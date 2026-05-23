import { useEffect, useState } from 'react'
import api from '@/api/client'

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

const MetricCard = ({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) => (
  <div style={{ background: '#fff', border: `1px solid ${warn ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, padding: '16px 20px', flex: '1 1 160px' }}>
    <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
    <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, color: warn ? '#dc2626' : '#111827' }}>{value}</p>
    {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{sub}</p>}
  </div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ margin: '28px 0 12px', fontSize: 15, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>{children}</h3>
)

const instStatusColour = (s: string) => {
  if (s === 'Available')   return '#d1fae5'
  if (s === 'InUse')       return '#dbeafe'
  if (s === 'Maintenance') return '#fef3c7'
  if (s === 'OutOfCalibration') return '#fee2e2'
  return '#f3f4f6'
}

export default function DashboardPage() {
  const [wip, setWip]     = useState<WipSummary | null>(null)
  const [tat, setTat]     = useState<TatSummary | null>(null)
  const [kpis, setKpis]   = useState<QualityKpis | null>(null)
  const [board, setBoard] = useState<InstrumentBoardItem[]>([])
  const [comp, setComp]   = useState<ComplianceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [w, t, k, b, c] = await Promise.all([
        api.get('/dashboard/wip'),
        api.get('/dashboard/tat'),
        api.get('/dashboard/quality-kpis'),
        api.get('/dashboard/instrument-board'),
        api.get('/dashboard/compliance'),
      ])
      setWip(w.data); setTat(t.data); setKpis(k.data); setBoard(b.data); setComp(c.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ padding: 32, color: '#6b7280' }}>Loading dashboard…</div>

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111827' }}>Lab Dashboard</h2>
        <button onClick={load} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: '#fff' }}>↻ Refresh</button>
      </div>

      {/* ── WIP Panel ── */}
      <SectionTitle>Work in Progress</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <MetricCard label="Registered Today"  value={wip?.registeredToday ?? 0} />
        <MetricCard label="In Testing"        value={wip?.inTesting ?? 0} />
        <MetricCard label="Completed Today"   value={wip?.completedToday ?? 0} />
        <MetricCard label="Overdue"           value={wip?.overdue ?? 0} warn={(wip?.overdue ?? 0) > 0} sub="Past DueDate, not Released" />
        <MetricCard label="Tests Pending"     value={wip?.testsPending ?? 0} />
        <MetricCard label="Tests In Progress" value={wip?.testsInProgress ?? 0} />
        <MetricCard label="Tests Completed"   value={wip?.testsCompleted ?? 0} />
      </div>
      {(wip?.analystWorkloads?.length ?? 0) > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={th}>Analyst</th>
                <th style={th}>Active Assignments</th>
              </tr>
            </thead>
            <tbody>
              {wip!.analystWorkloads.map(a => (
                <tr key={a.analystId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={td}>{a.fullName}</td>
                  <td style={td}>{a.assignedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAT Panel ── */}
      <SectionTitle>Turnaround Time — Last {tat?.periodDays ?? 30} Days</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <MetricCard label="Avg TAT (hrs)" value={(tat?.avgTatHours ?? 0).toFixed(1)} />
        <MetricCard label="Target (hrs)"  value={(tat?.targetHours ?? 0).toFixed(0)} sub="From lab_config tat_target_hrs" />
        <MetricCard label="Breach Count"  value={tat?.breachCount ?? 0} warn={(tat?.breachCount ?? 0) > 0} sub="Completed tests over target" />
      </div>
      {(tat?.byAnalyst?.length ?? 0) > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={th}>Analyst</th>
                <th style={th}>Avg TAT (hrs)</th>
                <th style={th}>vs Target</th>
              </tr>
            </thead>
            <tbody>
              {tat!.byAnalyst.map(a => {
                const over = a.avgTatHours > (tat?.targetHours ?? 48)
                return (
                  <tr key={a.analystId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{a.fullName}</td>
                    <td style={td}>{a.avgTatHours.toFixed(1)}</td>
                    <td style={{ ...td, color: over ? '#dc2626' : '#16a34a', fontWeight: 500 }}>{over ? '▲ Over' : '✓ On Track'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quality KPIs Panel ── */}
      <SectionTitle>Quality KPIs — Last {kpis?.periodDays ?? 30} Days</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard label="OOS Rate"   value={`${kpis?.oosRate ?? 0}%`} warn={(kpis?.oosRate ?? 0) > 0} />
        <MetricCard label="OOT Rate"   value={`${kpis?.ootRate ?? 0}%`} warn={(kpis?.ootRate ?? 0) > 0} />
        <MetricCard label="RFT Rate"   value={`${kpis?.rftRate ?? 0}%`} sub="Right First Time (Released)" />
        <MetricCard label="Re-Test Rate" value={`${kpis?.retestRate ?? 0}%`} />
        <MetricCard label="Open CAPAs" value={kpis?.openCapas ?? 0} warn={(kpis?.openCapas ?? 0) > 0} />
      </div>

      {/* ── Instrument Status Board ── */}
      <SectionTitle>Instrument Status Board</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={th}>Code</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <th style={th}>Cal. Due</th>
              <th style={th}>Cal Days Remaining</th>
              <th style={th}>Utilisation (latest)</th>
              <th style={th}>Open Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {board.map(i => (
              <tr key={i.instrumentId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{i.instrumentCode}</td>
                <td style={td}>{i.instrumentType}</td>
                <td style={td}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: instStatusColour(i.statusText), color: '#374151' }}>{i.statusText}</span>
                </td>
                <td style={td}>{i.calibrationDue}</td>
                <td style={{ ...td, color: i.calDaysRemaining <= 7 ? '#dc2626' : i.calDaysRemaining <= 30 ? '#d97706' : '#374151', fontWeight: i.calDaysRemaining <= 7 ? 600 : 400 }}>
                  {i.calDaysRemaining}d
                </td>
                <td style={td}>{i.latestUtilPct != null ? `${i.latestUtilPct}%` : '—'}</td>
                <td style={{ ...td, color: i.openBreakdownId ? '#dc2626' : '#9ca3af' }}>
                  {i.openBreakdownId ? `#${i.openBreakdownId}` : '—'}
                </td>
              </tr>
            ))}
            {board.length === 0 && <tr><td colSpan={7} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>No active instruments</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Compliance Summary ── */}
      {comp && (
        <>
          <SectionTitle>Compliance Overview</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <MetricCard label="Total Audit Events" value={comp.totalAuditEvents} />
            <MetricCard label="Open OOS"           value={comp.openOos}   warn={comp.openOos > 0} />
            <MetricCard label="Closed OOS"         value={comp.closedOos} />
            <MetricCard label="E-Signatures"       value={comp.totalSignatures} />
            <MetricCard label="System Status"      value={comp.systemStatus} />
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e5e7eb' }
const td: React.CSSProperties = { padding: '10px 12px', color: '#374151' }
