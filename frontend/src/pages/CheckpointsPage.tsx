import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/dateFormat'
import { fmtLabel } from '@/utils/formatLabel'
import DataTable from '@/components/DataTable'
import { inp } from './master-data/LaboratoriesPage'
import ESignatureDrawer from '@/components/ESignatureDrawer'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { Panel } from '@/components/Panel'
import { useOfflineScanQueue } from '@/hooks/useOfflineScanQueue'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckpointParam {
  parameterId: number; parameterCode: string; parameterName: string; uom: string | null
  alertMin?: number | null; alertMax?: number | null
  actionMin?: number | null; actionMax?: number | null
}
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

// ── Two-tier limit check ──────────────────────────────────────────────────────
type LimitTier = 'ok' | 'alert' | 'action' | 'none'
function checkLimits(value: string, p: CheckpointParam): LimitTier {
  const n = parseFloat(value)
  if (isNaN(n)) return 'none'
  const hasAction = p.actionMin != null || p.actionMax != null
  const hasAlert  = p.alertMin  != null || p.alertMax  != null
  if (hasAction) {
    const outAction = (p.actionMin != null && n < p.actionMin) || (p.actionMax != null && n > p.actionMax)
    if (outAction) return 'action'
  }
  if (hasAlert) {
    const outAlert = (p.alertMin != null && n < p.alertMin) || (p.alertMax != null && n > p.alertMax)
    if (outAlert) return 'alert'
  }
  return (hasAction || hasAlert) ? 'ok' : 'none'
}
const TIER_STYLE: Record<LimitTier, { border: string; background: string; badge?: string }> = {
  ok:     { border: '#16a34a', background: '#f0fdf4', badge: 'Within limits' },
  alert:  { border: '#f59e0b', background: '#fffbeb', badge: '⚠ Alert limit' },
  action: { border: '#dc2626', background: '#fef2f2', badge: '🔴 Action limit!' },
  none:   { border: '#d1d5db', background: '#fff' },
}

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
  const role = useSelector((s: RootState) => s.auth.role) ?? ''

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
  const [paramLimits, setParamLimits] = useState<Record<number, { alertMin: string; alertMax: string; actionMin: string; actionMax: string }>>({})
  const [showParamLimits, setShowParamLimits] = useState<number | null>(null)

  const [signForm, setSignForm] = useState({
    password: '', meaning: 'I confirm this process log entry', reason: 'Routine checkpoint sign-off'
  })
  const [signReadings, setSignReadings]     = useState<Record<number, string>>({})
  const [signParams, setSignParams]         = useState<CheckpointParam[]>([])

  // Record Check — Time-Based mode 1
  const [showRecordCheck, setShowRecordCheck] = useState<Checkpoint | null>(null)
  const [recordReadings, setRecordReadings]   = useState<Record<number, string>>({})
  const [recordSlotLabel, setRecordSlotLabel] = useState('')
  const [recordSampleId, setRecordSampleId]   = useState('')
  const [recordSamples, setRecordSamples]     = useState<{ sampleId: number; sampleNumber: string; materialName: string }[]>([])
  const [recordSaving, setRecordSaving]       = useState(false)
  const [recordError, setRecordError]         = useState('')
  const [recordEsig, setRecordEsig]           = useState({ password: '', meaning: 'I confirm this time-based checkpoint reading is accurate and complete', reason: '' })

  async function openRecordCheck(cp: Checkpoint) {
    const now = new Date()
    const hh  = now.getHours().toString().padStart(2, '0')
    const mm  = now.getMinutes().toString().padStart(2, '0')
    setRecordSlotLabel(`${hh}:${mm}`)
    setRecordReadings({}); setRecordSampleId(''); setRecordError('')
    setRecordEsig({ password: '', meaning: 'I confirm this time-based checkpoint reading is accurate and complete', reason: '' })
    setShowRecordCheck(cp)
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/linked-samples`)
      setRecordSamples(r.data)
    } catch { setRecordSamples([]) }
  }

  async function submitRecordCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!showRecordCheck) return
    setRecordSaving(true); setRecordError('')
    try {
      const readings = showRecordCheck.parameters
        .map(p => ({ parameterId: p.parameterId, value: (recordReadings[p.parameterId] ?? '').trim() }))
        .filter(r => r.value !== '')
      await api.post(`/checkpoints/${showRecordCheck.checkpointId}/execute`, {
        slotLabel: recordSlotLabel,
        password:  recordEsig.password,
        meaning:   recordEsig.meaning,
        reason:    recordEsig.reason,
        readings,
        sampleId: recordSampleId ? Number(recordSampleId) : null,
      })
      toast(`Checkpoint "${showRecordCheck.checkpointCode}" recorded ✓`, 'success')
      setShowRecordCheck(null)
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Record failed')
      setRecordError(msg); toast(msg, 'error')
    } finally { setRecordSaving(false) }
  }

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Checkpoint | null>(null)
  const [deleting, setDeleting]         = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/checkpoints/${deleteTarget.checkpointId}`)
      toast(`Checkpoint "${deleteTarget.checkpointCode}" deleted`, 'success')
      setDeleteTarget(null)
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Delete failed')
      toast(msg, 'error')
    } finally {
      setDeleting(false)
    }
  }

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
    setSelectedParams([]); setParamLimits({}); setShowParamLimits(null); setError('')
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
        parameters: selectedParams.map(id => {
          const lim = paramLimits[id] ?? {}
          return {
            parameterId: id,
            alertMin:  lim.alertMin  ? parseFloat(lim.alertMin)  : null,
            alertMax:  lim.alertMax  ? parseFloat(lim.alertMax)  : null,
            actionMin: lim.actionMin ? parseFloat(lim.actionMin) : null,
            actionMax: lim.actionMax ? parseFloat(lim.actionMax) : null,
          }
        }),
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
      const readings = signParams
        .map(p => ({ parameterId: p.parameterId, value: (signReadings[p.parameterId] ?? '').trim() }))
        .filter(r => r.value !== '')
      await api.post(`/checkpoints/${showSignRow.checkpointId}/process-log/${showSignRow.rowId}/sign`, {
        ...signForm, readings,
      })
      setSignForm({ password: '', meaning: '', reason: '' })
      setSignReadings({}); setSignParams([])
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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Checkpoints</h2>
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
          {(role === 'Admin' || role === 'QA') && (
            <button onClick={openCreate}
              style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              + Add Checkpoint
            </button>
          )}
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
              {r.triggerMode === 'TimeBased' && (
                <button onClick={() => openRecordCheck(r)}
                  style={{ padding: '3px 9px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  📋 Record Check
                </button>
              )}
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
              {(role === 'Admin' || role === 'QA') && (
                <button onClick={() => setDeleteTarget(r)}
                  style={{ padding: '3px 9px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  🗑 Delete
                </button>
              )}
            </div>
          )
        },
      ]} />

      {/* ══════════════════════════════════════════════════════════════════
          Create / Edit Checkpoint — matches reference UI
      ══════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <Drawer title={editTarget ? 'Edit Checkpoint' : 'Add Checkpoint'} width={680} onClose={() => setShowForm(false)}>
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
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>{manualSlotError}</p>
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
                    const checked   = selectedParams.includes(p.parameterId)
                    const limitsOpen = showParamLimits === p.parameterId
                    const lim       = paramLimits[p.parameterId] ?? {}
                    const hasLim    = checked && (lim.alertMin || lim.alertMax || lim.actionMin || lim.actionMax)
                    return (
                      <div key={p.parameterId} style={{ borderBottom: i < params.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', cursor: 'pointer',
                          background: checked ? '#f0f9ff' : '#fff',
                          transition: 'background 0.1s'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => toggleParam(p.parameterId)}>
                            <input type="checkbox" checked={checked} onChange={() => toggleParam(p.parameterId)}
                              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1e3a5f' }} />
                            <span style={{ fontSize: 13, color: '#111827' }}>{p.parameterName}</span>
                            {p.parameterCode && (
                              <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.parameterCode}</span>
                            )}
                            {hasLim && (
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>limits set</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.uom && (
                              <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{p.uom}</span>
                            )}
                            {checked && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setShowParamLimits(limitsOpen ? null : p.parameterId) }}
                                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: limitsOpen ? '#1e3a5f' : '#f9fafb', color: limitsOpen ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 600 }}>
                                {limitsOpen ? '▲ Limits' : '▼ Limits'}
                              </button>
                            )}
                          </div>
                        </div>
                        {checked && limitsOpen && (
                          <div style={{ padding: '10px 14px 14px', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#92400e' }}>Two-Tier Limits (LabVantage parity)</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {(['alertMin','alertMax','actionMin','actionMax'] as const).map(field => (
                                <div key={field}>
                                  <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 600 }}>
                                    {field === 'alertMin' ? '⚠ Alert Min' : field === 'alertMax' ? '⚠ Alert Max' : field === 'actionMin' ? '🔴 Action Min' : '🔴 Action Max'}
                                  </label>
                                  <input
                                    style={{ ...inp, margin: 0, fontSize: 12, padding: '6px 10px', fontFamily: 'monospace' }}
                                    type="number" step="any" placeholder="—"
                                    value={lim[field] ?? ''}
                                    onChange={e => setParamLimits(prev => ({ ...prev, [p.parameterId]: { ...prev[p.parameterId] ?? {}, [field]: e.target.value } }))}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
              <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} label="💾 Save Checkpoint" />
            </form>
        </Drawer>
      )}

      {/* ── Mode 3: Process Log grid ──────────────────────────────────────── */}
      {showProcessLog && (
        <Drawer title="Process Log — Mode 3 Shift Grid" subtitle="Today's shift slots for this checkpoint." width={540} onClose={() => setShowProcessLog(null)}>
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
                    {fmtDateTime(row.slotTime)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 10,
                    background: row.status === 'Locked' ? '#d1fae5' : '#fef9c3',
                    color: row.status === 'Locked' ? '#065f46' : '#854d0e'
                  }}>{fmtLabel(row.status)}</span>
                  {row.status === 'Open' && (
                    <button onClick={() => {
                      const cp = data.find(c => c.checkpointId === showProcessLog)
                      setSignParams(cp?.parameters ?? [])
                      setSignReadings({})
                      setShowSignRow({ checkpointId: showProcessLog, rowId: row.rowId })
                      setError('')
                    }}
                      style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      Sign Row
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}

      {/* ── Sign Process Log Row §11.50 ───────────────────────────────────── */}
      {showSignRow && (
        <ESignatureDrawer
          title="Sign Process Log Row"
          subtitle="Immutable audit entry (21 CFR §11.50)"
          form={signForm} onChange={setSignForm}
          onSubmit={submitSignRow}
          onClose={() => { setSignForm({ password: '', meaning: '', reason: '' }); setSignReadings({}); setSignParams([]); setShowSignRow(null); setError('') }}
          saving={saving} error={error} label="Sign & Lock Row"
          actionKey="Checkpoint.Acknowledge"
        >
          {signParams.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>Parameter Readings</p>
              {signParams.map(p => {
                const val  = signReadings[p.parameterId] ?? ''
                const tier = checkLimits(val, p)
                const ts   = TIER_STYLE[tier]
                const hasLimits = p.alertMin != null || p.alertMax != null || p.actionMin != null || p.actionMax != null
                return (
                  <div key={p.parameterId} style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${ts.border}`, background: ts.background, transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        {p.parameterName}{p.uom ? ` (${p.uom})` : ''}
                      </label>
                      {ts.badge && val !== '' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: tier === 'ok' ? '#d1fae5' : tier === 'alert' ? '#fef3c7' : '#fee2e2', color: tier === 'ok' ? '#065f46' : tier === 'alert' ? '#92400e' : '#991b1b' }}>
                          {ts.badge}
                        </span>
                      )}
                    </div>
                    <input
                      style={{ ...inp, margin: 0, fontFamily: 'monospace' }}
                      type="text"
                      placeholder="Enter measured value…"
                      value={val}
                      onChange={e => setSignReadings(prev => ({ ...prev, [p.parameterId]: e.target.value }))}
                    />
                    {hasLimits && (
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: '#9ca3af' }}>
                        {[
                          p.actionMin != null ? `Action ≥${p.actionMin}` : null,
                          p.alertMin  != null ? `Alert ≥${p.alertMin}`  : null,
                          p.alertMax  != null ? `Alert ≤${p.alertMax}`  : null,
                          p.actionMax != null ? `Action ≤${p.actionMax}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ESignatureDrawer>
      )}

      {/* ── Record Check — Mode 1 Time-Based ────────────────────────────── */}
      {showRecordCheck && (
        <Drawer title={`Record Check — ${showRecordCheck.checkpointCode}`} width={520}
          onClose={() => setShowRecordCheck(null)}>
          <form onSubmit={submitRecordCheck}>
            {/* Slot label */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Slot Time (HH:MM)
              </label>
              <input style={{ ...inp, fontFamily: 'monospace', letterSpacing: '0.06em' }}
                value={recordSlotLabel} onChange={e => setRecordSlotLabel(e.target.value)}
                required placeholder="08:00" maxLength={5} />
            </div>

            {/* Sample link */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Link to Sample <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <select style={inp} value={recordSampleId} onChange={e => setRecordSampleId(e.target.value)}>
                <option value="">— No sample link —</option>
                {recordSamples.map(s => (
                  <option key={s.sampleId} value={s.sampleId}>
                    {s.sampleNumber} · {s.materialName}
                  </option>
                ))}
              </select>
            </div>

            {/* Parameter readings with two-tier limit feedback */}
            {showRecordCheck.parameters.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  Parameter Readings
                </p>
                {showRecordCheck.parameters.map(p => {
                  const val  = recordReadings[p.parameterId] ?? ''
                  const tier = checkLimits(val, p)
                  const ts   = TIER_STYLE[tier]
                  const hasLimits = p.alertMin != null || p.alertMax != null || p.actionMin != null || p.actionMax != null
                  return (
                    <div key={p.parameterId} style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${ts.border}`, background: ts.background, transition: 'border-color 0.15s, background 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                          {p.parameterName}{p.uom ? <span style={{ fontWeight: 400, color: '#6b7280' }}> ({p.uom})</span> : ''}
                        </label>
                        {ts.badge && val !== '' && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: tier === 'ok' ? '#d1fae5' : tier === 'alert' ? '#fef3c7' : '#fee2e2', color: tier === 'ok' ? '#065f46' : tier === 'alert' ? '#92400e' : '#991b1b' }}>
                            {ts.badge}
                          </span>
                        )}
                      </div>
                      <input
                        style={{ ...inp, margin: 0, fontFamily: 'monospace' }}
                        type="text"
                        placeholder="Enter measured value…"
                        value={val}
                        onChange={e => setRecordReadings(prev => ({ ...prev, [p.parameterId]: e.target.value }))}
                      />
                      {hasLimits && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
                          {[
                            p.actionMin != null ? `Action ≥${p.actionMin}` : null,
                            p.alertMin  != null ? `Alert ≥${p.alertMin}`  : null,
                            p.alertMax  != null ? `Alert ≤${p.alertMax}`  : null,
                            p.actionMax != null ? `Action ≤${p.actionMax}` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* E-signature */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Electronic Signature — 21 CFR §11.300
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password (re-enter)</label>
                <input style={inp} type="password" required autoComplete="current-password"
                  value={recordEsig.password}
                  onChange={e => setRecordEsig(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Meaning of Signature</label>
                <input style={inp} required value={recordEsig.meaning}
                  onChange={e => setRecordEsig(f => ({ ...f, meaning: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Reason / Observation</label>
                <textarea style={{ ...inp, height: 72, resize: 'vertical' }} required
                  placeholder="e.g. Routine time-based check — all readings within spec"
                  value={recordEsig.reason}
                  onChange={e => setRecordEsig(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>

            {recordError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠ {recordError}</p>
              </div>
            )}
            <DrawerFooter saving={recordSaving} onCancel={() => setShowRecordCheck(null)} label="✅ Submit & Sign" />
          </form>
        </Drawer>
      )}

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '28px 32px',
            maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#111827', textAlign: 'center' }}>
              Delete Checkpoint?
            </h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#374151', textAlign: 'center' }}>
              <strong style={{ fontFamily: 'monospace' }}>{deleteTarget.checkpointCode}</strong>
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              This permanently removes the checkpoint and all its trigger history.
              Blocked if signed audit rows exist.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #d1d5db',
                  background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: deleting ? '#fca5a5' : '#dc2626', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trigger History Modal ────────────────────────────────────────── */}
      {historyCheckpoint && (
        <Panel title={`${historyCheckpoint.checkpointCode} — Trigger History`} subtitle="Last 10 trigger events for this checkpoint." width={620} onClose={() => setHistoryCheckpoint(null)}>
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
                      {fmtDateTime(t.triggeredAt)}
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
        </Panel>
      )}
    </div>
  )
}
