import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'

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
      <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, color: '#202124', lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</p>
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
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#202124', letterSpacing: '-0.02em' }}>{title}</h3>
      </div>
      {tag && <span style={{ fontSize: 11, color: '#80868b', background: '#f8f9fa', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: 20, fontWeight: 500 }}>{tag}</span>}
    </div>
  )
}

// ── Table styles ──────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#202124', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e0e0e0', background: '#f8f9fa' }
const td: React.CSSProperties = { padding: '11px 14px', color: '#202124', borderBottom: '1px solid #f1f3f4', fontSize: 14 }

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
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState<Tab>('overview')
  const navigate = useNavigate()

  const firstName = fullName?.split(' ')[0] ?? 'there'

  async function load(isRefresh = false) {
    setLoading(true)
    try {
      const [w, t, k, b, c, sm, wq] = await Promise.all([
        api.get('/dashboard/wip'),
        api.get('/dashboard/tat'),
        api.get('/dashboard/quality-kpis'),
        api.get('/dashboard/instrument-board'),
        api.get('/dashboard/compliance'),
        api.get('/samples').catch(() => ({ data: [] })),
        api.get('/test-executions').catch(() => ({ data: [] })),
      ])
      setWip(w.data); setTat(t.data); setKpis(k.data); setBoard(b.data); setComp(c.data)
      const samples = Array.isArray(sm.data) ? sm.data : []
      setRecentSamples(samples.slice(-5).reverse())
      const tasks = Array.isArray(wq.data) ? wq.data : []
      setRecentTasks(tasks.slice(0, 5))
      if (isRefresh) {
        toast('Dashboard refreshed', 'success', 2500)
      } else {
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
        <StatItem value={wip?.inTesting ?? 0}        label="In Testing"         valueColor="#202124"
          iconBg="#eff6ff" iconColor="#2563eb" iconPath={ICONS.flask} />
        <StatItem value={wip?.testsCompleted ?? 0}   label="Tests Completed"    valueColor="#16a34a"
          iconBg="#f0fdf4" iconColor="#16a34a" iconPath={ICONS.check} />
        <StatItem value={`${kpis?.oosRate ?? 0}%`}   label="OOS Rate"           valueColor={(kpis?.oosRate ?? 0) > 0 ? '#dc2626' : '#16a34a'}
          iconBg={(kpis?.oosRate ?? 0) > 0 ? '#fef2f2' : '#f0fdf4'} iconColor={(kpis?.oosRate ?? 0) > 0 ? '#dc2626' : '#16a34a'} iconPath={ICONS.percent} />
        <StatItem value={`${kpis?.ootRate ?? 0}%`}   label="OOT Rate"           valueColor={(kpis?.ootRate ?? 0) > 0 ? '#d97706' : '#16a34a'}
          iconBg={(kpis?.ootRate ?? 0) > 0 ? '#fffbeb' : '#f0fdf4'} iconColor={(kpis?.ootRate ?? 0) > 0 ? '#d97706' : '#16a34a'} iconPath={ICONS.alert} />
        <StatItem value={board.length}               label="Active Instruments"  valueColor="#202124"
          iconBg="#f8fafc" iconColor="#64748b" iconPath={ICONS.instrument} />
        <StatItem value={kpis?.openCapas ?? 0}       label="Open CAPAs"          valueColor={(kpis?.openCapas ?? 0) > 0 ? '#dc2626' : '#202124'}
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
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 700, color: '#202124', display: 'flex', alignItems: 'center', gap: 7 }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <KpiCard label="Avg TAT (hrs)"  value={(tat?.avgTatHours ?? 0).toFixed(1)} accent="teal"  icon="clock" />
            <KpiCard label="Target (hrs)"   value={(tat?.targetHours ?? 0).toFixed(0)} accent="slate" icon="chart" sub="From lab_config tat_target_hrs" />
            <KpiCard label="Breach Count"   value={tat?.breachCount ?? 0}              accent="red"   icon="alert" sub="Completed tests over target" badge={tat && tat.breachCount > 0 ? { text: '⚠ Breached', type: 'bad' } : { text: '✓ On Track', type: 'ok' }} />
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
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', fontSize: 13, fontWeight: 700, color: '#202124', display: 'flex', alignItems: 'center', gap: 7 }}>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>Work Queue</span>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sampleNumber}</div>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>Recent Samples</span>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sampleNumber}</div>
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

        {/* Widget 3 — Welcome + Today's Pulse */}
        <div style={{
          background: 'linear-gradient(140deg, #f0fdfa 0%, #e0f2fe 60%, #ede9fe 100%)',
          border: '1px solid #99f6e4', borderRadius: 12,
          padding: '18px 18px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#202124', letterSpacing: '-0.01em' }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? '🌅' : h < 17 ? '☀️' : '🌙' })()}
              {' '}{fullName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
            </div>
            <div style={{ fontSize: 12, color: '#5f6368', marginTop: 3 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { label: 'Registered Today', value: wip?.registeredToday ?? 0, color: '#0d9488', icon: '📋' },
              { label: 'In Testing',       value: wip?.inTesting ?? 0,       color: '#2563eb', icon: '🔬' },
              { label: 'Completed Today',  value: wip?.completedToday ?? 0,  color: '#16a34a', icon: '✅' },
              { label: 'Overdue',          value: wip?.overdue ?? 0,         color: wip && wip.overdue > 0 ? '#dc2626' : '#80868b', icon: '⏰' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '7px 12px', backdropFilter: 'blur(4px)' }}>
                <span style={{ fontSize: 12.5, color: '#202124', fontWeight: 500 }}>{row.icon} {row.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e80', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11.5, color: T.primary, fontWeight: 600 }}>
              {wip && wip.overdue > 0 ? `${wip.overdue} task${wip.overdue > 1 ? 's' : ''} need attention` : 'All systems operational'}
            </span>
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
