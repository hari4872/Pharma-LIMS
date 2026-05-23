import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface UserRow { userId: number; username: string; fullName: string; email: string; userType: string; role: string; labName: string; isActive: boolean; isTenantAdmin: boolean }
interface Lab { labId: number; labName: string }

export default function UsersPage() {
  const [data, setData] = useState<UserRow[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', userType: 'RegularUser', role: 'Analyst', labId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [r, lr] = await Promise.all([api.get('/users'), api.get('/laboratories')])
    setData(r.data); setLabs(lr.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/users', { ...form, labId: form.labId ? Number(form.labId) : null })
      setShowForm(false)
      toast(`User "${form.username}" created successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Users" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="Users" columns={[
        { header: 'Username', accessor: 'username' },
        { header: 'Full Name', accessor: 'fullName' },
        { header: 'Email', accessor: 'email' },
        { header: 'Type', accessor: 'userType' },
        { header: 'Role', accessor: 'role' },
        { header: 'Lab', accessor: 'labName' },
        { header: 'Admin', accessor: r => r.isTenantAdmin ? '✓' : '' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
      ]} />
      {showForm && (
        <Modal title="Add User" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Username"><input style={inp} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required /></Field>
            <Field label="Password"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Full Name"><input style={inp} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required /></Field>
            <Field label="Email"><input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></Field>
            <Field label="User Type">
              <select style={inp} value={form.userType} onChange={e => setForm(f => ({ ...f, userType: e.target.value }))}>
                {['Admin', 'RegularUser'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Role">
              <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {['Admin', 'QA', 'Analyst', 'Supervisor', 'ReadOnly'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Laboratory (optional)">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}>
                <option value="">None</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
