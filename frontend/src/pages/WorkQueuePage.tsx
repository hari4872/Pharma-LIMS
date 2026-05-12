import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface WorkItem {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; instrumentCode: string
  status: string; priorityScore: number | null
  startedAt: string | null; completedAt: string | null
  dueDate: string | null; createdAt: string
}
interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string }
interface Analyst { userId: number; fullName: string }
interface Instrument { instrumentId: number; instrumentCode: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Assigned:   { bg: '#dbeafe', color: '#1e40af' },
  InProgress: { bg: '#fef9c3', color: '#854d0e' },
  Completed:  { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:    { bg: '#fee2e2', color: '#991b1b' },
}

export default function WorkQueuePage() {
  const userId = useSelector((s: RootState) => s.auth.userId)
  const [data, setData] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [samples, setSamples] = useState<Sample[]>([])
  const [analysts, setAnalysts] = useState<Analyst[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [form, setForm] = useState({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const r = await api.get(`/test-executions${params}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  async function openAssign() {
    const [sr, ur, ir] = await Promise.all([
      api.get('/samples?status=PendingTesting'),
      api.get('/users'),
      api.get('/instruments'),
    ])
    setSamples(sr.data); setAnalysts(ur.data); setInstruments(ir.data)
    setShowAssign(true)
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/test-executions', {
        sampleId: Number(form.sampleId),
        analystId: Number(form.analystId),
        instrumentId: Number(form.instrumentId),
        priorityScore: form.priorityScore ? Number(form.priorityScore) : null,
      })
      setShowAssign(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Assignment failed') }
    finally { setSaving(false) }
  }

  async function startTask(executionId: number) {
    try {
      await api.post(`/test-executions/${executionId}/start`, {})
      load()
    } catch (err: any) { alert(err.response?.data?.message ?? 'Start failed') }
  }

  function isOverdue(item: WorkItem) {
    return item.dueDate && new Date(item.dueDate) < new Date() &&
      (item.status === 'Assigned' || item.status === 'InProgress')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="Work Queue (WAP)" onAdd={openAssign} addLabel="Assign Task" />
        <select style={{ ...inp, width: 180, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Assigned', 'InProgress', 'Completed', 'OOSOpen'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample No.', accessor: r => (
          <div>
            <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong>
            {isOverdue(r) && <span style={{ marginLeft: 6, fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 8 }}>OVERDUE</span>}
          </div>
        )},
        { header: 'Material / Lot', accessor: r => <span>{r.materialName}<br /><span style={{ fontSize: 12, color: '#6b7280' }}>{r.lotNumber}</span></span> },
        { header: 'Analyst', accessor: 'analystName' },
        { header: 'Instrument', accessor: 'instrumentCode' },
        { header: 'Priority', accessor: r => r.priorityScore ?? '—' },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Due', accessor: r => r.dueDate ? <span style={{ color: isOverdue(r) ? '#dc2626' : '#374151' }}>{new Date(r.dueDate).toLocaleDateString()}</span> : '—' },
        { header: 'Started', accessor: r => r.startedAt ? new Date(r.startedAt).toLocaleString() : '—' },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status === 'Assigned' && (
              <button onClick={() => startTask(r.executionId)}
                style={{ padding: '3px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Start Task
              </button>
            )}
            {r.status === 'InProgress' && (
              <a href={`/test-execution/${r.executionId}`}
                style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', borderRadius: 4, textDecoration: 'none', fontSize: 11 }}>
                Enter Results
              </a>
            )}
          </div>
        )},
      ]} />

      {showAssign && (
        <Modal title="Assign Task (WAP)" onClose={() => setShowAssign(false)}>
          <form onSubmit={submitAssign}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              ℹ WAP rules enforced: trained analyst + calibrated instrument + capacity check server-side.
            </p>
            <Field label="Sample (PendingTesting)">
              <select style={inp} value={form.sampleId} onChange={e => setForm(f => ({ ...f, sampleId: e.target.value }))} required>
                <option value="">Select sample…</option>
                {samples.map(s => <option key={s.sampleId} value={s.sampleId}>{s.sampleNumber} — {s.materialName} / {s.lotNumber}</option>)}
              </select>
            </Field>
            <Field label="Analyst">
              <select style={inp} value={form.analystId} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Instrument">
              <select style={inp} value={form.instrumentId} onChange={e => setForm(f => ({ ...f, instrumentId: e.target.value }))} required>
                <option value="">Select instrument…</option>
                {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (lower = higher priority)">
              <input style={inp} type="number" min="1" max="100" value={form.priorityScore} onChange={e => setForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="e.g. 1 (urgent)" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowAssign(false)} label="Assign" />
          </form>
        </Modal>
      )}
    </div>
  )
}
