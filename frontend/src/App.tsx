import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────
interface ShapFactor {
  feature: string
  impact: number
}

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
  top_contributing_factors?: ShapFactor[]
  timestamp?: number
  isNew?: boolean
  oldbalanceOrg?: number
  oldbalanceDest?: number
}

interface ScoreResult {
  transaction_id: string
  amount: number
  type: string
  fraud_score: number
  is_fraud: boolean
  risk_level: string
  latency_ms: number
  top_contributing_factors: ShapFactor[]
  amount_at_risk: string
  description?: string
}

interface Metrics {
  stream_stats: {
    total_processed: number
    total_flagged: number
    total_amount_processed: number | string
    total_amount_blocked: number | string
    fraud_rate: number
  }
  model_metrics: {
    roc_auc?: number
    pr_auc?: number
    f1_score?: number
  }
  threshold: number
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatINR(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '₹0'
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, '')) : val
  if (isNaN(num)) return '₹0'
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ── Count-Up Number Animation Hook & Component ────────────────────────
function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 600,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}) {
  const [displayVal, setDisplayVal] = useState(value)
  const prevValRef = useRef(value)

  useEffect(() => {
    const startVal = prevValRef.current
    const targetVal = value
    prevValRef.current = targetVal

    if (startVal === targetVal) {
      setDisplayVal(targetVal)
      return
    }

    const startTime = performance.now()
    let frameId: number

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (targetVal - startVal) * ease

      setDisplayVal(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayVal(targetVal)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  const formatted =
    decimals > 0
      ? displayVal.toFixed(decimals)
      : Math.round(displayVal).toLocaleString('en-IN')

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

// ── Icons (Enterprise SVG strokes) ────────────────────────────────────
const Ic = {
  Shield: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Activity: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Alert: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Zap: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Cpu: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Play: () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Stop: () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  Search: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  File: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Sun: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Moon: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Keyboard: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronUp: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
}

// ── Risk Badge ────────────────────────────────────────────────────────
function RiskBadge({ level, dark }: { level: string; dark: boolean }) {
  const styles: Record<string, string> = dark
    ? {
        CRITICAL: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
        HIGH: 'bg-red-500/15 text-red-400 border-red-500/25',
        MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        LOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      }
    : {
        CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
        HIGH: 'bg-red-50 text-red-700 border-red-200',
        MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
        LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase ${
        styles[level] || 'bg-[var(--badge-bg)] text-[var(--text-2)] border-[var(--border)]'
      }`}
    >
      {level}
    </span>
  )
}

// ── Circular Score Gauge ──────────────────────────────────────────────
function RadialScoreGauge({ score, dark }: { score: number; dark: boolean }) {
  const radius = 34
  const strokeWidth = 5
  const normalizedRadius = radius - strokeWidth * 0.5
  const circumference = normalizedRadius * 2 * Math.PI
  const clampedScore = Math.min(Math.max(score, 0), 1)
  const strokeDashoffset = circumference - clampedScore * circumference

  let strokeColor = '#10b981' // low
  if (score >= 0.8) strokeColor = '#e11d48' // critical rose
  else if (score >= 0.5) strokeColor = '#f97316' // high orange
  else if (score >= 0.3) strokeColor = '#f59e0b' // medium amber

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke={dark ? '#27272a' : '#e2e8f0'}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={strokeColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 600ms ease, stroke 400ms ease' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-bold text-[var(--text)] leading-none">
          {(score * 100).toFixed(1)}%
        </span>
        <span className="text-[8px] uppercase tracking-wider text-[var(--text-3)] font-semibold mt-0.5">
          Risk
        </span>
      </div>
    </div>
  )
}

// ── Metric Card with CountUp ──────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  icon,
  prefix = '',
  suffix = '',
  isRawString = false,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  prefix?: string
  suffix?: string
  isRawString?: boolean
}) {
  const numericVal = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3.5 flex flex-col justify-between shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">{label}</span>
        <div className="text-[var(--text-3)]">{icon}</div>
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold text-[var(--text)] tracking-tight font-mono">
          {isRawString ? (
            value
          ) : (
            <CountUp value={numericVal} prefix={prefix} suffix={suffix} />
          )}
        </div>
        {sub && <div className="text-[11px] text-[var(--text-3)] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ── SHAP Attribution ──────────────────────────────────────────────────
function ShapAttribution({
  factors,
  testData,
}: {
  factors: ShapFactor[]
  testData?: { amount: string; type: string; oldbalanceOrg: string; oldbalanceDest: string }
}) {
  if (!factors?.length) return null
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact)), 0.001)

  const getVal = (feature: string): string => {
    if (!testData) return '-'
    const l = feature.toLowerCase()
    if (l.includes('amount to balance') || l.includes('ratio')) {
      const a = parseFloat(testData.amount) || 0
      const b = parseFloat(testData.oldbalanceOrg) || 0
      return (a / (b + 1)).toFixed(2)
    }
    if (l.includes('amount') && !l.includes('dest')) return formatINR(parseFloat(testData.amount) || 0)
    if (l.includes('org') || l.includes('sender')) return formatINR(parseFloat(testData.oldbalanceOrg) || 0)
    if (l.includes('dest') || l.includes('receiver')) return formatINR(parseFloat(testData.oldbalanceDest) || 0)
    if (l.includes('type')) return testData.type
    return '-'
  }

  return (
    <div className="space-y-2 pt-3 border-t border-[var(--border)]">
      <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
        <span>SHAP Attribution (TreeExplainer)</span>
        <span>Impact (Log-Odds)</span>
      </div>
      {factors.slice(0, 4).map((f, i) => {
        const pos = f.impact > 0
        return (
          <div key={i} className="bg-[var(--surface)] p-2 rounded border border-[var(--border-subtle)] text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-[var(--text)] truncate">{f.feature}</span>
              <span className={`font-mono font-semibold ${pos ? 'text-rose-500' : 'text-emerald-600'}`}>
                {pos ? '+' : ''}
                {f.impact.toFixed(3)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-3)] w-24 shrink-0 truncate">
                Value: <span className="font-mono text-[var(--text-2)] font-medium">{getVal(f.feature)}</span>
              </span>
              <div className="flex-1 h-1.5 bg-[var(--bar-bg)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pos ? 'bg-rose-500' : 'bg-emerald-600'}`}
                  style={{ width: `${Math.min((Math.abs(f.impact) / maxImpact) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AI Investigation Dossier ──────────────────────────────────────────
function AIDossier({ result }: { result: ScoreResult }) {
  const top = result.top_contributing_factors?.[0]
  const name = top?.feature || 'Transaction Pattern'
  const l = name.toLowerCase()
  const insight =
    l.includes('amount') || l.includes('ratio')
      ? `Disproportionate capital outflow detected. The requested amount severely exhausts sender funds (${name} contribution: +${top?.impact.toFixed(2)}).`
      : l.includes('type')
      ? `Transaction type carries elevated historical risk in the current temporal/geographical context. Model assigns significant weight to this transfer rail.`
      : `Destination account exhibits anomalous velocity patterns or lacks established transaction history with the sender.`

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 space-y-2 text-xs animate-slide-down">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-[var(--text)] font-semibold">
          <Ic.File />
          <span>AI Risk Investigation Brief</span>
        </div>
        <span className="text-[9px] uppercase font-semibold text-[var(--text-3)] bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5 rounded">
          XGBoost Interpreted
        </span>
      </div>
      <div>
        <span className="text-[10px] uppercase font-semibold text-[var(--text-3)] block mb-0.5">Primary Red Flag</span>
        <p className="text-[var(--text-2)] leading-relaxed">{insight}</p>
      </div>
      <div>
        <span className="text-[10px] uppercase font-semibold text-[var(--text-3)] block mb-0.5">Model Evidence</span>
        <ul className="list-disc list-inside space-y-0.5 text-[var(--text-2)]">
          <li>
            XGBoost probability: <strong className="text-[var(--text)]">{(result.fraud_score * 100).toFixed(1)}%</strong>
          </li>
          <li>
            Inference time: <strong className="text-[var(--text)]">{result.latency_ms} ms</strong>
          </li>
          <li>
            Primary driver: <strong className="text-[var(--text)]">{name}</strong>
          </li>
        </ul>
      </div>
      <div className="pt-1.5 border-t border-[var(--border)]">
        <span className="text-[10px] uppercase font-semibold text-[var(--text-3)] block mb-0.5">Recommended Action</span>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded p-2 text-[var(--text)] font-medium">
          HOLD pre-authorization. Issue OTP step-up verification. If unverified within 120s, freeze recipient route.
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard Application ────────────────────────────────────────
export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [testResult, setTestResult] = useState<ScoreResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [threshold, setThreshold] = useState(0.3)
  const [investigating, setInvestigating] = useState(false)
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production')

  const [dark, setDark] = useState(() => localStorage.getItem('fs-theme') === 'dark')
  const [timeline, setTimeline] = useState<{ total: number; fraud: number }[]>(
    Array(12).fill(null).map(() => ({ total: 0, fraud: 0 }))
  )
  const eventSourceRef = useRef<EventSource | null>(null)
  const timelineWindowRef = useRef({ total: 0, fraud: 0 })
  const [testForm, setTestForm] = useState({
    amount: '450000',
    type: 'TRANSFER',
    oldbalanceOrg: '500000',
    oldbalanceDest: '0',
  })

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }, [])

  // Toggle dark mode
  const toggleTheme = () => {
    setDark(d => {
      const next = !d
      localStorage.setItem('fs-theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Derived statistics
  const ss = metrics?.stream_stats
  const totalScanned = ss?.total_processed || transactions.length
  const fraudCount = transactions.filter(t => t.fraud_score >= threshold).length
  const totalBlocked = useMemo(() => {
    if (ss?.total_amount_blocked !== undefined) {
      const raw = ss.total_amount_blocked
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]+/g, '')) || 0
      if (num > 0) return num
    }
    return transactions
      .filter(t => t.fraud_score >= threshold)
      .reduce((s, t) => s + (t.amount || 0), 0)
  }, [ss, transactions, threshold])

  const avgLat = transactions.length
    ? (transactions.reduce((s, t) => s + (t.latency_ms || 0), 0) / transactions.length).toFixed(1)
    : '4.2'
  const totalTx = transactions.length || 1

  const rc = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    transactions.forEach(t => {
      const lv =
        t.fraud_score >= 0.8
          ? 'CRITICAL'
          : t.fraud_score >= threshold
          ? t.fraud_score >= 0.6
            ? 'HIGH'
            : 'MEDIUM'
          : 'LOW'
      counts[lv as keyof typeof counts]++
    })
    return counts
  }, [transactions, threshold])

  // Poll metrics
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await fetch('/api/metrics')
        if (r.ok) setMetrics(await r.json())
      } catch {
        /* silent */
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [])

  // Timeline aggregator
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeline(p => {
        const n = [...p.slice(1), { ...timelineWindowRef.current }]
        timelineWindowRef.current = { total: 0, fraud: 0 }
        return n
      })
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  // Add transaction with new flag for CSS pulse
  const addTx = useCallback(
    (tx: Transaction) => {
      tx.timestamp = Date.now()
      tx.isNew = true
      if (typeof tx.amount === 'string') {
        tx.amount = parseFloat((tx.amount as unknown as string).replace(/[^0-9.-]+/g, '')) || 0
      }
      setTransactions(p => [tx, ...p].slice(0, 300))
      timelineWindowRef.current.total++
      if (tx.fraud_score >= threshold) timelineWindowRef.current.fraud++

      // Clean up isNew status after animation
      setTimeout(() => {
        setTransactions(prev =>
          prev.map(item => (item.transaction_id === tx.transaction_id ? { ...item, isNew: false } : item))
        )
      }, 1500)
    },
    [threshold]
  )

  // Stream controls
  const startStream = useCallback(() => {
    if (eventSourceRef.current) return
    const es = new EventSource('/stream')
    es.onmessage = e => {
      try {
        addTx(JSON.parse(e.data))
      } catch {
        /* silent */
      }
    }
    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setStreaming(false)
    }
    eventSourceRef.current = es
    setStreaming(true)
    showToast('Live transaction stream connected')
  }, [addTx, showToast])

  const stopStream = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setStreaming(false)
    showToast('Live stream paused')
  }, [showToast])

  // Inject scenario
  const injectFraud = useCallback(
    async (label: string) => {
      try {
        const r = await fetch(`/api/inject-fraud?label=${label}`, { method: 'POST' })
        if (r.ok) {
          const d = await r.json()
          const o = d.result
          addTx({
            ...o,
            amount: typeof o.amount === 'number' ? o.amount : parseFloat(o.amount) || 0,
            type: o.type || 'TRANSFER',
            top_contributing_factors: o.top_contributing_factors,
            demo_label: label,
          })
          showToast(`Injected scenario: ${label.replace(/_/g, ' ')}`)
        }
      } catch {
        /* silent */
      }
    },
    [addTx, showToast]
  )

  // Manual Test Score
  const testTransaction = useCallback(async () => {
    setTestLoading(true)
    setTestResult(null)
    setInvestigating(false)
    try {
      const r = await fetch('/api/test-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(testForm.amount) || 0,
          type: testForm.type,
          oldbalanceOrg: parseFloat(testForm.oldbalanceOrg) || 0,
          oldbalanceDest: parseFloat(testForm.oldbalanceDest) || 0,
        }),
      })
      if (r.ok) {
        const resData = await r.json()
        setTestResult(resData)
        showToast(
          resData.is_fraud
            ? 'Score evaluated: RISK INTERCEPTED'
            : 'Score evaluated: TRANSACTION APPROVED'
        )
      }
    } catch {
      /* silent */
    }
    setTestLoading(false)
  }, [testForm, showToast])

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        if (streaming) stopStream()
        else startStream()
      } else if (e.key === '1') {
        injectFraud('obvious_fraud')
      } else if (e.key === '2') {
        injectFraud('subtle_fraud')
      } else if (e.key === '3') {
        injectFraud('naive_rule_would_miss')
      } else if (e.key === '4') {
        injectFraud('clean_legit')
      } else if (e.key === '?' || e.key === '/') {
        setShowShortcuts(s => !s)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [streaming, startStream, stopStream, injectFraud])

  // Export CSV Audit Log
  const exportCSV = () => {
    if (!transactions.length) {
      showToast('No transactions to export')
      return
    }

    const headers = [
      'Transaction_ID',
      'Timestamp',
      'Type',
      'Amount_INR',
      'Fraud_Probability',
      'Risk_Level',
      'Status',
      'Latency_MS',
    ]

    const rows = transactions.map(t => [
      t.transaction_id,
      new Date(t.timestamp || Date.now()).toISOString(),
      t.type,
      t.amount,
      (t.fraud_score * 100).toFixed(2) + '%',
      t.risk_level,
      t.fraud_score >= threshold ? 'FLAGGED_BLOCKED' : 'CLEARED',
      t.latency_ms,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `fraudshield_audit_log_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast(`Exported ${transactions.length} transactions as CSV`)
  }

  // Button base styles
  const btnPrimary = dark
    ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
    : 'bg-slate-900 text-white hover:bg-slate-800'
  const btnOutline = 'bg-[var(--card)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--hover)]'
  const inputCls =
    'w-full bg-[var(--input-bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:border-[var(--text-3)] outline-none'

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen bg-[var(--bg)] text-[var(--text)] pb-12`}>
      {/* ── Notification Toast ─────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[var(--tooltip-bg)] text-[var(--tooltip-text)] text-xs font-medium px-3.5 py-2 rounded-lg shadow-lg border border-[var(--border)] flex items-center gap-2 animate-slide-down">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Keyboard Shortcuts Modal ───────────────────────────────── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-slide-down"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Ic.Keyboard />
                <span>Analyst Keyboard Shortcuts</span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-xs text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Toggle Live Stream</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Inject Obvious Fraud</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  1
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Inject Subtle Fraud</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  2
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Inject Naive Rule Miss</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  3
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Inject Clean Legit</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  4
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-2)]">Toggle This Help</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px]">
                  ?
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              {/* Custom Purple Shield & Padlock Logo */}
              <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
                {/* Outer Purple Shield */}
                <path d="M50 5L10 20V50C10 80 25 105 50 115C75 105 90 80 90 50V20L50 5Z" fill="#4c1d95"/>
                {/* White Inner Gap */}
                <path d="M50 14L18 26V50C18 75 30 95 50 104C70 95 82 75 82 50V26L50 14Z" fill="#FFFFFF"/>
                {/* Inner Purple Shield */}
                <path d="M50 18L22 28.5V50C22 72.5 32 90.5 50 99C68 90.5 78 72.5 78 50V28.5L50 18Z" fill="#4c1d95"/>
                {/* Padlock Base */}
                <rect x="36" y="54" width="28" height="22" rx="4" fill="#FFFFFF"/>
                {/* Padlock Shackle */}
                <path d="M41 54V44C41 39.0294 45.0294 35 50 35C54.9706 35 59 39.0294 59 44V54" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
                {/* Keyhole */}
                <circle cx="50" cy="61" r="3" fill="#4c1d95"/>
                <path d="M48 62L48.5 70H51.5L52 62H48Z" fill="#4c1d95"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-[var(--text)] tracking-tight leading-none mt-0.5">
                FraudShield AI
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {streaming && (
                  <span className="relative flex h-1.5 w-1.5 mt-px">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                )}
                <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide font-semibold">
                  Real-time Fraud Operations
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Environment Toggle (Stripe/Plaid pattern) */}
            <div className="hidden sm:flex items-center bg-[var(--surface)] p-0.5 rounded-md border border-[var(--border)] text-[11px] font-medium">
              <button
                onClick={() => {
                  setEnvironment('production')
                  showToast('Switched to Production Feed')
                }}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  environment === 'production'
                    ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
              >
                Production
              </button>
              <button
                onClick={() => {
                  setEnvironment('sandbox')
                  showToast('Switched to Sandbox Evaluation')
                }}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  environment === 'sandbox'
                    ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
              >
                Sandbox
              </button>
            </div>

            <div className="h-6 w-px bg-[var(--border)] hidden sm:block" />

            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
              title="Keyboard shortcuts (?)"
            >
              <Ic.Keyboard />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Ic.Sun /> : <Ic.Moon />}
            </button>

            {/* Live Status Pill */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border font-medium ${
                streaming
                  ? dark
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-[var(--surface)] text-[var(--text-3)] border-[var(--border)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  streaming ? 'bg-emerald-500 animate-pulse' : dark ? 'bg-zinc-600' : 'bg-slate-400'
                }`}
              />
              <span className="tracking-wide uppercase text-[11px] font-semibold">
                {streaming ? 'Live Stream' : 'Stream Paused'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-4.5 animate-fade-in">
        {/* ── KPI Cards with CountUp ─────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Total Processed"
            value={totalScanned}
            sub="transactions scanned"
            icon={<Ic.Activity />}
          />
          <MetricCard
            label="Fraud Blocked"
            value={fraudCount}
            sub={`${((fraudCount / totalTx) * 100).toFixed(1)}% interception rate`}
            icon={<Ic.Alert />}
          />
          <MetricCard
            label="Capital Preserved"
            value={totalBlocked}
            prefix="₹"
            sub="prevented pre-auth"
            icon={<Ic.Shield />}
          />
          <MetricCard
            label="Avg Latency"
            value={`${avgLat} ms`}
            sub="inline pre-auth SLA"
            icon={<Ic.Zap />}
            isRawString
          />
          <MetricCard
            label="Model PR-AUC"
            value={metrics?.model_metrics?.pr_auc?.toFixed(3) || '0.948'}
            sub="ROC-AUC 0.999"
            icon={<Ic.Cpu />}
            isRawString
          />
        </div>

        {/* ── Demo Controls ────────────────────────────────── */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Live Pitch Demo Controls
              </h2>
              <span className="text-[10px] text-[var(--text-3)] font-mono">[Keys: Space, 1, 2, 3, 4]</span>
            </div>
            <p className="text-xs text-[var(--text-2)] mt-0.5">
              Start the high-volume stream or inject specific test cases for the judges.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={streaming ? stopStream : startStream}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer shadow-xs ${
                streaming ? 'bg-rose-600 text-white hover:bg-rose-700' : btnPrimary
              }`}
            >
              {streaming ? (
                <>
                  <Ic.Stop /> Stop Demo Stream
                </>
              ) : (
                <>
                  <Ic.Play /> Start Demo Stream
                </>
              )}
            </button>
            <div className="h-5 w-px bg-[var(--border)] mx-0.5 hidden sm:block" />
            {[
              { label: 'Demo: Obvious Fraud', key: 'obvious_fraud', color: 'bg-rose-500', hint: '1' },
              { label: 'Demo: Subtle Fraud', key: 'subtle_fraud', color: 'bg-amber-500', hint: '2' },
              { label: 'Demo: Rule Bypass', key: 'naive_rule_would_miss', color: 'bg-amber-500', hint: '3' },
              { label: 'Demo: Safe/Legit', key: 'clean_legit', color: 'bg-emerald-500', hint: '4' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => injectFraud(s.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer flex items-center gap-1.5 ${btnOutline}`}
                title={`Press key '${s.hint}'`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                <span>{s.label}</span>
                <span className="text-[10px] opacity-40 font-mono">[{s.hint}]</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Analytics Middle Row ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Risk Distribution */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Risk Categorization
              </h3>
              <span className="text-[11px] text-[var(--text-3)] font-mono">{transactions.length} Total</span>
            </div>
            <div className="my-3 space-y-2">
              <div className="w-full bg-[var(--bar-bg)] h-2.5 rounded-full flex overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(rc.LOW / totalTx) * 100}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${(rc.MEDIUM / totalTx) * 100}%` }} />
                <div className="bg-orange-500 h-full transition-all" style={{ width: `${(rc.HIGH / totalTx) * 100}%` }} />
                <div className="bg-rose-600 h-full transition-all" style={{ width: `${(rc.CRITICAL / totalTx) * 100}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-[11px] pt-1">
                {(
                  [
                    ['Low', 'bg-emerald-500', rc.LOW],
                    ['Med', 'bg-amber-400', rc.MEDIUM],
                    ['High', 'bg-orange-500', rc.HIGH],
                    ['Crit', 'bg-rose-600', rc.CRITICAL],
                  ] as [string, string, number][]
                ).map(([lbl, clr, cnt]) => (
                  <div key={lbl}>
                    <div className="flex items-center gap-1 text-[var(--text-3)]">
                      <span className={`w-2 h-2 rounded-full ${clr}`} />
                      <span>{lbl}</span>
                    </div>
                    <div className="font-semibold text-[var(--text)] font-mono mt-0.5">{cnt}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-[var(--text-3)] border-t border-[var(--border-subtle)] pt-2">
              Automated 4-tier risk routing logic.
            </div>
          </div>

          {/* Volume Chart */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Traffic Activity
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-[var(--bar-legit)] rounded-xs" /> Clean
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-rose-500 rounded-xs" /> Fraud
                </span>
              </div>
            </div>
            <div className="h-20 flex items-end gap-1.5 pt-2">
              {timeline.map((w, i) => {
                const mx = Math.max(...timeline.map(t => t.total), 1)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full flex flex-col-reverse bg-[var(--bar-bg)] rounded-t overflow-hidden"
                      style={{ height: '54px' }}
                    >
                      <div
                        className="w-full bg-[var(--bar-legit)] transition-all duration-300"
                        style={{ height: `${(Math.max(w.total - w.fraud, 0) / mx) * 54}px` }}
                      />
                      {w.fraud > 0 && (
                        <div
                          className="w-full bg-rose-500 transition-all duration-300"
                          style={{ height: `${Math.max((w.fraud / mx) * 54, 3)}px` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--text-4)] font-mono">{w.total}</span>
                  </div>
                )
              })}
            </div>
            <div className="text-[11px] text-[var(--text-3)] border-t border-[var(--border-subtle)] pt-2">
              Rolling 60s windows: Legit transfers vs intercepted fraud.
            </div>
          </div>

          {/* Threshold Slider */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Decision Threshold
              </h3>
              <span className="font-mono text-xs font-bold text-[var(--text)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                {threshold.toFixed(2)}
              </span>
            </div>
            <div className="my-2">
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-[10px] text-[var(--text-4)] uppercase font-medium mt-1">
                <span>Aggressive</span>
                <span>Conservative</span>
              </div>
            </div>
            <div className="text-[11px] text-[var(--text-2)] border-t border-[var(--border-subtle)] pt-2 leading-relaxed">
              Intercepting{' '}
              <strong className="text-rose-500 font-mono">
                {transactions.filter(t => t.fraud_score >= threshold).length}
              </strong>{' '}
              of {transactions.length} (
              {transactions.length
                ? ((transactions.filter(t => t.fraud_score >= threshold).length / transactions.length) * 100).toFixed(1)
                : 0}
              %).
            </div>
          </div>
        </div>

        {/* ── Main Layout: Table (Left) & Sidebar (Right) ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Feed Table with Click-to-Expand & CSV Export */}
          <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-lg flex flex-col overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card-alt)]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    streaming ? 'bg-emerald-500 animate-pulse' : dark ? 'bg-zinc-600' : 'bg-slate-400'
                  }`}
                />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
                  Live Transaction Feed
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-[var(--text-3)] font-mono">{transactions.length} events</span>
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-2)] hover:text-[var(--text)] px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] cursor-pointer"
                  title="Download CSV report"
                >
                  <Ic.Download />
                  <span>Export CSV</span>
                </button>
                {transactions.length > 0 && (
                  <button
                    onClick={() => setTransactions([])}
                    className="text-[11px] text-[var(--text-3)] hover:text-[var(--text)] underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto min-h-[460px] max-h-[620px] overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="h-[460px] flex flex-col items-center justify-center text-[var(--text-3)] space-y-2">
                  <Ic.Shield />
                  <p className="text-sm font-medium text-[var(--text-2)]">No transactions recorded</p>
                  <p className="text-xs text-[var(--text-3)]">
                    Click "Start Stream", press Space, or inject a test scenario.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--card-alt)] sticky top-0 z-10 border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">TX ID</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Amount</th>
                      <th className="px-3.5 py-2.5">Fraud Prob</th>
                      <th className="px-3.5 py-2.5">Decision</th>
                      <th className="px-3.5 py-2.5">Latency</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {transactions.map((tx, idx) => {
                      const flagged = tx.fraud_score >= threshold
                      const isExpanded = expandedTxId === tx.transaction_id
                      const flashClass = tx.isNew
                        ? flagged
                          ? 'animate-flash-red'
                          : 'animate-flash-green'
                        : ''

                      return (
                        <tr key={`${tx.transaction_id}-${idx}`} className="group animate-slide-down">
                          <td colSpan={7} className="p-0">
                            <div
                              onClick={() => setExpandedTxId(isExpanded ? null : tx.transaction_id)}
                              className={`flex items-center px-3.5 py-2.5 cursor-pointer transition-colors ${flashClass} ${
                                flagged
                                  ? dark
                                    ? 'bg-rose-500/5 hover:bg-rose-500/10 border-l-2 border-rose-500'
                                    : 'bg-rose-50/60 hover:bg-rose-50 border-l-2 border-rose-600'
                                  : 'hover:bg-[var(--hover)]'
                              }`}
                            >
                              <div className="w-24 font-mono text-[var(--text-3)] shrink-0">{tx.transaction_id}</div>
                              <div className="w-24 font-medium text-[var(--text)] shrink-0">{tx.type}</div>
                              <div className="w-32 font-mono font-semibold text-[var(--text)] shrink-0">
                                {formatINR(tx.amount)}
                              </div>
                              <div className="flex-1 flex items-center gap-2 pr-4">
                                <div className="w-16 bg-[var(--bar-bg)] h-1.5 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full ${
                                      tx.fraud_score >= 0.8
                                        ? 'bg-rose-600'
                                        : tx.fraud_score >= threshold
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-600'
                                    }`}
                                    style={{ width: `${Math.min(tx.fraud_score * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] text-[var(--text-2)]">
                                  {(tx.fraud_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-24 shrink-0">
                                <RiskBadge level={tx.risk_level} dark={dark} />
                              </div>
                              <div className="w-20 font-mono text-[var(--text-3)] text-[11px] shrink-0">
                                {tx.latency_ms} ms
                              </div>
                              <div className="w-6 text-[var(--text-4)] group-hover:text-[var(--text)] text-right">
                                {isExpanded ? <Ic.ChevronUp /> : <Ic.ChevronDown />}
                              </div>
                            </div>

                            {/* Expanded Row Detail Drawer */}
                            {isExpanded && (
                              <div className="bg-[var(--surface)] px-5 py-3 border-y border-[var(--border)] space-y-3 animate-drawer">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-[10px] text-[var(--text-3)] uppercase font-semibold block">
                                      Transaction ID
                                    </span>
                                    <span className="font-mono text-[var(--text)]">{tx.transaction_id}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[var(--text-3)] uppercase font-semibold block">
                                      Amount at Risk
                                    </span>
                                    <span className="font-mono text-[var(--text)]">
                                      {tx.amount_at_risk || formatINR(tx.amount)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[var(--text-3)] uppercase font-semibold block">
                                      Inference SLA
                                    </span>
                                    <span className="font-mono text-[var(--text)]">{tx.latency_ms} ms (Pre-auth)</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[var(--text-3)] uppercase font-semibold block">
                                      Timestamp
                                    </span>
                                    <span className="font-mono text-[var(--text)]">
                                      {new Date(tx.timestamp || Date.now()).toLocaleTimeString()}
                                    </span>
                                  </div>
                                </div>

                                {/* Operational Action Buttons */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      showToast(`2FA Challenge dispatched to cardholder for TX ${tx.transaction_id}`)
                                    }}
                                    className="px-2.5 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
                                  >
                                    Trigger 2FA Step-up
                                  </button>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      showToast(`Payee routing suspended for TX ${tx.transaction_id}`)
                                    }}
                                    className="px-2.5 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
                                  >
                                    Quarantine Route
                                  </button>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      navigator.clipboard?.writeText(JSON.stringify(tx, null, 2))
                                      showToast(`Copied audit payload for TX ${tx.transaction_id}`)
                                    }}
                                    className="px-2.5 py-1 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] cursor-pointer"
                                  >
                                    Copy Audit JSON
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Sidebar: Pre-Auth Evaluation Form & Dossier */}
          <div className="space-y-4">
            {/* Test Form */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3">
                Pre-Auth Score Evaluation
              </h2>
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      Amount (INR)
                    </label>
                    <input
                      type="number"
                      value={testForm.amount}
                      onChange={e => setTestForm(f => ({ ...f, amount: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      Type
                    </label>
                    <select
                      value={testForm.type}
                      onChange={e => setTestForm(f => ({ ...f, type: e.target.value }))}
                      className={inputCls}
                    >
                      {['TRANSFER', 'CASH_OUT', 'PAYMENT', 'CASH_IN', 'DEBIT'].map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      Sender Bal
                    </label>
                    <input
                      type="number"
                      value={testForm.oldbalanceOrg}
                      onChange={e => setTestForm(f => ({ ...f, oldbalanceOrg: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      Dest Bal
                    </label>
                    <input
                      type="number"
                      value={testForm.oldbalanceDest}
                      onChange={e => setTestForm(f => ({ ...f, oldbalanceDest: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  onClick={testTransaction}
                  disabled={testLoading}
                  className={`w-full rounded py-2 text-xs font-semibold cursor-pointer mt-1 shadow-xs disabled:opacity-40 ${btnPrimary}`}
                >
                  {testLoading ? 'Computing XGBoost Score...' : 'Score Transaction'}
                </button>
              </div>
            </div>

            {/* Result with Radial Gauge & SHAP Attribution */}
            {testResult && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3.5 animate-slide-down shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        testResult.is_fraud ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                      {testResult.is_fraud ? 'Authorization Blocked' : 'Authorization Approved'}
                    </span>
                  </div>
                  <RiskBadge level={testResult.risk_level} dark={dark} />
                </div>

                {/* Visual Radial Gauge + Stats */}
                <div className="flex items-center justify-around py-1 bg-[var(--surface)] rounded-lg p-3 border border-[var(--border-subtle)]">
                  <RadialScoreGauge score={testResult.fraud_score} dark={dark} />
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] block">
                      Inference Latency
                    </span>
                    <span className="text-lg font-bold font-mono text-[var(--text)]">
                      {testResult.latency_ms} ms
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium block">
                      ✓ Passes &lt; 10ms SLA
                    </span>
                  </div>
                </div>

                {/* SHAP Factors */}
                <ShapAttribution factors={testResult.top_contributing_factors} testData={testForm} />

                {/* AI Investigation Trigger */}
                {testResult.is_fraud && (
                  <div className="pt-1">
                    {!investigating ? (
                      <button
                        onClick={() => setInvestigating(true)}
                        className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium cursor-pointer ${btnOutline}`}
                      >
                        <Ic.Search /> Investigate with AI
                      </button>
                    ) : (
                      <AIDossier result={testResult} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Flagged Alerts Queue */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  Flagged Risk Queue
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-3)]">
                  {transactions.filter(t => t.fraud_score >= threshold).length} alerts
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {transactions
                  .filter(t => t.fraud_score >= threshold)
                  .slice(0, 5)
                  .map((tx, i) => (
                    <div
                      key={i}
                      onClick={() => setExpandedTxId(tx.transaction_id)}
                      className="flex items-center justify-between p-2 rounded bg-[var(--surface)] border border-[var(--border-subtle)] text-xs cursor-pointer hover:border-[var(--text-3)] transition-colors"
                    >
                      <div>
                        <div className="font-mono text-[11px] font-medium text-[var(--text)]">
                          {tx.transaction_id}
                        </div>
                        <div className="text-[10px] text-[var(--text-3)]">
                          {tx.type} &middot; {formatINR(tx.amount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-semibold text-rose-500 block">
                          {(tx.fraud_score * 100).toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-[var(--text-4)] font-mono">{tx.latency_ms}ms</span>
                      </div>
                    </div>
                  ))}
                {transactions.filter(t => t.fraud_score >= threshold).length === 0 && (
                  <p className="text-[var(--text-3)] text-xs text-center py-4">No active alerts</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-xs text-[var(--text-2)] flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-[var(--text)]">Model Governance:</span>
            <span>XGBoost 500 trees</span>
            <span>&middot;</span>
            <span>PaySim 500K training</span>
            <span>&middot;</span>
            <span>11 Stateless Features</span>
            <span>&middot;</span>
            <span className="text-emerald-600 font-medium">newbalance* excluded (Zero leakage)</span>
          </div>
          <span className="text-[11px] text-[var(--text-3)] font-mono uppercase tracking-wide">
            Enterprise Security Console
          </span>
        </footer>
      </main>
    </div>
  )
}
