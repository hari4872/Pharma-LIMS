import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface RetainSample {
  retainId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; quantity: number; quantityUom: string
  locationId: number; locationName: string; locationCode: string
  retainedOn: string; retentionDueDate: string; status: string
  retainedBy: string; destroyedAt: string | null; destroyedBy: string | null
}

interface StorageLocation { locationId: number; locationCode: string; locationName: string }

const STAGES = [
  { key: 'Active',      label: 'Active',      color: '#065f46', bg: '#d1fae5' },
  { key: 'Destroyed',   label: 'Destroyed',   color: '#991b1b', bg: '#fee2e2' },
  { key: 'Transferred', label: 'Transferred', color: '#374151', bg: '#f3f4f6' },
]

export default function RetainSamplesPage() {
  const [data, setData]       = useState<RetainSample[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilter] = useState('Active')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [showDestroy, setShowDestroy] = useState<RetainSample | null>(null)
  const [addForm, setAddForm] = useState({ sampleId: '', locationId: '', quantity: '', quantityUom: 'g', retainedOn: '' })
  const [destroyForm, setDestroyForm] = useState({ password: '', meaning: 'I authorize destruction of this retain sample', reason: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const [r, lr] = await Promise.all([api.get('/retain-samples'), api.get('/storage-locations')])
    setData(r.data); setLocations(lr.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false
      if (dateFrom && r.retentionDueDate < dateFrom) return false
      if (dateTo && r.retentionDueDate.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, filterStatus, dateFrom, dateTo])

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/retain-samples', { sampleId: Number(addForm.sampleId), locationId: Number(addForm.locationId), quantity: Number(addForm.quantity), quantityUom: addForm.quantityUom, retainedOn: addForm.retainedOn })
      setShowAdd(false); load()
    } catch (err: any) { setError(err.friendlyMessage ?? err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function submitDestroy(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/retain-samples/${showDestroy!.retainId}/destroy`, destroyForm)
      setShowDestroy(null); load()
    } catch (err: any) { setError(err.friendlyMessage ?? err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  function daysUntil(date: string) {
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return d
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', marginRight: 4 }}>Retain Samples</h2>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={filterStatus} onChange={setFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setAddForm({ sampleId: '', locationId: '', quantity: '', quantityUom: 'g', retainedOn: '' }); setError(''); setShowAdd(true) }}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Register
          </button>
        </div>
      </div>

      <DataTable loading={loading} data={filtered} columns={[
        { header: 'Sample', accessor: r => (
          <button onClick={() => setDetailSampleId(r.sampleId)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}>
            {r.sampleNumber}
          </button>
        )},
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
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600 }}>
              Destroy
            </button>
          : null
        },
      ]} />

      <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} />

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
