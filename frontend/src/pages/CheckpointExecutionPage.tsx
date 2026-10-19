import { useEffect, useState, useMemo } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { inp, Field } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckpointParam {
  parameterId:   number
  parameterName: string
  parameterCode: string
  uom:           string | null
  dataType:      string
  alertMin?:     number | null
  alertMax?:     number | null
  actionMin?:    number | null
  actionMax?:    number | null
}

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
  ok:     { border: '#16a34a', background: '#f0fdf4', badge: '✓ Within limits' },
  alert:  { border: '#f59e0b', background: '#fffbeb', badge: '⚠ Alert limit' },
  action: { border: '#dc2626', background: '#fef2f2', badge: '🔴 Action limit!' },
  none:   { border: '#d1d5db', background: '#fff' },
}

interface Checkpoint {
  checkpointId:         number
  checkpointCode:       string
  triggerMode:          string
  checkpointType:       string
  shiftIntervalHrs:     number | null
  isActive:             boolean
  locationCount:        number
  timeSlots?:           string | null
  parameters:           CheckpointParam[]
  executedTodaySlots:   string[]
  executedSlotBreaches: Record<string, string>  // slotLabel → "alert"|"action"
  category:             string
  systemName:           string | null
  location?:            string | null
  scheduledDate:        string | null
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function getWeekDays(anchor: string): Date[] {
  const anchorDate = new Date(anchor + 'T12:00:00')
  const dow = anchorDate.getDay()
  const monday = new Date(anchorDate)
  monday.setDate(anchorDate.getDate() - ((dow + 6) % 7))
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseSlots(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

type CellState = 'done' | 'done-alert' | 'done-action' | 'overdue' | 'due' | 'upcoming' | 'empty'

function getCellState(
  slot: string, viewDate: string, executedSlots: string[],
  todayStr: string, breaches?: Record<string, string>
): CellState {
  if (executedSlots.includes(slot)) {
    const breach = breaches?.[slot]
    if (breach === 'action') return 'done-action'
    if (breach === 'alert')  return 'done-alert'
    return 'done'
  }
  if (viewDate < todayStr) return 'overdue'
  if (viewDate > todayStr) return 'upcoming'
  // today: live time check
  const now = new Date()
  const [h, m] = slot.split(':').map(Number)
  const slotDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  const diffMin = (now.getTime() - slotDt.getTime()) / 60000
  if (Math.abs(diffMin) <= 30) return 'due'
  if (diffMin > 30) return 'overdue'
  return 'upcoming'
}

const CELL_CFG: Record<CellState, { bg: string; color: string; border: string; label: string; clickable: boolean }> = {
  done:        { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: '✓ Done',    clickable: false },
  'done-alert':  { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', label: '⚠ Done',  clickable: false },
  'done-action': { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: '🔴 Done', clickable: false },
  overdue:     { bg: '#fff7ed', color: '#9a3412', border: '#fdba74', label: '⚠ Due',     clickable: true  },
  due:         { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: '● Due Now', clickable: true  },
  upcoming:    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: '📅 Sched.',  clickable: false },
  empty:       { bg: 'transparent', color: '#d1d5db', border: 'transparent', label: '',  clickable: false },
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CheckpointExecutionPage() {
  const todayStr = toDateStr(new Date())
  const [viewDate, setViewDate]         = useState(todayStr)
  const [checkpoints, setCheckpoints]   = useState<Checkpoint[]>([])
  const [loading, setLoading]           = useState(false)
  const [category, setCategory]         = useState<'all' | 'em' | 'batch'>('all')

  // Execute drawer state
  const [execFor, setExecFor]           = useState<{ checkpoint: Checkpoint; slotLabel: string } | null>(null)
  const [execForm, setExecForm]         = useState({ password: '', meaning: 'I confirm this time-based checkpoint has been performed', reason: '' })
  const [execReadings, setExecReadings] = useState<Record<number, string>>({})
  const [execSaving, setExecSaving]     = useState(false)
  const [execError, setExecError]       = useState('')
  const [execSamples, setExecSamples]   = useState<{ sampleId: number; sampleNumber: string; materialName: string; lotNumber: string }[]>([])
  const [execSampleId, setExecSampleId] = useState<number | null>(null)

  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate])

  async function load() {
    setLoading(true)
    try {
      const dateParam = viewDate !== todayStr ? `&date=${viewDate}` : ''
      const r = await api.get(`/checkpoints?triggerMode=TimeBased${dateParam}`)
      setCheckpoints(r.data.filter((c: Checkpoint) => c.isActive))
    } catch { toast('Failed to load checkpoints', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [viewDate])

  const filtered = checkpoints.filter(c => {
    if (category === 'em')    return c.category === 'Environmental'
    if (category === 'batch') return c.category !== 'Environmental'
    return true
  })

  const allSlots = useMemo(() => {
    const set = new Set<string>()
    filtered.forEach(c => parseSlots(c.timeSlots).forEach(s => set.add(s)))
    return Array.from(set).sort()
  }, [filtered])

  function navigateWeek(dir: number) {
    const d = new Date(viewDate + 'T12:00:00')
    d.setDate(d.getDate() + dir * 7)
    setViewDate(toDateStr(d))
  }

  async function openExecute(cp: Checkpoint, slot: string) {
    setExecFor({ checkpoint: cp, slotLabel: slot })
    setExecForm({ password: '', meaning: 'I confirm this time-based checkpoint has been performed', reason: '' })
    setExecReadings({})
    setExecError('')
    setExecSampleId(null)
    setExecSamples([])
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/linked-samples`)
      setExecSamples(r.data)
    } catch { /* non-critical */ }
  }

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
        sampleId:  execSampleId ?? undefined,
      })
      toast(`${execFor.checkpoint.checkpointCode} @ ${execFor.slotLabel} recorded ✓`, 'success')
      setExecFor(null)
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Execution failed')
      setExecError(msg); toast(msg, 'error')
    }
    finally { setExecSaving(false) }
  }

  // Summary stats
  const totalSlots   = filtered.reduce((acc, c) => acc + parseSlots(c.timeSlots).length, 0)
  const doneSlots    = filtered.reduce((acc, c) => acc + c.executedTodaySlots.length, 0)
  const overdueCount = filtered.reduce((acc, c) =>
    acc + parseSlots(c.timeSlots).filter(s => getCellState(s, viewDate, c.executedTodaySlots, todayStr) === 'overdue').length, 0)

  const viewDateDisplay = new Date(viewDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
          Checkpoint Timeline
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Time-based checkpoint schedule — click any due cell to record
        </p>
      </div>

      {/* Date navigation */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => navigateWeek(-1)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#374151' }}>
            ‹ Prev
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', flex: 1, textAlign: 'center', minWidth: 180 }}>
            {viewDateDisplay}
          </span>
          <button onClick={() => navigateWeek(1)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#374151' }}>
            Next ›
          </button>
          <button onClick={() => setViewDate(todayStr)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: '1.5px solid',
              background: viewDate === todayStr ? '#3b82f6' : '#fff',
              color: viewDate === todayStr ? '#fff' : '#3b82f6',
              borderColor: '#3b82f6',
            }}>
            Today
          </button>
          <input
            type="date"
            value={viewDate}
            onChange={e => e.target.value && setViewDate(e.target.value)}
            title="Jump to date"
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#374151',
              fontFamily: 'inherit',
            }}
          />
          <button onClick={load}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
            ↺
          </button>
        </div>

        {/* Week strip */}
        <div style={{ display: 'flex', gap: 4 }}>
          {weekDays.map((d, i) => {
            const ds = toDateStr(d)
            const isSelected = ds === viewDate
            const isToday    = ds === todayStr
            return (
              <button key={ds} onClick={() => setViewDate(ds)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  border: `1.5px solid ${isSelected ? '#3b82f6' : isToday ? '#93c5fd' : '#e5e7eb'}`,
                  background: isSelected ? '#3b82f6' : isToday ? '#eff6ff' : '#f9fafb',
                  color: isSelected ? '#fff' : isToday ? '#1d4ed8' : '#374151',
                  transition: 'all 0.1s',
                }}>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{DAY_LABELS[i]}</div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 1 }}>{d.getDate()}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category tabs + Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
          {([['all', 'All'], ['em', 'Environmental (EM)'], ['batch', 'Batch Parameters']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setCategory(val)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                background: category === val ? '#fff' : 'transparent',
                color: category === val ? '#0f172a' : '#6b7280',
                fontWeight: category === val ? 700 : 500,
                boxShadow: category === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.1s',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {[
            { label: 'Total Slots', value: totalSlots,   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
            { label: 'Done',        value: doneSlots,    color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Overdue',     value: overdueCount, color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
          ].map(s => (
            <div key={s.label} style={{ padding: '6px 14px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, textAlign: 'center', minWidth: 72 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>
          Loading timeline…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          <p style={{ margin: 0, fontSize: 14 }}>No active time-based checkpoints found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '2px solid #e5e7eb', minWidth: 170,
                  position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2,
                }}>
                  Checkpoint
                </th>
                {allSlots.map(slot => (
                  <th key={slot} style={{
                    padding: '12px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700,
                    color: '#374151', borderBottom: '2px solid #e5e7eb', minWidth: 95,
                  }}>
                    {slot}
                  </th>
                ))}
                <th style={{
                  padding: '12px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '2px solid #e5e7eb', minWidth: 80,
                }}>
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cp, idx) => {
                const cpSlots  = parseSlots(cp.timeSlots)
                const done     = cp.executedTodaySlots.length
                const total    = cpSlots.length
                const allDone  = done === total && total > 0
                const rowBg    = idx % 2 === 0 ? '#fff' : '#fafafa'

                return (
                  <tr key={cp.checkpointId} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}>
                    {/* Checkpoint label */}
                    <td style={{
                      padding: '10px 16px', position: 'sticky', left: 0, background: rowBg,
                      zIndex: 1, borderRight: '1px solid #f1f5f9',
                    }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                        {cp.checkpointCode}
                      </div>
                      {cp.category === 'Environmental' && (
                        <>
                          <div style={{
                            fontSize: 10, fontWeight: 700, color: '#065f46',
                            background: '#d1fae5', padding: '1px 7px', borderRadius: 4,
                            display: 'inline-block', marginTop: 3, border: '1px solid #6ee7b7',
                          }}>
                            🌿 {cp.systemName ?? 'EM'}
                          </div>
                          {cp.location && (
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{cp.location}</div>
                          )}
                        </>
                      )}
                      {cp.checkpointType && cp.category !== 'Environmental' && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{cp.checkpointType}</div>
                      )}
                    </td>

                    {/* Slot cells */}
                    {allSlots.map(slot => {
                      const hasSlot = cpSlots.includes(slot)
                      if (!hasSlot) {
                        return (
                          <td key={slot} style={{ padding: '8px 6px', textAlign: 'center' }}>
                            <span style={{ color: '#e5e7eb', fontSize: 13, userSelect: 'none' }}>—</span>
                          </td>
                        )
                      }
                      const state = getCellState(slot, viewDate, cp.executedTodaySlots, todayStr, cp.executedSlotBreaches)
                      const cfg   = CELL_CFG[state]
                      return (
                        <td key={slot} style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button
                            onClick={cfg.clickable ? () => openExecute(cp, slot) : undefined}
                            disabled={!cfg.clickable}
                            title={cfg.clickable ? `Record ${cp.checkpointCode} @ ${slot}` : undefined}
                            style={{
                              padding: '6px 8px', borderRadius: 8, minWidth: 78,
                              border: `1.5px solid ${cfg.border}`,
                              background: cfg.bg, color: cfg.color,
                              fontSize: 11, fontWeight: 700,
                              cursor: cfg.clickable ? 'pointer' : 'default',
                              opacity: state === 'upcoming' ? 0.55 : 1,
                              transition: 'opacity 0.1s',
                              fontFamily: 'inherit',
                            }}>
                            {cfg.label}
                          </button>
                        </td>
                      )
                    })}

                    {/* Progress */}
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: allDone ? '#15803d' : done > 0 ? '#0369a1' : '#9ca3af',
                      }}>
                        {done}/{total}
                        {allDone && <span style={{ marginLeft: 4, fontSize: 12 }}>✓</span>}
                      </span>
                      {total > 0 && (
                        <div style={{
                          height: 3, background: '#e5e7eb', borderRadius: 2, marginTop: 4, width: 48, margin: '4px auto 0',
                        }}>
                          <div style={{
                            height: 3, borderRadius: 2,
                            background: allDone ? '#16a34a' : '#3b82f6',
                            width: `${(done / total) * 100}%`,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { state: 'done' as CellState,         desc: 'Recorded — within limits' },
          { state: 'done-alert' as CellState,   desc: 'Recorded — alert limit breach' },
          { state: 'done-action' as CellState,  desc: 'Recorded — action limit breach' },
          { state: 'due' as CellState,          desc: 'Due now (±30 min)' },
          { state: 'overdue' as CellState,      desc: 'Overdue / missed' },
          { state: 'upcoming' as CellState,     desc: 'Scheduled (future)' },
        ].map(({ state, desc }) => {
          const cfg = CELL_CFG[state]
          return (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280' }}>
              <span style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: 3,
                background: cfg.bg, border: `1.5px solid ${cfg.border}`,
              }} />
              {desc}
            </div>
          )
        })}
      </div>

      {/* ── Execute drawer ────────────────────────────────────────────────── */}
      {execFor && (
        <Drawer
          title={`Record — ${execFor.checkpoint.checkpointCode} @ ${execFor.slotLabel}`}
          subtitle="21 CFR Part 11 — immutable audit entry"
          onClose={() => setExecFor(null)}
          blocking width={480}
        >
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            Record your readings and confirm with e-signature.
          </p>
          <form onSubmit={handleExecute}>

            {/* Link to sample */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Link to Sample <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <select
                style={{ ...inp, margin: 0 }}
                value={execSampleId ?? ''}
                onChange={e => setExecSampleId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— No sample link —</option>
                {execSamples.map(s => (
                  <option key={s.sampleId} value={s.sampleId}>
                    {s.sampleNumber} · {s.materialName}{s.lotNumber ? ` / ${s.lotNumber}` : ''}
                  </option>
                ))}
              </select>
              {execSamples.length === 0 && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  No samples linked to this checkpoint.
                </p>
              )}
            </div>
            <div style={{ height: 1, background: '#e5e7eb', marginBottom: 16 }} />

            {/* Parameter readings */}
            {execFor.checkpoint.parameters.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                  Parameter Readings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {execFor.checkpoint.parameters.map(p => {
                    const rawVal = execReadings[p.parameterId] ?? ''
                    const tier   = rawVal !== '' ? checkLimits(rawVal, p) : 'none'
                    const ts     = TIER_STYLE[tier]
                    const hasLimits = p.alertMin != null || p.alertMax != null || p.actionMin != null || p.actionMax != null
                    return (
                      <div key={p.parameterId} style={{
                        border: `1.5px solid ${ts.border}`,
                        background: ts.background,
                        borderRadius: 8,
                        padding: '10px 12px',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                            {p.parameterName}
                            <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', fontWeight: 400 }}>{p.parameterCode}</span>
                          </label>
                          {ts.badge && rawVal !== '' && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                              background: tier === 'action' ? '#fef2f2' : tier === 'alert' ? '#fffbeb' : '#f0fdf4',
                              color:      tier === 'action' ? '#dc2626' : tier === 'alert' ? '#b45309' : '#15803d',
                              border:     `1px solid ${tier === 'action' ? '#fca5a5' : tier === 'alert' ? '#fcd34d' : '#86efac'}`,
                            }}>{ts.badge}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.dataType === 'PassFail' ? (
                            <select
                              style={{ ...inp, margin: 0, flex: 1 }}
                              value={rawVal}
                              onChange={e => setExecReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}>
                              <option value="">— Select —</option>
                              <option value="Pass">Pass</option>
                              <option value="Fail">Fail</option>
                            </select>
                          ) : (
                            <input
                              type="number" step="any"
                              style={{ ...inp, margin: 0, flex: 1, borderColor: ts.border }}
                              value={rawVal}
                              onChange={e => setExecReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}
                              placeholder="Enter value"
                            />
                          )}
                          {p.uom && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 30 }}>{p.uom}</span>}
                        </div>
                        {hasLimits && (
                          <div style={{ marginTop: 5, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {(p.alertMin != null || p.alertMax != null) && (
                              <span style={{ color: '#b45309' }}>
                                ⚠ Alert: {p.alertMin != null ? `≥${p.alertMin}` : ''}{p.alertMin != null && p.alertMax != null ? ' – ' : ''}{p.alertMax != null ? `≤${p.alertMax}` : ''}
                              </span>
                            )}
                            {(p.actionMin != null || p.actionMax != null) && (
                              <span style={{ color: '#dc2626' }}>
                                🔴 Action: {p.actionMin != null ? `≥${p.actionMin}` : ''}{p.actionMin != null && p.actionMax != null ? ' – ' : ''}{p.actionMax != null ? `≤${p.actionMax}` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                placeholder="e.g. All readings within acceptable range" />
            </Field>
            {execError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {execError}</p>}
            <DrawerFooter saving={execSaving} onCancel={() => setExecFor(null)} label="Submit & Sign" />
          </form>
        </Drawer>
      )}
    </div>
  )
}
