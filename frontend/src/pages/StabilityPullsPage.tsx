import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

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

export default function StabilityPullsPage() {
  const [data, setData]           = useState<StabilityPull[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilter] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showExecute, setShowExecute]   = useState<StabilityPull | null>(null)
  const [schedForm, setSchedForm] = useState({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' })
  const [execForm, setExecForm]   = useState({ actualQty: '', shortReason: '', password: '', meaning: 'I confirm this stability pull was performed correctly' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const r = await api.get(`/stability-pulls${params}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [filterStatus])

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="Stability Pulls" onAdd={() => { setSchedForm({ sampleId: '', timePoint: '', dueDate: '', requiredQty: '', requiredQtyUom: 'g' }); setError(''); setShowSchedule(true) }} />
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={filterStatus} onChange={e => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Pending', 'Pulled', 'Missed', 'Escalated'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <DataTable loading={loading} data={data} columns={[
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
              style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
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
