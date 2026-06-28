import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { getErrorMessage } from '@/utils/errors'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import AuditTrailPanel from '@/components/AuditTrailPanel'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface UserRow { userId: number; username: string; fullName: string; email: string; userType: string; role: string; labName: string; isActive: boolean; isTenantAdmin: boolean; customPermissionsJson: string | null; lockedUntil: string | null }
interface Lab { labId: number; labName: string }

const PERMISSIONS = [
  { key: 'masterData',         label: 'Master Data' },
  { key: 'sampleRegistration', label: 'Sample Reg.' },
  { key: 'workQueue',          label: 'Work Queue' },
  { key: 'resultsReview',      label: 'Results Review' },
  { key: 'coaApproval',        label: 'COA Approval' },
  { key: 'batchRelease',       label: 'Batch Release' },
  { key: 'oosCapa',            label: 'OOS / CAPA' },
  { key: 'compliance',         label: 'Compliance' },
  { key: 'dispatchQc',         label: 'Dispatch QC' },
]

function PermCheck({ val }: { val: boolean }) {
  return val
    ? <span style={{ color: '#16a34a', fontSize: 16, fontWeight: 700 }}>✓</span>
    : <span style={{ color: '#d1d5db', fontSize: 14 }}>—</span>
}

export default function UsersPage() {
  const role    = useSelector((s: RootState) => s.auth.role) ?? ''
  const isAdmin = role === 'Admin'

  const [data, setData] = useState<UserRow[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', userType: 'RegularUser', role: 'Analyst', labId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow]   = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', role: 'Analyst', labId: '' })
  const roleChanged = editRow !== null && editForm.role !== editRow.role
  const [permUser, setPermUser] = useState<UserRow | null>(null)
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [permSaving, setPermSaving] = useState(false)
  const [auditUser, setAuditUser] = useState<UserRow | null>(null)

  async function openPerms(r: UserRow) {
    setPerms({})
    setPermUser(r)
    try {
      const res = await api.get(`/users/${r.userId}/permissions`)
      setPerms(res.data.permissions ?? {})
    } catch { setPerms({}) }
  }

  async function savePerms() {
    if (!permUser) return
    setPermSaving(true)
    try {
      await api.put(`/users/${permUser.userId}/permissions`, { permissions: perms })
      toast(`Permissions updated for ${permUser.fullName}`, 'success')
      setPermUser(null)
      load()
    } catch (err) { toast(getErrorMessage(err, 'Failed'), 'error') }
    finally { setPermSaving(false) }
  }

  function openEdit(r: UserRow) {
    setEditRow(r)
    const lab = labs.find(l => l.labName === r.labName)
    setEditForm({ fullName: r.fullName, email: r.email, role: r.role, labId: lab ? String(lab.labId) : '' })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    await doSaveEdit()
  }

  async function doSaveEdit() {
    setSaving(true); setError('')
    try {
      await api.put(`/users/${editRow!.userId}`, { ...editForm, labId: editForm.labId ? Number(editForm.labId) : null })
      setEditRow(null); load()
      toast(`User "${editRow!.username}" updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function unlockUser(userId: number, fullName: string) {
    try {
      await api.post(`/users/${userId}/unlock`, {})
      toast(`Account unlocked for ${fullName}`, 'success')
      load()
    } catch { toast('Unlock failed', 'error') }
  }

  async function load(inactive = showInactive) {
    setLoading(true)
    try {
      const [r, lr] = await Promise.all([
        api.get(`/users${inactive ? '?includeInactive=true' : ''}`),
        api.get('/laboratories').catch(() => ({ data: [] })),
      ])
      setData(r.data); setLabs(lr.data)
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to load users'), 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { const t = setTimeout(() => load(showInactive), 0); return () => clearTimeout(t) }, [showInactive])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/users', { ...form, labId: form.labId ? Number(form.labId) : null })
      setShowForm(false)
      toast(`User "${form.username}" created successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <PageHeader title="Users" onAdd={isAdmin ? () => { setForm({ username: '', password: '', fullName: '', email: '', userType: 'RegularUser', role: 'Analyst', labId: '' }); setError(''); setShowForm(true) } : undefined} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            style={{ accentColor: '#6b7280', width: 14, height: 14 }} />
          Show inactive users
        </label>
      </div>
      <DataTable loading={loading} data={data} exportFilename="Users" columns={[
        { header: 'User', accessor: r => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{r.username}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{r.email}</div>
          </div>
        )},
        { header: 'Type', accessor: r => (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            background: r.userType === 'Admin' ? '#ede9fe' : '#f1f5f9',
            color: r.userType === 'Admin' ? '#6d28d9' : '#475569' }}>
            {r.role}
          </span>
        )},
        ...PERMISSIONS.map(p => ({
          header: p.label,
          accessor: (r: UserRow) => {
            if (r.role === 'Admin' || r.isTenantAdmin) return <PermCheck val={true} />
            try {
              const perms = r.customPermissionsJson ? JSON.parse(r.customPermissionsJson) : null
              if (perms) return <PermCheck val={!!perms[p.key]} />
            } catch { /* ignore */ }
            return <PermCheck val={false} />
          }
        })),
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {isAdmin && r.role !== 'Admin' && (
              <button onClick={() => openPerms(r)}
                style={{ padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                Edit Permissions
              </button>
            )}
            {isAdmin && (
              <button onClick={() => openEdit(r)}
                style={{ padding: '3px 8px', background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Edit
              </button>
            )}
            {isAdmin && r.lockedUntil && new Date(r.lockedUntil) > new Date() && (
              <button onClick={() => unlockUser(r.userId, r.fullName)}
                style={{ padding: '3px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                🔓 Unlock
              </button>
            )}
          </div>
        )},
      ]} />
      {permUser && (
        <Drawer title={`Edit Permissions — ${permUser.username}`} subtitle="Toggle module access rights for this user" onClose={() => setPermUser(null)}>
          <form onSubmit={e => { e.preventDefault(); savePerms() }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                Toggle permissions for <strong>{permUser.fullName}</strong> ({permUser.role}).
              </p>
              <button type="button"
                onClick={() => { setAuditUser(permUser); setPermUser(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                📋 Audit Trail
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {PERMISSIONS.map(p => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, background: perms[p.key] ? '#f0fdf4' : '#f9fafb', border: `1px solid ${perms[p.key] ? '#bbf7d0' : '#e5e7eb'}`, transition: 'all 0.12s' }}>
                  <input
                    type="checkbox"
                    checked={!!perms[p.key]}
                    onChange={e => setPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                    style={{ accentColor: '#16a34a', width: 15, height: 15, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.label}</span>
                  {perms[p.key] && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Enabled</span>}
                </label>
              ))}
            </div>
            <DrawerFooter saving={permSaving} onCancel={() => setPermUser(null)} label="Save Permissions" />
          </form>
        </Drawer>
      )}
      {auditUser && (
        <AuditTrailPanel
          entity="UserPermissions"
          entityId={auditUser.userId}
          entityLabel={`${auditUser.fullName} (${auditUser.role})`}
          onClose={() => setAuditUser(null)}
        />
      )}
      {editRow && (
        <Drawer title={`Edit User — ${editRow.username}`} subtitle="Update user profile, role and laboratory assignment" onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <Field label="Full Name"><input style={inp} value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} required /></Field>
            <Field label="Email"><input style={inp} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required /></Field>
            <Field label="Role">
              <select style={inp} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                {['Admin', 'QA', 'QCLead', 'Analyst', 'LabManager', 'Viewer'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            {roleChanged && (
              <div style={{ marginBottom: 12, padding: '9px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span>
                <span>Role changing from <strong>{editRow.role}</strong> → <strong>{editForm.role}</strong>. Permissions update on next login.</span>
              </div>
            )}
            <Field label="Laboratory (optional)">
              <select style={inp} value={editForm.labId} onChange={e => setEditForm(f => ({ ...f, labId: e.target.value }))}>
                <option value="">None</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Drawer>
      )}
      {showForm && (
        <Drawer title="Add User" subtitle="Create a new user account with role and laboratory assignment" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Username"><input style={inp} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required /></Field>
            <Field label="Password">
              <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
                Min 8 chars · uppercase · lowercase · digit · special character (e.g. <code style={{ fontSize: 11 }}>!@#$</code>)
              </div>
            </Field>
            <Field label="Full Name"><input style={inp} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required /></Field>
            <Field label="Email"><input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></Field>
            <Field label="User Type">
              <select style={inp} value={form.userType} onChange={e => setForm(f => ({ ...f, userType: e.target.value }))}>
                {['Admin', 'RegularUser'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Role">
              <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {['Admin', 'QA', 'QCLead', 'Analyst', 'LabManager', 'Viewer'].map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Laboratory (optional)">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}>
                <option value="">None</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}
    </div>
  )
}
