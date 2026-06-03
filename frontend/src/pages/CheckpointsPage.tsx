import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { useOfflineScanQueue } from '@/hooks/useOfflineScanQueue'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckpointParam { parameterId: number; parameterCode: string; parameterName: string; uom: string | null }
interface TriggerLog { triggerId: number; triggerMode: string; triggeredBy: string | null; triggeredAt: string; deliveryOrder: string | null; isOfflineSync: boolean }
interface Checkpoint {
  checkpointId: number; checkpointCode: string; triggerMode: string
  checkpointType: string; shiftIntervalHrs: number; isActive: boolean; locationCount: number
  parameters: CheckpointParam[]
}
interface ProcessLogRow {
  rowId: number; slotTime: string; slotLabel: string; status: string; isSigned: boolean
}
interface Lab { labId: number; labName: string }
interface Param { parameterId: number; parameterName: string; parameterCode: string; uom: string }

const MODE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af', label: 'Mode 1 — Time-Based' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46', label: 'Mode 2 — Operator Scan' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e', label: 'Mode 3 — Process Log' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9', label: 'Mode 4 — Dispatch Event' },
}

// ── All available 2-hour time slots ──────────────────────────────────────────
const ALL_SLOTS = [
  '02:00','04:00','06:00','08:00','10:00','12:00',
  '14:00','16:00','18:00','20:00','22:00','00:00'
]

// ── Quick preset definitions ──────────────────────────────────────────────────
const PRESETS = [
  { label: 'Daily 08:00',        slots: ['08:00'] },
  { label: 'Twice daily (06/18)',slots: ['06:00','18:00'] },
  { label: 'Every 4 hours',      slots: ['00:00','04:00','08:00','12:00','16:00','20:00'] },
  { label: 'Every 2 hours',      slots: ALL_SLOTS },
]

// ── Time slot chip component ──────────────────────────────────────────────────
function SlotChip({ time, selected, onToggle }: { time: string; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      padding: '5px 13px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
      border: `1.5px solid ${selected ? '#1e3a5f' : '#d1d5db'}`,
      background: selected ? '#1e3a5f' : '#fff',
      color: selected ? '#fff' : '#6b7280',
      transition: 'all 0.12s',
    }}>
      {time}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckpointsPage() {
  const [data, setData]             = useState<Checkpoint[]>([])
  const [labs, setLabs]             = useState<Lab[]>([])
  const [params, setParams]         = useState<Param[]>([])
  const [loading, setLoading]       = useState(false)
  const [modeFilter, setModeFilter] = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Checkpoint | null>(null)
  const [showProcessLog, setShowProcessLog]   = useState<number | null>(null)
  // History modal
  const [historyCheckpoint, setHistoryCheckpoint] = useState<Checkpoint | null>(null)
  const [historyLogs, setHistoryLogs]             = useState<TriggerLog[]>([])
  const [historyLoading, setHistoryLoading]       = useState(false)

  async function openHistory(cp: Checkpoint) {
    setHistoryCheckpoint(cp); setHistoryLogs([]); setHistoryLoading(true)
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/triggers`)
      setHistoryLogs(r.data)
    } catch { setHistoryLogs([]) }
    finally { setHistoryLoading(false) }
  }
  const [showSignRow, setShowSignRow]         = useState<{ checkpointId: number; rowId: number } | null>(null)
  const [processLogRows, setProcessLogRows]   = useState<ProcessLogRow[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const { triggerCheckpoint, pendingCount, isOnline } = useOfflineScanQueue()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [cpName, setCpName]               = useState('')
  const [cpId, setCpId]                   = useState('')      // slug / display ID
  const [labId, setLabId]                 = useState('')
  const [perBatch, setPerBatch]           = useState(false)   // true = OperatorScan
  const [triggerMode, setTriggerMode]     = useState('TimeBased')
  const [cpType, setCpType]               = useState('Single')
  const [shiftHrs, setShiftHrs]           = useState('')
  const [selectedSlots, setSelectedSlots] = useState<string[]>(['08:00'])
  const [manualSlot, setManualSlot]       = useState('')        // manual time entry
  const [manualSlotError, setManualSlotError] = useState('')
  const [selectedParams, setSelectedParams] = useState<number[]>([])

  const [signForm, setSignForm] = useState({
    password: '', meaning: 'I confirm this process log entry', reason: ''
  })

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const mq = modeFilter ? `?triggerMode=${modeFilter}` : ''
      const [r, lr, pr] = await Promise.all([
        api.get(`/checkpoints${mq}`).catch(() => ({ data: [] })),
        api.get('/laboratories').catch(() => ({ data: [] })),
        api.get('/parameters').catch(() => ({ data: [] })),
      ])
      setData(r.data); setLabs(lr.data); setParams(pr.data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [modeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open form (create) ───────────────────────────────────────────────────
  function openCreate() {
    setCpName(''); setCpId(''); setLabId(''); setPerBatch(false)
    setTriggerMode('TimeBased'); setCpType('Single'); setShiftHrs('')
    setSelectedSlots(['08:00']); setManualSlot(''); setManualSlotError('')
    setSelectedParams([]); setError('')
    setEditTarget(null); setShowForm(true)
  }

  // ── Auto-generate slug from name ────────────────────────────────────────
  function handleNameChange(val: string) {
    setCpName(val)
    // auto-fill ID only if user hasn't manually edited it
    if (!editTarget) {
      setCpId(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20))
    }
  }

  // ── Slot toggle / presets ───────────────────────────────────────────────
  function toggleSlot(t: string) {
    setSelectedSlots(prev => prev.includes(t) ? prev.filter(s => s !== t) : [...prev, t])
  }
  function applyPreset(slots: string[]) { setSelectedSlots(slots) }

  function addManualSlot() {
    const t = manualSlot.trim()
    if (!/^\d{2}:\d{2}$/.test(t)) { setManualSlotError('Use HH:mm format (e.g. 07:30)'); return }
    const [h, m] = t.split(':').map(Number)
    if (h > 23 || m > 59) { setManualSlotError('Invalid time'); return }
    if (selectedSlots.includes(t)) { setManualSlotError('Already added'); return }
    setSelectedSlots(prev => [...prev, t])
    setManualSlot(''); setManualSlotError('')
  }

  // ── Param toggle ────────────────────────────────────────────────────────
  function toggleParam(id: number) {
    setSelectedParams(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Effective trigger mode ──────────────────────────────────────────────
  const effectiveMode = perBatch ? 'OperatorScan' : triggerMode

  // ── Submit ──────────────────────────────────────────────────────────────
  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const timeSlots = (!perBatch && effectiveMode === 'TimeBased' && selectedSlots.length > 0)
      ? JSON.stringify(selectedSlots.sort())
      : null
    try {
      await api.post('/checkpoints', {
        checkpointCode: cpName,
        labId: Number(labId),
        triggerMode: effectiveMode,
        checkpointType: cpType,
        timeSlots,
        shiftIntervalHrs: shiftHrs ? Number(shiftHrs) : null,
        parameterIds: selectedParams,
      })
      setShowForm(false)
      toast(`Checkpoint "${cpName}" added successfully`, 'success')
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to create checkpoint')
      setError(msg)
      toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  // ── Process log ─────────────────────────────────────────────────────────
  async function loadProcessLog(checkpointId: number) {
    const r = await api.get(`/checkpoints/${checkpointId}/process-log`)
    setProcessLogRows(r.data); setShowProcessLog(checkpointId)
  }

  async function submitSignRow(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    if (!showSignRow) return
    try {
      await api.post(`/checkpoints/${showSignRow.checkpointId}/process-log/${showSignRow.rowId}/sign`, signForm)
      setShowSignRow(null)
      toast('Process log row signed and locked ✓', 'success')
      loadProcessLog(showSignRow.checkpointId)
    } catch (err) {
      const msg = getErrorMessage(err, 'E-signature failed')
      setError(msg)
      toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  const isTimeBased = !perBatch && effectiveMode === 'TimeBased'

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Checkpoints</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>All 4 trigger modes — time-based, operator scan, process log, dispatch event</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select style={{ ...inp, width: 220, margin: 0 }} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
            <option value="">All Modes</option>
            <option value="TimeBased">Mode 1 — Time-Based</option>
            <option value="OperatorScan">Mode 2 — Operator Scan</option>
            <option value="ProcessLog">Mode 3 — Process Log</option>
            <option value="DispatchEvent">Mode 4 — Dispatch Event</option>
          </select>
          <button onClick={openCreate}
            style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Add Checkpoint
          </button>
        </div>
      </div>

      {/* ── Offline / pending-sync banner ────────────────────────────────── */}
      {(!isOnline || pendingCount > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: !isOnline ? '#fef3c7' : '#d1fae5',
          border: `1px solid ${!isOnline ? '#fcd34d' : '#6ee7b7'}`,
        }}>
          <span style={{ fontSize: 18 }}>{!isOnline ? '📶' : '🔄'}</span>
          <div>
            <strong style={{ fontSize: 13, color: !isOnline ? '#92400e' : '#065f46' }}>
              {!isOnline ? 'Offline — scans will be queued' : 'Back online — syncing…'}
            </strong>
            {pendingCount > 0 && (
              <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>
                {pendingCount} scan{pendingCount > 1 ? 's' : ''} pending sync
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <DataTable loading={loading} data={data} columns={[
        { header: 'Code', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.checkpointCode}</strong> },
        {
          header: 'Trigger Mode', accessor: r => {
            const m = MODE_COLORS[r.triggerMode] ?? { bg: '#f3f4f6', color: '#374151', label: r.triggerMode }
            return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: m.bg, color: m.color, fontWeight: 500 }}>{m.label}</span>
          }
        },
        { header: 'Type', accessor: 'checkpointType' },
        { header: 'Interval (hrs)', accessor: r => r.shiftIntervalHrs || '—' },
        {
          header: 'Parameters', accessor: r => (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(r.parameters ?? []).length === 0
                ? <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
                : (r.parameters ?? []).map(p => (
                  <span key={p.parameterId} title={p.parameterName}
                    style={{ padding: '1px 7px', background: '#f0fdfa', border: '1px solid #99f6e4',
                      borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#0d6e6e', fontFamily: 'monospace' }}>
                    {p.parameterCode}
                  </span>
                ))
              }
            </div>
          )
        },
        { header: 'Active', accessor: r => <span style={{ fontSize: 12, fontWeight: 600, color: r.isActive ? '#16a34a' : '#dc2626' }}>{r.isActive ? '● Active' : '● Inactive'}</span> },
        {
          header: 'Actions', accessor: r => (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(r.triggerMode === 'OperatorScan' || r.triggerMode === 'DispatchEvent') && (
                <button onClick={() => { triggerCheckpoint(r.checkpointId); toast(`Checkpoint "${r.checkpointCode}" triggered`, 'success') }}
                  style={{ padding: '3px 9px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  Trigger
                </button>
              )}
              {r.triggerMode === 'ProcessLog' && (
                <button onClick={() => loadProcessLog(r.checkpointId)}
                  style={{ padding: '3px 9px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  Process Log
                </button>
              )}
              <button onClick={() => openHistory(r)}
                style={{ padding: '3px 9px', background: '#f1f5f9', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                📜 History
              </button>
            </div>
          )
        },
      ]} />

      {/* ══════════════════════════════════════════════════════════════════
          Create / Edit Checkpoint — matches reference UI
      ══════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '32px 16px', overflowY: 'auto'
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640,
            padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {editTarget ? 'Edit Checkpoint' : 'Add Checkpoint'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={submitForm}>
              {/* ── Name + ID ─────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name</label>
                  <input style={inp} value={cpName} onChange={e => handleNameChange(e.target.value)}
                    required placeholder="e.g. Compressor A Water Check" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>ID</label>
                  <input style={{ ...inp, background: '#f9fafb', fontFamily: 'monospace' }}
                    value={cpId} onChange={e => setCpId(e.target.value)}
                    required placeholder="e.g. c-cmpa" />
                </div>
              </div>

              {/* ── Lab + Type ────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Laboratory</label>
                  <select style={inp} value={labId} onChange={e => setLabId(e.target.value)} required>
                    <option value="">Select lab…</option>
                    {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Type</label>
                  <select style={inp} value={cpType} onChange={e => setCpType(e.target.value)}>
                    <option value="Single">Single</option>
                    <option value="Grouped">Grouped (multiple locations)</option>
                  </select>
                </div>
              </div>

              {/* ── Per-batch toggle ──────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                marginBottom: 20, cursor: 'pointer', background: perBatch ? '#f0fdf4' : '#fff',
                borderColor: perBatch ? '#86efac' : '#e5e7eb'
              }} onClick={() => setPerBatch(b => !b)}>
                <input type="checkbox" checked={perBatch} onChange={() => setPerBatch(b => !b)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Per-batch (no time slots)</span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                    Triggered by operator scan or dispatch event — no fixed schedule
                  </p>
                </div>
              </div>

              {/* ── Trigger mode (shown only when NOT per-batch) ──────── */}
              {!perBatch && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Trigger Mode</label>
                  <select style={inp} value={triggerMode} onChange={e => setTriggerMode(e.target.value)}>
                    <option value="TimeBased">Mode 1 — Time-Based (auto by scheduler)</option>
                    <option value="ProcessLog">Mode 3 — Process Log (shift-based grid)</option>
                    <option value="DispatchEvent">Mode 4 — Dispatch Event (DO-triggered)</option>
                  </select>
                </div>
              )}

              {/* ── Time Slots — visual chips ─────────────────────────── */}
              {isTimeBased && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      Time slots
                    </label>
                    {/* Quick presets */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRESETS.map(p => (
                        <button key={p.label} type="button" onClick={() => applyPreset(p.slots)}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                            border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151',
                            cursor: 'pointer', whiteSpace: 'nowrap'
                          }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Chip grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 16px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                    {ALL_SLOTS.map(t => (
                      <SlotChip key={t} time={t} selected={selectedSlots.includes(t)} onToggle={() => toggleSlot(t)} />
                    ))}
                  </div>
                  {/* Manual entry row */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        style={{ ...inp, fontFamily: 'monospace', letterSpacing: '0.05em', margin: 0 }}
                        value={manualSlot}
                        onChange={e => { setManualSlot(e.target.value); setManualSlotError('') }}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualSlot())}
                        placeholder="Custom time, e.g. 07:30 or 13:45"
                        maxLength={5}
                      />
                      {manualSlotError && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444' }}>{manualSlotError}</p>
                      )}
                    </div>
                    <button type="button" onClick={addManualSlot}
                      style={{ padding: '9px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      + Add
                    </button>
                  </div>

                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>
                    {selectedSlots.length === 0
                      ? 'No slots selected — checkpoint will not auto-trigger'
                      : `${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''} selected: ${[...selectedSlots].sort().join(', ')}`}
                  </p>
                </div>
              )}

              {/* ── Shift interval (ProcessLog mode) ─────────────────── */}
              {!perBatch && triggerMode === 'ProcessLog' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shift Interval (hours)</label>
                  <input style={inp} type="number" value={shiftHrs}
                    onChange={e => setShiftHrs(e.target.value)} placeholder="e.g. 8" />
                </div>
              )}

              {/* ── Parameters checklist ─────────────────────────────── */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Parameters
                  {selectedParams.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
                      ({selectedParams.length} selected)
                    </span>
                  )}
                </label>
                <div style={{
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  maxHeight: 220, overflowY: 'auto', background: '#fff'
                }}>
                  {params.length === 0 ? (
                    <p style={{ padding: '16px', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                      No parameters found. Add test method parameters first.
                    </p>
                  ) : params.map((p, i) => {
                    const checked = selectedParams.includes(p.parameterId)
                    return (
                      <label key={p.parameterId}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: i < params.length - 1 ? '1px solid #f3f4f6' : 'none',
                          background: checked ? '#f0f9ff' : '#fff',
                          transition: 'background 0.1s'
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleParam(p.parameterId)}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1e3a5f' }} />
                          <span style={{ fontSize: 13, color: '#111827' }}>{p.parameterName}</span>
                          {p.parameterCode && (
                            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.parameterCode}</span>
                          )}
                        </div>
                        {p.uom && (
                          <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', flexShrink: 0 }}>{p.uom}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* ── Error + Buttons ───────────────────────────────────── */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠ {error}</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '10px 22px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '10px 22px', background: saving ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {saving ? 'Saving…' : '💾  Save Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mode 3: Process Log grid ──────────────────────────────────────── */}
      {showProcessLog && (
        <Modal title="Process Log — Mode 3 Shift Grid" onClose={() => setShowProcessLog(null)}>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {processLogRows.length === 0 && (
              <p style={{ color: '#6b7280', fontSize: 13 }}>No slots for today. Scheduler runs at midnight UTC.</p>
            )}
            {processLogRows.map(row => (
              <div key={row.rowId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderBottom: '1px solid #e5e7eb',
                background: row.status === 'Locked' ? '#f0fdf4' : row.status === 'Open' ? '#fff' : '#fef3c7'
              }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{row.slotLabel}</strong>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                    {new Date(row.slotTime).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 10,
                    background: row.status === 'Locked' ? '#d1fae5' : '#fef9c3',
                    color: row.status === 'Locked' ? '#065f46' : '#854d0e'
                  }}>{row.status}</span>
                  {row.status === 'Open' && (
                    <button onClick={() => { setShowSignRow({ checkpointId: showProcessLog, rowId: row.rowId }); setError('') }}
                      style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      Sign Row
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Sign Process Log Row §11.50 ───────────────────────────────────── */}
      {showSignRow && (
        <Modal title="Sign Process Log Row" onClose={() => setShowSignRow(null)}>
          <form onSubmit={submitSignRow}>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={signForm.password}
                onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={signForm.meaning}
                onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={signForm.reason}
                onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSignRow(null)} label="Sign & Lock Row" />
          </form>
        </Modal>
      )}

      {/* ── Trigger History Modal ────────────────────────────────────────── */}
      {historyCheckpoint && (
        <Modal title={`${historyCheckpoint.checkpointCode} — Trigger History`} onClose={() => setHistoryCheckpoint(null)}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Last 10 trigger events for this checkpoint</span>
          </div>
          {historyLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
          {!historyLoading && historyLogs.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              No trigger history found for this checkpoint.
            </p>
          )}
          {!historyLoading && historyLogs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date / Time', 'Triggered By', 'Mode', 'Delivery Order', 'Sync'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((t, i) => (
                  <tr key={t.triggerId} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#111827' }}>
                      {new Date(t.triggeredAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151' }}>{t.triggeredBy ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: '#dbeafe', color: '#1e40af' }}>
                        {t.triggerMode}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {t.deliveryOrder ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {t.isOfflineSync
                        ? <span style={{ fontSize: 11, color: '#854d0e', fontWeight: 600 }}>📴 Offline</span>
                        : <span style={{ fontSize: 11, color: '#065f46' }}>✓ Online</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setHistoryCheckpoint(null)}
              style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
