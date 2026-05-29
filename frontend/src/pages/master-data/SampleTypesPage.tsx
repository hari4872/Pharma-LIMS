import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface SampleType { sampleTypeId: number; typeName: string; typeCode: string; matrix: string; stage: string; description: string; isActive: boolean }

const MATRICES = ['Solid', 'Liquid', 'Gas', 'Swab', 'Powder', 'Granule', 'Suspension', 'Emulsion']
const STAGES = ['InProcess', 'Release', 'Stability', 'Incoming']

export default function SampleTypesPage() {
  const [data, setData] = useState<SampleType[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ typeName: '', typeCode: '', matrix: 'Liquid', stage: 'InProcess', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() { setLoading(true); const r = await api.get('/sample-types'); setData(r.data); setLoading(false) }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/sample-types', form)
      setShowForm(false)
      toast(`Sample Type "${form.typeName}" added successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.friendlyMessage ?? err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Sample Types" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="SampleTypes" columns={[
        { header: 'Code', accessor: 'typeCode' },
        { header: 'Name', accessor: 'typeName' },
        { header: 'Matrix', accessor: 'matrix' },
        { header: 'Stage', accessor: 'stage' },
        { header: 'Description', accessor: 'description' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
      ]} />
      {showForm && (
        <Modal title="Add Sample Type" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Type Code"><input style={inp} value={form.typeCode} onChange={e => setForm(f => ({ ...f, typeCode: e.target.value }))} required placeholder="e.g. ST-LIQ-001" /></Field>
            <Field label="Type Name"><input style={inp} value={form.typeName} onChange={e => setForm(f => ({ ...f, typeName: e.target.value }))} required /></Field>
            <Field label="Matrix">
              <select style={inp} value={form.matrix} onChange={e => setForm(f => ({ ...f, matrix: e.target.value }))}>
                {MATRICES.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Stage">
              <select style={inp} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Description"><input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
