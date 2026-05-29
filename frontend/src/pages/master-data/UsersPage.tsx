import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface UserRow { userId: number; username: string; fullName: string; email: string; userType: string; role: string; labName: string; isActive: boolean; isTenantAdmin: boolean }
interface Lab { labId: number; labName: string }

export default function UsersPage() {
  const role    = useSelector((s: RootState) => s.auth.role) ?? ''
  const isAdmin = role === 'Admin'

  const [data, setData] = useState<UserRow[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', userType: 'RegularUser', role: 'Analyst', labId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', role: 'Analyst', labId: '' })

  function openEdit(r: UserRow) {
    setEditRow(r)
    const lab = labs.find(l => l.labName === r.labName)
    setEditForm({ fullName: r.fullName, email: r.email, role: r.role, labId: lab ? String(lab.labId) : '' })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/users/${editRow!.userId}`, { ...editForm, labId: editForm.labId ? Number(editForm.labId) : null })
      setEditRow(null); load()
      toast(`User "${editRow!.username}" updated successfully`, 'success')
    } catch (err: any) { const msg = err.friendlyMessage ?? err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function unlockUser(userId: number, fullName: string) {
    try {
      await api.post(`/users/${userId}/unlock`, {})
      toast(`Account unlocked for ${fullName}`, 'success')
      load()
    } catch { toast('Unlock failed', 'error') }
  }

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
    } catch (err: any) { const msg = err.friendlyMessage ?? err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Users" onAdd={isAdmin ? () => setShowForm(true) : undefined} />
      <DataTable loading={loading} data={data} exportFilename="Users" columns={[
        { header: 'Username', accessor: 'username' },
        { header: 'Full Name', accessor: 'fullName' },
        { header: 'Email', accessor: 'email' },
        { header: 'Type', accessor: 'userType' },
        { header: 'Role', accessor: 'role' },
        { header: 'Lab', accessor: 'labName' },
        { header: 'Admin', accessor: r => r.isTenantAdmin ? '✓' : '' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
        { header: 'Unlock', accessor: r => isAdmin ? (
          <button onClick={() => unlockUser(r.userId, r.fullName)}
            style={{ padding: '3px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            🔓 Unlock
          </button>
        ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span> },
        { header: 'Edit', accessor: r => isAdmin ? (
          <button onClick={() => openEdit(r)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Edit
          </button>
        ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span> },
      ]} />
      {editRow && (
        <Modal title={`Edit User — ${editRow.username}`} onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <Field label="Full Name"><input style={inp} value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} required /></Field>
            <Field label="Email"><input style={inp} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required /></Field>
            <Field label="Role">
              <select style={inp} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                {['Admin', 'QA', 'Analyst', 'Supervisor', 'ReadOnly'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Laboratory (optional)">
              <select style={inp} value={editForm.labId} onChange={e => setEditForm(f => ({ ...f, labId: e.target.value }))}>
                <option value="">None</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Modal>
      )}
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
