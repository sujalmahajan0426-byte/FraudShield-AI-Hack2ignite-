"""
train.py — Train XGBoost fraud classifier on PaySim dataset.

Design decisions (all informed by repo analysis & council review):
- STATELESS features only (amount, type, oldbalanceOrg, oldbalanceDest + 3 derived)
  Stolen pattern: Bumerdene073's amount_vs_balance ratio; Rahul45f's scale_pos_weight calc
- NO newbalance* columns (PaySim documentation says these leak fraud labels)
- Stratified sampling to 200K rows if full 6.3M is too slow
- TreeExplainer background data saved for fast per-transaction SHAP at inference
- Outputs: model.joblib, explainer_background.joblib, metrics.json, feature_names.json
"""

import json
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# ── paths ──────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = Path(__file__).parent / "artifacts"
OUT_DIR.mkdir(exist_ok=True)

CSV_PATH = DATA_DIR / "paysim.csv"
SAMPLE_SIZE = 500_000  # stratified sample; set None to use full 6.3M


def load_and_sample(path: str, n: int | None = SAMPLE_SIZE) -> pd.DataFrame:
    """Load PaySim CSV; optionally stratified-sample down."""
    print(f"[1/6] Loading {path} ...")
    df = pd.read_csv(path)
    print(f"       Loaded {len(df):,} rows, {df['isFraud'].sum():,} fraud ({df['isFraud'].mean()*100:.3f}%)")

    if n and len(df) > n:
        print(f"[1/6] Stratified sampling to {n:,} rows ...")
        df, _ = train_test_split(
            df, train_size=n, stratify=df["isFraud"], random_state=42
        )
        print(f"       Sampled: {len(df):,} rows, {df['isFraud'].sum():,} fraud ({df['isFraud'].mean()*100:.3f}%)")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build authorization-time-only features. 7 total after one-hot.

    CRITICAL: We deliberately exclude newbalanceOrig/newbalanceDest.
    PaySim resets these columns as a simulation artifact on fraud rows,
    creating a near-perfect but fake signal. This leakage was identified
    during our planning review and avoiding it is a key differentiator
    in our presentation.

    Features (stolen patterns from repo analysis):
    - amount                    (raw transaction amount)
    - type                      (one-hot encoded: CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER)
    - oldbalanceOrg             (sender's balance before txn)
    - oldbalanceDest            (receiver's balance before txn)
    - amount_to_balance_ratio   (inspired by Bumerdene073's amount_vs_user_avg)
    - is_large_relative_tx      (inspired by Bumerdene073's is_high_amount threshold)
    - step_hour                 (time-of-day; inspired by MarvyGithub's is_early_morning)
    """
    print("[2/6] Engineering features ...")

    # ── Derived features ──
    df["amount_to_balance_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["is_large_relative_tx"] = (df["amount"] > 0.8 * df["oldbalanceOrg"]).astype(int)
    df["step_hour"] = df["step"] % 24

    # ── One-hot encode type ──
    type_dummies = pd.get_dummies(df["type"], prefix="type")
    df = pd.concat([df, type_dummies], axis=1)

    # ── Select only our approved features ──
    feature_cols = [
        "amount",
        "oldbalanceOrg",
        "oldbalanceDest",
        "amount_to_balance_ratio",
        "is_large_relative_tx",
        "step_hour",
    ]
    # Add all type_ one-hot columns
    type_cols = [c for c in df.columns if c.startswith("type_")]
    feature_cols.extend(sorted(type_cols))

    return df, feature_cols


def train_model(X_train, y_train, X_val, y_val):
    """
    Train XGBoost with scale_pos_weight for class imbalance.
    Pattern stolen from MarvyGithub: dynamic ratio of neg/pos samples.
    """
    print("[3/6] Training XGBoost ...")

    # Dynamic scale_pos_weight (from MarvyGithub pattern)
    n_legit = (y_train == 0).sum()
    n_fraud = (y_train == 1).sum()
    scale_pos_weight = n_legit / n_fraud
    print(f"       Class ratio: {n_legit:,} legit / {n_fraud:,} fraud = scale_pos_weight={scale_pos_weight:.1f}")

    model = XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",
        min_child_weight=5,
        subsample=0.8,
        colsample_bytree=0.8,
        gamma=1,
        random_state=42,
        use_label_encoder=False,
        n_jobs=-1,
    )

    t0 = time.time()
    model.fit(X_train, y_train, verbose=False)
    elapsed = time.time() - t0
    print(f"       Training completed in {elapsed:.1f}s (500 rounds)")

    return model


def evaluate_model(model, X_val, y_val):
    """Compute all metrics. Expect PR-AUC 0.85-0.95, NOT >0.99."""
    print("[4/6] Evaluating ...")

    y_proba = model.predict_proba(X_val)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    roc_auc = roc_auc_score(y_val, y_proba)
    pr_auc = average_precision_score(y_val, y_proba)
    f1 = f1_score(y_val, y_pred)

    print(f"       ROC-AUC:  {roc_auc:.4f}")
    print(f"       PR-AUC:   {pr_auc:.4f}")
    print(f"       F1-Score: {f1:.4f}")
    print()
    print(classification_report(y_val, y_pred, target_names=["Legit", "Fraud"]))

    # Find optimal threshold on precision-recall curve
    precision, recall, thresholds = precision_recall_curve(y_val, y_proba)
    f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
    best_idx = np.argmax(f1_scores)
    best_threshold = float(thresholds[best_idx])
    print(f"       Optimal threshold (max F1): {best_threshold:.4f}")

    metrics = {
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "f1_score": round(f1, 4),
        "optimal_threshold": round(best_threshold, 4),
        "n_train": int(len(y_val) * 4),  # approximate
        "n_val": int(len(y_val)),
        "fraud_rate_pct": round(y_val.mean() * 100, 3),
        "note": "newbalance* columns deliberately excluded to avoid PaySim data leakage",
    }
    return metrics


def save_shap_background(X_train, feature_cols):
    """
    Pre-compute SHAP background dataset (100 samples) for fast TreeExplainer.
    Stolen insight: Rahul45f's repo showed SHAP is in requirements but never
    called — we actually integrate it for real per-transaction explanations.
    """
    print("[5/6] Saving SHAP background data ...")
    import shap  # noqa: delayed import

    # Use 100 stratified samples as background for TreeExplainer
    bg = shap.sample(X_train, 100, random_state=42)
    joblib.dump(bg, OUT_DIR / "explainer_background.joblib")
    print(f"       Saved {len(bg)} background samples")


def main():
    print("=" * 60)
    print("  FT-02 Fraud Detection — Model Training Pipeline")
    print("  PaySim dataset, stateless features, no data leakage")
    print("=" * 60)
    print()

    # ── Load & sample ──
    df = load_and_sample(CSV_PATH)

    # ── Feature engineering ──
    df, feature_cols = engineer_features(df)
    print(f"       Features ({len(feature_cols)}): {feature_cols}")

    X = df[feature_cols].values
    y = df["isFraud"].values

    # ── Train/val split (80/20, stratified) ──
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"       Train: {len(X_train):,}  Val: {len(X_val):,}")

    # ── Train ──
    model = train_model(X_train, y_train, X_val, y_val)

    # ── Evaluate ──
    metrics = evaluate_model(model, X_val, y_val)

    # ── Save artifacts ──
    print("[6/6] Saving artifacts ...")
    joblib.dump(model, OUT_DIR / "model.joblib")
    print(f"       -> {OUT_DIR / 'model.joblib'}")

    with open(OUT_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"       -> {OUT_DIR / 'metrics.json'}")

    with open(OUT_DIR / "feature_names.json", "w") as f:
        json.dump(feature_cols, f, indent=2)
    print(f"       -> {OUT_DIR / 'feature_names.json'}")

    # ── SHAP background ──
    save_shap_background(
        pd.DataFrame(X_train, columns=feature_cols),
        feature_cols,
    )

    print()
    print("=" * 60)
    print("  [OK] Training complete! Artifacts saved to model/artifacts/")
    print("=" * 60)


if __name__ == "__main__":
    main()
