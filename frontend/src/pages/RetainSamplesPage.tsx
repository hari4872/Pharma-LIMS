import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface RetainSample {
  retainId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; quantity: number; quantityUom: string
  locationId: number; locationName: string; locationCode: string
  retainedOn: string; retentionDueDate: string; status: string
  retainedBy: string; destroyedAt: string | null; destroyedBy: string | null
}

interface StorageLocation { locationId: number; locationCode: string; locationName: string }

export default function RetainSamplesPage() {
  const [data, setData]       = useState<RetainSample[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilter] = useState('Active')
  const [showAdd, setShowAdd]     = useState(false)
  const [showDestroy, setShowDestroy] = useState<RetainSample | null>(null)
  const [addForm, setAddForm] = useState({ sampleId: '', locationId: '', quantity: '', quantityUom: 'g', retainedOn: '' })
  const [destroyForm, setDestroyForm] = useState({ password: '', meaning: 'I authorize destruction of this retain sample', reason: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const [r, lr] = await Promise.all([api.get(`/retain-samples${params}`), api.get('/storage-locations')])
    setData(r.data); setLocations(lr.data); setLoading(false)
  }
  useEffect(() => { load() }, [filterStatus])

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/retain-samples', { sampleId: Number(addForm.sampleId), locationId: Number(addForm.locationId), quantity: Number(addForm.quantity), quantityUom: addForm.quantityUom, retainedOn: addForm.retainedOn })
      setShowAdd(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function submitDestroy(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/retain-samples/${showDestroy!.retainId}/destroy`, destroyForm)
      setShowDestroy(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  function daysUntil(date: string) {
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return d
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="Retain Samples" onAdd={() => { setAddForm({ sampleId: '', locationId: '', quantity: '', quantityUom: 'g', retainedOn: '' }); setError(''); setShowAdd(true) }} />
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={filterStatus} onChange={e => setFilter(e.target.value)}>
          <option value="">All</option>
          {['Active', 'Destroyed', 'Transferred'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample',     accessor: 'sampleNumber' },
        { header: 'Material',   accessor: 'materialName' },
        { header: 'Lot',        accessor: 'lotNumber' },
        { header: 'Quantity',   accessor: r => `${r.quantity} ${r.quantityUom}` },
        { header: 'Location',   accessor: r => `${r.locationCode} — ${r.locationName}` },
        { header: 'Retained On', accessor: 'retainedOn' },
        { header: 'Due Date',   accessor: r => {
          const days = daysUntil(r.retentionDueDate)
          const color = days <= 30 ? '#dc2626' : days <= 90 ? '#d97706' : '#065f46'
          return <span style={{ color, fontWeight: days <= 90 ? 600 : 400 }}>{r.retentionDueDate} {days <= 90 ? `(T-${days})` : ''}</span>
        }},
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12,
            background: r.status === 'Active' ? '#d1fae5' : r.status === 'Destroyed' ? '#fee2e2' : '#f3f4f6',
            color: r.status === 'Active' ? '#065f46' : r.status === 'Destroyed' ? '#991b1b' : '#374151' }}>
            {r.status}
          </span>
        )},
        { header: '', accessor: r => r.status === 'Active'
          ? <button onClick={() => { setDestroyForm({ password: '', meaning: 'I authorize destruction of this retain sample', reason: '' }); setError(''); setShowDestroy(r) }}
              style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
              Destroy
            </button>
          : null
        },
      ]} />

      {showAdd && (
        <Modal title="Register Retain Sample" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd}>
            <Field label="Sample ID"><input style={inp} type="number" value={addForm.sampleId} onChange={e => setAddForm(f => ({ ...f, sampleId: e.target.value }))} required /></Field>
            <Field label="Storage Location">
              <select style={inp} value={addForm.locationId} onChange={e => setAddForm(f => ({ ...f, locationId: e.target.value }))} required>
                <option value="">Select…</option>
                {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.locationCode} — {l.locationName}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Quantity"><input style={inp} type="number" step="0.001" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} required /></Field>
              <Field label="UOM"><input style={inp} value={addForm.quantityUom} onChange={e => setAddForm(f => ({ ...f, quantityUom: e.target.value }))} required /></Field>
            </div>
            <Field label="Retained On"><input style={inp} type="date" value={addForm.retainedOn} onChange={e => setAddForm(f => ({ ...f, retainedOn: e.target.value }))} required /></Field>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Retention period calculated from DB config (retain_period_months) — Contract 2.</p>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowAdd(false)} />
          </form>
        </Modal>
      )}

      {showDestroy && (
        <Modal title="Destroy Retain Sample — E-Signature" onClose={() => setShowDestroy(null)}>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            Sample: <strong>{showDestroy.sampleNumber}</strong> · Lot: <strong>{showDestroy.lotNumber}</strong> · Qty: <strong>{showDestroy.quantity} {showDestroy.quantityUom}</strong>
          </p>
          <form onSubmit={submitDestroy}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={destroyForm.password} onChange={e => setDestroyForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={destroyForm.meaning} onChange={e => setDestroyForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason for Destruction"><textarea style={{ ...inp, height: 64, resize: 'vertical' }} value={destroyForm.reason} onChange={e => setDestroyForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowDestroy(null)} label="Confirm Destruction" />
          </form>
        </Modal>
      )}
    </div>
  )
}
