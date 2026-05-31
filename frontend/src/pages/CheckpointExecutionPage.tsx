// ─────────────────────────────────────────────────────────────────────────────
// CheckpointExecutionPage.tsx — Analyst Execution View
//
// Analyst-focused page: shows all active checkpoints as cards with
// clear status indicators and one-click action buttons.
// No admin config (Add/Edit) — pure execution.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import api from '@/api/client'
import { inp, Modal, Field, ModalFooter } from './master-data/LaboratoriesPage'
import { useOfflineScanQueue } from '@/hooks/useOfflineScanQueue'
import { toast } from '@/components/Toast'

interface CheckpointParam {
  parameterId:   number
  parameterName: string
  parameterCode: string
  uom:           string | null
  dataType:      string
}

interface Checkpoint {
  checkpointId:    number
  checkpointCode:  string
  triggerMode:     string
  checkpointType:  string
  shiftIntervalHrs: number | null
  isActive:        boolean
  locationCount:   number
  timeSlots?:      string | null  // JSON string e.g. '["08:00","14:00"]' — now returned by API
  parameters:      CheckpointParam[]
}

interface ProcessLogRow {
  rowId:         number
  slotTime:      string
  slotLabel:     string
  status:        string
  isSigned:      boolean
  sampleId?:     number
  sampleNumber?: string
}

const MODE_META: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af', icon: '⏱', label: 'Time-Based (auto)' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46', icon: '📷', label: 'Operator Scan' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e', icon: '📋', label: 'Process Log' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9', icon: '🚚', label: 'Dispatch Event' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseSlots(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function slotStatus(slot: string): 'done' | 'overdue' | 'upcoming' {
  const now   = new Date()
  const [h, m] = slot.split(':').map(Number)
  const slotDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  const diffMin = (now.getTime() - slotDt.getTime()) / 60000
  if (diffMin > 30)  return 'overdue'   // past by >30 min — needs execution
  if (diffMin < -5)  return 'upcoming'  // future
  return 'done'                          // within 5 min window — active now
}

// ── Slot status pill ──────────────────────────────────────────────────────────
function SlotPill({ slot, onExecute }: { slot: string; onExecute?: () => void }) {
  const s = slotStatus(slot)
  const styles: Record<string, { bg: string; color: string; icon: string }> = {
    done:     { bg: '#d1fae5', color: '#065f46', icon: '🟢' },
    overdue:  { bg: '#fee2e2', color: '#991b1b', icon: '🔴' },
    upcoming: { bg: '#f3f4f6', color: '#374151', icon: '⏳' },
  }
  const st = styles[s]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, marginBottom: 4 }}>
      <span style={{
        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
        background: st.bg, color: st.color,
      }}>
        {st.icon} {slot}
      </span>
      {onExecute && (s === 'done' || s === 'overdue') && (
        <button
          onClick={onExecute}
          style={{
            padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: s === 'overdue' ? '#dc2626' : '#16a34a', color: '#fff',
            border: 'none',
          }}
        >
          ✍️ Execute
        </button>
      )}
    </span>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ checkpoints }: { checkpoints: Checkpoint[] }) {
  const auto      = checkpoints.filter(c => c.triggerMode === 'TimeBased').length
  const manual    = checkpoints.filter(c => c.triggerMode === 'OperatorScan' || c.triggerMode === 'DispatchEvent').length
  const processLog = checkpoints.filter(c => c.triggerMode === 'ProcessLog').length

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {[
        { label: 'Total Active',   value: checkpoints.length, bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
        { label: 'Auto (Timer)',   value: auto,               bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
        { label: 'Manual Trigger', value: manual,             bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
        { label: 'Process Log',    value: processLog,         bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
      ].map(s => (
        <div key={s.label} style={{
          padding: '12px 20px', borderRadius: 10,
          background: s.bg, border: `1px solid ${s.border}`,
          minWidth: 110, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CheckpointExecutionPage() {
  const [checkpoints, setCheckpoints]   = useState<Checkpoint[]>([])
  const [loading, setLoading]           = useState(false)
  const [filterMode, setFilterMode]     = useState('')

  // Process Log modal state
  const [logRows, setLogRows]           = useState<ProcessLogRow[]>([])
  const [logFor, setLogFor]             = useState<Checkpoint | null>(null)
  const [logLoading, setLogLoading]     = useState(false)

  // E-signature modal (Process Log sign)
  const [signRow, setSignRow]           = useState<{ checkpointId: number; rowId: number; params: CheckpointParam[] } | null>(null)
  const [signForm, setSignForm]         = useState({ password: '', meaning: 'I confirm this process log entry', reason: '' })
  const [readings, setReadings]         = useState<Record<number, string>>({})
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  // Execute (TimeBased) modal state
  const [execFor, setExecFor]           = useState<{ checkpoint: Checkpoint; slotLabel: string } | null>(null)
  const [execForm, setExecForm]         = useState({ password: '', meaning: 'I confirm this time-based checkpoint has been performed', reason: '' })
  const [execReadings, setExecReadings] = useState<Record<number, string>>({})
  const [execSaving, setExecSaving]     = useState(false)
  const [execError, setExecError]       = useState('')

  const { triggerCheckpoint } = useOfflineScanQueue()

  // ── Load checkpoints ───────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const q = filterMode ? `?triggerMode=${filterMode}` : ''
      const r = await api.get(`/checkpoints${q}`)
      setCheckpoints(r.data.filter((c: Checkpoint) => c.isActive))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filterMode])

  // ── OperatorScan: load linked samples then trigger ─────────────────────
  const [scanModal,       setScanModal]       = useState<Checkpoint | null>(null)
  const [linkedSamples,   setLinkedSamples]   = useState<{ sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; status: string }[]>([])
  const [scanSampleId,    setScanSampleId]    = useState<number | null>(null)
  const [scanLoading,     setScanLoading]     = useState(false)

  async function openScanModal(cp: Checkpoint) {
    setScanModal(cp); setScanSampleId(null); setLinkedSamples([]); setScanLoading(true)
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/linked-samples`)
      setLinkedSamples(r.data)
    } catch { setLinkedSamples([]) }
    finally { setScanLoading(false) }
  }

  async function confirmScanTrigger() {
    if (!scanModal) return
    triggerCheckpoint(scanModal.checkpointId, scanSampleId ?? undefined)
    setScanModal(null); setScanSampleId(null); setLinkedSamples([])
    load()
  }

  // ── Trigger (Mode 2 / Mode 4) ──────────────────────────────────────────
  async function handleTrigger(cp: Checkpoint) {
    if (cp.triggerMode === 'OperatorScan') {
      openScanModal(cp)
    } else {
      triggerCheckpoint(cp.checkpointId)
      toast(`✅ "${cp.checkpointCode}" triggered successfully`, 'success')
      load()
    }
  }

  // ── Open Process Log (Mode 3) ──────────────────────────────────────────
  async function openProcessLog(cp: Checkpoint) {
    setLogFor(cp); setLogLoading(true); setError('')
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/process-log`)
      setLogRows(r.data)
    } catch { toast('Failed to load process log', 'error') }
    finally { setLogLoading(false) }
  }

  // ── Open Execute modal for a time-based slot ───────────────────────────
  function openExecute(cp: Checkpoint, slot: string) {
    setExecFor({ checkpoint: cp, slotLabel: slot })
    setExecForm({ password: '', meaning: 'I confirm this time-based checkpoint has been performed', reason: '' })
    setExecReadings({})
    setExecError('')
  }

  // ── Submit Execute (Mode 1) ────────────────────────────────────────────
  async function handleExecute(e: React.FormEvent) {
    e.preventDefault()
    if (!execFor) return
    setExecSaving(true); setExecError('')
    try {
      const readingsList = Object.entries(execReadings)
        .filter(([, v]) => v.trim() !== '')
        .map(([parameterId, value]) => ({ parameterId: Number(parameterId), value }))
      await api.post(`/checkpoints/${execFor.checkpoint.checkpointId}/execute`, {
        slotLabel: execFor.slotLabel,
        password:  execForm.password,
        meaning:   execForm.meaning,
        reason:    execForm.reason,
        readings:  readingsList,
      })
      toast(`✅ Checkpoint ${execFor.checkpoint.checkpointCode} (${execFor.slotLabel}) executed and signed`, 'success')
      setExecFor(null)
    } catch (err: any) {
      const msg = err.friendlyMessage ?? err.response?.data?.message ?? 'Execution failed'
      setExecError(msg); toast(msg, 'error')
    }
    finally { setExecSaving(false) }
  }

  // ── Sign row (Mode 3, 21 CFR §11) ─────────────────────────────────────
  async function handleSign(e: React.FormEvent) {
    e.preventDefault()
    if (!signRow) return
    setSaving(true); setError('')
    try {
      const readingsList = Object.entries(readings)
        .filter(([, v]) => v.trim() !== '')
        .map(([parameterId, value]) => ({ parameterId: Number(parameterId), value }))
      await api.post(
        `/checkpoints/${signRow.checkpointId}/process-log/${signRow.rowId}/sign`,
        { ...signForm, readings: readingsList }
      )
      toast('Row signed and locked ✓', 'success')
      setSignRow(null)
      setReadings({})
      setSignForm({ password: '', meaning: 'I confirm this process log entry', reason: '' })
      if (logFor) openProcessLog(logFor)
    } catch (err: any) {
      const msg = err.friendlyMessage ?? err.response?.data?.message ?? 'E-signature failed'
      setError(msg); toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  const filtered = checkpoints

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
          ✅ Checkpoint Execution
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Trigger checkpoints, sign process log rows, and monitor today's schedule
        </p>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {!loading && <SummaryBar checkpoints={filtered} />}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'All Checkpoints', value: '' },
          { label: '⏱ Time-Based',   value: 'TimeBased' },
          { label: '📷 Operator Scan', value: 'OperatorScan' },
          { label: '📋 Process Log',  value: 'ProcessLog' },
          { label: '🚚 Dispatch',     value: 'DispatchEvent' },
        ].map(f => (
          <button key={f.value} onClick={() => setFilterMode(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1.5px solid',
              background: filterMode === f.value ? '#0f172a' : '#fff',
              color: filterMode === f.value ? '#fff' : '#374151',
              borderColor: filterMode === f.value ? '#0f172a' : '#e5e7eb',
              transition: 'all 0.12s',
            }}>
            {f.label}
          </button>
        ))}
        <button onClick={load}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>
          Loading checkpoints…
        </div>
      )}

      {/* ── Cards grid ──────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <p style={{ margin: 0, fontSize: 14 }}>No active checkpoints found.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(cp => {
          const meta   = MODE_META[cp.triggerMode] ?? { bg: '#f3f4f6', color: '#374151', icon: '•', label: cp.triggerMode }
          const slots  = parseSlots(cp.timeSlots)
          const isManual = cp.triggerMode === 'OperatorScan' || cp.triggerMode === 'DispatchEvent'
          const isAuto   = cp.triggerMode === 'TimeBased'
          const isLog    = cp.triggerMode === 'ProcessLog'

          // Count overdue/due slots for badge
          const activeSlots = slots.filter(s => slotStatus(s) !== 'upcoming')

          return (
            <div key={cp.checkpointId} style={{
              background: '#fff',
              border: `1.5px solid ${isAuto && activeSlots.length > 0 ? '#fca5a5' : '#e5e7eb'}`,
              borderRadius: 12,
              padding: '18px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                    {cp.checkpointCode}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: meta.bg, color: meta.color,
                  }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
                    background: '#dcfce7', color: '#15803d',
                  }}>
                    ● Active
                  </span>
                  {isAuto && activeSlots.length > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
                      background: '#fee2e2', color: '#991b1b',
                    }}>
                      ⚠ {activeSlots.length} slot{activeSlots.length > 1 ? 's' : ''} need execution
                    </span>
                  )}
                </div>
              </div>

              {/* Type badge */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
                  {cp.checkpointType}
                </span>
                {cp.shiftIntervalHrs && (
                  <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
                    Every {cp.shiftIntervalHrs}h
                  </span>
                )}
                {cp.parameters.length > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
                    {cp.parameters.length} parameter{cp.parameters.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* ── Time-Based: show today's schedule slots with Execute buttons ── */}
              {isAuto && slots.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Today's Schedule — click ✍️ Execute when you perform the check
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[...slots].sort().map(slot => (
                      <SlotPill key={slot} slot={slot} onExecute={() => openExecute(cp, slot)} />
                    ))}
                  </div>
                  {activeSlots.length === 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
                      ⏱ No slots due yet today — upcoming slots will show Execute when they fire
                    </p>
                  )}
                </div>
              )}

              {isAuto && slots.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  ⏱ No time slots configured — add slots in Settings → Checkpoints
                </p>
              )}

              {/* ── Operator Scan / Dispatch: Trigger button ─────────────────── */}
              {isManual && (
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#374151' }}>
                    {cp.triggerMode === 'OperatorScan'
                      ? 'Click when operator performs the scan / batch check'
                      : 'Click when a dispatch order has been processed'}
                  </p>
                  <button
                    onClick={() => handleTrigger(cp)}
                    style={{
                      width: '100%', padding: '12px 0',
                      background: '#16a34a', color: '#fff',
                      border: 'none', borderRadius: 8,
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#15803d')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}
                  >
                    🔔 Trigger Now
                  </button>
                </div>
              )}

              {/* ── Process Log: open shift grid ─────────────────────────────── */}
              {isLog && (
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#374151' }}>
                    Sign each shift row after completing the process check
                  </p>
                  <button
                    onClick={() => openProcessLog(cp)}
                    style={{
                      width: '100%', padding: '12px 0',
                      background: '#7c3aed', color: '#fff',
                      border: 'none', borderRadius: 8,
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#6d28d9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#7c3aed')}
                  >
                    📋 Open Process Log
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Execute Time-Based Checkpoint Modal ──────────────────────────── */}
      {execFor && (
        <Modal
          title={`✍️ Execute Checkpoint — ${execFor.checkpoint.checkpointCode} @ ${execFor.slotLabel}`}
          onClose={() => setExecFor(null)}
        >
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            Record your readings and confirm with e-signature. This creates an immutable audit entry (21 CFR Part 11).
          </p>
          <form onSubmit={handleExecute}>

            {/* ── Parameter readings ── */}
            {execFor.checkpoint.parameters.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                  📊 Enter Parameter Readings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {execFor.checkpoint.parameters.map(p => (
                    <div key={p.parameterId} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                        {p.parameterName}
                        <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.parameterCode}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.dataType === 'PassFail' ? (
                          <select
                            style={{ ...inp, margin: 0, width: '100%' }}
                            value={execReadings[p.parameterId] ?? ''}
                            onChange={e2 => setExecReadings(r => ({ ...r, [p.parameterId]: e2.target.value }))}>
                            <option value="">—</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                          </select>
                        ) : (
                          <input
                            type="number" step="any"
                            style={{ ...inp, margin: 0, width: '100%' }}
                            value={execReadings[p.parameterId] ?? ''}
                            onChange={e2 => setExecReadings(r => ({ ...r, [p.parameterId]: e2.target.value }))}
                            placeholder="value"
                          />
                        )}
                        {p.uom && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{p.uom}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: '#e5e7eb', margin: '14px 0' }} />
              </div>
            )}

            <Field label="Password (re-enter to confirm identity)">
              <input style={inp} type="password" value={execForm.password}
                onChange={e => setExecForm(f => ({ ...f, password: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Meaning of Signature">
              <input style={inp} value={execForm.meaning}
                onChange={e => setExecForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason / Observation">
              <input style={inp} value={execForm.reason}
                onChange={e => setExecForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. All readings within acceptable range — no anomalies observed" />
            </Field>
            {execError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {execError}</p>}
            <ModalFooter saving={execSaving} onCancel={() => setExecFor(null)} label="✅ Execute & Sign" />
          </form>
        </Modal>
      )}

      {/* ── OperatorScan: Linked Samples Modal ──────────────────────────── */}
      {scanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
              📷 Operator Scan — {scanModal.checkpointCode}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280' }}>
              Select the sample this scan is for. Only samples registered with this checkpoint are shown.
            </p>

            {scanLoading && <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>Loading linked samples…</div>}

            {!scanLoading && linkedSamples.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                No samples are linked to this checkpoint yet.<br />
                <span style={{ fontSize: 12 }}>Link samples by selecting this checkpoint during Sample Registration.</span>
              </div>
            )}

            {!scanLoading && linkedSamples.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {linkedSamples.map(s => (
                  <label key={s.sampleId} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${scanSampleId === s.sampleId ? '#0d9488' : '#e5e7eb'}`,
                    background: scanSampleId === s.sampleId ? '#f0fdfa' : '#fafafa',
                    transition: 'all 0.1s',
                  }}>
                    <input type="radio" name="scanSample" value={s.sampleId}
                      checked={scanSampleId === s.sampleId}
                      onChange={() => setScanSampleId(s.sampleId)}
                      style={{ accentColor: '#0d9488' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.sampleNumber}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{s.materialName} · Lot: {s.lotNumber}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: s.status === 'InTesting' ? '#fde8d8' : s.status === 'Released' ? '#d1fae5' : '#f1f5f9',
                      color: s.status === 'InTesting' ? '#9a3412' : s.status === 'Released' ? '#065f46' : '#475569',
                    }}>{s.status}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Always allow scan without sample link */}
              {linkedSamples.length > 0 && (
                <button onClick={() => { setScanSampleId(null); confirmScanTrigger() }}
                  style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#6b7280' }}>
                  Scan without sample link
                </button>
              )}
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <button onClick={() => setScanModal(null)}
                  style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={confirmScanTrigger}
                  style={{ padding: '8px 20px', borderRadius: 7, border: 'none', fontWeight: 700, cursor: 'pointer',
                    background: '#0d9488', color: '#fff', fontFamily: 'inherit' }}>
                  ✅ {scanSampleId ? 'Confirm Scan' : linkedSamples.length === 0 ? 'Confirm Scan' : 'Confirm without selection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Process Log Modal ────────────────────────────────────────────── */}
      {logFor && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
            padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  📋 Process Log
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {logFor.checkpointCode} — Sign each completed shift
                </p>
              </div>
              <button onClick={() => setLogFor(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer' }}>
                ×
              </button>
            </div>

            {logLoading && <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading shifts…</p>}

            {!logLoading && logRows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <p style={{ margin: 0, fontSize: 13 }}>No shift slots for today yet.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Scheduler generates slots at midnight UTC.</p>
              </div>
            )}

            {!logLoading && logRows.map(row => {
              const isOpen   = row.status === 'Open'
              const isLocked = row.status === 'Locked' || row.isSigned
              return (
                <div key={row.rowId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                  background: isLocked ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${isLocked ? '#bbf7d0' : '#fde68a'}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.slotLabel}
                      {row.sampleNumber && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 4, padding: '1px 6px' }}>
                          {row.sampleNumber}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {new Date(row.slotTime).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isLocked ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✅ Signed
                      </span>
                    ) : isOpen ? (
                      <button
                        onClick={() => { setSignRow({ checkpointId: logFor.checkpointId, rowId: row.rowId, params: logFor.parameters ?? [] }); setReadings({}); setError('') }}
                        style={{
                          padding: '7px 16px', background: '#7c3aed', color: '#fff',
                          border: 'none', borderRadius: 6, cursor: 'pointer',
                          fontSize: 12, fontWeight: 700,
                        }}>
                        ✍️ Sign Row
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{row.status}</span>
                    )}
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setLogFor(null)}
                style={{ padding: '9px 22px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── E-Signature Modal (Process Log row) ──────────────────────────── */}
      {signRow && (
        <Modal title="✍️ Sign Process Log Row" onClose={() => setSignRow(null)}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            21 CFR Part 11 — your signature will be permanently recorded.
          </p>
          <form onSubmit={handleSign}>

            {/* ── Parameter readings ── */}
            {signRow.params.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                  📊 Enter Parameter Readings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {signRow.params.map(p => (
                    <div key={p.parameterId} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                        {p.parameterName}
                        <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.parameterCode}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.dataType === 'PassFail' ? (
                          <select
                            style={{ ...inp, margin: 0, width: '100%' }}
                            value={readings[p.parameterId] ?? ''}
                            onChange={e => setReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}>
                            <option value="">—</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                          </select>
                        ) : (
                          <input
                            type="number" step="any"
                            style={{ ...inp, margin: 0, width: '100%' }}
                            value={readings[p.parameterId] ?? ''}
                            onChange={e => setReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}
                            placeholder="value"
                          />
                        )}
                        {p.uom && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{p.uom}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: '#e5e7eb', margin: '14px 0' }} />
              </div>
            )}

            <Field label="Password (re-enter to confirm identity)">
              <input style={inp} type="password" value={signForm.password}
                onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Meaning of Signature">
              <input style={inp} value={signForm.meaning}
                onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={signForm.reason}
                onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Shift check completed — all values within range" />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
            <ModalFooter saving={saving} onCancel={() => setSignRow(null)} label="Sign & Lock Row" />
          </form>
        </Modal>
      )}
    </div>
  )
}
