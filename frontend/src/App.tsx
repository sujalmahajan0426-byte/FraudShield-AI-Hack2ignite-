import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────
interface Transaction {
  transaction_id: string
  amount: number
  type: string
  fraud_score: number
  is_fraud: boolean
  risk_level: string
  latency_ms: number
  amount_at_risk: string
  demo_label?: string
}

interface ShapFactor {
  feature: string
  impact: number
}

interface ScoreResult {
  transaction_id: string
  fraud_score: number
  is_fraud: boolean
  risk_level: string
  latency_ms: number
  top_contributing_factors: ShapFactor[]
  amount_at_risk: string
}

interface Metrics {
  stream_stats: {
    total_processed: number
    total_flagged: number
    total_amount_processed: string
    total_amount_blocked: string
    fraud_rate: number
  }
  model_metrics: {
    roc_auc?: number
    pr_auc?: number
    f1_score?: number
  }
  threshold: number
}

// ── KPI Card (Bumerdene073 pattern + Rahul45f styling) ────────────────
function KPICard({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon: string
}) {
  return (
    <div className={`bg-gray-900 border-l-4 ${color} rounded-lg p-4 flex items-center gap-3`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}

// ── Risk Badge ────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-yellow-500 text-black',
    LOW: 'bg-green-600 text-white',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[level] || 'bg-gray-500'}`}>
      {level}
    </span>
  )
}

// ── SHAP Bar Chart (horizontal bar — council decision over waterfall) ─
function ShapBars({ factors }: { factors: ShapFactor[] }) {
  if (!factors.length) return null
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact)), 0.001)

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400 font-semibold mb-1">Top Contributing Factors (SHAP)</p>
      {factors.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-36 text-right text-gray-300 truncate">{f.feature}</span>
          <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full rounded ${f.impact > 0 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${(Math.abs(f.impact) / maxImpact) * 100}%` }}
            />
          </div>
          <span className={`w-14 text-right ${f.impact > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {f.impact > 0 ? '+' : ''}{f.impact.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Transaction Row ───────────────────────────────────────────────────
function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <tr className={`border-b border-gray-800 ${tx.is_fraud ? 'bg-red-950/30' : ''}`}>
      <td className="px-3 py-2 font-mono text-xs text-gray-400">{tx.transaction_id}</td>
      <td className="px-3 py-2 text-sm">{tx.type}</td>
      <td className="px-3 py-2 text-sm font-mono">₹{tx.amount.toLocaleString()}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full rounded ${tx.fraud_score > 0.5 ? 'bg-red-500' : tx.fraud_score > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${tx.fraud_score * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono">{(tx.fraud_score * 100).toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-3 py-2"><RiskBadge level={tx.risk_level} /></td>
      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{tx.latency_ms}ms</td>
      <td className="px-3 py-2 text-xs font-semibold text-red-400">{tx.is_fraud ? tx.amount_at_risk : '-'}</td>
    </tr>
  )
}

// ── Main App ──────────────────────────────────────────────────────────
export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [testResult, setTestResult] = useState<ScoreResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Test form state — 4 fields (council decision)
  const [testForm, setTestForm] = useState({
    amount: '15000',
    type: 'TRANSFER',
    oldbalanceOrg: '20000',
    oldbalanceDest: '100',
  })

  // Poll metrics every 3s (Rahul45f pattern)
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/metrics')
        if (res.ok) setMetrics(await res.json())
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(poll)
  }, [])

  // SSE Stream
  const startStream = () => {
    if (eventSourceRef.current) return
    const es = new EventSource('/stream')
    es.onmessage = (e) => {
      const tx: Transaction = JSON.parse(e.data)
      setTransactions(prev => [tx, ...prev].slice(0, 100))
    }
    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setStreaming(false)
    }
    eventSourceRef.current = es
    setStreaming(true)
  }

  const stopStream = () => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setStreaming(false)
  }

  // Inject fraud (Rahul45f simulator panel pattern)
  const injectFraud = async (label: string) => {
    try {
      const res = await fetch(`/api/inject-fraud?label=${label}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        const tx: Transaction = { ...data.result, amount: data.result.amount || 0, type: data.result.type || 'TRANSFER' }
        setTransactions(prev => [tx, ...prev].slice(0, 100))
      }
    } catch { /* ignore */ }
  }

  // Test transaction (interactive form)
  const testTransaction = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/test-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(testForm.amount),
          type: testForm.type,
          oldbalanceOrg: parseFloat(testForm.oldbalanceOrg),
          oldbalanceDest: parseFloat(testForm.oldbalanceDest),
        }),
      })
      if (res.ok) {
        const result: ScoreResult = await res.json()
        setTestResult(result)
      }
    } catch { /* ignore */ }
    setTestLoading(false)
  }

  const ss = metrics?.stream_stats

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🛡️ FraudShield AI</h1>
            <p className="text-gray-400 text-sm">Real-time AI-Powered Fraud Detection — Hack2Ignite FT-02</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${streaming ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-sm text-gray-400">{streaming ? 'Live' : 'Paused'}</span>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards (Bumerdene073 pattern) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Scanned" value={ss?.total_processed || 0} color="border-blue-500" icon="📊" />
          <KPICard label="Fraud Blocked" value={ss?.total_flagged || 0} color="border-red-500" icon="🚫" />
          <KPICard label="Amount Processed" value={ss?.total_amount_processed || '₹0'} color="border-green-500" icon="💰" />
          <KPICard label="₹ Saved (Blocked)" value={ss?.total_amount_blocked || '₹0'} color="border-yellow-500" icon="🛡️" />
        </div>

        {/* Model Performance Badge */}
        {metrics?.model_metrics?.pr_auc && (
          <div className="bg-gray-900 rounded-lg p-3 flex items-center gap-6 text-sm">
            <span className="text-gray-400">Model Performance:</span>
            <span>PR-AUC: <b className="text-green-400">{metrics.model_metrics.pr_auc}</b></span>
            <span>ROC-AUC: <b className="text-blue-400">{metrics.model_metrics.roc_auc}</b></span>
            <span>F1: <b className="text-yellow-400">{metrics.model_metrics.f1_score}</b></span>
            <span>Threshold: <b className="text-gray-300">{metrics.threshold}</b></span>
          </div>
        )}

        {/* Controls — Rahul45f simulator panel pattern */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">🎮 Simulator Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={streaming ? stopStream : startStream}
              className={`px-4 py-2 rounded text-sm font-bold ${streaming ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {streaming ? '⏹ Stop Stream' : '▶ Start Live Stream'}
            </button>
            <button onClick={() => injectFraud('obvious_fraud')}
              className="px-3 py-2 rounded text-sm bg-red-900 hover:bg-red-800 border border-red-700">
              💥 Inject Obvious Fraud
            </button>
            <button onClick={() => injectFraud('subtle_fraud')}
              className="px-3 py-2 rounded text-sm bg-orange-900 hover:bg-orange-800 border border-orange-700">
              🔍 Inject Subtle Fraud
            </button>
            <button onClick={() => injectFraud('naive_rule_would_miss')}
              className="px-3 py-2 rounded text-sm bg-yellow-900 hover:bg-yellow-800 border border-yellow-700">
              🎯 Naive Rule Fails
            </button>
            <button onClick={() => injectFraud('clean_legit')}
              className="px-3 py-2 rounded text-sm bg-green-900 hover:bg-green-800 border border-green-700">
              ✅ Clean Legit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Transaction Feed */}
          <div className="lg:col-span-2 bg-gray-900 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-sm">📡 Live Transaction Feed</h2>
              <span className="text-xs text-gray-500">{transactions.length} transactions</span>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">ID</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">Type</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">Amount</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">Fraud Score</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">Risk</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">Latency</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400">₹ At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <TransactionRow key={`${tx.transaction_id}-${i}`} tx={tx} />
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                      Click "Start Live Stream" or inject a demo transaction
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Test Transaction Panel — 4 fields (council decision) */}
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="font-bold text-sm mb-3">🧪 Test a Transaction</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400">Amount (₹)</label>
                  <input
                    type="number"
                    value={testForm.amount}
                    onChange={e => setTestForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Type</label>
                  <select
                    value={testForm.type}
                    onChange={e => setTestForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1"
                  >
                    {['CASH_IN', 'CASH_OUT', 'DEBIT', 'PAYMENT', 'TRANSFER'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Sender Balance (₹)</label>
                  <input
                    type="number"
                    value={testForm.oldbalanceOrg}
                    onChange={e => setTestForm(f => ({ ...f, oldbalanceOrg: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Receiver Balance (₹)</label>
                  <input
                    type="number"
                    value={testForm.oldbalanceDest}
                    onChange={e => setTestForm(f => ({ ...f, oldbalanceDest: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1"
                  />
                </div>
                <button
                  onClick={testTransaction}
                  disabled={testLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded py-2 text-sm font-bold"
                >
                  {testLoading ? 'Scoring...' : '🔍 Score Transaction'}
                </button>
              </div>
            </div>

            {/* Test Result with SHAP */}
            {testResult && (
              <div className={`rounded-lg p-4 ${testResult.is_fraud ? 'bg-red-950 border border-red-800' : 'bg-green-950 border border-green-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold">
                    {testResult.is_fraud ? '🚨 FRAUD DETECTED' : '✅ LEGITIMATE'}
                  </span>
                  <RiskBadge level={testResult.risk_level} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-400">Score:</span>{' '}
                    <span className="font-bold">{(testResult.fraud_score * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Latency:</span>{' '}
                    <span className="font-mono">{testResult.latency_ms}ms</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">₹ At Risk:</span>{' '}
                    <span className="font-bold text-red-400">{testResult.amount_at_risk}</span>
                  </div>
                </div>
                <ShapBars factors={testResult.top_contributing_factors} />
              </div>
            )}

            {/* Flagged Alerts Preview */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="font-bold text-sm mb-2">🚨 Recent Fraud Alerts</h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.filter(t => t.is_fraud).slice(0, 5).map((tx, i) => (
                  <div key={i} className="bg-red-950/50 border border-red-900 rounded p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-mono">{tx.transaction_id}</span>
                      <span className="text-red-400 font-bold">{tx.amount_at_risk}</span>
                    </div>
                    <div className="text-gray-400 mt-1">{tx.type} — Score: {(tx.fraud_score * 100).toFixed(1)}%</div>
                  </div>
                ))}
                {transactions.filter(t => t.is_fraud).length === 0 && (
                  <p className="text-gray-600 text-xs">No fraud detected yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
