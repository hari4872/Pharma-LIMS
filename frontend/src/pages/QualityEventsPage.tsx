import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

// ─── Types ───────────────────────────────────────────────────────────────────
interface QualityEvent {
  cdId: number; cdType: string; cdReference: string; title: string
  description: string | null; status: string; priority: string
  rootCause: string | null; correctiveAction: string | null; preventiveAction: string | null
  sampleId: number | null; sampleNumber: string | null
  assignedToUserId: number | null; assignedToName: string | null
  labId: number | null; labName: string | null
  linkedOosId: number | null; dueDate: string | null
  openedBy: string; openedAt: string; resolvedAt: string | null; resolvedBy: string | null
}
interface User { userId: number; fullName: string }
interface Sample { sampleId: number; sampleNumber: string; materialName: string }
interface OosInv { investigationId: number; executionId: number; status: string }

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'Capa',      label: 'CAPA',       bg: '#fce7f3', color: '#9d174d' },
  { value: 'Deviation', label: 'Deviation',  bg: '#fee2e2', color: '#991b1b' },
  { value: 'Complaint', label: 'Complaint',  bg: '#fff7ed', color: '#92400e' },
]

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  Low:      { bg: '#f0fdf4', color: '#166534' },
  Medium:   { bg: '#fef9c3', color: '#854d0e' },
  High:     { bg: '#ffedd5', color: '#9a3412' },
  Critical: { bg: '#fee2e2', color: '#991b1b' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Open:        { bg: '#dbeafe', color: '#1e40af' },
  UnderReview: { bg: '#fef9c3', color: '#854d0e' },
  Closed:      { bg: '#d1fae5', color: '#065f46' },
  Verified:    { bg: '#f0fdfa', color: '#0d6e6e' },
  Void:        { bg: '#f3f4f6', color: '#6b7280' },
}

const EMPTY_FORM = {
  cdType: 'Capa', title: '', description: '', priority: 'Medium',
  rootCause: '', correctiveAction: '', preventiveAction: '',
  sampleId: '', assignedToUserId: '', linkedOosId: '', dueDate: '',
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function QualityEventsPage() {
  const [typeFilter,   setTypeFilter]   = useState('Capa')
  const [statusFilter, setStatusFilter] = useState('')
  const [data,         setData]         = useState<QualityEvent[]>([])
  const [loading,      setLoading]      = useState(false)
  const [showCreate,   setShowCreate]   = useState(false)
  const [showEdit,     setShowEdit]     = useState(false)
  const [selected,     setSelected]     = useState<QualityEvent | null>(null)
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [users,        setUsers]        = useState<User[]>([])
  const [samples,      setSamples]      = useState<Sample[]>([])
  const [oosInvs,      setOosInvs]      = useState<OosInv[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  async function load() {
    setLoading(true)
    const params: string[] = []
    if (typeFilter)   params.push(`type=${typeFilter}`)
    if (statusFilter) params.push(`status=${statusFilter}`)
    const r = await api.get(`/quality-events${params.length ? '?' + params.join('&') : ''}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [typeFilter, statusFilter])

  async function openCreate() {
    const [ur, sr, oor] = await Promise.all([
      api.get('/users').catch(() => ({ data: [] })),
      api.get('/samples').catch(() => ({ data: [] })),
      api.get('/oos-investigations?status=Open').catch(() => ({ data: [] })),
    ])
    setUsers(ur.data); setSamples(sr.data); setOosInvs(oor.data)
    setForm({ ...EMPTY_FORM, cdType: typeFilter || 'Capa' })
    setError(''); setShowCreate(true)
  }

  async function openEdit(ev: QualityEvent) {
    if (!users.length) {
      const [ur] = await Promise.all([api.get('/users').catch(() => ({ data: [] }))])
      setUsers(ur.data)
    }
    setSelected(ev)
    setForm({
      cdType: ev.cdType, title: ev.title, description: ev.description ?? '',
      priority: ev.priority, rootCause: ev.rootCause ?? '',
      correctiveAction: ev.correctiveAction ?? '', preventiveAction: ev.preventiveAction ?? '',
      sampleId: String(ev.sampleId ?? ''), assignedToUserId: String(ev.assignedToUserId ?? ''),
      linkedOosId: String(ev.linkedOosId ?? ''), dueDate: ev.dueDate ? ev.dueDate.split('T')[0] : '',
    })
    setError(''); setShowEdit(true)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/quality-events', {
        cdType:            form.cdType,
        title:             form.title,
        description:       form.description || null,
        priority:          form.priority,
        rootCause:         form.rootCause || null,
        correctiveAction:  form.correctiveAction || null,
        preventiveAction:  form.preventiveAction || null,
        sampleId:          form.sampleId ? Number(form.sampleId) : null,
        assignedToUserId:  form.assignedToUserId ? Number(form.assignedToUserId) : null,
        linkedOosId:       form.linkedOosId ? Number(form.linkedOosId) : null,
        dueDate:           form.dueDate || null,
      })
      setShowCreate(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Failed to create')) }
    finally { setSaving(false) }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/quality-events/${selected!.cdId}`, {
        title:             form.title,
        description:       form.description || null,
        priority:          form.priority,
        rootCause:         form.rootCause || null,
        correctiveAction:  form.correctiveAction || null,
        preventiveAction:  form.preventiveAction || null,
        assignedToUserId:  form.assignedToUserId ? Number(form.assignedToUserId) : null,
        dueDate:           form.dueDate || null,
      })
      setShowEdit(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Failed to update')) }
    finally { setSaving(false) }
  }

  async function closeEvent(ev: QualityEvent) {
    if (!confirm(`Close ${ev.cdType} "${ev.cdReference}"?`)) return
    try {
      await api.put(`/quality-events/${ev.cdId}`, { status: 'Closed' })
      load()
    } catch (err) { alert(getErrorMessage(err, 'Failed to close')) }
  }

  const currentType = TYPE_OPTIONS.find(t => t.value === typeFilter) ?? TYPE_OPTIONS[0]

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <PageHeader
          title={`${currentType.label} Register`}
          onAdd={openCreate}
          addLabel={`New ${currentType.label}`}
        />
        {/* Type tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {TYPE_OPTIONS.map(t => (
            <button key={t.value}
              onClick={() => setTypeFilter(t.value)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${typeFilter === t.value ? t.color : '#e0e0e0'}`,
                background: typeFilter === t.value ? t.bg : '#fff',
                color: typeFilter === t.value ? t.color : '#6b7280',
                fontFamily: 'inherit',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Open', 'UnderReview', 'Closed', 'Verified'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <DataTable loading={loading} data={data}
        rowStyle={r => {
          const isOverdue = !!r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'Closed' && r.status !== 'Void'
          return isOverdue ? { background: '#fff5f5', borderLeft: '3px solid #fca5a5' } : {}
        }}
        columns={[
        { header: 'Reference', accessor: r => (
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{r.cdReference}</span>
        )},
        { header: 'Title', accessor: r => (
          <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</span>
        )},
        { header: 'Priority', accessor: r => {
          const c = PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS['Medium']
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{r.priority}</span>
        }},
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Sample', accessor: r => r.sampleNumber ?? '—' },
        { header: 'Assigned To', accessor: r => r.assignedToName ?? '—' },
        { header: 'Due Date', accessor: r => r.dueDate
          ? <span style={{ color: new Date(r.dueDate) < new Date() && r.status === 'Open' ? '#dc2626' : '#374151', fontSize: 12 }}>
              {new Date(r.dueDate).toLocaleDateString()}
            </span>
          : '—'
        },
        { header: 'Opened', accessor: r => <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(r.openedAt).toLocaleDateString()}</span> },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status !== 'Closed' && r.status !== 'Void' && (
              <>
                <button onClick={() => openEdit(r)} style={{ padding: '3px 8px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                <button onClick={() => closeEvent(r)} style={{ padding: '3px 8px', background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Close</button>
              </>
            )}
          </div>
        )},
      ]} />

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal title={`New ${currentType.label}`} onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate}>
            <Field label="Type">
              <select style={inp} value={form.cdType} onChange={e => setForm(f => ({ ...f, cdType: e.target.value }))}>
                {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Title *">
              <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Short descriptive title" />
            </Field>
            <Field label="Priority">
              <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the event…" />
            </Field>
            <Field label="Root Cause">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.rootCause} onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))} placeholder="Root cause analysis (if known)" />
            </Field>
            <Field label="Corrective Action">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.correctiveAction} onChange={e => setForm(f => ({ ...f, correctiveAction: e.target.value }))} placeholder="Immediate corrective action" />
            </Field>
            <Field label="Preventive Action">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.preventiveAction} onChange={e => setForm(f => ({ ...f, preventiveAction: e.target.value }))} placeholder="Long-term preventive action" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Related Sample">
                <select style={inp} value={form.sampleId} onChange={e => setForm(f => ({ ...f, sampleId: e.target.value }))}>
                  <option value="">None</option>
                  {samples.map(s => <option key={s.sampleId} value={s.sampleId}>{s.sampleNumber} — {s.materialName}</option>)}
                </select>
              </Field>
              <Field label="Linked OOS Investigation">
                <select style={inp} value={form.linkedOosId} onChange={e => setForm(f => ({ ...f, linkedOosId: e.target.value }))}>
                  <option value="">None</option>
                  {oosInvs.map(o => <option key={o.investigationId} value={o.investigationId}>#{o.investigationId} — Exec {o.executionId}</option>)}
                </select>
              </Field>
              <Field label="Assign To">
                <select style={inp} value={form.assignedToUserId} onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" style={inp} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </Field>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowCreate(false)} label={`Create ${currentType.label}`} />
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {showEdit && selected && (
        <Modal title={`Edit ${selected.cdType} — ${selected.cdReference}`} onClose={() => setShowEdit(false)}>
          <form onSubmit={submitEdit}>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
              <span style={{ fontSize: 11, color: '#0f766e', fontWeight: 600 }}>Reference: </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{selected.cdReference}</span>
            </div>
            <Field label="Title *">
              <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Priority">
              <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Root Cause">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.rootCause} onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))} />
            </Field>
            <Field label="Corrective Action">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.correctiveAction} onChange={e => setForm(f => ({ ...f, correctiveAction: e.target.value }))} />
            </Field>
            <Field label="Preventive Action">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.preventiveAction} onChange={e => setForm(f => ({ ...f, preventiveAction: e.target.value }))} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Assign To">
                <select style={inp} value={form.assignedToUserId} onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" style={inp} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </Field>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowEdit(false)} label="Save Changes" />
          </form>
        </Modal>
      )}
    </div>
  )
}
