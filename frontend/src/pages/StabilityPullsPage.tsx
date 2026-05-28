import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

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

const CHIPS = [
  { label: 'All',       value: '',          color: '#374151' },
  { label: 'Pending',   value: 'Pending',   color: '#d97706' },
  { label: 'Pulled',    value: 'Pulled',    color: '#16a34a' },
  { label: 'Missed',    value: 'Missed',    color: '#dc2626' },
  { label: 'Escalated', value: 'Escalated', color: '#9d174d' },
]

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: `1.5px solid ${active ? color : '#e5e7eb'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer', whiteSpace: 'nowrap',
  }
}

export default function StabilityPullsPage() {
  const [data, setData]           = useState<StabilityPull[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilter] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showExecute, setShowExecute]   = useState<StabilityPull | null>(null)
  const [schedForm, setSchedForm] = useState({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' })
  const [execForm, setExecForm]   = useState({ actualQty: '', shortReason: '', password: '', meaning: 'I confirm this stability pull was performed correctly' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    const r = await api.get('/stability-pulls')
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

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
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function submitExecute(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = { actualQty: Number(execForm.actualQty), shortReason: execForm.shortReason || null, password: execForm.password, meaning: execForm.meaning }
      await api.post(`/stability-pulls/${showExecute!.pullId}/execute`, body)
      setShowExecute(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  const needsShortReason = showExecute && execForm.actualQty && Number(execForm.actualQty) < showExecute.requiredQty

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', marginRight: 4 }}>Stability Pulls</h2>
        {CHIPS.map(c => (
          <button key={c.value} onClick={() => setFilter(c.value)} style={chipStyle(filterStatus === c.value, c.color)}>
            {c.label}
          </button>
        ))}

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setSchedForm({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' }); setError(''); setShowSchedule(true) }}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Schedule Pull
          </button>
        </div>
      </div>

      <DataTable loading={loading} data={filtered} columns={[
        { header: 'Sample',     accessor: 'sampleNumber' },
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
      ]} />

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
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
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
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowExecute(null)} label="Confirm Pull" />
          </form>
        </Modal>
      )}
    </div>
  )
}
