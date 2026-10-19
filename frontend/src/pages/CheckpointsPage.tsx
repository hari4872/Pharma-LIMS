import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/dateFormat'
import DataTable from '@/components/DataTable'
import { inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { Panel } from '@/components/Panel'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckpointParam {
  parameterId: number; parameterCode: string; parameterName: string; uom: string | null
  alertMin?: number | null; alertMax?: number | null
  actionMin?: number | null; actionMax?: number | null
}
interface TriggerLog {
  triggerId: number; triggerMode: string; triggeredBy: string | null
  triggeredAt: string; deliveryOrder: string | null; isOfflineSync: boolean
}
interface Checkpoint {
  checkpointId: number; checkpointCode: string; triggerMode: string
  checkpointType: string; shiftIntervalHrs: number; isActive: boolean
  locationCount: number; timeSlots?: string | null
  category: string; systemName: string | null; scheduledDate: string | null
  lifecycleStatus?: string; location?: string | null
  parameters: CheckpointParam[]
}
interface EmSample {
  emSampleId: number; sampleNumber: string
  checkpointId: number; checkpointCode: string; systemName: string | null; location: string | null
  slotLabel: string; samplingDate: string; status: string
  collectedAt: string | null; collectedBy: string | null
  receivedAt: string | null; receivedBy: string | null
  analysisStartedAt: string | null; assignedAnalyst: string | null
  processLogRowId: number | null
  resultsApprovedAt: string | null; resultsApprovedBy: string | null
  resultStatus: string | null
  investigationNumber: string | null; investigationStatus: string | null; investigationNotes: string | null
  expiresAt: string; createdAt: string; createdBy: string
}
interface Lab        { labId: number; labName: string }
interface Param      { parameterId: number; parameterName: string; parameterCode: string; uom: string }
interface TestMethod { methodId: number; methodCode: string; methodName: string; status: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const EM_SYSTEM_TYPES = [
  'Cleanroom Air', 'Settle Plates', 'Surface Monitoring',
  'Non-viable Particle', 'Personnel Monitoring', 'Water/WFI',
]

const LIFECYCLE_CFG: Record<string, { bg: string; color: string; border: string }> = {
  Draft:   { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Active:  { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  Retired: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
}

const ALL_SLOTS = [
  '02:00','04:00','06:00','08:00','10:00','12:00',
  '14:00','16:00','18:00','20:00','22:00','00:00',
]
const PRESETS = [
  { label: 'Daily 08:00',         slots: ['08:00'] },
  { label: 'Twice (06/18)',        slots: ['06:00','18:00'] },
  { label: 'Every 4 h',           slots: ['00:00','04:00','08:00','12:00','16:00','20:00'] },
  { label: 'Every 2 h',           slots: ALL_SLOTS },
]

// ── Two-tier limit helpers ────────────────────────────────────────────────────
type LimitTier = 'ok' | 'alert' | 'action' | 'none'
function checkLimits(value: string, p: CheckpointParam): LimitTier {
  const n = parseFloat(value)
  if (isNaN(n)) return 'none'
  const hasAction = p.actionMin != null || p.actionMax != null
  const hasAlert  = p.alertMin  != null || p.alertMax  != null
  if (hasAction) {
    const out = (p.actionMin != null && n < p.actionMin) || (p.actionMax != null && n > p.actionMax)
    if (out) return 'action'
  }
  if (hasAlert) {
    const out = (p.alertMin != null && n < p.alertMin) || (p.alertMax != null && n > p.alertMax)
    if (out) return 'alert'
  }
  return (hasAction || hasAlert) ? 'ok' : 'none'
}
const TIER_STYLE: Record<LimitTier, { border: string; background: string; badge?: string }> = {
  ok:     { border: '#16a34a', background: '#f0fdf4', badge: 'Within limits' },
  alert:  { border: '#f59e0b', background: '#fffbeb', badge: '⚠ Alert limit' },
  action: { border: '#dc2626', background: '#fef2f2', badge: '🔴 Action limit!' },
  none:   { border: '#d1d5db', background: '#fff' },
}

// ── Slot chip ─────────────────────────────────────────────────────────────────
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

// ── Parse slots helper ────────────────────────────────────────────────────────
function parseSlots(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

// ── EM status config ─────────────────────────────────────────────────────────
const EM_STATUS_CFG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  Scheduled:       { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', label: 'Scheduled' },
  Collected:       { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', label: 'Collected' },
  ReceivedByLab:   { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd', label: 'Received' },
  UnderAnalysis:   { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', label: 'Analysis' },
  ResultsApproved: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: 'Approved' },
  Invalid:         { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1', label: 'Invalid' },
}
const RESULT_CFG: Record<string, { bg: string; color: string; border: string }> = {
  Pass:            { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  AlertExceeded:   { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
  ActionExceeded:  { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
}

function StatusPill({ status }: { status: string }) {
  const cfg = EM_STATUS_CFG[status] ?? EM_STATUS_CFG.Scheduled
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ── EM sub-components ─────────────────────────────────────────────────────────
function EmSamplingPlanTable({ samples, role, onCollect, onReceive, onResults }: {
  samples: EmSample[]
  role: string
  onCollect: (id: number) => void
  onReceive: (id: number) => void
  onResults: (s: EmSample) => void
}) {
  if (samples.length === 0)
    return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>No samples for this date. Click "+ Generate Samples" to create them.</p>

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Sample ID', 'System / Area', 'Location', 'Slot', 'Status', 'Result', 'Expires', 'Action'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {samples.map((s, i) => {
            const exp   = new Date(s.expiresAt)
            const now   = new Date()
            const expH  = Math.round((exp.getTime() - now.getTime()) / 3600000)
            const expStr = expH < 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Expired</span>
              : expH < 24 ? <span style={{ color: '#d97706', fontWeight: 700 }}>{expH}h left</span>
              : <span style={{ color: '#6b7280' }}>{Math.round(expH / 24)}d left</span>
            const resultCfg = s.resultStatus ? (RESULT_CFG[s.resultStatus] ?? {}) : null
            return (
              <tr key={s.emSampleId} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#065f46', fontSize: 12 }}>{s.sampleNumber}</td>
                <td style={{ padding: '8px 12px', color: '#374151' }}>{s.systemName ?? '—'}</td>
                <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11 }}>{s.location ?? '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#1e40af' }}>{s.slotLabel}</td>
                <td style={{ padding: '8px 12px' }}><StatusPill status={s.status} /></td>
                <td style={{ padding: '8px 12px' }}>
                  {resultCfg && s.resultStatus ? (
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: resultCfg.bg, color: resultCfg.color, border: `1px solid ${resultCfg.border}` }}>
                      {s.resultStatus === 'Pass' ? '✓ Pass' : s.resultStatus === 'AlertExceeded' ? '⚠ Alert' : '🔴 Action'}
                    </span>
                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 11 }}>{expStr}</td>
                <td style={{ padding: '8px 12px' }}>
                  {(role === 'Admin' || role === 'QA' || role === 'Analyst') && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {s.status === 'Scheduled' && (
                        <button onClick={() => onCollect(s.emSampleId)}
                          style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}>
                          Collect
                        </button>
                      )}
                      {s.status === 'Collected' && (
                        <button onClick={() => onReceive(s.emSampleId)}
                          style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd', borderRadius: 4, cursor: 'pointer' }}>
                          Receive
                        </button>
                      )}
                      {(s.status === 'ReceivedByLab' || s.status === 'UnderAnalysis') && !s.resultStatus && (
                        <button onClick={() => onResults(s)}
                          style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 4, cursor: 'pointer' }}>
                          Enter Results
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmInvestigationsTable({ samples, role, onOpen }: {
  samples: EmSample[]
  role: string
  onOpen: (s: EmSample) => void
}) {
  if (samples.length === 0)
    return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>No Action limit exceedances for this date.</p>

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #fca5a5', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fff5f5' }}>
            {['Sample ID', 'System / Area', 'Slot', 'Investigation #', 'Inv. Status', 'Notes', 'Action'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #fca5a5', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {samples.map((s, i) => (
            <tr key={s.emSampleId} style={{ background: i % 2 === 0 ? '#fff' : '#fff5f5', borderBottom: '1px solid #fee2e2' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#991b1b', fontSize: 12 }}>{s.sampleNumber}</td>
              <td style={{ padding: '8px 12px', color: '#374151' }}>{s.systemName ?? '—'}</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#1e40af' }}>{s.slotLabel}</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>{s.investigationNumber ?? '—'}</td>
              <td style={{ padding: '8px 12px' }}>
                {s.investigationStatus
                  ? <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: s.investigationStatus === 'Closed' ? '#d1fae5' : '#fef2f2', color: s.investigationStatus === 'Closed' ? '#065f46' : '#991b1b', border: `1px solid ${s.investigationStatus === 'Closed' ? '#6ee7b7' : '#fca5a5'}` }}>{s.investigationStatus}</span>
                  : <span style={{ color: '#9ca3af' }}>—</span>}
              </td>
              <td style={{ padding: '8px 12px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.investigationNotes ?? '—'}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {(role === 'Admin' || role === 'QA') && (
                  <button onClick={() => onOpen(s)}
                    style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}>
                    📝 Notes
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmExpiryTable({ samples }: { samples: EmSample[] }) {
  if (samples.length === 0)
    return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>No samples expiring within 7 days.</p>

  const now = new Date()
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #fdba74', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fff7ed' }}>
            {['Sample ID', 'System / Area', 'Slot', 'Status', 'Expires At', 'Time Left'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #fdba74', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {samples.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()).map((s, i) => {
            const exp  = new Date(s.expiresAt)
            const expH = Math.round((exp.getTime() - now.getTime()) / 3600000)
            const isExpired = expH < 0
            return (
              <tr key={s.emSampleId} style={{ background: isExpired ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#92400e', fontSize: 12 }}>{s.sampleNumber}</td>
                <td style={{ padding: '8px 12px', color: '#374151' }}>{s.systemName ?? '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#1e40af' }}>{s.slotLabel}</td>
                <td style={{ padding: '8px 12px' }}><StatusPill status={s.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 11, color: '#374151' }}>{exp.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                  {isExpired
                    ? <span style={{ color: '#dc2626' }}>EXPIRED</span>
                    : expH < 24
                      ? <span style={{ color: '#d97706' }}>{expH}h left</span>
                      : <span style={{ color: '#92400e' }}>{Math.round(expH / 24)}d left</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckpointsPage() {
  const [data, setData]               = useState<Checkpoint[]>([])
  const [labs, setLabs]               = useState<Lab[]>([])
  const [params, setParams]           = useState<Param[]>([])
  const [testMethods, setTestMethods] = useState<TestMethod[]>([])
  const [loading, setLoading]         = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<Checkpoint | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // History modal
  const [historyCheckpoint, setHistoryCheckpoint] = useState<Checkpoint | null>(null)
  const [historyLogs, setHistoryLogs]             = useState<TriggerLog[]>([])
  const [historyLoading, setHistoryLoading]       = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Checkpoint | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const role = useSelector((s: RootState) => s.auth.role) ?? ''

  // ── EM Samples section state ─────────────────────────────────────────────────
  const [emTab,          setEmTab]          = useState<'plan' | 'investigations' | 'expiry'>('plan')
  const [emSamples,      setEmSamples]      = useState<EmSample[]>([])
  const [emLoading,      setEmLoading]      = useState(false)
  const [emGenerating,   setEmGenerating]   = useState(false)
  const [emSampleDate,   setEmSampleDate]   = useState(new Date().toISOString().slice(0, 10))
  const [emResultModal,  setEmResultModal]  = useState<EmSample | null>(null)
  const [emResultStatus, setEmResultStatus] = useState('Pass')
  const [emInvModal,     setEmInvModal]     = useState<EmSample | null>(null)
  const [emInvNotes,     setEmInvNotes]     = useState('')

  const hasEmCheckpoints = data.some(cp => cp.category === 'Environmental')

  async function loadEmSamples(date?: string) {
    setEmLoading(true)
    try {
      const d = date ?? emSampleDate
      const r = await api.get(`/em-samples?from=${d}&to=${d}`)
      setEmSamples(Array.isArray(r.data) ? r.data : [])
    } catch { setEmSamples([]) }
    finally { setEmLoading(false) }
  }

  async function generateEmSamples() {
    setEmGenerating(true)
    try {
      const r = await api.post(`/em-samples/generate?date=${emSampleDate}`)
      toast(`Generated ${r.data.created} sample(s) for ${emSampleDate}`, 'success')
      loadEmSamples()
    } catch (err) { toast(getErrorMessage(err, 'Generate failed'), 'error') }
    finally { setEmGenerating(false) }
  }

  async function collectSample(id: number) {
    try {
      await api.patch(`/em-samples/${id}/collect`)
      toast('Sample marked as Collected', 'success')
      loadEmSamples()
    } catch (err) { toast(getErrorMessage(err, 'Failed'), 'error') }
  }

  async function receiveSample(id: number) {
    try {
      await api.patch(`/em-samples/${id}/receive`, {})
      toast('Sample received by lab', 'success')
      loadEmSamples()
    } catch (err) { toast(getErrorMessage(err, 'Failed'), 'error') }
  }

  async function submitResults() {
    if (!emResultModal) return
    try {
      await api.patch(`/em-samples/${emResultModal.emSampleId}/results`, { resultStatus: emResultStatus })
      toast('Results recorded', 'success')
      setEmResultModal(null); loadEmSamples()
    } catch (err) { toast(getErrorMessage(err, 'Failed'), 'error') }
  }

  async function submitInvestigation() {
    if (!emInvModal) return
    try {
      await api.patch(`/em-samples/${emInvModal.emSampleId}/investigation`, {
        investigationStatus: 'Open', investigationNotes: emInvNotes,
      })
      toast('Investigation updated', 'success')
      setEmInvModal(null); setEmInvNotes(''); loadEmSamples()
    } catch (err) { toast(getErrorMessage(err, 'Failed'), 'error') }
  }

  // Load EM samples when date changes
  useEffect(() => { if (hasEmCheckpoints) loadEmSamples(emSampleDate) }, [emSampleDate, hasEmCheckpoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form state ──────────────────────────────────────────────────────────────
  const [cpName, setCpName]                   = useState('')
  const [cpId, setCpId]                       = useState('')
  const [labId, setLabId]                     = useState('')
  const [cpType, setCpType]                   = useState('Single')
  const [selectedSlots, setSelectedSlots]     = useState<string[]>(['08:00'])
  const [manualSlot, setManualSlot]           = useState('')
  const [manualSlotError, setManualSlotError] = useState('')
  const [selectedParams, setSelectedParams]   = useState<number[]>([])
  const [paramLimits, setParamLimits]         = useState<Record<number, { alertMin: string; alertMax: string; actionMin: string; actionMax: string }>>({})
  const [showParamLimits, setShowParamLimits]   = useState<number | null>(null)
  const [selectedMethodId, setSelectedMethodId] = useState('')
  const [methodParamsLoading, setMethodParamsLoading] = useState(false)

  // EM fields
  const [category, setCategory]                   = useState('Batch')
  const [systemName, setSystemName]               = useState('')
  const [systemCode, setSystemCode]               = useState('')
  const [location, setLocation]                   = useState('')
  const [samplingPointCode, setSamplingPointCode] = useState('')
  const [lifecycleStatus, setLifecycleStatus]     = useState('Draft')

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const [r, lr, pr, tmr] = await Promise.all([
        api.get('/checkpoints?triggerMode=TimeBased').catch(() => ({ data: [] })),
        api.get('/laboratories').catch(() => ({ data: [] })),
        api.get('/parameters').catch(() => ({ data: [] })),
        api.get('/test-methods').catch(() => ({ data: [] })),
      ])
      setData(r.data); setLabs(lr.data); setParams(pr.data); setTestMethods(tmr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ─────────────────────────────────────────────────────────────────
  async function openHistory(cp: Checkpoint) {
    setHistoryCheckpoint(cp); setHistoryLogs([]); setHistoryLoading(true)
    try {
      const r = await api.get(`/checkpoints/${cp.checkpointId}/triggers`)
      setHistoryLogs(r.data)
    } catch { setHistoryLogs([]) }
    finally { setHistoryLoading(false) }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/checkpoints/${deleteTarget.checkpointId}`)
      toast(`Checkpoint "${deleteTarget.checkpointCode}" deleted`, 'success')
      setDeleteTarget(null); load()
    } catch (err) {
      toast(getErrorMessage(err, 'Delete failed'), 'error')
    } finally { setDeleting(false) }
  }

  // ── Open form ───────────────────────────────────────────────────────────────
  function openCreate() {
    setCpName(''); setCpId(''); setLabId(''); setCpType('Single')
    setSelectedSlots(['08:00']); setManualSlot(''); setManualSlotError('')
    setSelectedParams([]); setParamLimits({}); setShowParamLimits(null); setError('')
    setCategory('Batch'); setSystemName(''); setSystemCode(''); setLocation(''); setSamplingPointCode(''); setLifecycleStatus('Draft')
    setSelectedMethodId(''); setEditTarget(null); setShowForm(true)
  }

  async function handleMethodChange(methodId: string) {
    setSelectedMethodId(methodId)
    if (!methodId) { setParams([]); setSelectedParams([]); setParamLimits({}); return }
    setMethodParamsLoading(true)
    try {
      const r = await api.get(`/parameters?methodId=${methodId}`)
      setParams(r.data)
      setSelectedParams((r.data as Param[]).map(p => p.parameterId))
      setParamLimits({})
    } catch { toast('Failed to load method parameters', 'error') }
    finally { setMethodParamsLoading(false) }
  }

  function handleNameChange(val: string) {
    setCpName(val)
    if (!editTarget)
      setCpId(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20))
  }

  // ── Slots ───────────────────────────────────────────────────────────────────
  function toggleSlot(t: string) {
    setSelectedSlots(prev => prev.includes(t) ? prev.filter(s => s !== t) : [...prev, t])
  }
  function addManualSlot() {
    const t = manualSlot.trim()
    if (!/^\d{2}:\d{2}$/.test(t)) { setManualSlotError('Use HH:mm (e.g. 07:30)'); return }
    const [h, m] = t.split(':').map(Number)
    if (h > 23 || m > 59) { setManualSlotError('Invalid time'); return }
    if (selectedSlots.includes(t)) { setManualSlotError('Already added'); return }
    setSelectedSlots(prev => [...prev, t]); setManualSlot(''); setManualSlotError('')
  }

  // ── Params ──────────────────────────────────────────────────────────────────
  function toggleParam(id: number) {
    setSelectedParams(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/checkpoints', {
        checkpointCode: cpName,
        labId: Number(labId),
        triggerMode: 'TimeBased',
        checkpointType: cpType,
        timeSlots: selectedSlots.length > 0 ? JSON.stringify(selectedSlots.sort()) : null,
        category,
        systemName:        category === 'Environmental' ? (systemName || null) : null,
        systemCode:        category === 'Environmental' ? (systemCode || null) : null,
        location:          category === 'Environmental' ? (location || null) : null,
        samplingPointCode: category === 'Environmental' ? (samplingPointCode || null) : null,
        lifecycleStatus:   category === 'Environmental' ? lifecycleStatus : null,
        scheduledDate: null,
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
      toast(`Checkpoint "${cpName}" saved`, 'success')
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to save checkpoint')
      setError(msg); toast(msg, 'error')
    } finally { setSaving(false) }
  }

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Checkpoints</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Time-based checkpoints — Batch parameters and Environmental Monitoring (EM)
          </p>
        </div>
        {(role === 'Admin' || role === 'QA') && (
          <button onClick={openCreate}
            style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Add Checkpoint
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <DataTable loading={loading} data={data} columns={[
        {
          header: 'Code',
          accessor: r => (
            <div>
              <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.checkpointCode}</strong>
              {r.category === 'Environmental' && r.systemName && (
                <div style={{ fontSize: 10, color: '#065f46', marginTop: 2 }}>{r.systemName}</div>
              )}
              {r.category === 'Environmental' && (r as Checkpoint & { location?: string }).location && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>{(r as Checkpoint & { location?: string }).location}</div>
              )}
            </div>
          )
        },
        {
          header: 'Category',
          accessor: r => r.category === 'Environmental'
            ? <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, background: '#d1fae5', color: '#065f46', fontWeight: 700, border: '1px solid #6ee7b7' }}>🌿 EM</span>
            : <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, background: '#f3f4f6', color: '#6b7280' }}>Batch</span>
        },
        {
          header: 'Status',
          accessor: r => {
            const ls = r.lifecycleStatus ?? (r.isActive ? 'Active' : 'Retired')
            const cfg = LIFECYCLE_CFG[ls] ?? LIFECYCLE_CFG.Draft
            return (
              <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {ls}
              </span>
            )
          }
        },
        { header: 'Type', accessor: 'checkpointType' },
        {
          header: 'Time Slots',
          accessor: r => {
            const slots = parseSlots(r.timeSlots)
            return slots.length > 0
              ? <span style={{ fontSize: 12, color: '#374151' }}>{slots.sort().join(', ')}</span>
              : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
          }
        },
        {
          header: 'Parameters',
          accessor: r => (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {(r.parameters ?? []).length === 0
                ? <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
                : (r.parameters ?? []).map(p => (
                  <span key={p.parameterId} title={p.parameterName}
                    style={{ padding: '1px 6px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 5, fontSize: 11, fontWeight: 600, color: '#0d6e6e', fontFamily: 'monospace' }}>
                    {p.parameterCode}
                  </span>
                ))
              }
            </div>
          )
        },
        {
          header: 'Actions',
          accessor: r => (
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => openHistory(r)}
                style={{ padding: '3px 9px', background: '#f1f5f9', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                📜 History
              </button>
              {(role === 'Admin' || role === 'QA') && (
                <button onClick={() => setDeleteTarget(r)}
                  style={{ padding: '3px 9px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  🗑
                </button>
              )}
            </div>
          )
        },
      ]} />

      {/* ══ Add Checkpoint Drawer ══════════════════════════════════════════ */}
      {showForm && (
        <Drawer title="Add Checkpoint" width={700} onClose={() => setShowForm(false)}>
          <form onSubmit={submitForm}>

            {/* ── Name + ID ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Checkpoint Name</label>
                <input style={inp} value={cpName} onChange={e => handleNameChange(e.target.value)}
                  required placeholder="e.g. Cleanroom Zone A — Air Check" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Code / ID</label>
                <input style={{ ...inp, fontFamily: 'monospace' }}
                  value={cpId} onChange={e => setCpId(e.target.value)}
                  required placeholder="e.g. ck-air-a" />
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

            {/* ── Category ─────────────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Category</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'Batch',         label: 'Batch Parameters',          desc: 'In-process checks, QC parameters' },
                  { value: 'Environmental', label: 'Environmental Monitoring',   desc: 'EM — cleanroom, air, water, surfaces' },
                ].map(opt => (
                  <div key={opt.value} onClick={() => setCategory(opt.value)}
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${category === opt.value ? (opt.value === 'Environmental' ? '#5DCAA5' : '#1e3a5f') : '#e5e7eb'}`,
                      background: category === opt.value ? (opt.value === 'Environmental' ? '#f0fdf9' : '#eff6ff') : '#fff',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── EM section (shown when Environmental) ────────────── */}
            {category === 'Environmental' && (
              <div style={{ marginBottom: 20, padding: '16px 18px', border: '1.5px solid #5DCAA5', borderRadius: 10, background: '#f0fdf9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🌿 Environmental Monitoring Settings
                </div>

                {/* System Type + System Code */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>System Type</label>
                    <select style={{ ...inp, margin: 0 }} value={systemName} onChange={e => setSystemName(e.target.value)} required={category === 'Environmental'}>
                      <option value="">Select system…</option>
                      {EM_SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      System Code <span style={{ color: '#9ca3af', fontWeight: 400 }}>— short prefix</span>
                    </label>
                    <input style={{ ...inp, margin: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}
                      value={systemCode} onChange={e => setSystemCode(e.target.value.toUpperCase())}
                      placeholder="e.g. WFI, CA, CS, PW" maxLength={10} />
                  </div>
                </div>

                {/* Location + Sampling Point Code */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Location / Sampling Point</label>
                    <input style={{ ...inp, margin: 0 }} value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Zone A – Supply Air, Near Fill Point 3" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                      Sampling Point Code <span style={{ color: '#9ca3af', fontWeight: 400 }}>— for sample ID</span>
                    </label>
                    <input style={{ ...inp, margin: 0, fontFamily: 'monospace', textTransform: 'uppercase' }}
                      value={samplingPointCode} onChange={e => setSamplingPointCode(e.target.value.toUpperCase())}
                      placeholder="e.g. POU01, CA-01, LOOP-R" maxLength={15} />
                  </div>
                </div>

                {/* Sample ID preview */}
                {systemCode && samplingPointCode && (
                  <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, color: '#0369a1' }}>Sample ID preview: </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0369a1' }}>
                      {systemCode}-{samplingPointCode}-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-001
                    </span>
                  </div>
                )}

                {/* Lifecycle Status */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Lifecycle Status</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['Draft', 'Active', 'Retired'] as const).map(ls => {
                      const cfg = LIFECYCLE_CFG[ls]
                      const selected = lifecycleStatus === ls
                      return (
                        <button key={ls} type="button" onClick={() => setLifecycleStatus(ls)}
                          style={{
                            padding: '7px 20px', borderRadius: 20, fontSize: 12, fontWeight: selected ? 700 : 500,
                            cursor: 'pointer', transition: 'all 0.1s',
                            background: selected ? cfg.bg : '#fff',
                            color: cfg.color,
                            border: `1.5px solid ${selected ? cfg.border : '#d1d5db'}`,
                            boxShadow: selected ? `0 0 0 2px ${cfg.border}44` : 'none',
                          }}>
                          {ls}
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
                    Draft = in setup · Active = live monitoring · Retired = decommissioned
                  </p>
                </div>
              </div>
            )}

            {/* ── Time Slots ───────────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Time Slots
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#6b7280' }}>
                    — scheduler triggers at these times daily
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {PRESETS.map(p => (
                    <button key={p.label} type="button" onClick={() => setSelectedSlots(p.slots)}
                      style={{ padding: '3px 9px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 14px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                {ALL_SLOTS.map(t => (
                  <SlotChip key={t} time={t} selected={selectedSlots.includes(t)} onToggle={() => toggleSlot(t)} />
                ))}
              </div>
              {/* Custom slot */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input style={{ ...inp, fontFamily: 'monospace', margin: 0 }}
                    value={manualSlot}
                    onChange={e => { setManualSlot(e.target.value); setManualSlotError('') }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualSlot())}
                    placeholder="Custom time e.g. 07:30" maxLength={5} />
                  {manualSlotError && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{manualSlotError}</p>}
                </div>
                <button type="button" onClick={addManualSlot}
                  style={{ padding: '9px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', flexShrink: 0 }}>
                  + Add
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
                {selectedSlots.length === 0
                  ? 'No slots — checkpoint will not trigger automatically'
                  : `${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''}: ${[...selectedSlots].sort().join(', ')}`}
              </p>
            </div>

            {/* ── Parameters ───────────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              {/* Test Method selector — auto-loads and pre-selects its parameters */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Test Method
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#6b7280' }}>— select to auto-load parameters</span>
                </label>
                <select style={{ ...inp, margin: 0 }} value={selectedMethodId} onChange={e => handleMethodChange(e.target.value)}>
                  <option value="">— Browse all parameters manually —</option>
                  {testMethods.filter(m => m.status === 'Approved' || m.status === 'Draft').map(m => (
                    <option key={m.methodId} value={m.methodId}>
                      {m.methodCode} — {m.methodName} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Parameters
                {selectedParams.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#6b7280' }}>
                    ({selectedParams.length} selected)
                  </span>
                )}
              </label>
              <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: '#fff' }}>
                {methodParamsLoading ? (
                  <p style={{ padding: '16px', fontSize: 13, color: '#9ca3af', margin: 0 }}>Loading parameters…</p>
                ) : params.length === 0 ? (
                  <p style={{ padding: '16px', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    {selectedMethodId ? 'No parameters for this method.' : 'Select a test method above, or parameters will appear here after one is created.'}
                  </p>
                ) : params.map((p, i) => {
                  const checked    = selectedParams.includes(p.parameterId)
                  const limitsOpen = showParamLimits === p.parameterId
                  const lim        = paramLimits[p.parameterId] ?? {}
                  const hasLim     = checked && (lim.alertMin || lim.alertMax || lim.actionMin || lim.actionMax)
                  return (
                    <div key={p.parameterId} style={{ borderBottom: i < params.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: checked ? '#f0f9ff' : '#fff', cursor: 'pointer' }}>
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
                          {p.uom && <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{p.uom}</span>}
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
                          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#92400e' }}>Two-Tier Limits</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {(['alertMin','alertMax','actionMin','actionMax'] as const).map(field => (
                              <div key={field}>
                                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 600 }}>
                                  {field === 'alertMin' ? '⚠ Alert Min' : field === 'alertMax' ? '⚠ Alert Max' : field === 'actionMin' ? '🔴 Action Min' : '🔴 Action Max'}
                                </label>
                                <input style={{ ...inp, margin: 0, fontSize: 12, padding: '6px 10px', fontFamily: 'monospace' }}
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

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠ {error}</p>
              </div>
            )}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} label="Save Checkpoint" />
          </form>
        </Drawer>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#111827', textAlign: 'center' }}>Delete Checkpoint?</h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#374151', textAlign: 'center' }}>
              <strong style={{ fontFamily: 'monospace' }}>{deleteTarget.checkpointCode}</strong>
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              Permanently removes the checkpoint and all trigger history. Blocked if signed audit rows exist.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: deleting ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EM Samples Section ═══════════════════════════════════════════ */}
      {hasEmCheckpoints && (
        <div style={{ marginTop: 32 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#065f46' }}>🌿 EM Samples</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Physical sample tracking — collection → lab receipt → analysis → approval</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={emSampleDate}
                onChange={e => setEmSampleDate(e.target.value)}
                style={{ ...inp, fontSize: 12, padding: '6px 10px' }} />
              <button onClick={generateEmSamples} disabled={emGenerating}
                style={{ padding: '7px 14px', background: emGenerating ? '#9ca3af' : '#065f46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: emGenerating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {emGenerating ? '⏳ Generating…' : '+ Generate Samples'}
              </button>
              <button onClick={() => loadEmSamples()}
                style={{ padding: '7px 12px', background: '#f0fdf4', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
            {([['plan', '📋 Sampling Plan'], ['investigations', '🔴 Investigations'], ['expiry', '⏰ Expiry Alerts']] as const).map(([tab, label]) => {
              const count = tab === 'investigations' ? emSamples.filter(s => s.investigationStatus === 'Open').length
                : tab === 'expiry' ? emSamples.filter(s => new Date(s.expiresAt) < new Date(Date.now() + 7 * 86400000) && s.status !== 'ResultsApproved' && s.status !== 'Invalid').length
                : emSamples.length
              return (
                <button key={tab} onClick={() => setEmTab(tab)} style={{
                  padding: '8px 18px', fontSize: 12, fontWeight: emTab === tab ? 700 : 500,
                  color: emTab === tab ? '#065f46' : '#6b7280',
                  background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${emTab === tab ? '#065f46' : 'transparent'}`,
                  marginBottom: -2, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {label}{count > 0 && <span style={{ marginLeft: 5, background: tab === 'investigations' ? '#fef2f2' : tab === 'expiry' ? '#fff7ed' : '#d1fae5', color: tab === 'investigations' ? '#991b1b' : tab === 'expiry' ? '#92400e' : '#065f46', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {emLoading && <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading samples…</p>}

          {/* ── Sampling Plan tab ── */}
          {!emLoading && emTab === 'plan' && (
            <EmSamplingPlanTable
              samples={emSamples} role={role}
              onCollect={collectSample} onReceive={receiveSample}
              onResults={s => { setEmResultModal(s); setEmResultStatus('Pass') }}
            />
          )}

          {/* ── Investigations tab ── */}
          {!emLoading && emTab === 'investigations' && (
            <EmInvestigationsTable
              samples={emSamples.filter(s => s.resultStatus === 'ActionExceeded')}
              role={role}
              onOpen={s => { setEmInvModal(s); setEmInvNotes(s.investigationNotes ?? '') }}
            />
          )}

          {/* ── Expiry Alerts tab ── */}
          {!emLoading && emTab === 'expiry' && (
            <EmExpiryTable samples={emSamples.filter(s => {
              const exp = new Date(s.expiresAt)
              const now = new Date()
              return exp < new Date(now.getTime() + 7 * 86400000) && s.status !== 'ResultsApproved' && s.status !== 'Invalid'
            })} />
          )}
        </div>
      )}

      {/* ── Enter Results Modal ──────────────────────────────────────────── */}
      {emResultModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>Enter Results</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{emResultModal.sampleNumber}</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Result Status</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { v: 'Pass',           bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: '✓ Pass' },
                { v: 'AlertExceeded',  bg: '#fffbeb', color: '#92400e', border: '#fcd34d', label: '⚠ Alert' },
                { v: 'ActionExceeded', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: '🔴 Action' },
              ].map(o => (
                <button key={o.v} type="button" onClick={() => setEmResultStatus(o.v)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: emResultStatus === o.v ? 700 : 500, cursor: 'pointer', border: `2px solid ${emResultStatus === o.v ? o.border : '#e5e7eb'}`, background: emResultStatus === o.v ? o.bg : '#fff', color: o.color }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEmResultModal(null)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitResults}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#065f46', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Save Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Investigation Notes Modal ────────────────────────────────────── */}
      {emInvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#991b1b' }}>🔴 Investigation</h3>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{emInvModal.investigationNumber ?? emInvModal.sampleNumber}</p>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>Action limit exceeded — document findings</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Investigation Notes</label>
            <textarea value={emInvNotes} onChange={e => setEmInvNotes(e.target.value)}
              rows={4} style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="Root cause, corrective action, disposition…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEmInvModal(null)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitInvestigation}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#991b1b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trigger History Modal ────────────────────────────────────────── */}
      {historyCheckpoint && (
        <Panel title={`${historyCheckpoint.checkpointCode} — History`} subtitle="Last 10 trigger events" width={580} onClose={() => setHistoryCheckpoint(null)}>
          {historyLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
          {!historyLoading && historyLogs.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No trigger history yet.</p>
          )}
          {!historyLoading && historyLogs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date / Time', 'Triggered By', 'Mode', 'Sync'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((t, i) => (
                  <tr key={t.triggerId} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#111827', fontSize: 12 }}>{fmtDateTime(t.triggeredAt)}</td>
                    <td style={{ padding: '8px 10px', color: '#374151' }}>{t.triggeredBy ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>
                        {t.triggerMode}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {t.isOfflineSync
                        ? <span style={{ fontSize: 11, color: '#854d0e', fontWeight: 600 }}>📴 Offline</span>
                        : <span style={{ fontSize: 11, color: '#065f46' }}>✓ Online</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setHistoryCheckpoint(null)}
              style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}
