import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'

interface TestMethod { methodId: number; methodName: string; methodCode: string }
interface Parameter  { parameterId: number; parameterName: string; uom: string; isMandatory: boolean }
interface Execution  {
  executionId: number; sampleId: number; sampleNumber: string
  materialName: string; lotNumber: string; analystName: string; status: string
}
interface RowResult  {
  executionId: number; sampleNumber: string
  results: { parameterId: number; parameterName: string; rawValue: string; passFail: string; isOos: boolean; isOot: boolean }[]
  hasOos: boolean; hasOot: boolean; error?: string
}

const inp: React.CSSProperties = {
  width: '100%', padding: '5px 8px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace',
  background: '#fafafa', boxSizing: 'border-box',
}

export default function BatchResultEntryPage() {
  const { labId } = useSelector((s: RootState) => s.auth)

  const [methods,     setMethods]     = useState<TestMethod[]>([])
  const [methodId,    setMethodId]    = useState('')
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [executions,  setExecutions]  = useState<Execution[]>([])
  const [entries,     setEntries]     = useState<Record<string, string>>({}) // key: `${execId}-${paramId}`
  const [results,     setResults]     = useState<RowResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  useEffect(() => {
    api.get('/test-methods').then(r => setMethods(r.data)).catch(() => {})
  }, [])

  async function loadGrid(mid: string) {
    if (!mid) { setParameters([]); setExecutions([]); return }
    setLoading(true)
    try {
      const [paramsRes, queueRes] = await Promise.all([
        api.get(`/parameters?methodId=${mid}`),
        api.get(`/test-executions?status=InProgress${labId ? `&labId=${labId}` : ''}`),
      ])
      const params: Parameter[] = paramsRes.data
      // Filter executions to those whose test method matches
      // (work queue returns all InProgress; filter client-side by methodId)
      const execs: Execution[] = queueRes.data.filter((e: any) => e.methodId === Number(mid) || !e.methodId)
      setParameters(params)
      setExecutions(execs)
      setEntries({})
      setResults([])
    } catch {
      toast('Failed to load grid data', 'error')
    } finally { setLoading(false) }
  }

  function cellKey(execId: number, paramId: number) { return `${execId}-${paramId}` }

  function setCell(execId: number, paramId: number, value: string) {
    setEntries(prev => ({ ...prev, [cellKey(execId, paramId)]: value }))
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setResults([])
    try {
      const rows = executions.map(ex => ({
        executionId: ex.executionId,
        entries: parameters
          .filter(p => entries[cellKey(ex.executionId, p.parameterId)]?.trim())
          .map(p => ({ parameterId: p.parameterId, rawValue: entries[cellKey(ex.executionId, p.parameterId)] })),
      })).filter(r => r.entries.length > 0)

      if (rows.length === 0) { toast('No values entered', 'error'); setSubmitting(false); return }

      const r = await api.post('/test-executions/batch-results', { rows })
      const data = r.data
      setResults(data.rows)
      toast(`Batch submitted — ${data.successCount} passed, ${data.failCount} failed`, data.failCount > 0 ? 'error' : 'success')
    } catch (err: any) {
      toast(err.response?.data?.message ?? 'Batch submit failed', 'error')
    } finally { setSubmitting(false) }
  }

  const hasAnyEntry = Object.values(entries).some(v => v.trim())

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Batch Result Entry</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Enter results for multiple samples at once — one row per sample, one column per parameter.
        </p>
      </div>

      {/* ── Method selector ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Test Method
          </label>
          <select
            value={methodId}
            onChange={e => { setMethodId(e.target.value); loadGrid(e.target.value) }}
            style={{ ...inp, fontFamily: 'inherit', padding: '8px 10px' }}>
            <option value="">Select test method…</option>
            {methods.map(m => (
              <option key={m.methodId} value={m.methodId}>{m.methodName} ({m.methodCode})</option>
            ))}
          </select>
        </div>
        {executions.length > 0 && (
          <div style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8 }}>
            {executions.length} sample{executions.length !== 1 ? 's' : ''} in progress · {parameters.length} parameter{parameters.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading grid…</div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────── */}
      {!loading && executions.length > 0 && parameters.length > 0 && (
        <form onSubmit={submitBatch}>
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', minWidth: 160, borderRight: '1px solid #334155' }}>
                    Sample
                  </th>
                  {parameters.map(p => (
                    <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 110, borderRight: '1px solid #334155' }}>
                      <div>{p.parameterName}</div>
                      {p.uom && <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>{p.uom}</div>}
                      {p.isMandatory && <div style={{ fontSize: 9, color: '#fde68a' }}>Required</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map((ex, i) => {
                  const rowResult = results.find(r => r.executionId === ex.executionId)
                  const rowBg = rowResult
                    ? rowResult.error ? '#fff1f2'
                    : rowResult.hasOos ? '#fff1f2'
                    : rowResult.hasOot ? '#fffbeb'
                    : '#f0fdf4'
                    : i % 2 === 0 ? '#ffffff' : '#f8fafc'

                  return (
                    <tr key={ex.executionId} style={{ background: rowBg, borderBottom: '1px solid #e5e7eb' }}>
                      {/* Sample info cell */}
                      <td style={{ padding: '8px 14px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                          {ex.sampleNumber}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{ex.materialName}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>Lot: {ex.lotNumber}</div>
                        {rowResult && (
                          <div style={{ marginTop: 4 }}>
                            {rowResult.error
                              ? <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Error: {rowResult.error}</span>
                              : rowResult.hasOos
                                ? <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>OOS Detected</span>
                                : rowResult.hasOot
                                  ? <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>OOT Detected</span>
                                  : <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>All Pass</span>
                            }
                          </div>
                        )}
                      </td>

                      {/* Parameter input cells */}
                      {parameters.map(p => {
                        const key = cellKey(ex.executionId, p.parameterId)
                        const val = entries[key] ?? ''
                        const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                        const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.isOot ? '#fde68a' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#d1d5db'

                        return (
                          <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              step="any"
                              value={val}
                              onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                              required={p.isMandatory && !results.length}
                              placeholder="—"
                              style={{ ...inp, borderColor: cellBorder, width: '100%' }}
                            />
                            {cellResult && (
                              <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                color: cellResult.isOos ? '#dc2626' : cellResult.isOot ? '#d97706' : '#16a34a' }}>
                                {cellResult.isOos ? 'OOS' : cellResult.isOot ? 'OOT' : 'PASS'}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Submit bar ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button
              type="submit"
              disabled={submitting || !hasAnyEntry}
              style={{
                padding: '10px 28px', background: submitting || !hasAnyEntry ? '#99f6e4' : '#0d9488',
                color: '#fff', border: 'none', borderRadius: 8,
                fontWeight: 700, fontSize: 14, cursor: submitting || !hasAnyEntry ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {submitting ? 'Submitting…' : `Submit ${executions.length} Sample${executions.length !== 1 ? 's' : ''}`}
            </button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              OOS/OOT detection runs server-side for each sample independently
            </span>
          </div>
        </form>
      )}

      {!loading && methodId && executions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13,
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          No samples currently InProgress for this test method.<br />
          <span style={{ fontSize: 12 }}>Assign samples from the Work Queue first.</span>
        </div>
      )}
    </div>
  )
}
