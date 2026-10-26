import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'
import { getErrorMessage } from '@/utils/errors'

interface TestMethod { methodId: number; methodName: string; methodCode: string }
interface Parameter  { parameterId: number; parameterName: string; parameterCode: string; uom: string; isMandatory: boolean; inspectionScope?: string; calcFormula?: string; parameterGroup?: string | null }
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
      const execs: Execution[] = queueRes.data.filter((e: { methodId?: number }) => e.methodId === Number(mid) || !e.methodId)
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
    } catch (err) {
      toast(getErrorMessage(err, 'Batch submit failed'), 'error')
    } finally { setSubmitting(false) }
  }

  const hasAnyEntry = Object.values(entries).some(v => v.trim())

  // Group-aware parameter splitting
  const hasGroups          = parameters.some(p => p.parameterGroup)
  const groupNames         = [...new Set(parameters.filter(p => p.parameterGroup).map(p => p.parameterGroup!))]
  const groupDefs          = groupNames.map(g => ({
    name:      g,
    unitEntry: parameters.filter(p => p.parameterGroup === g && p.inspectionScope === 'UnitBased' && !p.calcFormula),
    unitCalc:  parameters.filter(p => p.parameterGroup === g && p.inspectionScope === 'UnitBased' && !!p.calcFormula),
    sample:    parameters.filter(p => p.parameterGroup === g && p.inspectionScope !== 'UnitBased'),
  }))
  const ungroupedUnitEntry = parameters.filter(p => !p.parameterGroup && p.inspectionScope === 'UnitBased' && !p.calcFormula)
  const ungroupedUnitCalc  = parameters.filter(p => !p.parameterGroup && p.inspectionScope === 'UnitBased' && !!p.calcFormula)
  const ungroupedSample    = parameters.filter(p => !p.parameterGroup && p.inspectionScope !== 'UnitBased')
  // Legacy (no groups) aliases
  const unitEntryParams    = hasGroups ? ungroupedUnitEntry : parameters.filter(p => p.inspectionScope === 'UnitBased' && !p.calcFormula)
  const unitCalcParams     = hasGroups ? ungroupedUnitCalc  : parameters.filter(p => p.inspectionScope === 'UnitBased' && !!p.calcFormula)
  const sampleParams       = hasGroups ? ungroupedSample    : parameters.filter(p => p.inspectionScope !== 'UnitBased')
  const hasUnitBased       = unitEntryParams.length > 0 || groupDefs.some(g => g.unitEntry.length > 0)

  function computeCalcForGroup(p: Parameter, execId: number, gUnitEntry: Parameter[]): string {
    if (!p.calcFormula) return '—'
    try {
      let expr = p.calcFormula
      for (const up of gUnitEntry) {
        const val = entries[cellKey(execId, up.parameterId)] || '0'
        expr = expr.replace(new RegExp(`\\b${up.parameterCode}\\b`, 'gi'), val)
      }
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)()
      if (!isFinite(result)) return '—'
      return parseFloat(result.toFixed(4)).toString()
    } catch { return '—' }
  }

  function computeUnitCalc(p: Parameter, execId: number): string {
    return computeCalcForGroup(p, execId, unitEntryParams)
  }

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
                {/* Row 1: group labels (or single "Unit Inspection" label when no groups) */}
                {(hasUnitBased || hasGroups) && (
                  <tr style={{ background: '#1e293b' }}>
                    <th style={{ borderRight: '1px solid #334155' }} />
                    {hasGroups ? (
                      <>
                        {groupDefs.map((g, gi) => {
                          const colSpan = g.unitEntry.length + g.unitCalc.length + g.sample.length
                          const hasAfterGroups = ungroupedUnitEntry.length > 0 || ungroupedUnitCalc.length > 0 || ungroupedSample.length > 0
                          return (
                            <th key={g.name} colSpan={colSpan}
                              style={{ padding: '5px 12px', textAlign: 'center', color: '#e9d5ff', fontWeight: 700, fontSize: 11,
                                borderRight: gi < groupDefs.length - 1 || hasAfterGroups ? '2px solid #7c3aed' : undefined,
                                background: '#2d1b69' }}>
                              {g.name}
                            </th>
                          )
                        })}
                        {(ungroupedUnitEntry.length > 0 || ungroupedUnitCalc.length > 0) && (
                          <th colSpan={ungroupedUnitEntry.length + ungroupedUnitCalc.length}
                            style={{ padding: '5px 12px', textAlign: 'center', color: '#fcd34d', fontWeight: 700, fontSize: 11,
                              borderRight: ungroupedSample.length > 0 ? '2px solid #f59e0b' : undefined }}>
                            Unit Inspection
                          </th>
                        )}
                        {ungroupedSample.length > 0 && (
                          <th colSpan={ungroupedSample.length}
                            style={{ padding: '5px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 11 }}>
                            Sample-based
                          </th>
                        )}
                      </>
                    ) : (
                      <>
                        <th colSpan={unitEntryParams.length + unitCalcParams.length}
                          style={{ padding: '5px 12px', textAlign: 'center', color: '#fcd34d', fontWeight: 700, fontSize: 11,
                            borderRight: sampleParams.length > 0 ? '2px solid #f59e0b' : undefined }}>
                          Unit Inspection
                        </th>
                        {sampleParams.length > 0 && (
                          <th colSpan={sampleParams.length}
                            style={{ padding: '5px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 11 }}>
                            Sample-based
                          </th>
                        )}
                      </>
                    )}
                  </tr>
                )}
                {/* Row 2: individual parameter column names */}
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', minWidth: 160, borderRight: '1px solid #334155' }}>
                    Sample
                  </th>
                  {hasGroups ? (
                    <>
                      {groupDefs.map(g => (
                        <React.Fragment key={g.name}>
                          {g.unitEntry.map(p => (
                            <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100, borderRight: '1px solid #334155', background: '#1c1917' }}>
                              <div>{p.parameterName}</div>
                              {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                              {p.isMandatory && <div style={{ fontSize: 9, color: '#fbbf24' }}>Required</div>}
                            </th>
                          ))}
                          {g.unitCalc.map(p => (
                            <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100, borderRight: '1px solid #334155', background: '#1c1917' }}>
                              <div>{p.parameterName}</div>
                              {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                              <div style={{ fontSize: 9, color: '#86efac' }}>Auto-calculated</div>
                            </th>
                          ))}
                          {g.sample.map((p, idx) => (
                            <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 110,
                              borderRight: idx === g.sample.length - 1 ? '2px solid #7c3aed' : '1px solid #334155' }}>
                              <div>{p.parameterName}</div>
                              {p.uom && <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>{p.uom}</div>}
                              {p.isMandatory && <div style={{ fontSize: 9, color: '#fde68a' }}>Required</div>}
                            </th>
                          ))}
                        </React.Fragment>
                      ))}
                      {ungroupedUnitEntry.map(p => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100, borderRight: '1px solid #334155', background: '#1c1917' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                          {p.isMandatory && <div style={{ fontSize: 9, color: '#fbbf24' }}>Required</div>}
                        </th>
                      ))}
                      {ungroupedUnitCalc.map((p, idx) => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100,
                          borderRight: idx === ungroupedUnitCalc.length - 1 && ungroupedSample.length > 0 ? '2px solid #f59e0b' : '1px solid #334155', background: '#1c1917' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                          <div style={{ fontSize: 9, color: '#86efac' }}>Auto-calculated</div>
                        </th>
                      ))}
                      {ungroupedSample.map(p => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 110, borderRight: '1px solid #334155' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>{p.uom}</div>}
                          {p.isMandatory && <div style={{ fontSize: 9, color: '#fde68a' }}>Required</div>}
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      {unitEntryParams.map(p => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100, borderRight: '1px solid #334155', background: '#1c1917' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                          {p.isMandatory && <div style={{ fontSize: 9, color: '#fbbf24' }}>Required</div>}
                        </th>
                      ))}
                      {unitCalcParams.map((p, idx) => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 100, borderRight: idx === unitCalcParams.length - 1 && sampleParams.length > 0 ? '2px solid #f59e0b' : '1px solid #334155', background: '#1c1917' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#a8a29e', fontSize: 10 }}>{p.uom}</div>}
                          <div style={{ fontSize: 9, color: '#86efac' }}>Auto-calculated</div>
                        </th>
                      ))}
                      {sampleParams.map(p => (
                        <th key={p.parameterId} style={{ padding: '10px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: 110, borderRight: '1px solid #334155' }}>
                          <div>{p.parameterName}</div>
                          {p.uom && <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: 10 }}>{p.uom}</div>}
                          {p.isMandatory && <div style={{ fontSize: 9, color: '#fde68a' }}>Required</div>}
                        </th>
                      ))}
                    </>
                  )}
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

                      {hasGroups ? (
                        <>
                          {/* Per-group cells: entry → calc → sample, separated by purple border */}
                          {groupDefs.map(g => (
                            <React.Fragment key={g.name}>
                              {g.unitEntry.map(p => {
                                const key = cellKey(ex.executionId, p.parameterId)
                                const val = entries[key] ?? ''
                                const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                                const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#fcd34d'
                                return (
                                  <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                    <input type="number" step="1" min="0" value={val}
                                      onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                      required={p.isMandatory && !results.length}
                                      placeholder="0"
                                      style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                    {cellResult && (
                                      <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                        color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                        {cellResult.isOos ? 'OOS' : 'PASS'}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              {g.unitCalc.map(p => {
                                const calcVal = computeCalcForGroup(p, ex.executionId, g.unitEntry)
                                const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                                return (
                                  <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle', textAlign: 'center', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                                      color: cellResult?.isOos ? '#dc2626' : calcVal === '—' ? '#9ca3af' : '#0f172a' }}>
                                      {cellResult ? cellResult.rawValue ?? calcVal : calcVal}
                                      {p.uom && calcVal !== '—' ? ` ${p.uom}` : ''}
                                    </div>
                                    {cellResult ? (
                                      <div style={{ fontSize: 10, fontWeight: 700, color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                        {cellResult.isOos ? 'OOS' : 'PASS'}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 9, color: '#9ca3af' }}>preview</div>
                                    )}
                                  </td>
                                )
                              })}
                              {g.sample.map((p, idx) => {
                                const key = cellKey(ex.executionId, p.parameterId)
                                const val = entries[key] ?? ''
                                const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                                const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.isOot ? '#fde68a' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#d1d5db'
                                return (
                                  <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: idx === g.sample.length - 1 ? '2px solid #7c3aed' : '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                                    <input type="number" step="any" value={val}
                                      onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                      required={p.isMandatory && !results.length}
                                      placeholder="—"
                                      style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                    {cellResult && (
                                      <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                        color: cellResult.isOos ? '#dc2626' : cellResult.isOot ? '#d97706' : '#16a34a' }}>
                                        {cellResult.isOos ? 'OOS' : cellResult.isOot ? 'OOT' : 'PASS'}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                            </React.Fragment>
                          ))}
                          {/* Ungrouped unit entry */}
                          {ungroupedUnitEntry.map((p, idx) => {
                            const key = cellKey(ex.executionId, p.parameterId)
                            const val = entries[key] ?? ''
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#fcd34d'
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: idx === ungroupedUnitEntry.length - 1 && ungroupedUnitCalc.length === 0 && ungroupedSample.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb', verticalAlign: 'middle', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                <input type="number" step="1" min="0" value={val}
                                  onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                  required={p.isMandatory && !results.length}
                                  placeholder="0"
                                  style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                {cellResult && (
                                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                    color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : 'PASS'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          {/* Ungrouped unit calc */}
                          {ungroupedUnitCalc.map((p, idx) => {
                            const calcVal = computeUnitCalc(p, ex.executionId)
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: idx === ungroupedUnitCalc.length - 1 && ungroupedSample.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb', verticalAlign: 'middle', textAlign: 'center', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                                  color: cellResult?.isOos ? '#dc2626' : calcVal === '—' ? '#9ca3af' : '#0f172a' }}>
                                  {cellResult ? cellResult.rawValue ?? calcVal : calcVal}
                                  {p.uom && calcVal !== '—' ? ` ${p.uom}` : ''}
                                </div>
                                {cellResult ? (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : 'PASS'}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>preview</div>
                                )}
                              </td>
                            )
                          })}
                          {/* Ungrouped sample */}
                          {ungroupedSample.map(p => {
                            const key = cellKey(ex.executionId, p.parameterId)
                            const val = entries[key] ?? ''
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.isOot ? '#fde68a' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#d1d5db'
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                                <input type="number" step="any" value={val}
                                  onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                  required={p.isMandatory && !results.length}
                                  placeholder="—"
                                  style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                {cellResult && (
                                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                    color: cellResult.isOos ? '#dc2626' : cellResult.isOot ? '#d97706' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : cellResult.isOot ? 'OOT' : 'PASS'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </>
                      ) : (
                        <>
                          {/* Legacy: unit entry cells */}
                          {unitEntryParams.map((p, idx) => {
                            const key = cellKey(ex.executionId, p.parameterId)
                            const val = entries[key] ?? ''
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#fcd34d'
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: idx === unitEntryParams.length - 1 && unitCalcParams.length === 0 && sampleParams.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb', verticalAlign: 'middle', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                <input type="number" step="1" min="0" value={val}
                                  onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                  required={p.isMandatory && !results.length}
                                  placeholder="0"
                                  style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                {cellResult && (
                                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                    color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : 'PASS'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          {/* Legacy: unit calc cells */}
                          {unitCalcParams.map((p, idx) => {
                            const calcVal = computeUnitCalc(p, ex.executionId)
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: idx === unitCalcParams.length - 1 && sampleParams.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb', verticalAlign: 'middle', textAlign: 'center', background: rowBg === '#ffffff' ? '#fffbeb' : rowBg === '#f8fafc' ? '#fefce8' : rowBg }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                                  color: cellResult?.isOos ? '#dc2626' : calcVal === '—' ? '#9ca3af' : '#0f172a' }}>
                                  {cellResult ? cellResult.rawValue ?? calcVal : calcVal}
                                  {p.uom && calcVal !== '—' ? ` ${p.uom}` : ''}
                                </div>
                                {cellResult ? (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: cellResult.isOos ? '#dc2626' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : 'PASS'}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>preview</div>
                                )}
                              </td>
                            )
                          })}
                          {/* Legacy: sample-based cells */}
                          {sampleParams.map(p => {
                            const key = cellKey(ex.executionId, p.parameterId)
                            const val = entries[key] ?? ''
                            const cellResult = rowResult?.results.find(r => r.parameterId === p.parameterId)
                            const cellBorder = cellResult?.isOos ? '#fca5a5' : cellResult?.isOot ? '#fde68a' : cellResult?.passFail === 'Pass' ? '#bbf7d0' : '#d1d5db'
                            return (
                              <td key={p.parameterId} style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', verticalAlign: 'middle' }}>
                                <input type="number" step="any" value={val}
                                  onChange={e => setCell(ex.executionId, p.parameterId, e.target.value)}
                                  required={p.isMandatory && !results.length}
                                  placeholder="—"
                                  style={{ ...inp, borderColor: cellBorder, width: '100%' }} />
                                {cellResult && (
                                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: 700,
                                    color: cellResult.isOos ? '#dc2626' : cellResult.isOot ? '#d97706' : '#16a34a' }}>
                                    {cellResult.isOos ? 'OOS' : cellResult.isOot ? 'OOT' : 'PASS'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </>
                      )}
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
