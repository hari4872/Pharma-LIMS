import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface StabilityPull {
  pullId: number; sampleId: number; sampleNumber: string; materialName: string
  timePoint: string; dueDate: string; requiredQty: number; requiredQtyUom: string
  status: string; actualQty: number | null; pulledAt: string | null
  hasShortfall: boolean; shortPullCount: number
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:   { bg: '#fef9c3', color: '#854d0e' },
  Pulled:    { bg: '#d1fae5', color: '#065f46' },
  Missed:    { bg: '#fee2e2', color: '#991b1b' },
  Escalated: { bg: '#fce7f3', color: '#9d174d' },
}

const STAGES = [
  { key: 'Pending',   label: 'Pending',   color: '#b45309', bg: '#fef9c3' },
  { key: 'Pulled',    label: 'Pulled',    color: '#065f46', bg: '#d1fae5' },
  { key: 'Missed',    label: 'Missed',    color: '#991b1b', bg: '#fee2e2' },
  { key: 'Escalated', label: 'Escalated', color: '#9d174d', bg: '#fce7f3' },
]

const TIME_POINT_ORDER = ['T0','T1M','T2M','T3M','T6M','T9M','T12M','T18M','T24M','T36M','T48M','T60M']
function tpSort(a: string, b: string) {
  const ai = TIME_POINT_ORDER.indexOf(a); const bi = TIME_POINT_ORDER.indexOf(b)
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1; if (bi !== -1) return 1
  return a.localeCompare(b)
}

export default function StabilityPullsPage() {
  const [data, setData]           = useState<StabilityPull[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilter] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [viewMode, setViewMode]   = useState<'table' | 'timeline'>('table')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showExecute, setShowExecute]   = useState<StabilityPull | null>(null)
  const [schedForm, setSchedForm] = useState({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' })
  const [execForm, setExecForm]   = useState({ actualQty: '', shortReason: '', password: '', meaning: 'I confirm this stability pull was performed correctly' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const r = await api.get('/stability-pulls')
    setData(r.data); setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false
      if (dateFrom && r.dueDate < dateFrom) return false
      if (dateTo && r.dueDate.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, filterStatus, dateFrom, dateTo])

  async function submitSchedule(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/stability-pulls', { ...schedForm, sampleId: Number(schedForm.sampleId), requiredQty: Number(schedForm.requiredQty) })
      setShowSchedule(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Failed')) }
    finally { setSaving(false) }
  }

  async function submitExecute(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = { actualQty: Number(execForm.actualQty), shortReason: execForm.shortReason || null, password: execForm.password, meaning: execForm.meaning }
      await api.post(`/stability-pulls/${showExecute!.pullId}/execute`, body)
      setShowExecute(null); load()
    } catch (err) { setError(getErrorMessage(err, 'Failed')) }
    finally { setSaving(false) }
  }

  const needsShortReason = showExecute && execForm.actualQty && Number(execForm.actualQty) < showExecute.requiredQty

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', marginRight: 4 }}>Stability Pulls</h2>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={filterStatus} onChange={setFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 7, overflow: 'hidden' }}>
            {(['table', 'timeline'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: viewMode === v ? '#2563eb' : '#fff', color: viewMode === v ? '#fff' : '#6b7280' }}>
                {v === 'table' ? '☰ Table' : '📅 Timeline'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSchedForm({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' }); setError(''); setShowSchedule(true) }}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Schedule Pull
          </button>
        </div>
      </div>

      {/* ── Timeline view ── */}
      {viewMode === 'timeline' && (() => {
        // Group filtered pulls by sampleNumber
        const bySample = filtered.reduce<Record<string, StabilityPull[]>>((acc, r) => {
          ;(acc[r.sampleNumber] ??= []).push(r)
          return acc
        }, {})
        // Collect all unique time-points across visible data, sorted
        const allTps = [...new Set(filtered.map(r => r.timePoint))].sort(tpSort)

        if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
        if (filtered.length === 0) return (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div>No records yet</div>
          </div>
        )

        const DOT_SIZE = 32
        return (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: allTps.length * 90 + 200 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', minWidth: 180, position: 'sticky', left: 0, zIndex: 2 }}>
                    Sample
                  </th>
                  {allTps.map(tp => (
                    <th key={tp} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', minWidth: 80 }}>
                      {tp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(bySample).sort(([a],[b]) => a.localeCompare(b)).map(([sampleNum, pulls]) => (
                  <tr key={sampleNum} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#fff', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #e5e7eb' }}>
                      <button onClick={() => setDetailSampleId(pulls[0].sampleId)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}>
                        {sampleNum}
                      </button>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'inherit', fontWeight: 400, marginTop: 2 }}>{pulls[0].materialName}</div>
                    </td>
                    {allTps.map(tp => {
                      const pull = pulls.find(p => p.timePoint === tp)
                      if (!pull) return (
                        <td key={tp} style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ color: '#e5e7eb', fontSize: 18 }}>·</span>
                        </td>
                      )
                      const c = STATUS_COLORS[pull.status] ?? { bg: '#f3f4f6', color: '#374151' }
                      const isOverdue = pull.status === 'Pending' && pull.dueDate < new Date().toISOString().slice(0, 10)
                      return (
                        <td key={tp} style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div
                              title={`${pull.status} — Due ${pull.dueDate}${pull.actualQty != null ? ` — Actual: ${pull.actualQty} ${pull.requiredQtyUom}` : ''}`}
                              onClick={pull.status === 'Pending' ? () => { setExecForm({ actualQty: '', shortReason: '', password: '', meaning: 'I confirm this stability pull was performed correctly' }); setError(''); setShowExecute(pull) } : undefined}
                              style={{
                                width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%',
                                background: isOverdue ? '#fef2f2' : c.bg,
                                border: `2px solid ${isOverdue ? '#fca5a5' : c.color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: pull.status === 'Pending' ? 'pointer' : 'default',
                                fontSize: 13,
                              }}>
                              {pull.status === 'Pulled'    ? '✓' :
                               pull.status === 'Pending'   ? (isOverdue ? '!' : '○') :
                               pull.status === 'Missed'    ? '✗' :
                               pull.status === 'Escalated' ? '↑' : '?'}
                            </div>
                            <span style={{ fontSize: 10, color: isOverdue ? '#dc2626' : c.color, fontWeight: 600 }}>
                              {isOverdue && pull.status === 'Pending' ? 'Overdue' : pull.status}
                            </span>
                            {pull.hasShortfall && <span style={{ fontSize: 10, color: '#dc2626' }}>⚠ Short</span>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, padding: '12px 16px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
              {[
                { symbol: '✓', bg: '#d1fae5', border: '#065f46', color: '#065f46', label: 'Pulled' },
                { symbol: '○', bg: '#fef9c3', border: '#b45309', color: '#b45309', label: 'Pending' },
                { symbol: '!', bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', label: 'Overdue' },
                { symbol: '✗', bg: '#fee2e2', border: '#991b1b', color: '#991b1b', label: 'Missed' },
                { symbol: '↑', bg: '#fce7f3', border: '#9d174d', color: '#9d174d', label: 'Escalated' },
                { symbol: '·', bg: 'transparent', border: 'none', color: '#9ca3af', label: 'Not scheduled' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: l.bg, border: `1.5px solid ${l.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: l.color, fontWeight: 700 }}>{l.symbol}</div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{l.label}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto', fontStyle: 'italic' }}>Click ○ Pending dot to execute pull</span>
            </div>
          </div>
        )
      })()}

      {/* ── Table view ── */}
      {viewMode === 'table' && <DataTable loading={loading} data={filtered} columns={[
        { header: 'Sample', accessor: r => (
          <button onClick={() => setDetailSampleId(r.sampleId)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline' }}>
            {r.sampleNumber}
          </button>
        )},
        { header: 'Material',   accessor: 'materialName' },
        { header: 'Time-Point', accessor: 'timePoint' },
        { header: 'Due Date',   accessor: 'dueDate' },
        { header: 'Required',   accessor: r => `${r.requiredQty} ${r.requiredQtyUom}` },
        { header: 'Actual',     accessor: r => r.actualQty != null ? `${r.actualQty} ${r.requiredQtyUom}` : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span> },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Shortfall', accessor: r => r.hasShortfall
          ? <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#fee2e2', color: '#991b1b' }}>⚠ Short Pull</span>
          : null
        },
        { header: '', accessor: r => r.status === 'Pending'
          ? <button onClick={() => { setExecForm({ actualQty: '', shortReason: '', password: '', meaning: 'I confirm this stability pull was performed correctly' }); setError(''); setShowExecute(r) }}
              style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600 }}>
              Execute Pull
            </button>
          : null
        },
      ]} />}

      {detailSampleId !== null && <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} />}

      {showSchedule && (
        <Modal title="Schedule Stability Pull" onClose={() => setShowSchedule(false)}>
          <form onSubmit={submitSchedule}>
            <Field label="Sample ID"><input style={inp} type="number" value={schedForm.sampleId} onChange={e => setSchedForm(f => ({ ...f, sampleId: e.target.value }))} required /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Time-Point">
                <input style={inp} value={schedForm.timePoint} onChange={e => setSchedForm(f => ({ ...f, timePoint: e.target.value }))} required placeholder="e.g. T0, T3M, T6M" />
              </Field>
              <Field label="Due Date">
                <input style={inp} type="date" value={schedForm.dueDate} onChange={e => setSchedForm(f => ({ ...f, dueDate: e.target.value }))} required />
              </Field>
              <Field label="Required Qty">
                <input style={inp} type="number" step="0.001" value={schedForm.requiredQty} onChange={e => setSchedForm(f => ({ ...f, requiredQty: e.target.value }))} required />
              </Field>
              <Field label="UOM">
                <input style={inp} value={schedForm.requiredQtyUom} onChange={e => setSchedForm(f => ({ ...f, requiredQtyUom: e.target.value }))} required placeholder="g, mL, units" />
              </Field>
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSchedule(false)} />
          </form>
        </Modal>
      )}

      {showExecute && (
        <Modal title={`Execute Pull — ${showExecute.sampleNumber} / ${showExecute.timePoint}`} onClose={() => setShowExecute(null)}>
          <form onSubmit={submitExecute}>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
              Required: <strong>{showExecute.requiredQty} {showExecute.requiredQtyUom}</strong>
            </p>
            <Field label="Actual Qty Pulled">
              <input style={inp} type="number" step="0.001" value={execForm.actualQty} onChange={e => setExecForm(f => ({ ...f, actualQty: e.target.value }))} required />
            </Field>
            {needsShortReason && (
              <Field label="Short Pull Reason (mandatory — ICH Q1A / FR-15)">
                <textarea style={{ ...inp, height: 64, resize: 'vertical' }}
                  value={execForm.shortReason} onChange={e => setExecForm(f => ({ ...f, shortReason: e.target.value }))} required />
                <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>
                  Actual quantity is less than required — reason is mandatory before pull can complete.
                </p>
              </Field>
            )}
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 4 }}>E-Signature</p>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={execForm.password} onChange={e => setExecForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={execForm.meaning} onChange={e => setExecForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowExecute(null)} label="Confirm Pull" />
          </form>
        </Modal>
      )}
    </div>
  )
}
