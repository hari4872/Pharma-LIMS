import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SiteKpi {
  labId: number; labName: string; site: string; location: string; labType: string
  totalSamples: number; registered: number; pendingTesting: number; inTesting: number
  pendingQAReview: number; released: number; rejected: number
  oosCount: number; oosRatePct: number; openCapa: number; overdueSamples: number
  pendingTransfers: number; avgTatDays: number; releaseRatePct: number
}

interface SiteTat {
  labId: number; labName: string
  minDays: number; avgDays: number; maxDays: number; sampleCount: number
}

// ── Colour palette (one per lab, cycles) ──────────────────────────────────────
const COLORS = ['#0d6e6e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#16a34a', '#0369a1', '#9d174d']
const labColor = (i: number) => COLORS[i % COLORS.length]

// ── Stat card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, alert }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? '#fff5f5' : '#fff',
      border: `1px solid ${alert ? '#fca5a5' : '#e5e7eb'}`,
      borderRadius: 10, padding: '14px 18px', minWidth: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: alert ? '#dc2626' : '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Site row card ─────────────────────────────────────────────────────────────
function SiteRow({ kpi, index }: { kpi: SiteKpi; index: number }) {
  const color = labColor(index)
  const pipelineTotal = kpi.totalSamples || 1

  const segments = [
    { key: 'released',       label: 'Released',      color: '#16a34a', value: kpi.released },
    { key: 'pendingQA',      label: 'Pending QA',    color: '#7c3aed', value: kpi.pendingQAReview },
    { key: 'inTesting',      label: 'In Testing',    color: '#d97706', value: kpi.inTesting },
    { key: 'pendingTesting', label: 'Pending Test',  color: '#2563eb', value: kpi.pendingTesting },
    { key: 'registered',     label: 'Registered',    color: '#6b7280', value: kpi.registered },
    { key: 'rejected',       label: 'Rejected',      color: '#dc2626', value: kpi.rejected },
  ]

  return (
    <div style={{ background: '#fff', border: `1px solid ${color}22`, borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{kpi.labName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {kpi.site && <span style={{ marginRight: 8 }}>📍 {kpi.site}</span>}
            {kpi.location && <span style={{ marginRight: 8 }}>🌍 {kpi.location}</span>}
            <span style={{ padding: '1px 7px', borderRadius: 8, background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600 }}>{kpi.labType}</span>
          </div>
        </div>
        {/* Quick KPIs */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{kpi.totalSamples}</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>TOTAL</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{kpi.releaseRatePct}%</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>RELEASED</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: kpi.oosRatePct > 5 ? '#dc2626' : '#374151' }}>{kpi.oosRatePct}%</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>OOS RATE</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#374151' }}>{kpi.avgTatDays}d</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>AVG TAT</div>
          </div>
          {kpi.overdueSamples > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{kpi.overdueSamples}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>OVERDUE</div>
            </div>
          )}
          {kpi.openCapa > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{kpi.openCapa}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>OPEN CAPA</div>
            </div>
          )}
          {kpi.pendingTransfers > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0369a1' }}>{kpi.pendingTransfers}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>TRANSFERS</div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline bar */}
      {kpi.totalSamples > 0 && (
        <div>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
            {segments.filter(s => s.value > 0).map(s => (
              <div key={s.key} style={{ width: `${(s.value / pipelineTotal) * 100}%`, background: s.color, transition: 'width 0.4s' }} title={`${s.label}: ${s.value}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {segments.filter(s => s.value > 0).map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{s.label}: <strong style={{ color: '#374151' }}>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MultiSiteDashboardPage() {
  const role = useSelector((s: RootState) => s.auth.role)
  const [kpis, setKpis]       = useState<SiteKpi[]>([])
  const [tat, setTat]         = useState<SiteTat[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod]   = useState(30)
  const [view, setView]       = useState<'overview' | 'pipeline' | 'tat'>('overview')

  async function load() {
    setLoading(true)
    try {
      const [k, t] = await Promise.all([
        api.get(`/site-analytics/kpis?periodDays=${period}`),
        api.get(`/site-analytics/tat?periodDays=${period}`),
      ])
      setKpis(k.data)
      setTat(t.data)
    } catch { /* handled by interceptor */ }
    finally { setLoading(false) }
  }

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [period])

  // Cross-lab access guard
  const isCrossLab = role === 'Admin' || role === 'SuperAdmin' || role === 'CorporateQA'
  if (!isCrossLab) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Access Restricted</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Multi-site dashboard is available to Admin, SuperAdmin and CorporateQA roles only.</div>
      </div>
    )
  }

  // Totals
  const totals = kpis.reduce((acc, k) => ({
    total:     acc.total     + k.totalSamples,
    released:  acc.released  + k.released,
    oos:       acc.oos       + k.oosCount,
    overdue:   acc.overdue   + k.overdueSamples,
    capa:      acc.capa      + k.openCapa,
    transfers: acc.transfers + k.pendingTransfers,
  }), { total: 0, released: 0, oos: 0, overdue: 0, capa: 0, transfers: 0 })

  // Pipeline chart data (per lab)
  const pipelineData = kpis.map(k => ({
    name:     k.labName.length > 12 ? k.labName.slice(0, 12) + '…' : k.labName,
    Released: k.released,
    Testing:  k.inTesting + k.pendingTesting,
    QA:       k.pendingQAReview,
    Registered: k.registered,
  }))

  // TAT chart data
  const tatData = tat.map(t => ({
    name:    t.labName.length > 12 ? t.labName.slice(0, 12) + '…' : t.labName,
    Min:     t.minDays,
    Avg:     t.avgDays,
    Max:     t.maxDays,
    Samples: t.sampleCount,
  }))

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid #e5e7eb', borderBottom: active ? '1px solid #fff' : '1px solid #e5e7eb',
    background: active ? '#fff' : '#f9fafb', color: active ? '#0d6e6e' : '#6b7280',
    fontWeight: active ? 700 : 500, fontSize: 13,
    marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 2 : 1,
  })

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
            🌐 Multi-Site Dashboard
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Consolidated view across {kpis.length} lab{kpis.length !== 1 ? 's' : ''} · {period}-day window
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={period}
            onChange={e => setPeriod(Number(e.target.value))}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <button onClick={load} disabled={loading}
            style={{ padding: '6px 14px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Global KPI strip ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Total Samples"     value={totals.total}     sub={`across ${kpis.length} labs`} />
        <KpiCard label="Released"          value={totals.released}  sub={totals.total > 0 ? `${Math.round(totals.released * 100 / totals.total)}% release rate` : ''} />
        <KpiCard label="OOS Events"        value={totals.oos}       alert={totals.oos > 0} />
        <KpiCard label="Overdue Samples"   value={totals.overdue}   alert={totals.overdue > 0} />
        <KpiCard label="Open CAPA"         value={totals.capa}      alert={totals.capa > 0} />
        <KpiCard label="Pending Transfers" value={totals.transfers} sub="inter-site" />
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
        <button style={TAB_STYLE(view === 'overview')}  onClick={() => setView('overview')}>📋 Site Overview</button>
        <button style={TAB_STYLE(view === 'pipeline')}  onClick={() => setView('pipeline')}>📊 Pipeline Chart</button>
        <button style={TAB_STYLE(view === 'tat')}       onClick={() => setView('tat')}>⏱ TAT Comparison</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 10px 10px 10px', padding: '20px 24px' }}>

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading…</div>
        )}

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        {!loading && view === 'overview' && (
          <>
            {kpis.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No active laboratories found.
              </div>
            ) : (
              kpis.map((k, i) => <SiteRow key={k.labId} kpi={k} index={i} />)
            )}
          </>
        )}

        {/* ── Pipeline chart tab ────────────────────────────────────────── */}
        {!loading && view === 'pipeline' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Sample Pipeline by Site</div>
            {pipelineData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={pipelineData} margin={{ top: 8, right: 24, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Registered" stackId="a" fill="#9ca3af" />
                  <Bar dataKey="Testing"    stackId="a" fill="#d97706" />
                  <Bar dataKey="QA"         stackId="a" fill="#7c3aed" />
                  <Bar dataKey="Released"   stackId="a" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* OOS rate comparison */}
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginTop: 24, marginBottom: 16 }}>OOS Rate by Site (%)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={kpis.map(k => ({ name: k.labName.length > 12 ? k.labName.slice(0, 12) + '…' : k.labName, 'OOS %': k.oosRatePct }))}
                margin={{ top: 4, right: 24, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'OOS Rate']} />
                <Bar dataKey="OOS %" radius={[4, 4, 0, 0]}>
                  {kpis.map((k) => (
                    <Cell key={k.labId} fill={k.oosRatePct > 5 ? '#dc2626' : k.oosRatePct > 2 ? '#d97706' : '#16a34a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {/* ── TAT comparison tab ────────────────────────────────────────── */}
        {!loading && view === 'tat' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
              Turnaround Time Comparison ({period}-day window, released samples only)
            </div>
            {tatData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No released samples in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tatData} margin={{ top: 8, right: 24, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="d" />
                  <Tooltip formatter={(v, name) => [`${v} days`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Min" fill="#d1fae5" />
                  <Bar dataKey="Avg" fill="#0d6e6e" />
                  <Bar dataKey="Max" fill="#fde68a" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* TAT table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 24 }}>
              <thead>
                <tr>
                  {['Lab', 'Min TAT', 'Avg TAT', 'Max TAT', 'Samples'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tat.map(t => (
                  <tr key={t.labId}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#111827' }}>{t.labName}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{t.minDays}d</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontWeight: 600 }}>{t.avgDays}d</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{t.maxDays}d</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{t.sampleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
