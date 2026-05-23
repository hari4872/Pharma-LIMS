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

type Tab = 'overview' | 'quality' | 'instruments' | 'compliance'

interface RecentSample {
  sampleId: number; sampleNumber: string; materialName: string; status: string; createdAt: string
}
interface RecentTask {
  executionId: number; sampleNumber: string; materialName: string; status: string; analystName: string
}

// ── Teal palette ──────────────────────────────────────────────────────────
const T = {
  primary:   '#0d6e6e',
  primary2:  '#0a4f4f',
  light:     '#f0fdfa',
  border:    '#99f6e4',
  teal100:   '#ccfbf1',
  teal600:   '#0d9488',
}

// ── KPI card with left accent bar ─────────────────────────────────────────
function KpiCard({ label, value, sub, accent, badge }: {
  label: string; value: string | number; sub?: string
  accent: 'teal' | 'green' | 'amber' | 'red' | 'violet' | 'slate'
  badge?: { text: string; type: 'ok' | 'warn' | 'bad' | 'neutral' }
}) {
  const bars: Record<string, string> = {
    teal: T.primary, green: '#22c55e', amber: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', slate: '#94a3b8',
  }
  const badgeStyles: Record<string, React.CSSProperties> = {
    ok:      { background: '#dcfce7', color: '#16a34a' },
    warn:    { background: '#fef9c3', color: '#b45309' },
    bad:     { background: '#fee2e2', color: '#dc2626' },
    neutral: { background: '#f1f5f9', color: '#64748b' },
  }
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '16px 16px 16px 20px', flex: '1 1 150px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: bars[accent], borderRadius: '8px 0 0 8px' }} />
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{sub}</p>}
      {badge && (
        <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...badgeStyles[badge.type] }}>
          {badge.text}
        </span>
      )}
    </div>
  )
}

// ── Table styles ──────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }
const td: React.CSSProperties = { padding: '11px 14px', color: '#374151', borderBottom: '1px solid #f3f4f6', fontSize: 13 }

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
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
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
      // Recent samples — last 5 newest first
      const samples = Array.isArray(sm.data) ? sm.data : []
      setRecentSamples(samples.slice(-5).reverse())
      // Recent tasks — first 5 from work queue
      const tasks = Array.isArray(wq.data) ? wq.data : []
      setRecentTasks(tasks.slice(0, 5))
      // Toasts
      if (isRefresh) {
        toast('Dashboard refreshed', 'success', 2500)
      } else {
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
        toast(`${greeting}, ${firstName}! 👋 Welcome back.`, 'info', 4000)
        // Alert if overdue samples
        const overdueCount = (w.data as WipSummary)?.overdue ?? 0
        if (overdueCount > 0) {
          setTimeout(() => toast(`⚠ ${overdueCount} overdue sample${overdueCount > 1 ? 's' : ''} need attention`, 'warning', 5000), 800)
        }
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',    label: 'Overview'     },
    { key: 'quality',     label: 'Quality KPIs' },
    { key: 'instruments', label: 'Instruments'  },
    { key: 'compliance',  label: 'Compliance'   },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', marginRight: 10 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Loading dashboard…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '0 2px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Lab Dashboard</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Real-time laboratory operations overview</p>
        </div>
        <button onClick={() => load(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', border: `1px solid ${T.border}`, borderRadius: 7,
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
          background: T.light, color: T.primary, fontFamily: 'Inter, sans-serif',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.7-3.7M20 15a9 9 0 01-14.7 3.7"/></svg>
          Refresh
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
        display: 'flex', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {[
          { n: wip?.inTesting ?? 0,      l: 'In Testing',        c: '#0f172a' },
          { n: wip?.testsCompleted ?? 0, l: 'Tests Completed',   c: '#16a34a' },
          { n: `${kpis?.oosRate ?? 0}%`, l: 'OOS Rate',          c: (kpis?.oosRate ?? 0) > 0 ? '#dc2626' : '#16a34a' },
          { n: `${kpis?.ootRate ?? 0}%`, l: 'OOT Rate',          c: (kpis?.ootRate ?? 0) > 0 ? '#dc2626' : '#16a34a' },
          { n: board.length,             l: 'Active Instruments', c: '#0f172a' },
          { n: kpis?.openCapas ?? 0,     l: 'Open CAPAs',        c: (kpis?.openCapas ?? 0) > 0 ? '#dc2626' : '#0f172a' },
          { n: comp?.totalSignatures ?? 0, l: 'E-Signatures',    c: T.primary },
        ].map((s, i, arr) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', padding: '14px 8px',
            borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.c, lineHeight: 1 }}>{String(s.n)}</div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20, gap: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 22px', fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? T.primary : '#6b7280',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.key ? T.primary : 'transparent'}`,
            marginBottom: -2, fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab === 'overview' && (
        <>
          {/* WIP */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Work in Progress</h3>
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 10px', borderRadius: 20 }}>Today</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <KpiCard label="Registered Today"  value={wip?.registeredToday ?? 0}  accent="teal" />
            <KpiCard label="In Testing"        value={wip?.inTesting ?? 0}        accent="teal"   badge={{ text: 'Active', type: 'neutral' }} />
            <KpiCard label="Completed Today"   value={wip?.completedToday ?? 0}   accent="green" />
            <KpiCard label="Overdue"           value={wip?.overdue ?? 0}          accent="red"    sub="Past DueDate, not Released" badge={wip && wip.overdue > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="Tests Pending"     value={wip?.testsPending ?? 0}     accent="violet" />
            <KpiCard label="Tests In Progress" value={wip?.testsInProgress ?? 0}  accent="violet" />
            <KpiCard label="Tests Completed"   value={wip?.testsCompleted ?? 0}   accent="green"  badge={{ text: '↑ Good', type: 'ok' }} />
          </div>

          {/* Analyst workload table */}
          {(wip?.analystWorkloads?.length ?? 0) > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Analyst Workload</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Analyst</th><th style={th}>Active Assignments</th></tr></thead>
                <tbody>{wip!.analystWorkloads.map(a => (
                  <tr key={a.analystId}><td style={td}>{a.fullName}</td><td style={td}>{a.assignedCount}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* TAT */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Turnaround Time</h3>
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 10px', borderRadius: 20 }}>Last {tat?.periodDays ?? 30} days</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard label="Avg TAT (hrs)"  value={(tat?.avgTatHours ?? 0).toFixed(1)} accent="teal" />
            <KpiCard label="Target (hrs)"   value={(tat?.targetHours ?? 0).toFixed(0)} accent="slate" sub="From lab_config tat_target_hrs" />
            <KpiCard label="Breach Count"   value={tat?.breachCount ?? 0}              accent="red"   sub="Completed tests over target" badge={tat && tat.breachCount > 0 ? { text: '⚠ Breached', type: 'bad' } : { text: '✓ On Track', type: 'ok' }} />
          </div>
        </>
      )}

      {/* ══ QUALITY KPIs TAB ══ */}
      {tab === 'quality' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Quality KPIs</h3>
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 10px', borderRadius: 20 }}>Last {kpis?.periodDays ?? 30} days</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <KpiCard label="OOS Rate"     value={`${kpis?.oosRate ?? 0}%`}    accent={( kpis?.oosRate ?? 0) > 0 ? 'red' : 'green'}  badge={(kpis?.oosRate ?? 0) > 0 ? { text: '⚠ Review', type: 'bad' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="OOT Rate"     value={`${kpis?.ootRate ?? 0}%`}    accent={(kpis?.ootRate ?? 0) > 0 ? 'amber' : 'green'} badge={(kpis?.ootRate ?? 0) > 0 ? { text: '⚠ Monitor', type: 'warn' } : { text: '✓ Clear', type: 'ok' }} />
            <KpiCard label="RFT Rate"     value={`${kpis?.rftRate ?? 0}%`}    accent="teal"  sub="Right First Time (Released)" />
            <KpiCard label="Re-Test Rate" value={`${kpis?.retestRate ?? 0}%`} accent="amber" />
            <KpiCard label="Open CAPAs"   value={kpis?.openCapas ?? 0}        accent={(kpis?.openCapas ?? 0) > 0 ? 'red' : 'green'} badge={(kpis?.openCapas ?? 0) > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ None open', type: 'ok' }} />
          </div>

          {(tat?.byAnalyst?.length ?? 0) > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Analyst TAT Breakdown</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Analyst</th><th style={th}>Avg TAT (hrs)</th><th style={th}>vs Target</th></tr></thead>
                <tbody>{tat!.byAnalyst.map(a => {
                  const over = a.avgTatHours > (tat?.targetHours ?? 48)
                  return (
                    <tr key={a.analystId}>
                      <td style={td}>{a.fullName}</td>
                      <td style={td}>{a.avgTatHours.toFixed(1)}</td>
                      <td style={{ ...td }}>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: over ? '#fee2e2' : '#dcfce7', color: over ? '#dc2626' : '#16a34a' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Instrument Status Board</h3>
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 10px', borderRadius: 20 }}>{board.length} instrument{board.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Code</th><th style={th}>Type</th><th style={th}>Status</th>
                  <th style={th}>Cal. Due</th><th style={th}>Cal Days Remaining</th>
                  <th style={th}>Utilisation</th><th style={th}>Open Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {board.map(i => {
                  const sc = instColour(i.statusText)
                  return (
                    <tr key={i.instrumentId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, color: T.primary, fontWeight: 600 }}>{i.instrumentCode}</td>
                      <td style={td}>{i.instrumentType}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{i.statusText}</span>
                      </td>
                      <td style={td}>{i.calibrationDue}</td>
                      <td style={{ ...td, fontWeight: 600, color: i.calDaysRemaining <= 7 ? '#dc2626' : i.calDaysRemaining <= 30 ? '#d97706' : '#16a34a' }}>
                        {i.calDaysRemaining}d
                      </td>
                      <td style={td}>{i.latestUtilPct != null ? `${i.latestUtilPct}%` : '—'}</td>
                      <td style={{ ...td, color: i.openBreakdownId ? '#dc2626' : '#9ca3af', fontWeight: i.openBreakdownId ? 600 : 400 }}>
                        {i.openBreakdownId ? `#${i.openBreakdownId}` : '—'}
                      </td>
                    </tr>
                  )
                })}
                {board.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No active instruments</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ COMPLIANCE TAB ══ */}
      {tab === 'compliance' && comp && (
        <>
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Compliance Overview</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <KpiCard label="Total Audit Events" value={comp.totalAuditEvents} accent="teal" />
            <KpiCard label="Open OOS"           value={comp.openOos}          accent={comp.openOos > 0 ? 'red' : 'green'}  badge={comp.openOos > 0 ? { text: '⚠ Action needed', type: 'bad' } : { text: '✓ None open', type: 'ok' }} />
            <KpiCard label="Closed OOS"         value={comp.closedOos}        accent="green" />
            <KpiCard label="E-Signatures"       value={comp.totalSignatures}  accent="teal" />
            <KpiCard label="System Status"      value={comp.systemStatus}     accent="green" badge={{ text: '● Live', type: 'ok' }} />
          </div>

          {/* Compliance info bar */}
          <div style={{ background: T.light, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['21 CFR Part 11', 'EU GMP Annex 11', 'ISO 17025', 'ALCOA+', 'GAMP 5', 'ICH Q1A'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.primary }}>
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {s}
              </div>
            ))}
          </div>
        </>
      )}

              {/* ── 3 Quick-View Widgets ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>

            {/* Widget 1 — Work Queue Snapshot */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 6h16M4 10h16M4 14h10" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Work Queue</span>
                </div>
                <button onClick={() => navigate('/work-queue')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.primary, fontWeight: 600, fontFamily: 'inherit' }}>View All →</button>
              </div>
              <div style={{ padding: '4px 0' }}>
                {recentTasks.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No pending tasks</div>
                ) : recentTasks.map((t, i) => {
                  const sc = { Assigned: { bg: '#dbeafe', color: '#1e40af' }, InProgress: { bg: '#fef9c3', color: '#854d0e' }, Completed: { bg: '#d1fae5', color: '#065f46' }, OOSOpen: { bg: '#fee2e2', color: '#991b1b' } }[t.status] ?? { bg: '#f1f5f9', color: '#374151' }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < recentTasks.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sampleNumber}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.materialName}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: sc.bg, color: sc.color }}>{t.status}</span>
                        {t.analystName && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{t.analystName}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Widget 2 — Recent Registrations */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Recent Samples</span>
                </div>
                <button onClick={() => navigate('/samples')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.primary, fontWeight: 600, fontFamily: 'inherit' }}>View All →</button>
              </div>
              <div style={{ padding: '4px 0' }}>
                {recentSamples.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No recent registrations</div>
                ) : recentSamples.map((s, i) => {
                  const sc = { Registered: { bg: '#dbeafe', color: '#1e40af' }, PendingTesting: { bg: '#fef9c3', color: '#854d0e' }, InTesting: { bg: '#fde8d8', color: '#9a3412' }, Released: { bg: '#d1fae5', color: '#065f46' }, Rejected: { bg: '#fee2e2', color: '#991b1b' } }[s.status] ?? { bg: '#f1f5f9', color: '#374151' }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < recentSamples.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sampleNumber}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.materialName}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: sc.bg, color: sc.color }}>{s.status}</span>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{_timeAgo(s.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Widget 3 — Welcome + Today's Pulse */}
            <div style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)', border: '1px solid #99f6e4', borderRadius: 10, padding: '18px 18px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Greeting */}
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {(() => { const h = new Date().getHours(); return h < 12 ? '🌅' : h < 17 ? '☀️' : '🌙' })()} {fullName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              {/* Today's pulse */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Registered Today', value: wip?.registeredToday ?? 0, color: '#0d9488', icon: '📋' },
                  { label: 'In Testing',        value: wip?.inTesting ?? 0,        color: '#2563eb', icon: '🔬' },
                  { label: 'Completed Today',   value: wip?.completedToday ?? 0,   color: '#16a34a', icon: '✅' },
                  { label: 'Overdue',           value: wip?.overdue ?? 0,          color: wip && wip.overdue > 0 ? '#dc2626' : '#9ca3af', icon: '⏰' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '7px 12px' }}>
                    <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 500 }}>{row.icon} {row.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {/* Status line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 11.5, color: '#0d6e6e', fontWeight: 600 }}>
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
