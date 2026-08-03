import { useEffect, useState, useCallback, useMemo } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { toast } from '@/components/Toast'

// ── Constants ──────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7am – 6pm
const hrLabel = (h: number) => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
const DURATIONS = [1, 2, 3, 4]

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  Booked:    { bg: '#fffbeb', border: '#fcd34d', color: '#92400e',  label: 'Booked'  },
  InUse:     { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b',  label: 'In Use'  },
  Released:  { bg: '#f0fdf4', border: '#86efac', color: '#166534',  label: 'Released' },
  Cancelled: { bg: '#f9fafb', border: '#e5e7eb', color: '#9ca3af',  label: 'Cancelled' },
}

// Analyst colour palette — deterministic per analyst name
const ANALYST_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]
function analystColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return ANALYST_PALETTE[Math.abs(hash) % ANALYST_PALETTE.length]
}
function analystInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Booking {
  capacityBookingId: number
  instrumentId: number
  instrumentCode: string
  instrumentName: string
  bookedBy: string
  executionId: number | null
  sampleNumber: string | null
  startTime: string
  endTime: string
  status: string
  notes: string | null
}
interface Instrument {
  instrumentId: number
  instrumentCode: string
  instrumentName: string
  instrumentType: string
  status: string
}
interface PendingExecution {
  executionId: number
  sampleNumber: string
  status: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function dateToLocal(d: Date) {
  // Use local calendar date (not UTC date) so timezones > UTC don't show wrong day
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slotBooking(bookings: Booking[], instrumentId: number, hour: number, dateStr: string): Booking | null {
  return bookings.find(b => {
    if (b.instrumentId !== instrumentId) return false
    const s = new Date(b.startTime), e = new Date(b.endTime)
    // Use local time (no Z) so slot hours match what user sees in their timezone
    const slotS = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:00:00`)
    const slotE = new Date(`${dateStr}T${String(hour+1).padStart(2,'0')}:00:00`)
    return s < slotE && e > slotS
  }) ?? null
}

function isSlotStart(booking: Booking, hour: number, dateStr: string) {
  const s = new Date(booking.startTime)
  return s.getHours() === hour && dateToLocal(s) === dateStr
}

function isPast(hour: number, dateStr: string) {
  const now = new Date()
  const today = dateToLocal(now)
  if (dateStr < today) return true
  if (dateStr > today) return false
  return now.getHours() > hour
}

// ═══════════════════════════════════════════════════════════════════════════
export default function CapacityBookingPage() {
  const [dateStr, setDateStr] = useState(() => dateToLocal(new Date()))
  const [instruments,      setInstruments]      = useState<Instrument[]>([])
  const [bookings,         setBookings]         = useState<Booking[]>([])
  const [pendingExecs,     setPendingExecs]     = useState<PendingExecution[]>([])
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState('')

  // ── Filter / search / pagination state ────────────────────────────────
  const [typeFilter, setTypeFilter] = useState('')
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(0)
  const PAGE_SIZE = 12

  // Modal state
  const [showModal,    setShowModal]    = useState(false)
  const [modalInstr,   setModalInstr]   = useState<number | ''>('')
  const [modalHour,    setModalHour]    = useState<number>(9)
  const [modalDur,     setModalDur]     = useState<number>(1)
  const [modalExecId,  setModalExecId]  = useState<number | ''>('')
  const [modalNotes,   setModalNotes]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [modalErr,     setModalErr]     = useState('')

  // Detail popover
  const [detail,        setDetail]        = useState<Booking | null>(null)
  const [detailLoading, setDetailLoading] = useState<number | null>(null)

  // Cancellation reason modal
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [instrRes, bookRes, execRes] = await Promise.all([
        api.get('/capacity-bookings/instruments'),
        api.get(`/capacity-bookings?date=${dateStr}`),
        api.get('/capacity-bookings/pending-executions'),
      ])
      setInstruments(instrRes.data)
      setBookings(bookRes.data)
      setPendingExecs(execRes.data)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [dateStr])

  useEffect(() => { load() }, [load])

  function shiftDate(days: number) {
    const d = new Date(dateStr + 'T00:00:00')  // local midnight
    d.setDate(d.getDate() + days)
    setDateStr(dateToLocal(d))
    setDetail(null)
  }

  function openBookModal(instrumentId: number, hour: number) {
    setModalInstr(instrumentId); setModalHour(hour); setModalDur(1)
    setModalExecId(''); setModalNotes(''); setModalErr(''); setShowModal(true)
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setModalErr('')
    try {
      const startTime = new Date(`${dateStr}T${String(modalHour).padStart(2,'0')}:00:00`)
      const endTime   = new Date(`${dateStr}T${String(modalHour + modalDur).padStart(2,'0')}:00:00`)
      await api.post('/capacity-bookings', {
        instrumentId: modalInstr,
        startTime:    startTime.toISOString(),
        endTime:      endTime.toISOString(),
        executionId:  modalExecId !== '' ? modalExecId : null,
        notes:        modalNotes || null,
      })
      toast('Slot booked successfully', 'success')
      setShowModal(false); load()
    } catch (err) {
      const msg = getErrorMessage(err)
      setModalErr(msg)
    } finally { setSaving(false) }
  }

  // Opens the cancellation reason modal instead of window.confirm
  function promptCancel(id: number) {
    setCancelTarget(id)
    setCancelReason('')
    setDetail(null)
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setCancelSaving(true)
    try {
      await api.patch(`/capacity-bookings/${cancelTarget}/cancel`, {
        reason: cancelReason.trim() || null,
      })
      toast('Booking cancelled', 'success')
      setCancelTarget(null); setCancelReason('')
      load()
    } catch (e) { toast(getErrorMessage(e), 'error') }
    finally { setCancelSaving(false) }
  }

  async function startBooking(id: number) {
    setDetailLoading(id)
    try {
      await api.patch(`/capacity-bookings/${id}/start`)
      toast('Booking marked as In Use', 'success')
      setDetail(null); load()
    } catch (e) { toast(getErrorMessage(e), 'error') }
    finally { setDetailLoading(null) }
  }

  async function releaseBooking(id: number) {
    setDetailLoading(id)
    try {
      await api.patch(`/capacity-bookings/${id}/release`)
      toast('Instrument released', 'success')
      setDetail(null); load()
    } catch (e) { toast(getErrorMessage(e), 'error') }
    finally { setDetailLoading(null) }
  }

  // ── Derived data ───────────────────────────────────────────────────────
  const instrumentTypes = useMemo(
    () => [...new Set(instruments.map(i => i.instrumentType))].filter(Boolean).sort(),
    [instruments]
  )

  const filteredInstruments = useMemo(() => {
    setPage(0)
    return instruments.filter(i => {
      const matchType   = !typeFilter || i.instrumentType === typeFilter
      const q           = search.toLowerCase()
      const matchSearch = !q || i.instrumentCode.toLowerCase().includes(q) || i.instrumentName.toLowerCase().includes(q)
      return matchType && matchSearch
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments, typeFilter, search])

  const totalPages      = Math.ceil(filteredInstruments.length / PAGE_SIZE)
  const pagedInstruments = filteredInstruments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Unique analysts booked today — for the legend
  const analystLegend = useMemo(() => {
    const seen = new Map<string, string>()
    bookings.filter(b => b.status !== 'Cancelled').forEach(b => {
      if (!seen.has(b.bookedBy)) seen.set(b.bookedBy, analystColor(b.bookedBy))
    })
    return [...seen.entries()]
  }, [bookings])

  const displayDate = new Date(dateStr + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  const availableCount = instruments.length * HOURS.length - bookings.filter(b => b.status !== 'Cancelled').length
  const bookedCount    = bookings.filter(b => b.status === 'Booked').length
  const inUseCount     = bookings.filter(b => b.status === 'InUse').length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>📅 Capacity Booking</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Reserve instrument time slots before starting a test execution</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ padding: '8px 18px', background: '#028090', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Book Slot
        </button>
      </div>

      {/* ── Summary badges ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Available',   count: availableCount,       bg: '#f0fdf4', color: '#166534', border: '#86efac' },
          { label: 'Booked',      count: bookedCount,          bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
          { label: 'In Use',      count: inUseCount,           bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
          { label: 'Instruments', count: instruments.length,   bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
        ].map(s => (
          <div key={s.label} style={{ padding: '8px 16px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, minWidth: 90 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Date navigator ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => shiftDate(-1)} style={navBtn}>◀ Prev</button>
        <button onClick={() => setDateStr(dateToLocal(new Date()))} style={{ ...navBtn, background: '#028090', color: '#fff', border: 'none' }}>Today</button>
        <button onClick={() => shiftDate(1)}  style={navBtn}>Next ▶</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginLeft: 8 }}>{displayDate}</span>
        <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
          style={{ marginLeft: 'auto', padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
      </div>

      {/* ── Filter bar: type dropdown + search (single line) ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        {/* Type dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '6px 28px 6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#0f172a', background: '#fff', cursor: 'pointer', appearance: 'auto' }}>
            <option value="">All Types ({instruments.length})</option>
            {instrumentTypes.map(t => (
              <option key={t} value={t}>{t} ({instruments.filter(i => i.instrumentType === t).length})</option>
            ))}
          </select>
        </div>
        {typeFilter && (
          <button onClick={() => setTypeFilter('')} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit' }}>
            ✕ Clear
          </button>
        )}
        {/* Search box */}
        <div style={{ position: 'relative', marginLeft: 4 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search code or name…"
            style={{ padding: '6px 28px 6px 28px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', width: 200, color: '#0f172a', background: '#fff' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </div>
        {/* Result count */}
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
          {filteredInstruments.length} instrument{filteredInstruments.length !== 1 ? 's' : ''}
          {(typeFilter || search) && instruments.length !== filteredInstruments.length ? ` of ${instruments.length}` : ''}
        </span>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { bg: '#f0fdf4', border: '#86efac', label: 'Available' },
          { bg: '#fffbeb', border: '#fcd34d', label: 'Booked' },
          { bg: '#fef2f2', border: '#fca5a5', label: 'In Use' },
          { bg: '#f9fafb', border: '#e5e7eb', label: 'Past / Unavailable' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }} />
            {l.label}
          </div>
        ))}
        {/* Analyst colour legend */}
        {analystLegend.length > 0 && (
          <>
            <div style={{ width: 1, height: 16, background: '#e5e7eb', marginLeft: 4 }} />
            {analystLegend.map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>{analystInitials(name)}</div>
                {name}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading schedule…</div>
        ) : filteredInstruments.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
            {instruments.length === 0
              ? 'No active instruments found. Add instruments in Master Data → Instruments.'
              : 'No instruments match the current filter — clear to see all.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...th, width: 160, textAlign: 'left', paddingLeft: 16 }}>Instrument</th>
                {HOURS.map(h => (
                  <th key={h} style={{ ...th, width: 72, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                    {hrLabel(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedInstruments.map((instr, ri) => (
                <tr key={instr.instrumentId} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {/* Instrument name cell */}
                  <td style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', borderRight: '2px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{instr.instrumentCode}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{instr.instrumentType}</div>
                    {instr.status === 'InCalibration' && (
                      <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '0 4px', borderRadius: 3, fontWeight: 700 }}>CAL</span>
                    )}
                  </td>
                  {/* Hour cells */}
                  {HOURS.map(hour => {
                    const bk      = slotBooking(bookings, instr.instrumentId, hour, dateStr)
                    const past    = isPast(hour, dateStr)
                    const isStart = bk ? isSlotStart(bk, hour, dateStr) : false
                    const ss      = bk ? (STATUS_STYLE[bk.status] ?? STATUS_STYLE.Booked) : null
                    const aColor  = bk ? analystColor(bk.bookedBy) : null

                    const cellBg     = bk ? ss!.bg : past ? '#f9fafb' : '#f0fdf4'
                    const cellBorder = bk ? ss!.border : past ? '#f1f5f9' : '#dcfce7'
                    const cursor     = past || instr.status === 'InCalibration' ? 'default' : 'pointer'

                    return (
                      <td key={hour} onClick={() => {
                        if (bk) { setDetail(bk) }
                        else if (!past && instr.status !== 'InCalibration') { openBookModal(instr.instrumentId, hour) }
                      }} style={{
                        borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9',
                        padding: 3, textAlign: 'center', cursor,
                        background: cellBg, transition: 'background 0.1s',
                        position: 'relative',
                      }}>
                        <div style={{
                          height: 42, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: cellBg,
                          border: `1.5px solid ${cellBorder}`,
                          // Analyst colour as left accent strip when booking exists
                          borderLeft: bk && aColor ? `3px solid ${aColor}` : `1.5px solid ${cellBorder}`,
                          fontSize: 9, fontWeight: 700, color: bk ? ss!.color : (past ? '#cbd5e1' : '#166534'),
                          overflow: 'hidden', padding: '0 2px',
                          flexDirection: 'column', gap: 1,
                        }}>
                          {bk && isStart ? (
                            <span title={`${bk.bookedBy}${bk.sampleNumber ? ` — ${bk.sampleNumber}` : ''}${bk.notes ? ` | ${bk.notes}` : ''}`}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {/* Analyst avatar */}
                              <span style={{
                                width: 16, height: 16, borderRadius: '50%',
                                background: aColor!, color: '#fff',
                                fontSize: 7, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>{analystInitials(bk.bookedBy)}</span>
                              <span style={{ fontSize: 8, lineHeight: 1, textAlign: 'center', color: ss!.color }}>
                                {bk.sampleNumber ? bk.sampleNumber.slice(-6) : bk.bookedBy.split(' ')[0]}
                              </span>
                            </span>
                          ) : bk ? (
                            <span style={{ opacity: 0.35 }}>▬</span>
                          ) : past ? null : (
                            <span style={{ opacity: 0, fontSize: 14 }} className="slot-plus">+</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '8px 4px' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredInstruments.length)} of {filteredInstruments.length} instruments
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setPage(0)} disabled={page === 0} style={{ ...navBtn, fontSize: 11, padding: '4px 10px', opacity: page === 0 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={{ ...navBtn, fontSize: 11, padding: '4px 10px', opacity: page === 0 ? 0.4 : 1 }}>‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                style={{ ...navBtn, fontSize: 11, padding: '4px 10px', minWidth: 32,
                  background: i === page ? '#028090' : '#fff',
                  color:      i === page ? '#fff'    : '#374151',
                  border:     i === page ? 'none'    : '1px solid #e2e8f0',
                }}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1} style={{ ...navBtn, fontSize: 11, padding: '4px 10px', opacity: page === totalPages - 1 ? 0.4 : 1 }}>Next ›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} style={{ ...navBtn, fontSize: 11, padding: '4px 10px', opacity: page === totalPages - 1 ? 0.4 : 1 }}>»</button>
          </div>
        </div>
      )}

      {/* ── Booking detail popover ── */}
      {detail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 14, padding: 28, width: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'inherit',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Booking Detail</div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            {(() => {
              const ss    = STATUS_STYLE[detail.status] ?? STATUS_STYLE.Booked
              const s     = new Date(detail.startTime), e = new Date(detail.endTime)
              const dur   = (e.getTime() - s.getTime()) / 3600000
              const aCol  = analystColor(detail.bookedBy)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{ss.label}</span>
                    {/* Analyst colour badge */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: aCol, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>
                        {analystInitials(detail.bookedBy)}
                      </span>
                      {detail.bookedBy}
                    </span>
                  </div>
                  {[
                    ['Instrument', `${detail.instrumentCode} — ${detail.instrumentName}`],
                    ['Time',       `${hrLabel(s.getHours())} – ${hrLabel(e.getHours())} (${dur}h)`],
                    ...(detail.sampleNumber ? [['Linked Test', detail.sampleNumber]] : []),
                    ...(detail.notes ? [['Notes', detail.notes]] : []),
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', width: 90, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>{k}</span>
                      <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {detail.status === 'Booked' && (
                      <button onClick={() => startBooking(detail.capacityBookingId)} disabled={!!detailLoading}
                        style={{ padding: '7px 14px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        ▶ Mark In Use
                      </button>
                    )}
                    {detail.status === 'InUse' && (
                      <button onClick={() => releaseBooking(detail.capacityBookingId)} disabled={!!detailLoading}
                        style={{ padding: '7px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        ✓ Release
                      </button>
                    )}
                    {detail.status === 'Booked' && (
                      <button onClick={() => promptCancel(detail.capacityBookingId)} disabled={!!detailLoading}
                        style={{ padding: '7px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        ✕ Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Cancellation reason modal ── */}
      {cancelTarget !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (!cancelSaving) setCancelTarget(null) }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: '24px 28px', width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>✕ Cancel Booking</div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Please provide a reason for cancellation. This is recorded in the audit trail.
            </p>
            <label style={{ ...lbl, marginBottom: 6 }}>Reason for Cancellation</label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="e.g. Test postponed, instrument needed for urgent batch, rescheduled to tomorrow…"
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setCancelTarget(null)} disabled={cancelSaving}
                style={{ padding: '8px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Keep Booking
              </button>
              <button onClick={confirmCancel} disabled={cancelSaving || !cancelReason.trim()}
                style={{
                  padding: '8px 18px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700,
                  background: cancelReason.trim() ? '#dc2626' : '#f3f4f6',
                  color: cancelReason.trim() ? '#fff' : '#9ca3af',
                  cursor: cancelReason.trim() && !cancelSaving ? 'pointer' : 'not-allowed',
                }}>
                {cancelSaving ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Book Slot Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>📅 Book Instrument Slot</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <form onSubmit={submitBooking} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Instrument</label>
                <select value={modalInstr} onChange={e => setModalInstr(Number(e.target.value))} required style={inp}>
                  <option value="">Select instrument…</option>
                  {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode} — {i.instrumentName}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} required style={inp} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Start Time</label>
                  <select value={modalHour} onChange={e => setModalHour(Number(e.target.value))} style={inp}>
                    {HOURS.map(h => <option key={h} value={h}>{hrLabel(h)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Duration</label>
                  <select value={modalDur} onChange={e => setModalDur(Number(e.target.value))} style={inp}>
                    {DURATIONS.filter(d => modalHour + d <= 19).map(d => <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Linked Test (optional)</label>
                <select value={modalExecId} onChange={e => setModalExecId(e.target.value !== '' ? Number(e.target.value) : '')} style={inp}>
                  <option value="">— No linked test execution —</option>
                  {pendingExecs.map(e => (
                    <option key={e.executionId} value={e.executionId}>
                      {e.sampleNumber} #{e.executionId} ({e.status})
                    </option>
                  ))}
                </select>
                {pendingExecs.length === 0 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>No unbooked test executions currently in queue</div>
                )}
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <input type="text" value={modalNotes} onChange={e => setModalNotes(e.target.value)} placeholder="e.g. Stability pull batch ABC" style={inp} />
              </div>
              {modalErr && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>{modalErr}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding: '8px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '8px 22px', background: saving ? '#94a3b8' : '#028090', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 6px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }
const navBtn: React.CSSProperties = { padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a', background: '#fff' }
