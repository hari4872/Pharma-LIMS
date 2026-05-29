import { useEffect, useState, useCallback } from 'react'
import api from '@/api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface StabilityProtocol {
  stabilityProtocolId: number
  protocolCode: string
  protocolName: string
  materialName: string
  storageCondition: string
  studyDurationMonths: number
  isActive: boolean
}

interface TrendDataPoint {
  monthOffset: number
  timePointLabel: string
  value: number
  isOos: boolean
  sampleNumber: string
}

interface TrendParameter {
  parameterId: number
  parameterName: string
  unit: string | null
  specMin: number | null
  specMax: number | null
  predictedShelfLifeMonths: number | null
  rSquared: number | null
  dataPoints: TrendDataPoint[]
}

interface StabilityTrendResult {
  protocolId: number
  protocolName: string
  storageCondition: string
  studyDurationMonths: number
  intendedShelfLifeMonths: number | null
  parameters: TrendParameter[]
}

interface IchIntervalStatus {
  monthOffset: number
  label: string
  isMandatory: boolean
  isPulled: boolean
  pullId: number | null
  status: string
  pulledAt: string | null
}

interface IchComplianceResult {
  protocolId: number
  storageCondition: string
  intervals: IchIntervalStatus[]
}

// ── ICH Regression Trend (new endpoint: /stability-trend/{protocolId}/{parameterId}) ──
interface IchTrendReport {
  protocolId: number; parameterId: number
  parameterName: string; protocolName: string
  specMin: number | null; specMax: number | null
  timePoints: { timePointMonths: number; label: string; measuredValue: number; measuredAt: string }[]
  regressionSlope: number | null; regressionIntercept: number | null
  mean: number | null; stdDev: number | null
  predictedShelfLifeMonths: number | null
  flag: number  // 0=Stable, 1=WatchNeeded, 2=ActionRequired
}

function IchRegressionPanel({ protocolId, parameterId, paramName, onClose }: {
  protocolId: number; parameterId: number; paramName: string; onClose: () => void
}) {
  const [report, setReport]   = useState<IchTrendReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  useEffect(() => {
    setLoading(true); setErr('')
    api.get<IchTrendReport>(`/stability-trend/${protocolId}/${parameterId}`)
      .then(r => setReport(r.data))
      .catch(() => setErr('Failed to load regression data'))
      .finally(() => setLoading(false))
  }, [protocolId, parameterId])

  const FLAG_STYLE: Record<number, { bg: string; color: string; label: string }> = {
    0: { bg: '#d1fae5', color: '#065f46', label: '✓ Stable' },
    1: { bg: '#fef9c3', color: '#92400e', label: '⚠ Watch Needed' },
    2: { bg: '#fee2e2', color: '#991b1b', label: '✗ Action Required' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 640, padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>ICH Q1A Linear Regression — {paramName}</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>Protocol #{protocolId} · Statistical trending per ICH Q1A(R2)</p>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>×</button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>Calculating regression…</div>}
        {err    && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}

        {report && !loading && (
          <>
            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Flag', value: <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, ...FLAG_STYLE[report.flag] }}>{FLAG_STYLE[report.flag]?.label ?? '—'}</span> },
                { label: 'Predicted Shelf Life', value: report.predictedShelfLifeMonths != null ? `${report.predictedShelfLifeMonths} months` : '—' },
                { label: 'Slope / month', value: report.regressionSlope != null ? report.regressionSlope.toFixed(4) : '—' },
                { label: 'Intercept', value: report.regressionIntercept != null ? report.regressionIntercept.toFixed(4) : '—' },
                { label: 'Mean', value: report.mean != null ? report.mean.toFixed(4) : '—' },
                { label: 'Std Dev', value: report.stdDev != null ? `±${report.stdDev.toFixed(4)}` : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9fafb', borderRadius: 7, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Time points table */}
            {report.timePoints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                No trend points recorded yet. Record pull results via Stability Pulls to populate.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Time Point', 'Measured Value', 'Spec Min', 'Spec Max', 'Pass/Fail'].map(h =>
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.timePoints.map((tp, i) => {
                    const pass = (report.specMin == null || tp.measuredValue >= report.specMin) &&
                                 (report.specMax == null || tp.measuredValue <= report.specMax)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{tp.label || `T=${tp.timePointMonths}M`}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{tp.measuredValue}</td>
                        <td style={{ padding: '7px 12px', color: '#6b7280' }}>{report.specMin ?? '—'}</td>
                        <td style={{ padding: '7px 12px', color: '#6b7280' }}>{report.specMax ?? '—'}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: pass ? '#d1fae5' : '#fee2e2', color: pass ? '#065f46' : '#991b1b' }}>
                            {pass ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function storageColor(condition: string): React.CSSProperties {
  const c = condition.toLowerCase()
  if (c.includes('25'))  return { background: '#d1fae5', color: '#065f46' }
  if (c.includes('40'))  return { background: '#ffedd5', color: '#9a3412' }
  if (c.includes('-20')) return { background: '#dbeafe', color: '#1e40af' }
  if (c.includes('-80')) return { background: '#ede9fe', color: '#5b21b6' }
  if (c.includes('30'))  return { background: '#fef9c3', color: '#854d0e' }
  return { background: '#f3f4f6', color: '#374151' }
}

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  Pulled:     { background: '#d1fae5', color: '#065f46' },
  Pending:    { background: '#fef9c3', color: '#854d0e' },
  Missed:     { background: '#fee2e2', color: '#991b1b' },
  'Due Soon': { background: '#ffedd5', color: '#9a3412' },
}

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, ...style }}>
      {label}
    </span>
  )
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props
  return (
    <circle cx={cx} cy={cy} r={4}
      fill={payload.isOos ? '#ef4444' : '#3b82f6'}
      stroke={payload.isOos ? '#b91c1c' : '#1d4ed8'}
      strokeWidth={1.5} />
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: TrendDataPoint = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.timePointLabel}</div>
      <div>Value: <strong>{d.value}</strong></div>
      <div style={{ color: '#6b7280' }}>Sample: {d.sampleNumber}</div>
      {d.isOos && <div style={{ color: '#ef4444', fontWeight: 600 }}>⚠ OOS</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StabilityStudyPage() {
  const [protocols, setProtocols]         = useState<StabilityProtocol[]>([])
  const [selectedId, setSelectedId]       = useState<number | null>(null)
  const [trendResult, setTrendResult]     = useState<StabilityTrendResult | null>(null)
  const [ichResult, setIchResult]         = useState<IchComplianceResult | null>(null)
  const [loadingList, setLoadingList]     = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError]     = useState<string | null>(null)
  // ICH regression panel
  const [ichRegParam, setIchRegParam]     = useState<{ protocolId: number; parameterId: number; paramName: string } | null>(null)

  useEffect(() => {
    setLoadingList(true)
    api.get<StabilityProtocol[]>('/stability-protocols')
      .then(r => setProtocols(r.data))
      .catch(() => setProtocols([]))
      .finally(() => setLoadingList(false))
  }, [])

  const loadProtocol = useCallback((id: number) => {
    setSelectedId(id)
    setTrendResult(null)
    setIchResult(null)
    setDetailError(null)
    setLoadingDetail(true)
    Promise.all([
      api.get<StabilityTrendResult>(`/stability-protocols/${id}/trend`),
      api.get<IchComplianceResult>(`/stability-protocols/${id}/ich-compliance`),
    ])
      .then(([t, i]) => { setTrendResult(t.data); setIchResult(i.data) })
      .catch(() => setDetailError('Failed to load stability trend data. Please try again.'))
      .finally(() => setLoadingDetail(false))
  }, [])

  const mandatoryIntervals = ichResult?.intervals.filter(i => i.isMandatory) ?? []
  const completedMandatory = mandatoryIntervals.filter(i => i.isPulled).length

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 500, background: '#f9fafb', gap: 0 }}>
      {ichRegParam && (
        <IchRegressionPanel
          protocolId={ichRegParam.protocolId}
          parameterId={ichRegParam.parameterId}
          paramName={ichRegParam.paramName}
          onClose={() => setIchRegParam(null)}
        />
      )}

      {/* ── Left sidebar: Protocol list ────────────────────────────────────── */}
      <div style={{ width: 280, minWidth: 280, borderRight: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', borderRadius: '10px 0 0 10px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151' }}>
            📊 Stability Protocols
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loadingList && <div style={{ padding: 16, fontSize: 13, color: '#9ca3af' }}>Loading…</div>}
          {!loadingList && protocols.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              No stability protocols found. Create protocols in Settings → Stability Protocols.
            </div>
          )}
          {protocols.map(p => (
            <div key={p.stabilityProtocolId}
              onClick={() => loadProtocol(p.stabilityProtocolId)}
              style={{
                margin: '4px 10px', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: selectedId === p.stabilityProtocolId ? '2px solid #0d9488' : '1px solid #e5e7eb',
                background: selectedId === p.stabilityProtocolId ? '#f0fdfa' : '#fff',
                transition: 'border-color .15s, background .15s',
              }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{p.protocolCode}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{p.protocolName}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{p.materialName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={p.storageCondition} style={storageColor(p.storageCondition)} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.studyDurationMonths}mo</span>
                {!p.isActive && <Badge label="Inactive" style={{ background: '#f3f4f6', color: '#9ca3af' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Empty state */}
        {!selectedId && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: '#9ca3af', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select a Protocol</div>
            <div style={{ maxWidth: 320, lineHeight: 1.6, fontSize: 13 }}>
              Choose a stability protocol from the left panel to view ICH Q1A trend charts and compliance status.
            </div>
          </div>
        )}

        {/* Loading */}
        {selectedId && loadingDetail && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 13 }}>
            Loading stability data…
          </div>
        )}

        {/* Detail error */}
        {selectedId && !loadingDetail && detailError && (
          <div style={{ margin: '24px 0', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            ⚠ {detailError}
          </div>
        )}

        {/* Protocol detail */}
        {selectedId && !loadingDetail && trendResult && (
          <>
            {/* Protocol header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{trendResult.protocolName}</h2>
              <Badge label={trendResult.storageCondition} style={storageColor(trendResult.storageCondition)} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Intended Shelf Life: <strong style={{ color: '#1f2937' }}>
                  {trendResult.intendedShelfLifeMonths != null ? `${trendResult.intendedShelfLifeMonths} months` : 'Not set'}
                </strong>
              </span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Study Duration: <strong style={{ color: '#1f2937' }}>{trendResult.studyDurationMonths} months</strong>
              </span>
            </div>

            {/* No parameters */}
            {trendResult.parameters.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>
                No parameters defined for this stability protocol.
              </div>
            )}

            {/* Parameter trend cards */}
            {trendResult.parameters.map(param => (
              <div key={param.parameterId} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
                    {param.parameterName}
                    {param.unit && <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', marginLeft: 4 }}>({param.unit})</span>}
                  </span>
                  {param.rSquared != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: '#f3f4f6', color: '#1d4ed8' }}>
                      R²: {param.rSquared.toFixed(3)}
                    </span>
                  )}
                  <button onClick={() => setIchRegParam({ protocolId: selectedId!, parameterId: param.parameterId, paramName: param.parameterName })}
                    style={{ marginLeft: 'auto', padding: '3px 10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    📊 ICH Regression
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: '#f3f4f6', color: '#374151' }}>
                    Shelf-life: {param.predictedShelfLifeMonths != null ? `${param.predictedShelfLifeMonths.toFixed(1)} mo` : 'Insufficient data'}
                  </span>
                  {param.specMin != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
                      Spec min: {param.specMin}
                    </span>
                  )}
                  {param.specMax != null && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
                      Spec max: {param.specMax}
                    </span>
                  )}
                </div>

                {param.dataPoints.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                    No test results linked yet — pull stability samples and record results to see trends.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={param.dataPoints} margin={{ top: 8, right: 24, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monthOffset"
                        label={{ value: 'Months', position: 'insideBottom', offset: -16, fontSize: 11 }}
                        tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {param.specMin != null && (
                        <ReferenceLine y={param.specMin} stroke="#ef4444" strokeDasharray="4 4"
                          label={{ value: 'Min', fill: '#ef4444', fontSize: 10 }} />
                      )}
                      {param.specMax != null && (
                        <ReferenceLine y={param.specMax} stroke="#ef4444" strokeDasharray="4 4"
                          label={{ value: 'Max', fill: '#ef4444', fontSize: 10 }} />
                      )}
                      <Line type="monotone" dataKey="value" name={param.parameterName}
                        stroke="#3b82f6" strokeWidth={2}
                        dot={<CustomDot />} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}

            {/* ICH compliance table */}
            {ichResult && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginTop: 8, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>
                  ICH Q1A/Q1B Time-Point Coverage
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                  {completedMandatory} / {mandatoryIntervals.length} mandatory intervals complete
                  {mandatoryIntervals.length > 0 && (
                    <span style={{ marginLeft: 8, fontWeight: 600, color: completedMandatory === mandatoryIntervals.length ? '#065f46' : '#9a3412' }}>
                      {completedMandatory === mandatoryIntervals.length ? '✓ Fully compliant' : '⚠ Incomplete'}
                    </span>
                  )}
                </div>

                {ichResult.intervals.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                    No ICH intervals configured for this protocol.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Time Point', 'Mandatory', 'Status', 'Pulled At', 'Pull ID'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ichResult.intervals.map(iv => (
                        <tr key={iv.monthOffset} style={{ background: iv.isMandatory && !iv.isPulled && iv.status === 'Missed' ? '#fff5f5' : undefined }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                            <strong>{iv.label}</strong>
                            <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>({iv.monthOffset}mo)</span>
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                            {iv.isMandatory
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fef9c3', color: '#854d0e' }}>★ Required</span>
                              : <span style={{ color: '#9ca3af', fontSize: 12 }}>Optional</span>
                            }
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                            <Badge label={iv.status} style={STATUS_BADGE[iv.status] ?? { background: '#f3f4f6', color: '#374151' }} />
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                            {iv.pulledAt
                              ? new Date(iv.pulledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : <span style={{ color: '#d1d5db' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                            {iv.pullId != null
                              ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>#{iv.pullId}</span>
                              : <span style={{ color: '#d1d5db' }}>—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
