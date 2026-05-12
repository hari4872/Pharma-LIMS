import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'

interface SpecLimit { specLimitId: number; parameterName: string; materialName: string; stage: string; minValue: number; maxValue: number; ootMinValue: number; ootMaxValue: number; status: string; version: string }
interface Param { parameterId: number; parameterName: string }
interface Material { materialId: number; materialName: string }

export default function SpecLimitsPage() {
  const [data, setData] = useState<SpecLimit[]>([])
  const [params, setParams] = useState<Param[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showApprove, setShowApprove] = useState<number | null>(null)
  const [form, setForm] = useState({ parameterId: '', materialId: '', stage: 'InProcess', minValue: '', maxValue: '', ootMinValue: '', ootMaxValue: '' })
  const [approveForm, setApproveForm] = useState({ password: '', meaning: 'I approve this spec limit', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [r, pr, mr] = await Promise.all([api.get('/spec-limits'), api.get('/parameters'), api.get('/materials')])
    setData(r.data); setParams(pr.data); setMaterials(mr.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/spec-limits', {
        parameterId: Number(form.parameterId), materialId: form.materialId ? Number(form.materialId) : null,
        stage: form.stage, minValue: form.minValue ? Number(form.minValue) : null,
        maxValue: form.maxValue ? Number(form.maxValue) : null,
        ootMinValue: form.ootMinValue ? Number(form.ootMinValue) : null,
        ootMaxValue: form.ootMaxValue ? Number(form.ootMaxValue) : null
      })
      setShowForm(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try { await api.post(`/spec-limits/${showApprove}/approve`, approveForm); setShowApprove(null); load() }
    catch (err: any) { setError(err.response?.data?.message ?? 'E-signature failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Spec Limits" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} columns={[
        { header: 'Parameter', accessor: 'parameterName' },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Stage', accessor: 'stage' },
        { header: 'Min', accessor: 'minValue' },
        { header: 'Max', accessor: 'maxValue' },
        { header: 'OOT Min', accessor: 'ootMinValue' },
        { header: 'OOT Max', accessor: 'ootMaxValue' },
        { header: 'Version', accessor: 'version' },
        { header: 'Status', accessor: r => <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: r.status === 'Approved' ? '#d1fae5' : '#fef9c3', color: r.status === 'Approved' ? '#065f46' : '#854d0e' }}>{r.status}</span> },
        { header: '', accessor: r => r.status === 'Draft' ? <button onClick={() => setShowApprove(r.specLimitId)} style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Approve</button> : null },
      ]} />
      {showForm && (
        <Modal title="Add Spec Limit" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="Parameter">
              <select style={inp} value={form.parameterId} onChange={e => setForm(f => ({ ...f, parameterId: e.target.value }))} required>
                <option value="">Select…</option>
                {params.map(p => <option key={p.parameterId} value={p.parameterId}>{p.parameterName}</option>)}
              </select>
            </Field>
            <Field label="Material (optional)">
              <select style={inp} value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))}>
                <option value="">All Materials</option>
                {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
              </select>
            </Field>
            <Field label="Stage">
              <select style={inp} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {['InProcess', 'Release', 'Stability', 'Incoming'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Min Value"><input style={inp} type="number" step="any" value={form.minValue} onChange={e => setForm(f => ({ ...f, minValue: e.target.value }))} /></Field>
              <Field label="Max Value"><input style={inp} type="number" step="any" value={form.maxValue} onChange={e => setForm(f => ({ ...f, maxValue: e.target.value }))} /></Field>
              <Field label="OOT Min"><input style={inp} type="number" step="any" value={form.ootMinValue} onChange={e => setForm(f => ({ ...f, ootMinValue: e.target.value }))} /></Field>
              <Field label="OOT Max"><input style={inp} type="number" step="any" value={form.ootMaxValue} onChange={e => setForm(f => ({ ...f, ootMaxValue: e.target.value }))} /></Field>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
      {showApprove && (
        <Modal title="E-Signature Approval (§11.50)" onClose={() => setShowApprove(null)}>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={approveForm.password} onChange={e => setApproveForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={approveForm.meaning} onChange={e => setApproveForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={approveForm.reason} onChange={e => setApproveForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
