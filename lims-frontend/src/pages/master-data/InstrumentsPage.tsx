import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'

interface Instrument { instrumentId: number; labName: string; instrumentCode: string; instrumentType: string; model: string; serialNumber: string; calibrationDue: string; status: string; isActive: boolean }
interface Lab { labId: number; labName: string }

export default function InstrumentsPage() {
  const [data, setData] = useState<Instrument[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ labId: '', instrumentCode: '', instrumentType: '', model: '', serialNumber: '', calibrationDue: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [r, lr] = await Promise.all([api.get('/instruments'), api.get('/laboratories')])
    setData(r.data); setLabs(lr.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/instruments', { ...form, labId: Number(form.labId) })
      setShowForm(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Instruments" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} columns={[
        { header: 'Code', accessor: 'instrumentCode' },
        { header: 'Type', accessor: 'instrumentType' },
        { header: 'Lab', accessor: 'labName' },
        { header: 'Model', accessor: 'model' },
        { header: 'Serial No.', accessor: 'serialNumber' },
        { header: 'Cal. Due', accessor: r => r.calibrationDue?.split('T')[0] ?? '' },
        { header: 'Status', accessor: r => <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#dbeafe', color: '#1e40af' }}>{r.status}</span> },
        { header: 'Active', accessor: r => <StatusBadge active={r.isActive} /> },
      ]} />
      {showForm && (
        <Modal title="Add Instrument" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Instrument Code"><input style={inp} value={form.instrumentCode} onChange={e => setForm(f => ({ ...f, instrumentCode: e.target.value }))} required /></Field>
            <Field label="Instrument Type"><input style={inp} value={form.instrumentType} onChange={e => setForm(f => ({ ...f, instrumentType: e.target.value }))} required /></Field>
            <Field label="Model"><input style={inp} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Serial Number"><input style={inp} value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></Field>
            <Field label="Calibration Due"><input style={inp} type="date" value={form.calibrationDue} onChange={e => setForm(f => ({ ...f, calibrationDue: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
