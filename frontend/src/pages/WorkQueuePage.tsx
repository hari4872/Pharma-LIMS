import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

interface WorkItem {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; instrumentCode: string
  status: string; priorityScore: number | null
  startedAt: string | null; completedAt: string | null
  dueDate: string | null; createdAt: string
}
interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; specTemplateId?: number }
interface Analyst { userId: number; fullName: string }
interface Instrument { instrumentId: number; instrumentCode: string }
interface SuggestedInstrument {
  instrumentId:   number
  instrumentCode: string
  instrumentType: string
  model:          string | null
  calibrationDue: string
  priority:       number
  notes:          string | null
  labName:        string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Assigned:   { bg: '#dbeafe', color: '#1e40af' },
  InProgress: { bg: '#fef9c3', color: '#854d0e' },
  Completed:  { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:    { bg: '#fee2e2', color: '#991b1b' },
}

export default function WorkQueuePage() {
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
  // Re-assign (per-test-method)
  const [reassignItem, setReassignItem]   = useState<WorkItem | null>(null)
  const [reassignForm, setReassignForm]   = useState({ analystId: '', instrumentId: '', priorityScore: '' })
  const [reassignSaving, setReassignSaving] = useState(false)
  const [reassignError, setReassignError]   = useState('')
  // Phase D — auto-suggest
  const [suggestions, setSuggestions]       = useState<SuggestedInstrument[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)

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
    setSuggestions([]); setForm({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '' })
    setShowAssign(true)
  }

  async function fetchSuggestions(sampleId: string) {
    if (!sampleId) { setSuggestions([]); return }
    // Find the sample to get its spec template items (which carry test method IDs)
    // For now, query without filter to get all available instruments — the endpoint
    // returns all Available+calibrated instruments sorted by priority
    setSuggestLoading(true)
    try {
      const res = await api.get('/test-executions/suggest-instrument')
      setSuggestions(res.data)
    } catch {
      setSuggestions([])
    } finally { setSuggestLoading(false) }
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

  async function openReassign(item: WorkItem) {
    if (analysts.length === 0) {
      const [ur, ir] = await Promise.all([api.get('/users'), api.get('/instruments')])
      setAnalysts(ur.data); setInstruments(ir.data)
    }
    setReassignItem(item)
    setReassignForm({ analystId: '', instrumentId: '', priorityScore: item.priorityScore != null ? String(item.priorityScore) : '' })
    setReassignError('')
  }

  async function submitReassign(e: React.FormEvent) {
    e.preventDefault(); setReassignSaving(true); setReassignError('')
    try {
      await api.post(`/test-executions/${reassignItem!.executionId}/assign`, {
        analystId:    Number(reassignForm.analystId),
        instrumentId: Number(reassignForm.instrumentId),
        priorityScore: reassignForm.priorityScore ? Number(reassignForm.priorityScore) : null,
      })
      toast('Execution re-assigned successfully', 'success')
      setReassignItem(null); load()
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'TRAINING_EXPIRED') setReassignError('Analyst training expired — cannot assign (21 CFR Part 11)')
      else if (code === 'INSTRUMENT_OOC') setReassignError('Instrument out of calibration (21 CFR 211.68)')
      else setReassignError(err.response?.data?.message ?? 'Re-assign failed')
    } finally { setReassignSaving(false) }
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
            {r.status === 'Assigned' && (
              <button onClick={() => openReassign(r)}
                style={{ padding: '3px 8px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Re-assign
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

      {/* ── Re-assign Modal ───────────────────────────────────────────── */}
      {reassignItem && (
        <Modal title={`Re-assign Execution #${reassignItem.executionId} — ${reassignItem.sampleNumber}`} onClose={() => setReassignItem(null)}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            ℹ Per-test-method assignment — overrides analyst and instrument for this specific execution.
            Training and calibration checks enforced server-side.
          </p>
          <form onSubmit={submitReassign}>
            <Field label="New Analyst">
              <select style={inp} value={reassignForm.analystId} onChange={e => setReassignForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="New Instrument">
              <select style={inp} value={reassignForm.instrumentId} onChange={e => setReassignForm(f => ({ ...f, instrumentId: e.target.value }))} required>
                <option value="">Select instrument…</option>
                {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (optional)">
              <input style={inp} type="number" min="1" max="100" value={reassignForm.priorityScore}
                onChange={e => setReassignForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="1–100 (lower = higher priority)" />
            </Field>
            {reassignError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0' }}>{reassignError}</p>}
            <ModalFooter saving={reassignSaving} onCancel={() => setReassignItem(null)} label="Re-assign" />
          </form>
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Task (WAP)" onClose={() => setShowAssign(false)}>
          <form onSubmit={submitAssign}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              ℹ WAP rules enforced: trained analyst + calibrated instrument + capacity check server-side.
            </p>
            <Field label="Sample (PendingTesting)">
              <select style={inp} value={form.sampleId}
                onChange={e => {
                  setForm(f => ({ ...f, sampleId: e.target.value, instrumentId: '' }))
                  fetchSuggestions(e.target.value)
                }} required>
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
              {/* Phase D — show auto-suggest if available, else fall back to full list */}
              {suggestLoading && <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>🔍 Finding best instruments…</p>}
              {!suggestLoading && suggestions.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#0d6e6e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    ✦ Auto-suggested (sorted by priority)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {suggestions.slice(0, 5).map(s => (
                      <label key={s.instrumentId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                          padding: '8px 12px', borderRadius: 7,
                          border: `1.5px solid ${form.instrumentId === String(s.instrumentId) ? '#0d6e6e' : '#e0e0e0'}`,
                          background: form.instrumentId === String(s.instrumentId) ? '#f0fdfa' : '#fff',
                        }}>
                        <input type="radio" name="suggestedInstrument"
                          checked={form.instrumentId === String(s.instrumentId)}
                          onChange={() => setForm(f => ({ ...f, instrumentId: String(s.instrumentId) }))}
                          style={{ accentColor: '#0d6e6e' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#111', fontFamily: 'monospace' }}>{s.instrumentCode}</span>
                          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{s.instrumentType}</span>
                          {s.model && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>({s.model})</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
                          <div>{s.labName}</div>
                          <div>Cal. due: {new Date(s.calibrationDue).toLocaleDateString()}</div>
                        </div>
                        <span style={{
                          minWidth: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                          background: s.priority === 1 ? '#dcfce7' : '#fef9c3',
                          color: s.priority === 1 ? '#15803d' : '#92400e',
                        }}>P{s.priority}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Or choose manually below:</p>
                </div>
              )}
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
