import { useEffect, useState } from 'react'
import api from '@/api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
type ReportType = 'samples' | 'results' | 'audit-trail' | 'multi-site-summary'
type PageTab    = 'exports' | 'charts'

interface SpcPoint  { executionId: number; sampleNumber: string; measuredAt: string; value: number; isOos: boolean; isOot: boolean }
interface SpcResult { parameterId: number; parameterName: string; unit: string | null; n: number; mean: number; stddev: number; ucl: number; lcl: number; usl: number | null; lsl: number | null; cp: number | null; cpk: number | null; outOfControl: boolean; rules: string[]; points: SpcPoint[] }
interface Parameter { parameterId: number; parameterName: string; uom: string }

const REPORTS = [
  {
    id: 'samples' as ReportType,
    title: 'Sample Register',
    desc: 'All sample registrations with status, material, lot, analyst, and TAT data',
    icon: '🧪',
    color: '#0284c7',
    bg: '#e0f2fe',
    filters: ['status'],
  },
  {
    id: 'results' as ReportType,
    title: 'Test Results',
    desc: 'Digital logbook entries with values, OOS/OOT flags, and analyst sign-off status',
    icon: '📊',
    color: '#7c3aed',
    bg: '#f3e8ff',
    filters: [],
  },
  {
    id: 'audit-trail' as ReportType,
    title: 'Audit Trail',
    desc: '21 CFR Part 11 compliant audit log — all create/update/approve/retire events',
    icon: '🔍',
    color: '#b45309',
    bg: '#fef3c7',
    filters: ['entityType'],
    adminOnly: true,
  },
  {
    id: 'multi-site-summary' as ReportType,
    title: 'Multi-Site Summary',
    desc: 'Consolidated cross-site KPIs, pipeline status, OOS rates and TAT breakdown per laboratory',
    icon: '🌐',
    color: '#1d4ed8',
    bg: '#dbeafe',
    filters: [],
    adminOnly: true,
  },
]

const SAMPLE_STATUSES = ['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected']
const ENTITY_TYPES    = ['User', 'Sample', 'Instrument', 'Material', 'TestMethod', 'SpecLimit', 'CoA']

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
}

function capabilityColor(v: number | null): string {
  if (v === null) return '#6b7280'
  if (v >= 1.67) return '#16a34a'
  if (v >= 1.33) return '#65a30d'
  if (v >= 1.00) return '#d97706'
  return '#dc2626'
}

function CustomDot(props: { cx?: number; cy?: number; payload?: { isOos?: boolean; isOot?: boolean } }) {
  const { cx, cy, payload } = props
  if (payload?.isOos) return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
  if (payload?.isOot) return <circle cx={cx} cy={cy} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
  return <circle cx={cx} cy={cy} r={3} fill="#0d9488" />
}

export default function ReportsPage() {
  // ── Exports tab state ──
  const [selected,    setSelected]    = useState<ReportType | null>(null)
  const [from,        setFrom]        = useState('')
  const [to,          setTo]          = useState('')
  const [status,      setStatus]      = useState('')
  const [entityType,  setEntityType]  = useState('')
  const [downloading, setDownloading] = useState(false)
  const [dlError,     setDlError]     = useState('')

  // ── Charts tab state ──
  const [pageTab,     setPageTab]     = useState<PageTab>('exports')
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [paramId,     setParamId]     = useState<string>('')
  const [spcPoints,   setSpcPoints]   = useState<string>('50')
  const [spcData,     setSpcData]     = useState<SpcResult | null>(null)
  const [spcLoading,  setSpcLoading]  = useState(false)
  const [spcError,    setSpcError]    = useState('')

  // Load parameter list once when Charts tab is opened
  useEffect(() => {
    if (pageTab !== 'charts') return
    if (parameters.length > 0) return
    api.get('/parameters').then(r => {
      const list: Parameter[] = Array.isArray(r.data) ? r.data : []
      setParameters(list)
      if (list.length > 0) setParamId(String(list[0].parameterId))
    }).catch(() => {})
  }, [pageTab])

  async function loadSpc() {
    if (!paramId) return
    setSpcLoading(true); setSpcError(''); setSpcData(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const r = await api.get(`/spc/${paramId}?points=${spcPoints}`, { signal: controller.signal })
      setSpcData(r.data ?? null)
      if (!r.data || r.data.n === 0) setSpcError('No result data found for this parameter yet.')
    } catch (e: unknown) {
      const msg = (e as { name?: string })?.name === 'AbortError' || (e as { code?: string })?.code === 'ERR_CANCELED'
        ? 'Request timed out — backend may be slow or parameter has no data.'
        : 'Failed to load SPC data. Check that results exist for this parameter.'
      setSpcError(msg)
    } finally { clearTimeout(timer); setSpcLoading(false) }
  }

  async function download() {
    if (!selected) return
    setDownloading(true); setDlError('')
    try {
      const params = new URLSearchParams()
      if (from)       params.set('from', from)
      if (to)         params.set('to', to)
      if (status)     params.set('status', status)
      if (entityType) params.set('entityType', entityType)
      const url = `/reports/${selected}?${params.toString()}`
      const response = await api.get(url, { responseType: 'blob' })
      const cd = response.headers['content-disposition'] ?? ''
      const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = match?.[1]?.replace(/['"]/g, '') ?? `LIMS_${selected}_${new Date().toISOString().slice(0,10)}.xlsx`
      const blobUrl = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a'); a.href = blobUrl; a.download = filename; a.click()
      URL.revokeObjectURL(blobUrl)
    } catch { setDlError('Export failed. Check your access permissions or date range.') }
    finally { setDownloading(false) }
  }

  const report = REPORTS.find(r => r.id === selected)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Reports & Exports</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Download Excel reports and view SPC / quality control charts
        </p>
      </div>

      {/* ── Page tab nav ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['exports', 'charts'] as PageTab[]).map(t => (
          <button key={t} onClick={() => setPageTab(t)} style={{
            padding: '7px 22px', fontSize: 13, fontWeight: pageTab === t ? 700 : 500,
            color: pageTab === t ? '#0d9488' : '#5f6368',
            background: pageTab === t ? '#fff' : 'transparent',
            border: pageTab === t ? '1px solid #d1fae5' : '1px solid transparent',
            borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: pageTab === t ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
          }}>
            {t === 'exports' ? '⬇ Excel Exports' : '📈 SPC Charts'}
          </button>
        ))}
      </div>

      {/* ══ EXPORTS TAB ══ */}
      {pageTab === 'exports' && (
        <div style={{ display: 'flex', gap: 0, minHeight: 480, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          {/* Left panel — report type list */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {REPORTS.map(r => (
              <div key={r.id} onClick={() => { setSelected(r.id); setStatus(''); setEntityType('') }} style={{
                display: 'flex', alignItems: 'flex-start',
                cursor: 'pointer',
                borderLeft: `4px solid ${selected === r.id ? r.color : 'transparent'}`,
                background: selected === r.id ? r.bg : 'transparent',
                borderBottom: '1px solid #e2e8f0', transition: 'all 0.12s',
              }}>
                <div style={{ padding: '16px 18px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{r.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selected === r.id ? r.color : '#0f172a' }}>{r.title}</span>
                    {r.adminOnly && <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '1px 6px' }}>QA/Admin</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right panel — export config */}
          <div style={{ flex: 1, padding: '28px 32px' }}>
            {selected && report ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Export: {report.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>From Date</label>
                    <input type="date" style={{ ...inp, width: '100%' }} value={from} onChange={e => setFrom(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>To Date</label>
                    <input type="date" style={{ ...inp, width: '100%' }} value={to} onChange={e => setTo(e.target.value)} />
                  </div>
                </div>
                {report.filters.includes('status') && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Filter by Status (optional)</label>
                    <select style={{ ...inp, width: '100%' }} value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      {SAMPLE_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {report.filters.includes('entityType') && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Filter by Entity Type (optional)</label>
                    <select style={{ ...inp, width: '100%' }} value={entityType} onChange={e => setEntityType(e.target.value)}>
                      <option value="">All Entity Types</option>
                      {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ padding: '10px 14px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4', marginBottom: 16, fontSize: 12, color: '#0f766e' }}>
                  📥 Output: Excel (.xlsx) — formatted with teal header row, auto-fitted columns, header/footer with date stamp
                </div>
                {dlError && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>{dlError}</div>}
                <button onClick={download} disabled={downloading} style={{
                  width: '100%', padding: '11px 0',
                  background: downloading ? '#9ca3af' : report.color,
                  color: '#fff', border: 'none', borderRadius: 9,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                }}>
                  {downloading ? '⏳ Generating Excel…' : `⬇ Download ${report.title} Excel`}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Select a report type</div>
                <div style={{ fontSize: 13 }}>Choose from the list on the left to configure and download</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CHARTS TAB ══ */}
      {pageTab === 'charts' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px 28px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Parameter</label>
              <select style={{ ...inp, width: '100%' }} value={paramId} onChange={e => setParamId(e.target.value)}>
                {parameters.length === 0 && <option value="">Loading…</option>}
                {parameters.map(p => <option key={p.parameterId} value={p.parameterId}>{p.parameterName}{p.uom ? ` (${p.uom})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Last N Points</label>
              <select style={{ ...inp, width: 110 }} value={spcPoints} onChange={e => setSpcPoints(e.target.value)}>
                {['25','50','100','200'].map(n => <option key={n} value={n}>{n} points</option>)}
              </select>
            </div>
            <button onClick={loadSpc} disabled={spcLoading || !paramId} style={{
              padding: '7px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: spcLoading ? 'not-allowed' : 'pointer',
              opacity: spcLoading ? 0.7 : 1,
            }}>
              {spcLoading ? 'Loading…' : 'Load Chart'}
            </button>
            {spcData && (
              <button onClick={() => window.print()} style={{
                padding: '7px 20px', background: '#fff', color: '#374151', border: '1px solid #e0e0e0', borderRadius: 8,
                fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                🖨 Print / PDF
              </button>
            )}
          </div>

          {spcError && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{spcError}</div>
          )}

          {!spcData && !spcLoading && !spcError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Select a parameter and click Load Chart</div>
              <div style={{ fontSize: 13 }}>SPC control chart with UCL/LCL, Cp/Cpk capability index</div>
            </div>
          )}

          {spcData && (
            <>
              {/* KPI cards */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                {[
                  { label: 'N',       value: spcData.n,                         color: '#0369a1' },
                  { label: 'Mean',    value: spcData.mean.toFixed(3),            color: '#0369a1' },
                  { label: 'Std Dev', value: spcData.stddev.toFixed(3),          color: '#0369a1' },
                  { label: 'UCL',     value: spcData.ucl.toFixed(3),             color: '#ef4444' },
                  { label: 'LCL',     value: spcData.lcl.toFixed(3),             color: '#ef4444' },
                  { label: 'Cp',      value: spcData.cp?.toFixed(2) ?? '—',      color: capabilityColor(spcData.cp) },
                  { label: 'Cpk',     value: spcData.cpk?.toFixed(2) ?? '—',     color: capabilityColor(spcData.cpk) },
                ].map(k => (
                  <div key={k.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', minWidth: 80, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
                {spcData.outOfControl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                    ⚠ Out of Control
                    {spcData.rules.length > 0 && <span style={{ fontWeight: 400 }}>— {spcData.rules.join(', ')}</span>}
                  </div>
                )}
              </div>

              {/* SPC chart */}
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                SPC Control Chart — {spcData.parameterName}{spcData.unit ? ` (${spcData.unit})` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, display: 'flex', gap: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> OOS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> OOT</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} /> In Control</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={spcData.points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="sampleNumber" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v) => [typeof v === 'number' ? v.toFixed(4) : v, 'Value']}
                    labelFormatter={(l) => `Sample: ${l}`}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <ReferenceLine y={spcData.ucl}  stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'UCL', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                  <ReferenceLine y={spcData.lcl}  stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'LCL', fill: '#ef4444', fontSize: 10, position: 'insideBottomRight' }} />
                  <ReferenceLine y={spcData.mean} stroke="#64748b" strokeDasharray="6 3" label={{ value: 'Mean', fill: '#64748b', fontSize: 10, position: 'insideTopLeft' }} />
                  {spcData.usl != null && <ReferenceLine y={spcData.usl} stroke="#b45309" strokeDasharray="2 4" label={{ value: 'USL', fill: '#b45309', fontSize: 10, position: 'insideTopRight' }} />}
                  {spcData.lsl != null && <ReferenceLine y={spcData.lsl} stroke="#b45309" strokeDasharray="2 4" label={{ value: 'LSL', fill: '#b45309', fontSize: 10, position: 'insideBottomRight' }} />}
                  <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={1.8}
                    dot={<CustomDot />} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  )
}
