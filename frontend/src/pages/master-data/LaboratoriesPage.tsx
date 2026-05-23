import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { toast } from '@/components/Toast'

interface Lab { labId: number; labName: string; site: string; location: string; labType: string; isActive: boolean; createdBy: string }

export default function LaboratoriesPage() {
  const [data, setData] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ labName: '', site: '', location: '', labType: 'QC' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const r = await api.get('/laboratories')
    setData(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/laboratories', form)
      setShowForm(false); setForm({ labName: '', site: '', location: '', labType: 'QC' }); load()
      toast(`Laboratory "${form.labName}" added successfully`, 'success')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed'
      setError(msg)
      toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Laboratories" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} columns={[
        { header: 'ID', accessor: 'labId' },
        { header: 'Name', accessor: 'labName' },
        { header: 'Site', accessor: r => r.site || '—' },
        { header: 'Location', accessor: 'location' },
        { header: 'Type', accessor: 'labType' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
        { header: 'Created By', accessor: 'createdBy' },
      ]} />
      {showForm && (
        <Modal title="Add Laboratory" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Name"><input style={inp} value={form.labName} onChange={e => setForm(f => ({ ...f, labName: e.target.value }))} required /></Field>
            <Field label="Site / Facility"><input style={inp} value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} placeholder="e.g. Petaling Jaya Plant" /></Field>
            <Field label="Location"><input style={inp} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required /></Field>
            <Field label="Type">
              <select style={inp} value={form.labType} onChange={e => setForm(f => ({ ...f, labType: e.target.value }))}>
                {['QC', 'R&D', 'Microbiology', 'Stability', 'Analytical'].map(t => <option key={t}>{t}</option>)}
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

// ---- shared mini-components ----
export function PageHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.01em' }}>{title}</h2>
      {onAdd && <button onClick={onAdd} style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ {addLabel ?? 'Add'}</button>}
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: active ? '#d1fae5' : '#fee2e2', color: active ? '#065f46' : '#991b1b' }}>{active ? 'Active' : 'Inactive'}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{label}</label>{children}</div>
}

export function ModalFooter({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
      <button type="button" onClick={onCancel} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>Cancel</button>
      <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
        {saving ? 'Saving…' : (label ?? 'Save')}
      </button>
    </div>
  )
}

export const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }
