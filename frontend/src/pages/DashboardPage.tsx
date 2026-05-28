import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  ComposedChart, ReferenceLine, Scatter, ZAxis,
} from 'recharts'

// FR-10 / FR-11: All metrics server-side from IDashboardAggregationService (Contract 2)
// No client-side aggregation — display only

interface WipSummary {
  registeredToday: number; inTesting: number; completedToday: number
  testsPending: number; testsInProgress: number; testsCompleted: number; overdue: number
  analystWorkloads: { analystId: number; fullName: string; assignedCount: number }[]
}
interface TatSummary {
  avgTatHours: number; targetHours: number; breachCount: number; periodDays: number
  byAnalyst: { analystId: number; fullName: string; avgTatHours: number }[]
}
interface QualityKpis {
  oosRate: number; ootRate: number; rftRate: number; retestRate: number; openCapas: number; periodDays: number
}
interface InstrumentBoardItem {
  instrumentId: number; instrumentCode: string; instrumentType: string; statusText: string
  calibrationDue: string; calDaysRemaining: number; openBreakdownId: number | null; latestUtilPct: number | null
}
interface ComplianceSummary {
  totalAuditEvents: number; openOos: number; closedOos: number; totalSignatures: number; systemStatus: string
}
interface RecentSample {
  sampleId: number; sampleNumber: string; materialName: string; status: string; createdAt: string
}
interface RecentTask {
  executionId: number; sampleNumber: string; materialName: string; status: string; analystName: string
}
interface SamplePipelineItem { status: string; count: number; color: string }
interface SampleTrendPoint   { date: string; count: number }
interface OosTrendPoint      { date: string; oosCount: number; totalCount: number; rate: number }
interface CoaHistoryItem {
  coaId: number; coaNumber: string; sampleNumber: string; materialName: string
  status: string; qaDecision: string | null; qaSignedBy: string | null
  qaSignedAt: string | null; createdAt: string
}

// SPC interfaces
interface ParameterDto { parameterId: number; parameterCode: string; parameterName: string; unit?: string }
interface SpcDataPoint { executionId: number; sampleNumber: string; measuredAt: string; value: number; isOos: boolean; isOot: boolean }
interface SpcResult {
  parameterId: number; parameterName: string; unit?: string
  n: number; mean: number; stddev: number; ucl: number; lcl: number
  usl?: number; lsl?: number; cp?: number; cpk?: number
  outOfControl: boolean; rules: string[]; points: SpcDataPoint[]
}

type Tab = 'overview' | 'quality' | 'instruments' | 'compliance'

// ── Teal palette ──────────────────────────────────────────────────────────
const T = {
  primary:  '#0d6e6e',
  primary2: '#0a4f4f',
  light:    '#f0fdfa',
  border:   '#99f6e4',
  teal600:  '#0d9488',
}

// ── SVG icon paths ────────────────────────────────────────────────────────
const ICONS = {
  flask:      'M9 3h6m-3 0v6l3 12H6L9 9V3M6 15h12',
  check:      'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  percent:    'M19 5L5 19M9 6.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm10 11a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  instrument: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  capa:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  signature:  'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  clock:      'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chart:      'M3 3v18h18M7 16l4-4 4 4 4-7',
  shield:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  alert:      'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  users:      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
}

// ── KPI card with left accent bar + right icon watermark ──────────────────
function KpiCard({ label, value, sub, accent, badge, icon }: {
  label: string; value: string | number; sub?: string; icon?: keyof typeof ICONS
  accent: 'teal' | 'green' | 'amber' | 'red' | 'violet' | 'slate'
  badge?: { text: string; type: 'ok' | 'warn' | 'bad' | 'neutral' }
}) {
  const [hovered, setHovered] = useState(false)
  const bars: Record<string, string> = {
    teal: T.primary, green: '#22c55e', amber: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', slate: '#94a3b8',
  }
  const iconTints: Record<string, string> = {
    teal: '#0d6e6e', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', slate: '#94a3b8',
  }
  const badgeStyles: Record<string, React.CSSProperties> = {
    ok:      { background: '#dcfce7', color: '#16a34a' },
    warn:    { background: '#fef9c3', color: '#b45309' },
    bad:     { background: '#fee2e2', color: '#dc2626' },
    neutral: { background: '#f1f5f9', color: '#64748b' },
  }
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
        padding: '18px 18px 16px 22px', flex: '1 1 160px',
        position: 'relative', overflow: 'hidden',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.18s, transform 0.18s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'default',
      }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: bars[accent], borderRadius: '10px 0 0 10px' }} />
      {/* Right watermark icon */}
      {icon && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.07, pointerEvents: 'none' }}>
          <svg viewBox="0 0 24 24" fill="none" width="52" height="52">
            <path d={ICONS[icon]} stroke={iconTints[accent]} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, color: '#111111', lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#80868b' }}>{sub}</p>}
      {badge && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 8, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, ...badgeStyles[badge.type] }}>
          {badge.text}
        </span>
      )}
    </div>
  )
}

// ── Stat strip item with icon bubble ─────────────────────────────────────
function StatItem({ value, label, valueColor, iconPath, iconBg, iconColor, last }: {
  value: string | number; label: string; valueColor: string
  iconPath: string; iconBg: string; iconColor: string; last?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 24px',
        borderRight: last ? 'none' : '1px solid #f1f3f4',
        background: hov ? '#f8f9fa' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'default',
      }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, background: iconBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
          <path d={iconPath} stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: valueColor, lineHeight: 1, letterSpacing: '-0.02em' }}>{String(value)}</div>
        <div style={{ fontSize: 12, color: '#5f6368', marginTop: 4, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────
function SectionHead({ title, tag }: { title: string; tag?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 18, background: T.primary, borderRadius: 4 }} />
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em' }}>{title}</h3>
      </div>
      {tag && <span style={{ fontSize: 11, color: '#80868b', background: '#f8f9fa', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: 20, fontWeight: 500 }}>{tag}</span>}
    </div>
  )
}

// ── Table styles ──────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e0e0e0', background: '#f8f9fa' }
const td: React.CSSProperties = { padding: '11px 14px', color: '#111111', borderBottom: '1px solid #f1f3f4', fontSize: 14 }

const instColour = (s: string) => {
  if (s === 'Available')        return { bg: '#dcfce7', color: '#15803d' }
  if (s === 'InUse')            return { bg: '#dbeafe', color: '#1d4ed8' }
  if (s === 'Maintenance')      return { bg: '#fef9c3', color: '#b45309' }
  if (s === 'OutOfCalibration') return { bg: '#fee2e2', color: '#b91c1c' }
  return { bg: '#f1f5f9', color: '#374151' }
}

export default function DashboardPage() {
  const fullName = useSelector((s: RootState) => s.auth.fullName)

  const [wip,           setWip]           = useState<WipSummary | null>(null)
  const [tat,           setTat]           = useState<TatSummary | null>(null)
  const [kpis,          setKpis]          = useState<QualityKpis | null>(null)
  const [board,         setBoard]         = useState<InstrumentBoardItem[]>([])
  const [comp,          setComp]          = useState<ComplianceSummary | null>(null)
  const [recentSamples, setRecentSamples] = useState<RecentSample[]>([])
  const [recentTasks,   setRecentTasks]   = useState<RecentTask[]>([])
  const [pipeline,      setPipeline]      = useState<SamplePipelineItem[]>([])
  const [sampleTrend,   setSampleTrend]   = useState<SampleTrendPoint[]>([])
  const [oosTrend,      setOosTrend]      = useState<OosTrendPoint[]>([])
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState<Tab>('overview')
  // SPC state
  const [spcParams,   setSpcParams]   = useState<ParameterDto[]>([])
  const [spcParamId,  setSpcParamId]  = useState<number | null>(null)
  const [spcPoints,   setSpcPoints]   = useState<50 | 100 | 200>(50)
  const [spcData,     setSpcData]     = useState<SpcResult | null>(null)
  const [spcLoading,  setSpcLoading]  = useState(false)
  // CoA History state
  const [coaHistory,    setCoaHistory]    = useState<CoaHistoryItem[]>([])
  const [coaHistLoading, setCoaHistLoading] = useState(false)
  const navigate = useNavigate()

  const firstName = fullName?.split(' ')[0] ?? 'there'

  async function load(isRefresh = false) {
    setLoading(true)
    try {
      const [w, t, k, b, c, sm, wq, pl, st, ot] = await Promise.all([
        api.get('/dashboard/wip'),
        api.get('/dashboard/tat'),
        api.get('/dashboard/quality-kpis'),
        api.get('/dashboard/instrument-board'),
        api.get('/dashboard/compliance'),
        api.get('/samples').catch(() => ({ data: [] })),
        api.get('/test-executions').catch(() => ({ data: [] })),
        api.get('/dashboard/sample-pipeline').catch(() => ({ data: [] })),
        api.get('/dashboard/sample-trend?days=14').catch(() => ({ data: [] })),
        api.get('/dashboard/oos-trend?days=30').catch(() => ({ data: [] })),
      ])
      setWip(w.data); setTat(t.data); setKpis(k.data); setBoard(b.data); setComp(c.data)
      setPipeline(pl.data); setSampleTrend(st.data); setOosTrend(ot.data)
      const samples = Array.isArray(sm.data) ? sm.data : []
      setRecentSamples(samples.slice(-5).reverse())
      const tasks = Array.isArray(wq.data) ? wq.data : []
      setRecentTasks(tasks.slice(0, 5))
      if (isRefresh) {
        toast('Dashboard refreshed', 'success', 2500)
      } else if (!sessionStorage.getItem('lims_welcomed')) {
        // Show welcome toast only once per browser session
        sessionStorage.setItem('lims_welcomed', '1')
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
        toast(`${greeting}, ${firstName}! 👋 Welcome back.`, 'info', 4000)
        const overdueCount = (w.data as WipSummary)?.overdue ?? 0
        if (overdueCount > 0)
          setTimeout(() => toast(`⚠ ${overdueCount} overdue sample${overdueCount > 1 ? 's' : ''} need attention`, 'warning', 5000), 800)
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Load SPC parameter list once on quality tab open
  useEffect(() => {
    if (tab !== 'quality') return
    if (spcParams.length > 0) return
    api.get('/parameters').then(r => {
      const list: ParameterDto[] = Array.isArray(r.data) ? r.data : []
      setSpcParams(list)
      if (list.length > 0 && spcParamId == null) setSpcParamId(list[0].parameterId)
    }).catch(() => {})
  }, [tab])

  // Fetch SPC data when param or points changes
  useEffect(() => {
    if (spcParamId == null) return
    setSpcLoading(true)
    setSpcData(null)
    api.get(`/spc/${spcParamId}?points=${spcPoints}`).then(r => {
      setSpcData(r.data ?? null)
    }).catch(() => { setSpcData(null) }).finally(() => setSpcLoading(false))
  }, [spcParamId, spcPoints])

  // Lazy-load CoA history when compliance tab opens
  useEffect(() => {
    if (tab !== 'compliance') return
    if (coaHistory.length > 0) return
    setCoaHistLoading(true)
    api.get('/dashboard/coa-history').then(r => {
      setCoaHistory(Array.isArray(r.data) ? r.data : [])
    }).catch(() => {}).finally(() => setCoaHistLoading(false))
  }, [tab])

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',    label: 'Overview',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'quality',     label: 'Quality KPIs', icon: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'instruments', label: 'Instruments',  icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
    { key: 'compliance',  label: 'Compliance',   icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#5f6368', fontSize: 14 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', marginRight: 10 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Loading dashboard…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => load(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', border: `1px solid ${T.border}`, borderRadius: 8,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: T.light, color: T.primary, fontFamily: 'inherit',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'box-shadow 0.12s',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.7-3.7M20 15a9 9 0 01-14.7 3.7"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
        display: 'flex', marginBottom: 22, flexWrap: 'wrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <StatItem value={wip?.inTesting ?? 0}        label="In Testing"         valueColor="#111111"
          iconBg="#eff6ff" iconColor="#2563eb" iconPath={ICONS.flask} />
        <StatItem value={wip?.testsCompleted ?? 0}   label="Tests Completed"    valueColor="#16a34a"
          iconBg="#f0fdf4" iconColor="#16a34a" iconPath={ICONS.check} />
        <StatItem value={`${kpis?.oosRate ?? 0}%`}   label="OOS Rate"           valueColor={(kpis?.oosRate ?? 0) > 0 ? '#dc2626' : '#16a34a'}
          iconBg={(kpis?.oosRate ?? 0) > 0 ? '#fef2f2' : '#f0fdf4'} iconColor={(kpis?.oosRate ?? 0) > 0 ? '#dc2626' : '#16a34a'} iconPath={ICONS.percent} />
        <StatItem value={`${kpis?.ootRate ?? 0}%`}   label="OOT Rate"           valueColor={(kpis?.ootRate ?? 0) > 0 ? '#d97706' : '#16a34a'}
          iconBg={(kpis?.ootRate ?? 0) > 0 ? '#fffbeb' : '#f0fdf4'} iconColor={(kpis?.ootRate ?? 0) > 0 ? '#d97706' : '#16a34a'} iconPath={ICONS.alert} />
        <StatItem value={board.length}               label="Active Instruments"  valueColor="#111111"
          iconBg="#f8fafc" iconColor="#64748b" iconPath={ICONS.instrument} />
        <StatItem value={kpis?.openCapas ?? 0}       label="Open CAPAs"          valueColor={(kpis?.openCapas ?? 0) > 0 ? '#dc2626' : '#111111'}
          iconBg={(kpis?.openCapas ?? 0) > 0 ? '#fef2f2' : '#fafafa'} iconColor={(kpis?.openCapas ?? 0) > 0 ? '#dc2626' : '#94a3b8'} iconPath={ICONS.capa} />
        <StatItem value={comp?.totalSignatures ?? 0} label="E-Signatures"        valueColor={T.primary}
          iconBg={T.light} iconColor={T.primary} iconPath={ICONS.signature} last />
      </div>

      {/* ── Tab nav ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 22,
        background: '#f8f9fa', border: '1px solid #e0e0e0',
        borderRadius: 10, padding: 4,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? T.primary : '#5f6368',
            background: tab === t.key ? '#fff' : 'transparent',
            border: tab === t.key ? `1px solid ${T.border}` : '1px solid transparent',
            borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
              <path d={t.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab === 'overview' && (
        <>
          <SectionHead title="Work in Progress" tag="Today" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Registered Today"  value={wip?.registeredToday ?? 0}  accent="teal"   icon="capa" />
            <KpiCard label="In Testing"        value={wip?.inTesting ?? 0}        accent="teal"   icon="flask"   badge={{ text: 'Active', type: 'neutral' }} />
            <KpiCard label="Completed Today"   value={wip?.completedToday ?? 0}   accent="green"  icon="check" />
            <KpiCard label="Overdue"           value={wip?.overdue ?? 0}          accent="red"    icon="alert"   sub="Past DueDate, not Released" badge={wip && wip.overdue > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="Tests Pending"     value={wip?.testsPending ?? 0}     accent="violet" icon="clock" />
            <KpiCard label="Tests In Progress" value={wip?.testsInProgress ?? 0}  accent="violet" icon="chart" />
            <KpiCard label="Tests Completed"   value={wip?.testsCompleted ?? 0}   accent="green"  icon="check"   badge={{ text: '↑ Good', type: 'ok' }} />
          </div>

          {(wip?.analystWorkloads?.length ?? 0) > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d={ICONS.users} stroke={T.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Analyst Workload
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Analyst</th><th style={th}>Active Assignments</th></tr></thead>
                <tbody>{wip!.analystWorkloads.map(a => (
                  <tr key={a.analystId}><td style={td}>{a.fullName}</td><td style={{ ...td, fontWeight: 600 }}>{a.assignedCount}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <SectionHead title="Turnaround Time" tag={`Last ${tat?.periodDays ?? 30} days`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Avg TAT (hrs)"  value={(tat?.avgTatHours ?? 0).toFixed(1)} accent="teal"  icon="clock" />
            <KpiCard label="Target (hrs)"   value={(tat?.targetHours ?? 0).toFixed(0)} accent="slate" icon="chart" sub="From lab_config tat_target_hrs" />
            <KpiCard label="Breach Count"   value={tat?.breachCount ?? 0}              accent="red"   icon="alert" sub="Completed tests over target" badge={tat && tat.breachCount > 0 ? { text: '⚠ Breached', type: 'bad' } : { text: '✓ On Track', type: 'ok' }} />
          </div>

          {/* ── Charts row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Sample Pipeline Bar Chart */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 14, background: T.primary, borderRadius: 4, display: 'inline-block' }} />
                Sample Pipeline — All Status
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pipeline} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                  <Tooltip formatter={(v: any) => [v, 'Samples']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipeline.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Registrations Area Chart */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 14, background: '#3b82f6', borderRadius: 4, display: 'inline-block' }} />
                Daily Registrations — Last 14 Days
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sampleTrend} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Samples']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#grad1)" dot={{ r: 3, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ══ QUALITY KPIs TAB ══ */}
      {tab === 'quality' && (
        <>
          <SectionHead title="Quality KPIs" tag={`Last ${kpis?.periodDays ?? 30} days`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <KpiCard label="OOS Rate"     value={`${kpis?.oosRate ?? 0}%`}    accent={(kpis?.oosRate ?? 0) > 0 ? 'red' : 'green'}   icon="percent" badge={(kpis?.oosRate ?? 0) > 0 ? { text: '⚠ Review', type: 'bad' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="OOT Rate"     value={`${kpis?.ootRate ?? 0}%`}    accent={(kpis?.ootRate ?? 0) > 0 ? 'amber' : 'green'}  icon="alert"   badge={(kpis?.ootRate ?? 0) > 0 ? { text: '⚠ Monitor', type: 'warn' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="RFT Rate"     value={`${kpis?.rftRate ?? 0}%`}    accent="teal"  icon="check" sub="Right First Time (Released)" />
            <KpiCard label="Re-Test Rate" value={`${kpis?.retestRate ?? 0}%`} accent="amber" icon="clock" />
            <KpiCard label="Open CAPAs"   value={kpis?.openCapas ?? 0}        accent={(kpis?.openCapas ?? 0) > 0 ? 'red' : 'green'}  icon="capa"    badge={(kpis?.openCapas ?? 0) > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ None open', type: 'ok' }} />
          </div>

          {(tat?.byAnalyst?.length ?? 0) > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d={ICONS.users} stroke={T.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Analyst TAT Breakdown
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Analyst</th><th style={th}>Avg TAT (hrs)</th><th style={th}>vs Target</th></tr></thead>
                <tbody>{tat!.byAnalyst.map(a => {
                  const over = a.avgTatHours > (tat?.targetHours ?? 48)
                  return (
                    <tr key={a.analystId}>
                      <td style={td}>{a.fullName}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{a.avgTatHours.toFixed(1)}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: over ? '#fee2e2' : '#dcfce7', color: over ? '#dc2626' : '#16a34a' }}>
                          {over ? '▲ Over' : '✓ On Track'}
                        </span>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}

          {/* ── Quality Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Pass / Fail / OOT Donut */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 14, background: '#22c55e', borderRadius: 4, display: 'inline-block' }} />
                Result Distribution
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Last {kpis?.periodDays ?? 30} days</div>
              {kpis && (() => {
                const rft  = Math.max(0, kpis.rftRate)
                const oos  = Math.max(0, kpis.oosRate)
                const oot  = Math.max(0, kpis.ootRate)
                const rest = Math.max(0, 100 - rft - oos - oot)
                const pieData = [
                  { name: 'Right First Time', value: rft,  fill: '#22c55e' },
                  { name: 'OOS',              value: oos,  fill: '#ef4444' },
                  { name: 'OOT',              value: oot,  fill: '#f59e0b' },
                  { name: 'Other',            value: rest, fill: '#e2e8f0' },
                ].filter(d => d.value > 0)
                return (
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                        paddingAngle={2} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>

            {/* OOS Rate Trend Line Chart */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 14, background: '#ef4444', borderRadius: 4, display: 'inline-block' }} />
                OOS Rate Trend
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Last 30 days (%)</div>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={oosTrend} margin={{ left: -10, right: 10, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" domain={[0, 'auto']} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'OOS Rate']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2}
                    dot={{ r: 2, fill: '#ef4444' }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SPC Chart ─────────────────────────────────────────────────────── */}
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 18, background: '#8b5cf6', borderRadius: 4, display: 'inline-block' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Statistical Process Control — I-Chart</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>UCL/LCL = Mean ± 3σ &nbsp;|&nbsp; Nelson Rules 1/2/3 &nbsp;|&nbsp; Cp/Cpk capability indices</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Parameter selector */}
                <select
                  value={spcParamId ?? ''}
                  onChange={e => setSpcParamId(Number(e.target.value))}
                  style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#111', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {spcParams.length === 0 && <option value="">No parameters</option>}
                  {spcParams.map(p => (
                    <option key={p.parameterId} value={p.parameterId}>{p.parameterName}{p.unit ? ` (${p.unit})` : ''}</option>
                  ))}
                </select>
                {/* Points selector */}
                <select
                  value={spcPoints}
                  onChange={e => setSpcPoints(Number(e.target.value) as 50 | 100 | 200)}
                  style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#111', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <option value={50}>Last 50 pts</option>
                  <option value={100}>Last 100 pts</option>
                  <option value={200}>Last 200 pts</option>
                </select>
              </div>
            </div>

            {/* Loading / no-data states */}
            {spcLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: '#6b7280', fontSize: 13 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', marginRight: 8 }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Loading SPC data…
              </div>
            )}

            {!spcLoading && spcData === null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af', fontSize: 13, gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" width="36" height="36"><path d="M3 3v18h18M7 16l4-4 4 4 4-7" stroke="#d1d5db" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                No data available for this parameter
              </div>
            )}

            {!spcLoading && spcData && spcData.n < 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af', fontSize: 13, gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" width="36" height="36"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Insufficient data — n = {spcData.n} (minimum 5 required for control limits)</span>
              </div>
            )}

            {!spcLoading && spcData && spcData.n >= 5 && (() => {
              // Map data points for recharts — add sequential index for x-axis
              const chartData = spcData.points.map((p, i) => ({
                idx: i + 1,
                value: p.value,
                label: p.sampleNumber,
                date: new Date(p.measuredAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
                isOos: p.isOos,
                isOot: p.isOot,
                // All reference values repeated for recharts tooltip
                ucl: spcData.ucl,
                lcl: spcData.lcl,
                mean: spcData.mean,
              }))

              const cpkColor = (v?: number) => {
                if (v == null) return '#6b7280'
                if (v >= 1.33) return '#16a34a'
                if (v >= 1.0)  return '#d97706'
                return '#dc2626'
              }
              const cpkBg = (v?: number) => {
                if (v == null) return '#f1f5f9'
                if (v >= 1.33) return '#dcfce7'
                if (v >= 1.0)  return '#fef9c3'
                return '#fee2e2'
              }

              // Y-axis domain — pad 10% beyond UCL/LCL
              const yPad = (spcData.ucl - spcData.lcl) * 0.15
              const yMin = Math.min(spcData.lcl - yPad, ...spcData.points.map(p => p.value))
              const yMax = Math.max(spcData.ucl + yPad, ...spcData.points.map(p => p.value))

              return (
                <div>
                  {/* Nelson rule violations */}
                  {spcData.rules.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: 4, border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Process Out of Control
                      </span>
                      {spcData.rules.map((r, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 600 }}>{r}</span>
                      ))}
                    </div>
                  )}
                  {!spcData.outOfControl && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
                      <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Process In Control — No Nelson Rule violations
                    </div>
                  )}

                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 4, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="idx"
                        type="number"
                        domain={[1, chartData.length]}
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        label={{ value: 'Sample sequence', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }}
                        allowDecimals={false}
                      />
                      <YAxis
                        domain={[yMin, yMax]}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v: number) => v.toFixed(2)}
                        width={54}
                        label={{ value: spcData.unit ?? '', angle: -90, position: 'insideLeft', offset: 12, fontSize: 10, fill: '#9ca3af' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as typeof chartData[0]
                          return (
                            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6, color: '#111' }}>#{d.idx} — {d.label}</div>
                              <div style={{ color: '#6b7280', marginBottom: 2 }}>{d.date}</div>
                              <div style={{ fontWeight: 700, color: d.isOos ? '#dc2626' : d.isOot ? '#d97706' : '#16a34a', fontSize: 14, marginBottom: 4 }}>
                                {d.value.toFixed(4)} {spcData.unit}
                                {d.isOos && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#fee2e2', color: '#dc2626' }}>OOS</span>}
                                {d.isOot && !d.isOos && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#fef9c3', color: '#d97706' }}>OOT</span>}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 11, color: '#6b7280' }}>
                                <span>UCL: {spcData.ucl.toFixed(4)}</span>
                                <span>LCL: {spcData.lcl.toFixed(4)}</span>
                                <span>Mean: {spcData.mean.toFixed(4)}</span>
                              </div>
                            </div>
                          )
                        }}
                      />
                      {/* Control limit reference lines */}
                      <ReferenceLine y={spcData.ucl} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `UCL ${spcData.ucl.toFixed(3)}`, position: 'right', fontSize: 10, fill: '#ef4444', fontWeight: 600 }} />
                      <ReferenceLine y={spcData.mean} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5}
                        label={{ value: `μ ${spcData.mean.toFixed(3)}`, position: 'right', fontSize: 10, fill: '#22c55e', fontWeight: 600 }} />
                      <ReferenceLine y={spcData.lcl} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `LCL ${spcData.lcl.toFixed(3)}`, position: 'right', fontSize: 10, fill: '#ef4444', fontWeight: 600 }} />
                      {/* Spec limit lines (if defined) */}
                      {spcData.usl != null && (
                        <ReferenceLine y={spcData.usl} stroke="#f59e0b" strokeDasharray="3 4" strokeWidth={1.5}
                          label={{ value: `USL ${spcData.usl.toFixed(3)}`, position: 'right', fontSize: 10, fill: '#f59e0b', fontWeight: 600 }} />
                      )}
                      {spcData.lsl != null && (
                        <ReferenceLine y={spcData.lsl} stroke="#f59e0b" strokeDasharray="3 4" strokeWidth={1.5}
                          label={{ value: `LSL ${spcData.lsl.toFixed(3)}`, position: 'right', fontSize: 10, fill: '#f59e0b', fontWeight: 600 }} />
                      )}
                      {/* Connecting line (no dots — we use Scatter for colored dots) */}
                      <Line
                        dataKey="value"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                      {/* Colored dots via custom Line dot renderer */}
                      <Line
                        dataKey="value"
                        stroke="transparent"
                        strokeWidth={0}
                        isAnimationActive={false}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          const fill = payload.isOos ? '#ef4444' : payload.isOot ? '#f59e0b' : '#22c55e'
                          const r = payload.isOos ? 6 : 4
                          return (
                            <circle
                              key={`spc-dot-${props.index}`}
                              cx={cx} cy={cy} r={r}
                              fill={fill}
                              stroke="#fff"
                              strokeWidth={1.5}
                            />
                          )
                        }}
                        activeDot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Stats panel */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'n', value: String(spcData.n), bg: '#f8fafc', color: '#374151', title: 'Sample count' },
                      { label: 'Mean (μ)', value: spcData.mean.toFixed(4), bg: '#f0fdf4', color: '#15803d', title: 'Process mean' },
                      { label: 'Std Dev (σ)', value: spcData.stddev.toFixed(4), bg: '#eff6ff', color: '#1d4ed8', title: 'Sample standard deviation (Bessel-corrected)' },
                      { label: 'UCL', value: spcData.ucl.toFixed(4), bg: '#fef2f2', color: '#dc2626', title: 'Upper Control Limit (Mean + 3σ)' },
                      { label: 'LCL', value: spcData.lcl.toFixed(4), bg: '#fef2f2', color: '#dc2626', title: 'Lower Control Limit (Mean − 3σ)' },
                    ].map(s => (
                      <div key={s.label} title={s.title} style={{ background: s.bg, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: s.color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                      </div>
                    ))}
                    {/* Cp */}
                    {spcData.cp != null && (
                      <div title="Process capability Cp = (USL−LSL) / 6σ" style={{ background: '#f5f3ff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Cp</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', letterSpacing: '-0.01em' }}>{spcData.cp.toFixed(3)}</div>
                      </div>
                    )}
                    {/* Cpk */}
                    {spcData.cpk != null && (
                      <div title="Process capability index Cpk = min((USL−μ)/3σ, (μ−LSL)/3σ)" style={{ background: cpkBg(spcData.cpk), border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Cpk</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: cpkColor(spcData.cpk), letterSpacing: '-0.01em' }}>{spcData.cpk.toFixed(3)}</div>
                        <div style={{ fontSize: 9, color: cpkColor(spcData.cpk), marginTop: 2, fontWeight: 600 }}>
                          {spcData.cpk >= 1.33 ? 'Capable' : spcData.cpk >= 1.0 ? 'Marginal' : 'Incapable'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
                    {[
                      { color: '#22c55e', label: 'In Control' },
                      { color: '#f59e0b', label: 'OOT (Out of Trend)' },
                      { color: '#ef4444', label: 'OOS / Out of Control' },
                      { color: '#ef4444', label: '── UCL / LCL', dashed: true },
                      { color: '#22c55e', label: '── Mean (μ)', dashed: true },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {l.dashed
                          ? <span style={{ display: 'inline-block', width: 20, height: 0, borderTop: `2px dashed ${l.color}` }} />
                          : <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                        }
                        {l.label}
                      </div>
                    ))}
                    {spcData.usl != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-block', width: 20, height: 0, borderTop: '2px dashed #f59e0b' }} />
                        USL / LSL (Spec limits)
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* ══ INSTRUMENTS TAB ══ */}
      {tab === 'instruments' && (
        <>
          <SectionHead title="Instrument Status Board" tag={`${board.length} instrument${board.length !== 1 ? 's' : ''}`} />
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Code</th><th style={th}>Type</th><th style={th}>Status</th>
                  <th style={th}>Cal. Due</th><th style={th}>Days Remaining</th>
                  <th style={th}>Utilisation</th><th style={th}>Open Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {board.map(i => {
                  const sc = instColour(i.statusText)
                  return (
                    <tr key={i.instrumentId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                      <td style={{ ...td, color: T.primary, fontWeight: 700 }}>{i.instrumentCode}</td>
                      <td style={td}>{i.instrumentType}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{i.statusText}</span>
                      </td>
                      <td style={td}>{i.calibrationDue}</td>
                      <td style={{ ...td, fontWeight: 700, color: i.calDaysRemaining <= 7 ? '#dc2626' : i.calDaysRemaining <= 30 ? '#d97706' : '#16a34a' }}>
                        {i.calDaysRemaining}d
                      </td>
                      <td style={td}>{i.latestUtilPct != null ? `${i.latestUtilPct}%` : '—'}</td>
                      <td style={{ ...td, color: i.openBreakdownId ? '#dc2626' : '#80868b', fontWeight: i.openBreakdownId ? 700 : 400 }}>
                        {i.openBreakdownId ? `#${i.openBreakdownId}` : '—'}
                      </td>
                    </tr>
                  )
                })}
                {board.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#80868b', padding: '32px 16px' }}>No active instruments</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Calibration Timeline */}
          {board.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', marginTop: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 14, background: '#f59e0b', borderRadius: 4, display: 'inline-block' }} />
                Calibration Due — Next 90 Days
              </div>
              {board.slice().sort((a, b) => a.calDaysRemaining - b.calDaysRemaining).map(inst => {
                const pct   = Math.min(100, Math.max(0, (inst.calDaysRemaining / 90) * 100))
                const color = inst.calDaysRemaining < 0 ? '#ef4444'
                            : inst.calDaysRemaining <= 7 ? '#ef4444'
                            : inst.calDaysRemaining <= 30 ? '#f59e0b' : '#22c55e'
                const label = inst.calDaysRemaining < 0 ? `⛔ ${Math.abs(inst.calDaysRemaining)}d overdue`
                            : inst.calDaysRemaining === 0 ? '🔴 Due today'
                            : inst.calDaysRemaining <= 7 ? `🔴 ${inst.calDaysRemaining}d`
                            : inst.calDaysRemaining <= 30 ? `🟡 ${inst.calDaysRemaining}d`
                            : `🟢 ${inst.calDaysRemaining}d`
                return (
                  <div key={inst.instrumentId} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{inst.instrumentCode} <span style={{ fontWeight: 400, color: '#9ca3af' }}>({inst.instrumentType})</span></span>
                      <span style={{ fontWeight: 700, color, fontSize: 11 }}>{label}</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#6b7280' }}>
                <span>🔴 Overdue / ≤7d</span>
                <span>🟡 ≤30d</span>
                <span>🟢 &gt;30d</span>
                <span style={{ marginLeft: 'auto' }}>Bar = days remaining / 90d window</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ COMPLIANCE TAB ══ */}
      {tab === 'compliance' && comp && (
        <>
          <SectionHead title="Compliance Overview" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
            <KpiCard label="Total Audit Events" value={comp.totalAuditEvents} accent="teal"  icon="shield" />
            <KpiCard label="Open OOS"           value={comp.openOos}          accent={comp.openOos > 0 ? 'red' : 'green'}  icon="alert" badge={comp.openOos > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ None open', type: 'ok' }} />
            <KpiCard label="Closed OOS"         value={comp.closedOos}        accent="green" icon="check" />
            <KpiCard label="E-Signatures"       value={comp.totalSignatures}  accent="teal"  icon="signature" />
            <KpiCard label="System Status"      value={comp.systemStatus}     accent="green" icon="shield" badge={{ text: '● Live', type: 'ok' }} />
          </div>

          <div style={{ background: T.light, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Compliant with</span>
            {['21 CFR Part 11', 'EU GMP Annex 11', 'ISO 17025', 'ALCOA+', 'GAMP 5', 'ICH Q1A'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: T.primary, background: '#fff', padding: '4px 12px', borderRadius: 20, border: `1px solid ${T.border}` }}>
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {s}
              </div>
            ))}
          </div>

          {/* ── CoA History ── */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20, marginTop: 20 }}>
            <SectionHead title="CoA History" />
            {coaHistLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#80868b', fontSize: 13, padding: '20px 0' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Loading CoA history…
              </div>
            ) : coaHistory.length === 0 ? (
              <div style={{ color: '#80868b', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No CoA records yet</div>
            ) : (
              <>
                {/* Status distribution bar chart */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CoA Status Distribution</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(
                      coaHistory.reduce<Record<string, number>>((acc, item) => {
                        acc[item.status] = (acc[item.status] ?? 0) + 1
                        return acc
                      }, {})
                    ).map(([status, count]) => ({ status, count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0d6e6e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recent CoA table */}
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent CoAs (last 10)</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={th}>CoA No.</th>
                        <th style={th}>Sample No.</th>
                        <th style={th}>Material</th>
                        <th style={th}>Status</th>
                        <th style={th}>QA Decision</th>
                        <th style={th}>QA Signed By</th>
                        <th style={th}>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coaHistory.slice(0, 10).map((item, i) => (
                        <tr key={item.coaId} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={td}>{item.coaNumber}</td>
                          <td style={td}>{item.sampleNumber}</td>
                          <td style={td}>{item.materialName}</td>
                          <td style={td}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                              background: item.status === 'Released' ? '#d1fae5' : item.status === 'Rejected' ? '#fee2e2' : '#f1f5f9',
                              color:      item.status === 'Released' ? '#065f46' : item.status === 'Rejected' ? '#991b1b' : '#374151',
                            }}>{item.status}</span>
                          </td>
                          <td style={td}>{item.qaDecision ?? '—'}</td>
                          <td style={td}>{item.qaSignedBy ?? '—'}</td>
                          <td style={td}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── 3 Quick-View Widgets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24 }}>

        {/* Widget 1 — Work Queue */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M4 6h16M4 10h16M4 14h10" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>Work Queue</span>
            </div>
            <button onClick={() => navigate('/work-queue')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.primary, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
              View All
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div>
            {recentTasks.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#80868b', fontSize: 13 }}>No pending tasks</div>
            ) : recentTasks.map((t, i) => {
              const sc = { Assigned: { bg: '#dbeafe', color: '#1e40af' }, InProgress: { bg: '#fef9c3', color: '#854d0e' }, Completed: { bg: '#d1fae5', color: '#065f46' }, OOSOpen: { bg: '#fee2e2', color: '#991b1b' } }[t.status] ?? { bg: '#f1f5f9', color: '#374151' }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < recentTasks.length - 1 ? '1px solid #f8f9fa' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sampleNumber}</div>
                    <div style={{ fontSize: 11.5, color: '#80868b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.materialName}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{t.status}</span>
                    {t.analystName && <div style={{ fontSize: 10.5, color: '#80868b', marginTop: 2 }}>{t.analystName}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Widget 2 — Recent Samples */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>Recent Samples</span>
            </div>
            <button onClick={() => navigate('/samples')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.primary, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
              View All
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div>
            {recentSamples.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#80868b', fontSize: 13 }}>No recent registrations</div>
            ) : recentSamples.map((s, i) => {
              const sc = { Registered: { bg: '#dbeafe', color: '#1e40af' }, PendingTesting: { bg: '#fef9c3', color: '#854d0e' }, InTesting: { bg: '#fde8d8', color: '#9a3412' }, Released: { bg: '#d1fae5', color: '#065f46' }, Rejected: { bg: '#fee2e2', color: '#991b1b' } }[s.status] ?? { bg: '#f1f5f9', color: '#374151' }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < recentSamples.length - 1 ? '1px solid #f8f9fa' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sampleNumber}</div>
                    <div style={{ fontSize: 11.5, color: '#80868b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.materialName}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{s.status}</span>
                    <div style={{ fontSize: 10.5, color: '#80868b', marginTop: 2 }}>{_timeAgo(s.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Widget 3 — TAT Gauge + Welcome */}
        <div style={{
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
          padding: '18px 18px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Welcome line */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                {(() => { const h = new Date().getHours(); return h < 12 ? '🌅' : h < 17 ? '☀️' : '🌙' })()}
                {' '}{firstName ? `${firstName}` : 'Welcome'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e80', display: 'inline-block' }} />
          </div>

          {/* TAT Gauge */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>⏱ Turnaround Time</div>
            {(() => {
              const avg    = tat?.avgTatHours ?? 0
              const target = tat?.targetHours ?? 48
              const pct    = target > 0 ? Math.min(100, (avg / target) * 100) : 0
              const color  = pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e'
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                    <span>Avg: <strong style={{ color: '#111' }}>{avg.toFixed(1)}h</strong></span>
                    <span>Target: <strong style={{ color: '#111' }}>{target.toFixed(0)}h</strong></span>
                  </div>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 6, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color }}>
                    {pct > 100 ? '⚠ Over target' : pct > 80 ? '⚡ Approaching target' : '✓ On track'}
                    <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>({pct.toFixed(0)}% of target)</span>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: '📋 Registered Today', value: wip?.registeredToday ?? 0, color: '#0d9488' },
              { label: '🔬 In Testing',        value: wip?.inTesting ?? 0,       color: '#2563eb' },
              { label: '✅ Completed Today',   value: wip?.completedToday ?? 0,  color: '#16a34a' },
              { label: '⏰ Overdue',           value: wip?.overdue ?? 0,         color: wip && wip.overdue > 0 ? '#dc2626' : '#9ca3af' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#374151' }}>{row.label}</span>
                <span style={{ fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _timeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
