import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Template {
  formTemplateId: number; formCode: string; formName: string
  formType: string; triggerType: string; status: string; version: string
  locationCount: number; parameterCount: number
  sampleTypeId: number | null; sampleTypeName: string | null
}
interface Lab { labId: number; labName: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }

const TRIGGER_TYPES = ['TimeBased', 'OperatorScan', 'ProcessLog', 'DispatchEvent']
const FORM_TYPES    = ['Single', 'Grouped']

export default function FormTemplatesPage() {
  const [data, setData]               = useState<Template[]>([])
  const [labs, setLabs]               = useState<Lab[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [loading, setLoading]         = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [showApprove, setShowApprove] = useState<number | null>(null)
  const [form, setForm] = useState({
    formCode: '', formName: '', labId: '', formType: 'Single',
    triggerType: 'TimeBased', regulatoryTier: '',
    evidenceMandatory: false, sampleTypeId: ''
  })
  const [approveForm, setApproveForm] = useState({
    password: '', meaning: 'I approve this form template', reason: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    setLoading(true)
    const [r, lr, str] = await Promise.all([
      api.get('/form-templates'), api.get('/laboratories'), api.get('/sample-types')
    ])
    setData(r.data); setLabs(lr.data); setSampleTypes(str.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/form-templates', {
        ...form,
        labId: Number(form.labId),
        sampleTypeId: form.sampleTypeId ? Number(form.sampleTypeId) : null
      })
      setShowForm(false)
      toast(`Form Template "${form.formName}" added successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/form-templates/${showApprove}/approve`, approveForm)
      setShowApprove(null)
      toast(`Form Template approved successfully`, 'success')
      load()
    }
    catch (err: any) { const msg = err.response?.data?.message ?? 'E-signature failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Form Templates" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="FormTemplates" columns={[
        { header: 'Code',       accessor: 'formCode' },
        { header: 'Name',       accessor: 'formName' },
        { header: 'Type',       accessor: 'formType' },
        { header: 'Trigger',    accessor: 'triggerType' },
        { header: 'Sample Type', accessor: r => r.sampleTypeName ?? <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span> },
        { header: 'Version',    accessor: 'version' },
        { header: 'Locations',  accessor: 'locationCount' },
        { header: 'Parameters', accessor: 'parameterCount' },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12,
            background: r.status === 'Active' ? '#d1fae5' : '#fef9c3',
            color: r.status === 'Active' ? '#065f46' : '#854d0e' }}>{r.status}</span>
        )},
        { header: '', accessor: r => r.status === 'Draft'
          ? <button onClick={() => setShowApprove(r.formTemplateId)}
              style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Approve</button>
          : null
        },
      ]} />

      {showForm && (
        <Modal title="Add Form Template" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Form Code">
              <input style={inp} value={form.formCode} onChange={e => setForm(f => ({ ...f, formCode: e.target.value }))} required />
            </Field>
            <Field label="Form Name">
              <input style={inp} value={form.formName} onChange={e => setForm(f => ({ ...f, formName: e.target.value }))} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Form Type">
                <select style={inp} value={form.formType} onChange={e => setForm(f => ({ ...f, formType: e.target.value }))}>
                  {FORM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Trigger Type">
                <select style={inp} value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value, sampleTypeId: '' }))}>
                  {TRIGGER_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* Sample Type — shown for all trigger modes; mandatory for DispatchEvent */}
            <Field label={`Sample Type${form.triggerType === 'DispatchEvent' ? ' *' : ' (optional)'}`}>
              <select style={inp} value={form.sampleTypeId}
                onChange={e => setForm(f => ({ ...f, sampleTypeId: e.target.value }))}
                required={form.triggerType === 'DispatchEvent'}>
                <option value="">Select sample type…</option>
                {sampleTypes.map(t =>
                  <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                )}
              </select>
              {form.triggerType === 'DispatchEvent' && (
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>
                  Required for Dispatch Event — this type is used when a Delivery Order auto-creates a sample.
                </p>
              )}
            </Field>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.evidenceMandatory}
                onChange={e => setForm(f => ({ ...f, evidenceMandatory: e.target.checked }))} />
              Evidence Mandatory
            </label>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}

      {showApprove && (
        <Modal title="E-Signature Approval (§11.50)" onClose={() => setShowApprove(null)}>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={approveForm.password} onChange={e => setApproveForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={approveForm.meaning} onChange={e => setApproveForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={approveForm.reason} onChange={e => setApproveForm(f => ({ ...f, reason: e.target.value }))} required />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
