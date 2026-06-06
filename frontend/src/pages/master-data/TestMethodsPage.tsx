import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Method { methodId: number; methodCode: string; methodName: string; methodType: string; status: string; version: string; parameterCount: number; approvedBy: string }

export default function TestMethodsPage() {
  const [data, setData] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showApprove, setShowApprove] = useState<number | null>(null)
  const [form, setForm] = useState({ methodCode: '', methodName: '', sopReference: '', methodType: 'Chemical', version: '1.0' })
  const [approveForm, setApproveForm] = useState({ password: '', meaning: 'I approve this test method', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<Method | null>(null)
  const [editForm, setEditForm] = useState({ methodName: '', sopReference: '', methodType: 'Chemical' })

  function openEdit(r: Method) {
    setEditRow(r)
    setEditForm({ methodName: r.methodName, sopReference: '', methodType: r.methodType })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/test-methods/${editRow!.methodId}`, editForm)
      setEditRow(null); load()
      toast(`Test Method "${editForm.methodName}" updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function load() { setLoading(true); const r = await api.get('/test-methods'); setData(r.data); setLoading(false) }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/test-methods', { ...form, version: form.version || '1.0' })
      setShowForm(false)
      toast(`Test Method "${form.methodName}" added successfully`, 'success')
      load()
    }
    catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/test-methods/${showApprove}/approve`, approveForm)
      setShowApprove(null)
      toast(`Test Method approved successfully`, 'success')
      load()
    }
    catch (err) { const msg = getErrorMessage(err, 'E-signature failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Test Methods" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="TestMethods" columns={[
        { header: 'Code', accessor: 'methodCode' },
        { header: 'Name', accessor: 'methodName' },
        { header: 'Type', accessor: 'methodType' },
        { header: 'Version', accessor: 'version' },
        { header: 'Parameters', accessor: 'parameterCount' },
        { header: 'Status', accessor: r => <StatusChip status={r.status} /> },
        { header: 'Approved By', accessor: 'approvedBy' },
        { header: '', accessor: r => (
          <div style={{ display: 'flex', gap: 4 }}>
            {r.status === 'Draft' && <button onClick={() => setShowApprove(r.methodId)} style={approveBtn}>Approve</button>}
            <button onClick={() => openEdit(r)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Edit
            </button>
          </div>
        ) },
      ]} />
      {showForm && (
        <Modal title="Add Test Method" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Method Code"><input style={inp} value={form.methodCode} onChange={e => setForm(f => ({ ...f, methodCode: e.target.value }))} required /></Field>
            <Field label="Method Name"><input style={inp} value={form.methodName} onChange={e => setForm(f => ({ ...f, methodName: e.target.value }))} required /></Field>
            <Field label="SOP Reference"><input style={inp} value={form.sopReference} onChange={e => setForm(f => ({ ...f, sopReference: e.target.value }))} /></Field>
            <Field label="Method Type">
              <select style={inp} value={form.methodType} onChange={e => setForm(f => ({ ...f, methodType: e.target.value }))}>
                {['Chemical', 'Microbiological', 'Physical', 'Instrumental'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Version">
              <input style={inp} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="e.g. 1.0" />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
      {editRow && (
        <Modal title={`Edit Test Method — ${editRow.methodCode}`} onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <Field label="Method Name"><input style={inp} value={editForm.methodName} onChange={e => setEditForm(f => ({ ...f, methodName: e.target.value }))} required /></Field>
            <Field label="SOP Reference"><input style={inp} value={editForm.sopReference} onChange={e => setEditForm(f => ({ ...f, sopReference: e.target.value }))} /></Field>
            <Field label="Method Type">
              <select style={inp} value={editForm.methodType} onChange={e => setEditForm(f => ({ ...f, methodType: e.target.value }))}>
                {['Chemical', 'Microbiological', 'Physical', 'Instrumental'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Modal>
      )}
      {showApprove && (
        <Modal title="E-Signature Approval" onClose={() => setShowApprove(null)}>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={approveForm.password} onChange={e => setApproveForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={approveForm.meaning} onChange={e => setApproveForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason for Approval"><input style={inp} value={approveForm.reason} onChange={e => setApproveForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, [string, string]> = { Draft: ['#fef9c3', '#854d0e'], Approved: ['#d1fae5', '#065f46'], Inactive: ['#f1f5f9', '#475569'] }
  const [bg, fg] = colors[status] ?? ['#e5e7eb', '#374151']
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: bg, color: fg }}>{status}</span>
}

const approveBtn: React.CSSProperties = { padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }
