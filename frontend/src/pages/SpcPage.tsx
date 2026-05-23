import { useEffect, useState } from 'react'
import api from '@/api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SpcResult {
  parameterId: number; parameterName: string; unit: string | null; n: number
  mean: number; stddev: number; ucl: number; lcl: number
  usl: number | null; lsl: number | null
  cp: number | null; cpk: number | null
  outOfControl: boolean; rules: string[]
  points: SpcPoint[]
}
interface SpcPoint {
  executionId: number; sampleNumber: string; measuredAt: string
  value: number; isOos: boolean; isOot: boolean
}
interface Parameter { parameterId: number; parameterName: string; uom: string; methodName?: string }

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
}

// ─── Capability gauge colour ──────────────────────────────────────────────
function capabilityColor(val: number | null): string {
  if (val === null) return '#6b7280'
  if (val >= 1.67) return '#16a34a'
  if (val >= 1.33) return '#65a30d'
  if (val >= 1.00) return '#d97706'
  return '#dc2626'
}

// ─── Custom dot to highlight OOS / OOT / OOC ──────────────────────────────
function CustomDot(props: any) {
  const { cx, cy, payload } = props
  if (payload.isOos) return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
  if (payload.isOot) return <circle cx={cx} cy={cy} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
  return <circle cx={cx} cy={cy} r={3} fill="#0d9488" />
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SpcPage() {
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [selectedId,  setSelectedId]  = useState('')
  const [points,      setPoints]      = useState('50')
  const [result,      setResult]      = useState<SpcResult | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    api.get('/parameters').then(r => setParameters(r.data)).catch(() => {})
  }, [])

  async function calculate() {
    if (!selectedId) return
    setLoading(true); setError('')
    try {
      const r = await api.get(`/spc/${selectedId}?points=${points}`)
      setResult(r.data)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to calculate SPC')
    } finally { setLoading(false) }
  }

  const chartData = result?.points.map((p, i) => ({
    idx:          i + 1,
    sampleNumber: p.sampleNumber,
    value:        p.value,
    mean:         result.mean,
    ucl:          result.ucl,
    lcl:          result.lcl,
    usl:          result.usl,
    lsl:          result.lsl,
    isOos:        p.isOos,
    isOot:        p.isOot,
    label:        new Date(p.measuredAt).toLocaleDateString(),
  })) ?? []

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          SPC Control Chart
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Statistical Process Control — Shewhart X̄ chart, Cp/Cpk, Nelson rules
        </p>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Parameter</label>
          <select style={inp} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Select parameter…</option>
            {parameters.map(p => (
              <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.uom})</option>
            ))}
          </select>
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Data points</label>
          <select style={inp} value={points} onChange={e => setPoints(e.target.value)}>
            {['20', '30', '50', '100', '200'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={calculate}
          disabled={!selectedId || loading}
          style={{
            padding: '8px 20px', background: '#0d6e6e', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            fontFamily: 'inherit', opacity: !selectedId ? 0.6 : 1,
            marginBottom: 1,
          }}>
          {loading ? 'Calculating…' : '▶ Calculate'}
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', marginBottom: 16 }}>{error}</div>}

      {result && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'N (Points)',    value: result.n,      color: '#2563eb',  sub: null },
              { label: 'Mean (X̄)',     value: result.mean,   color: '#0d6e6e',  sub: result.unit },
              { label: 'Std Dev (σ)',   value: result.stddev, color: '#7c3aed',  sub: result.unit },
              { label: 'UCL (+3σ)',     value: result.ucl,    color: '#d97706',  sub: result.unit },
              { label: 'LCL (−3σ)',     value: result.lcl,    color: '#d97706',  sub: result.unit },
              {
                label: 'Cp',
                value: result.cp !== null ? result.cp : '—',
                color: capabilityColor(result.cp), sub: result.cp !== null ? (result.cp >= 1.33 ? 'Capable' : result.cp >= 1.00 ? 'Marginal' : 'Incapable') : 'No spec',
              },
              {
                label: 'Cpk',
                value: result.cpk !== null ? result.cpk : '—',
                color: capabilityColor(result.cpk), sub: result.cpk !== null ? (result.cpk >= 1.33 ? 'Capable' : result.cpk >= 1.00 ? 'Marginal' : 'Incapable') : 'No spec',
              },
            ].map(card => (
              <div key={card.label} style={{
                background: '#fff', borderRadius: 10, padding: '14px 16px',
                border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                {card.sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{card.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── OOC / Rules banner ── */}
          {result.outOfControl && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b', marginBottom: 6 }}>⚠ Process Out of Control — Nelson Rule Violations</div>
              {result.rules.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#7f1d1d', marginTop: 3 }}>• {r}</div>
              ))}
            </div>
          )}
          {!result.outOfControl && result.n >= 2 && (
            <div style={{ marginBottom: 16, padding: '10px 16px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
              <span style={{ fontSize: 13, color: '#0d6e6e', fontWeight: 600 }}>✓ Process In Control — No Nelson rule violations detected</span>
            </div>
          )}

          {/* ── Control Chart ── */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '20px 16px', border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
              {result.parameterName} — X̄ Control Chart
              <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>Last {result.n} measurements</span>
            </div>

            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={60} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.sampleNumber}</div>
                          <div>Value: <strong>{d.value}</strong> {result.unit}</div>
                          <div>Mean: {d.mean}</div>
                          {d.isOos && <div style={{ color: '#ef4444', fontWeight: 700 }}>● OOS</div>}
                          {d.isOot && <div style={{ color: '#f59e0b', fontWeight: 700 }}>● OOT</div>}
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />

                  {/* Control limits */}
                  <ReferenceLine y={result.ucl} stroke="#f97316" strokeDasharray="6 3" label={{ value: `UCL ${result.ucl}`, fontSize: 10, fill: '#f97316', position: 'insideTopRight' }} />
                  <ReferenceLine y={result.mean} stroke="#0d9488" strokeDasharray="4 2" label={{ value: `X̄ ${result.mean}`, fontSize: 10, fill: '#0d9488', position: 'insideTopRight' }} />
                  <ReferenceLine y={result.lcl} stroke="#f97316" strokeDasharray="6 3" label={{ value: `LCL ${result.lcl}`, fontSize: 10, fill: '#f97316', position: 'insideBottomRight' }} />

                  {/* Spec limits */}
                  {result.usl !== null && (
                    <ReferenceLine y={result.usl} stroke="#dc2626" strokeDasharray="3 3" label={{ value: `USL ${result.usl}`, fontSize: 10, fill: '#dc2626', position: 'insideTopLeft' }} />
                  )}
                  {result.lsl !== null && (
                    <ReferenceLine y={result.lsl} stroke="#dc2626" strokeDasharray="3 3" label={{ value: `LSL ${result.lsl}`, fontSize: 10, fill: '#dc2626', position: 'insideBottomLeft' }} />
                  )}

                  {/* Data line with custom dot */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0d9488"
                    strokeWidth={1.8}
                    dot={<CustomDot />}
                    activeDot={{ r: 6, fill: '#0d6e6e' }}
                    name={result.parameterName}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
                Not enough data points to render control chart (need ≥ 2 measurements)
              </div>
            )}

            {/* Legend for dots */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} />
                Normal
              </span>
              <span style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                OOT
              </span>
              <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                OOS
              </span>
            </div>
          </div>

          {/* ── Raw Data Table ── */}
          {result.points.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f3f4', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Raw Data ({result.n} points)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['#', 'Sample', 'Date', 'Value', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.points.map((p, i) => (
                      <tr key={i} style={{ background: p.isOos ? '#fff1f2' : p.isOot ? '#fffbeb' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 12px', color: '#6b7280' }}>{i + 1}</td>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.sampleNumber}</td>
                        <td style={{ padding: '6px 12px', color: '#374151' }}>{new Date(p.measuredAt).toLocaleDateString()}</td>
                        <td style={{ padding: '6px 12px', fontWeight: 700 }}>{p.value} {result.unit}</td>
                        <td style={{ padding: '6px 12px' }}>
                          {p.isOos ? <span style={{ color: '#ef4444', fontWeight: 700 }}>OOS</span>
                            : p.isOot ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>OOT</span>
                              : <span style={{ color: '#16a34a' }}>OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
