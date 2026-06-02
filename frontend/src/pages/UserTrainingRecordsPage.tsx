import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

// Master Data FR-11: User Training Records — GMP training gate for test-method assignment

interface TrainingRecord {
  trainingId: number; userId: number; userName: string
  methodId: number; methodCode: string; methodName: string
  trainingDate: string; validUntil: string | null; recordedBy: string; createdAt: string
}

interface User { userId: number; fullName: string; username: string }
interface Method { methodId: number; methodCode: string; methodName: string }

function validityBadge(validUntil: string | null) {
  if (!validUntil) return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#e0f2fe', color: '#0369a1' }}>No Expiry</span>
  const days = Math.floor((new Date(validUntil).getTime() - Date.now()) / 86400000)
  if (days < 0) return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#fee2e2', color: '#991b1b' }}>EXPIRED</span>
  if (days <= 30) return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#fef9c3', color: '#854d0e' }}>Exp. {days}d</span>
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#d1fae5', color: '#065f46' }}>Valid</span>
}

export default function UserTrainingRecordsPage() {
  const [data, setData]       = useState<TrainingRecord[]>([])
  const [users, setUsers]     = useState<User[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [filterUser, setFilterUser] = useState('')

  const [form, setForm] = useState({ userId: '', methodId: '', trainingDate: '', validUntil: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function load() {
    setLoading(true)
    const params = filterUser ? `?userId=${filterUser}` : ''
    const [r, ur, mr] = await Promise.all([
      api.get(`/training-records${params}`),
      api.get('/users'),
      api.get('/test-methods'),
    ])
    setData(r.data); setUsers(ur.data); setMethods(mr.data)
    setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [filterUser])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/training-records', {
        userId: Number(form.userId),
        methodId: Number(form.methodId),
        trainingDate: form.trainingDate,
        validUntil: form.validUntil || null,
      })
      setShowForm(false)
      setForm({ userId: '', methodId: '', trainingDate: '', validUntil: '' })
      load()
    } catch (err) { setError(getErrorMessage(err, 'Failed')) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#111827' }}>User Training Records</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>GMP training gate — analysts must be trained on a method before being assigned work</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select style={{ ...inp, width: 200, margin: 0 }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">All Users</option>
            {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            + Add Record
          </button>
        </div>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'ID',            accessor: 'trainingId' },
        { header: 'Analyst',       accessor: 'userName' },
        { header: 'Method Code',   accessor: 'methodCode' },
        { header: 'Method Name',   accessor: 'methodName' },
        { header: 'Training Date', accessor: r => new Date(r.trainingDate).toLocaleDateString() },
        { header: 'Valid Until',   accessor: r => r.validUntil ? new Date(r.validUntil).toLocaleDateString() : '—' },
        { header: 'Status',        accessor: r => validityBadge(r.validUntil) },
        { header: 'Recorded By',   accessor: 'recordedBy' },
      ]} />

      {showForm && (
        <Modal title="Add Training Record" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="Analyst *">
              <select style={inp} value={form.userId} onChange={set('userId')} required>
                <option value="">Select analyst…</option>
                {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName} ({u.username})</option>)}
              </select>
            </Field>
            <Field label="Test Method *">
              <select style={inp} value={form.methodId} onChange={set('methodId')} required>
                <option value="">Select method…</option>
                {methods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodCode} — {m.methodName}</option>)}
              </select>
            </Field>
            <Field label="Training Date *">
              <input style={inp} type="date" value={form.trainingDate} onChange={set('trainingDate')} required />
            </Field>
            <Field label="Valid Until (optional)">
              <input style={inp} type="date" value={form.validUntil} onChange={set('validUntil')} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Leave blank for permanent (no expiry) training.</p>
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
