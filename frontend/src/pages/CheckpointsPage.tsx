import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface Checkpoint {
  checkpointId: number; checkpointCode: string; triggerMode: string
  checkpointType: string; shiftIntervalHrs: number; isActive: boolean; locationCount: number
}
interface ProcessLogRow {
  rowId: number; slotTime: string; slotLabel: string; status: string; isSigned: boolean
}
interface Lab { labId: number; labName: string }

const MODE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af', label: 'Mode 1 — Time-Based' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46', label: 'Mode 2 — Operator Scan' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e', label: 'Mode 3 — Process Log' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9', label: 'Mode 4 — Dispatch Event' },
}

export default function CheckpointsPage() {
  const [data, setData] = useState<Checkpoint[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showProcessLog, setShowProcessLog] = useState<number | null>(null)
  const [showSignRow, setShowSignRow] = useState<{ checkpointId: number; rowId: number } | null>(null)
  const [processLogRows, setProcessLogRows] = useState<ProcessLogRow[]>([])
  const [modeFilter, setModeFilter] = useState('')
  const [form, setForm] = useState({
    checkpointCode: '', labId: '', triggerMode: 'TimeBased',
    checkpointType: 'Single', timeSlots: '', shiftIntervalHrs: ''
  })
  const [signForm, setSignForm] = useState({ password: '', meaning: 'I confirm this process log entry', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const params = modeFilter ? `?triggerMode=${modeFilter}` : ''
    const [r, lr] = await Promise.all([api.get(`/checkpoints${params}`), api.get('/laboratories')])
    setData(r.data); setLabs(lr.data); setLoading(false)
  }
  useEffect(() => { load() }, [modeFilter])

  async function loadProcessLog(checkpointId: number) {
    const r = await api.get(`/checkpoints/${checkpointId}/process-log`)
    setProcessLogRows(r.data)
    setShowProcessLog(checkpointId)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/checkpoints', {
        checkpointCode: form.checkpointCode, labId: Number(form.labId),
        triggerMode: form.triggerMode, checkpointType: form.checkpointType,
        timeSlots: form.timeSlots ? JSON.stringify(form.timeSlots.split(',').map(s => s.trim())) : null,
        shiftIntervalHrs: form.shiftIntervalHrs ? Number(form.shiftIntervalHrs) : null
      })
      setShowForm(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function triggerCheckpoint(checkpointId: number) {
    try {
      await api.post(`/checkpoints/${checkpointId}/trigger`, {})
      alert('Checkpoint triggered — task added to Work Queue')
    } catch (err: any) { alert(err.response?.data?.message ?? 'Trigger failed') }
  }

  async function submitSignRow(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    if (!showSignRow) return
    try {
      await api.post(`/checkpoints/${showSignRow.checkpointId}/process-log/${showSignRow.rowId}/sign`, signForm)
      setShowSignRow(null)
      loadProcessLog(showSignRow.checkpointId)
    } catch (err: any) { setError(err.response?.data?.message ?? 'E-signature failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="Checkpoints — All 4 Trigger Modes" onAdd={() => setShowForm(true)} />
        <select style={{ ...inp, width: 220, marginTop: 0 }} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
          <option value="">All Modes</option>
          <option value="TimeBased">Mode 1 — Time-Based</option>
          <option value="OperatorScan">Mode 2 — Operator Scan</option>
          <option value="ProcessLog">Mode 3 — Process Log</option>
          <option value="DispatchEvent">Mode 4 — Dispatch Event</option>
        </select>
      </div>
      <DataTable loading={loading} data={data} columns={[
        { header: 'Code', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.checkpointCode}</strong> },
        { header: 'Trigger Mode', accessor: r => {
          const m = MODE_COLORS[r.triggerMode] ?? { bg: '#f3f4f6', color: '#374151', label: r.triggerMode }
          return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: m.bg, color: m.color, fontWeight: 500 }}>{m.label}</span>
        }},
        { header: 'Type', accessor: 'checkpointType' },
        { header: 'Interval (hrs)', accessor: r => r.shiftIntervalHrs || '—' },
        { header: 'Locations', accessor: 'locationCount' },
        { header: 'Active', accessor: r => <span style={{ color: r.isActive ? '#16a34a' : '#dc2626' }}>{r.isActive ? 'Active' : 'Inactive'}</span> },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {(r.triggerMode === 'OperatorScan' || r.triggerMode === 'DispatchEvent') && (
              <button onClick={() => triggerCheckpoint(r.checkpointId)}
                style={{ padding: '3px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Trigger
              </button>
            )}
            {r.triggerMode === 'ProcessLog' && (
              <button onClick={() => loadProcessLog(r.checkpointId)}
                style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Process Log
              </button>
            )}
          </div>
        )},
      ]} />

      {/* Create Checkpoint Modal */}
      {showForm && (
        <Modal title="Create Checkpoint" onClose={() => setShowForm(false)}>
          <form onSubmit={submitCreate}>
            <Field label="Checkpoint Code"><input style={inp} value={form.checkpointCode} onChange={e => setForm(f => ({ ...f, checkpointCode: e.target.value }))} required placeholder="e.g. CP-WATER-001" /></Field>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select lab…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Trigger Mode">
              <select style={inp} value={form.triggerMode} onChange={e => setForm(f => ({ ...f, triggerMode: e.target.value }))}>
                <option value="TimeBased">Mode 1 — Time-Based (auto by scheduler)</option>
                <option value="OperatorScan">Mode 2 — Operator Scan (barcode/QR)</option>
                <option value="ProcessLog">Mode 3 — Process Log (shift-based grid)</option>
                <option value="DispatchEvent">Mode 4 — Dispatch Event (DO-triggered)</option>
              </select>
            </Field>
            <Field label="Type">
              <select style={inp} value={form.checkpointType} onChange={e => setForm(f => ({ ...f, checkpointType: e.target.value }))}>
                <option value="Single">Single</option>
                <option value="Grouped">Grouped (multiple locations)</option>
              </select>
            </Field>
            {form.triggerMode === 'TimeBased' && (
              <Field label="Time Slots (HH:mm, comma-separated)">
                <input style={inp} value={form.timeSlots} onChange={e => setForm(f => ({ ...f, timeSlots: e.target.value }))} placeholder="e.g. 08:00, 14:00, 20:00" />
              </Field>
            )}
            {form.triggerMode === 'ProcessLog' && (
              <Field label="Shift Interval (hours)">
                <input style={inp} type="number" value={form.shiftIntervalHrs} onChange={e => setForm(f => ({ ...f, shiftIntervalHrs: e.target.value }))} placeholder="e.g. 8" />
              </Field>
            )}
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}

      {/* Mode 3: Process Log grid */}
      {showProcessLog && (
        <Modal title="Process Log — Mode 3 Shift Grid" onClose={() => setShowProcessLog(null)}>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {processLogRows.length === 0 && <p style={{ color: '#6b7280', fontSize: 13 }}>No slots for today. Scheduler runs at midnight UTC.</p>}
            {processLogRows.map(row => (
              <div key={row.rowId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderBottom: '1px solid #e5e7eb',
                background: row.status === 'Locked' ? '#f0fdf4' : row.status === 'Open' ? '#fff' : '#fef3c7'
              }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{row.slotLabel}</strong>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{new Date(row.slotTime).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10,
                    background: row.status === 'Locked' ? '#d1fae5' : '#fef9c3',
                    color: row.status === 'Locked' ? '#065f46' : '#854d0e' }}>
                    {row.status}
                  </span>
                  {row.status === 'Open' && (
                    <button onClick={() => { setShowSignRow({ checkpointId: showProcessLog, rowId: row.rowId }); setError('') }}
                      style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      Sign Row §11.50
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Sign Process Log Row — Mode 3 §11.50 e-sig */}
      {showSignRow && (
        <Modal title="Sign Process Log Row (§11.50)" onClose={() => setShowSignRow(null)}>
          <form onSubmit={submitSignRow}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={signForm.password} onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={signForm.meaning} onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={signForm.reason} onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSignRow(null)} label="Sign & Lock Row" />
          </form>
        </Modal>
      )}
    </div>
  )
}
