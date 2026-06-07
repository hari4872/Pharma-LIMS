import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { GATE_HELP } from '@/pages/WorkflowConfigPage'

// ─── Cache ────────────────────────────────────────────────────────────────────
const _cache = new Map<number, SampleDetail>()

// ─── Types ────────────────────────────────────────────────────────────────────
export type SheetContext = 'workqueue' | 'qa' | 'release' | 'default'

interface SampleDetail {
  sampleId: number; sampleNumber: string; lotNumber: string
  materialId: number; materialName: string; sampleTypeName: string
  status: string; isRush: boolean; barcodePrinted: boolean
  createdAt: string; dueDate: string | null
  sampleCondition: string | null; externalBatchId: string | null
  specTemplateName: string | null; specTemplateId: number | null
  testExecutions: {
    executionId: number; status: string; analystName: string
    instrumentCode: string; priorityScore: number | null
    startedAt: string | null; completedAt: string | null; dueDate: string | null
  }[]
}

interface LinkedCheckpoint {
  checkpointId: number; checkpointCode: string
  triggerMode: string; checkpointType: string
  slotsTotal: number; slotsSigned: number
}

interface QaSummary {
  totalResults: number; passCount: number; failCount: number
  oosCount: number; ootCount: number; openInvestigations: number
}

interface CoaSummary {
  coaId: number; coaNumber: string; status: string
  qaSignedBy: string | null; qaSignedAt: string | null
  customerName: string | null; doNumber: string | null; despatchDate: string | null
}

interface WfStep {
  workflowStepId: number; stepOrder: number; stepName: string
  requiredRole: string; requiresESignature: boolean
  gateCondition: string | null; isOptional: boolean
}

interface WfStatus {
  templateName: string
  steps: { step: WfStep; gatePassed: boolean; gateReason: string }[]
  currentStepOrder: number
}

export interface SampleDetailExtraInfo {
  sampleType?:          string | null
  formTemplateName?:    string | null
  isCheckpointLinked?:  boolean
  checkpointCount?:     number
  specVersion?:         string | null
  specStage?:           string | null
  barcodePrinted?:      boolean
}

interface Props {
  sampleId:     number
  onClose:      () => void
  onStartTask?: (executionId: number) => void
  context?:     SheetContext
  extraInfo?:   SampleDetailExtraInfo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
  Assigned:        { bg: '#dbeafe', color: '#1e40af' },
  InProgress:      { bg: '#fef9c3', color: '#854d0e' },
  Completed:       { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:         { bg: '#fee2e2', color: '#991b1b' },
  Draft:           { bg: '#fef9c3', color: '#854d0e' },
  Superseded:      { bg: '#f3f4f6', color: '#6b7280' },
}

const TRIGGER_LABEL: Record<string, string> = {
  TimeBased: 'Time-Based', OperatorScan: 'Operator Scan',
  ProcessLog: 'Process Log', DispatchEvent: 'Dispatch Event',
}

const CONTEXT_META: Record<SheetContext, { label: string; color: string; bg: string }> = {
  workqueue: { label: 'Analyst View',  color: '#1d4ed8', bg: '#dbeafe' },
  qa:        { label: 'QA View',       color: '#7c3aed', bg: '#f3e8ff' },
  release:   { label: 'Release View',  color: '#065f46', bg: '#d1fae5' },
  default:   { label: 'Sample Detail', color: '#374151', bg: '#f1f5f9' },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f3f4f6', color: '#374151' }
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{status}</span>
}

function SectionHead({ title, count }: { title: string; count?: number | string }) {
  return (
    <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
      {title}
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', padding: '1px 7px', borderRadius: 8 }}>{count}</span>
      )}
    </h4>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SampleDetailSheet({ sampleId, onClose, onStartTask, context = 'default', extraInfo }: Props) {
  const [detail,      setDetail]      = useState<SampleDetail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // workqueue context
  const [checkpoints, setCheckpoints] = useState<LinkedCheckpoint[]>([])
  const [cpLoading,   setCpLoading]   = useState(false)

  // qa context
  const [qaSummary,   setQaSummary]   = useState<QaSummary | null>(null)
  const [qaLoading,   setQaLoading]   = useState(false)

  // release context
  const [coa,         setCoa]         = useState<CoaSummary | null>(null)
  const [coaLoading,  setCoaLoading]  = useState(false)

  // workflow status (workqueue + default)
  const [wfStatus,    setWfStatus]    = useState<WfStatus | null>(null)
  const [wfLoading,   setWfLoading]   = useState(false)

  const ctx = CONTEXT_META[context]

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {

      // ── Core sample detail ──────────────────────────────────────────────
      if (_cache.has(sampleId)) {
        if (!cancelled) { setDetail(_cache.get(sampleId)!); setLoading(false) }
      } else {
        setLoading(true)
        api.get(`/samples/${sampleId}`)
          .then(r => { if (!cancelled) { _cache.set(sampleId, r.data); setDetail(r.data) } })
          .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err, 'Failed to load sample details.')) })
          .finally(() => { if (!cancelled) setLoading(false) })
      }

      // ── Work Queue: checkpoints + today's slots ─────────────────────────
      if (context === 'workqueue') {
        setCpLoading(true)
        const today = new Date().toISOString().slice(0, 10)
        api.get(`/samples/${sampleId}/checkpoints`)
          .then(async r => {
            const ids: number[] = r.data ?? []
            if (!ids.length) { if (!cancelled) setCheckpoints([]); return }
            const results = await Promise.allSettled(
              ids.map(async (cpId: number) => {
                const [cpRes, logRes] = await Promise.allSettled([
                  api.get(`/checkpoints/${cpId}`),
                  api.get(`/checkpoints/${cpId}/process-log?date=${today}`),
                ])
                const cp  = cpRes.status  === 'fulfilled' ? cpRes.value.data   : null
                const log = logRes.status === 'fulfilled' ? logRes.value.data  : []
                if (!cp) return null
                const rows: { status: string }[] = Array.isArray(log) ? log : []
                return { checkpointId: cp.checkpointId, checkpointCode: cp.checkpointCode, triggerMode: cp.triggerMode, checkpointType: cp.checkpointType, slotsTotal: rows.length, slotsSigned: rows.filter(row => row.status === 'Locked').length } as LinkedCheckpoint
              })
            )
            if (!cancelled) setCheckpoints(results.map(r => r.status === 'fulfilled' ? r.value : null).filter((x): x is LinkedCheckpoint => x !== null))
          })
          .catch(() => { if (!cancelled) setCheckpoints([]) })
          .finally(() => { if (!cancelled) setCpLoading(false) })
      }

      // ── QA: results summary + OOS count ────────────────────────────────
      if (context === 'qa') {
        setQaLoading(true)
        Promise.allSettled([
          api.get(`/digital-logbook?sampleId=${sampleId}`),
          api.get(`/oos-investigations?sampleId=${sampleId}`),
        ]).then(([lbRes, oosRes]) => {
          if (cancelled) return
          const entries: { passFail: string; isOos: boolean; isOot: boolean }[] =
            lbRes.status === 'fulfilled' ? lbRes.value.data ?? [] : []
          const investigations: { status: string }[] =
            oosRes.status === 'fulfilled' ? oosRes.value.data ?? [] : []
          setQaSummary({
            totalResults:       entries.length,
            passCount:          entries.filter(e => e.passFail === 'PASS').length,
            failCount:          entries.filter(e => e.passFail === 'FAIL').length,
            oosCount:           entries.filter(e => e.isOos).length,
            ootCount:           entries.filter(e => e.isOot).length,
            openInvestigations: investigations.filter(i => i.status !== 'Closed' && i.status !== 'InvalidOOS').length,
          })
        }).finally(() => { if (!cancelled) setQaLoading(false) })
      }

      // ── Release: CoA status ─────────────────────────────────────────────
      if (context === 'release') {
        setCoaLoading(true)
        api.get(`/coas?sampleId=${sampleId}`)
          .then(r => {
            if (cancelled) return
            const list: CoaSummary[] = r.data ?? []
            const active = list.find(c => c.status !== 'Superseded') ?? list[0] ?? null
            setCoa(active)
          })
          .catch(() => { if (!cancelled) setCoa(null) })
          .finally(() => { if (!cancelled) setCoaLoading(false) })
      }

      // ── Workflow status (workqueue + default) ───────────────────────────
      if (context === 'workqueue' || context === 'default') {
        setWfLoading(true)
        api.get(`/samples/${sampleId}`)
          .then(async sr => {
            if (cancelled) return
            const { materialId, sampleTypeId } = sr.data
            const tplRes = await api.get(`/workflow-templates?materialId=${materialId}&sampleTypeId=${sampleTypeId}`)
              .catch(() => ({ data: [] }))
            const tpls: { workflowTemplateId: number; name: string; steps: WfStep[]; isDefault: boolean; isActive: boolean; materialId?: number; sampleTypeId?: number }[] = tplRes.data ?? []
            const tpl = tpls.find(t => t.isActive && t.materialId === materialId && t.sampleTypeId === sampleTypeId)
                      ?? tpls.find(t => t.isActive && t.isDefault)
                      ?? tpls.find(t => t.isActive)
            if (!tpl || cancelled) { setWfStatus(null); return }

            // Evaluate each gate client-side
            const [logbookRes, oosRes, coaCheckRes] = await Promise.allSettled([
              api.get(`/digital-logbook?sampleId=${sampleId}`),
              api.get(`/oos-investigations?sampleId=${sampleId}`),
              api.get(`/coas?sampleId=${sampleId}`),
            ])
            if (cancelled) return

            const logbook: { passFail: string; status?: string }[] = logbookRes.status === 'fulfilled' ? logbookRes.value.data ?? [] : []
            const oos: { status: string }[] = oosRes.status === 'fulfilled' ? oosRes.value.data ?? [] : []
            const coas: { status: string }[] = coaCheckRes.status === 'fulfilled' ? coaCheckRes.value.data ?? [] : []
            const sampleData = sr.data

            function evalGate(gate: string | null): { passed: boolean; reason: string } {
              if (!gate) return { passed: true, reason: '' }
              const openOos = oos.filter(i => i.status !== 'Closed' && i.status !== 'InvalidOOS').length
              switch (gate) {
                case 'AllTestsComplete':
                  return (sampleData.testExecutions ?? []).length > 0 &&
                    (sampleData.testExecutions ?? []).every((e: { status: string }) => e.status === 'Completed')
                    ? { passed: true,  reason: 'All tests completed' }
                    : { passed: false, reason: 'Some test executions are not yet completed' }
                case 'NoOpenOOS':
                  return openOos === 0
                    ? { passed: true,  reason: 'No open OOS investigations' }
                    : { passed: false, reason: `${openOos} OOS investigation(s) still open` }
                case 'LogbookSigned': {
                  const signed   = logbook.filter(e => e.status === 'Signed').length
                  const unsigned = logbook.filter(e => e.status !== 'Signed' && e.status !== 'Superseded').length
                  return logbook.length > 0 && unsigned === 0
                    ? { passed: true,  reason: `${signed} logbook entry/entries signed` }
                    : { passed: false, reason: logbook.length === 0 ? 'No logbook entries found' : `${unsigned} unsigned logbook entry/entries` }
                }
                case 'CoAApproved':
                  return coas.some(c => c.status === 'Released')
                    ? { passed: true,  reason: 'CoA approved and released' }
                    : { passed: false, reason: 'No released CoA found' }
                case 'SRFSigned':
                  return sampleData.srfSigned
                    ? { passed: true,  reason: 'SRF signed' }
                    : { passed: false, reason: 'Sample Registration Form not yet signed' }
                case 'SpecAssigned':
                  return !!sampleData.specTemplateName
                    ? { passed: true,  reason: `Spec: ${sampleData.specTemplateName}` }
                    : { passed: false, reason: 'No spec template assigned' }
                case 'FormTemplateFilled':
                  return !!sampleData.formTemplateName && sampleData.formEntryCount > 0
                    ? { passed: true,  reason: 'Monitoring form submitted' }
                    : { passed: false, reason: sampleData.formTemplateName ? 'Form template assigned but not yet filled' : 'No form template assigned' }
                case 'CheckpointsSigned':
                  // Evaluated elsewhere via checkpoint slots — show as unknown here
                  return { passed: true, reason: 'Checkpoint status checked in Checkpoint Execution page' }
                default:
                  return { passed: true, reason: 'Gate not evaluated client-side' }
              }
            }

            if (!tpl.steps || tpl.steps.length === 0) { if (!cancelled) setWfStatus(null); return }
            const sorted = [...tpl.steps].sort((a, b) => a.stepOrder - b.stepOrder)
            const evaluated = sorted.map(step => {
              const { passed, reason } = evalGate(step.gateCondition)
              return { step, gatePassed: passed, gateReason: reason }
            })

            // Current step = first step where gate is not passed (or last if all passed)
            const currentIdx = evaluated.findIndex(e => !e.gatePassed)
            const currentStepOrder = currentIdx === -1
              ? (sorted[sorted.length - 1]?.stepOrder ?? 1) + 1  // all done
              : sorted[currentIdx].stepOrder

            if (!cancelled) setWfStatus({ templateName: tpl.name, steps: evaluated, currentStepOrder })
          })
          .catch(() => { if (!cancelled) setWfStatus(null) })
          .finally(() => { if (!cancelled) setWfLoading(false) })
      }

    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [sampleId, context])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 700, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                {detail?.sampleNumber ?? 'Loading…'}
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: ctx.bg, color: ctx.color }}>
                {ctx.label}
              </span>
            </div>
            {detail && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{detail.materialName}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Loading skeleton */}
          {loading && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background: '#f1f5f9', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ height: 10, width: '40%', background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 14, width: '70%', background: '#e2e8f0', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
            </div>
          )}
          {error && <p style={{ color: '#dc2626' }}>{error}</p>}

          {detail && (
            <>
              {/* ── Sample info grid (all contexts) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {([
                  ['Material',      detail.materialName],
                  ['Sample Type',   detail.sampleTypeName],
                  ['Lot / Batch',   detail.lotNumber || '—'],
                  ['Status',        null],
                  ['Registered',    new Date(detail.createdAt).toLocaleDateString()],
                  ['Due Date',      detail.dueDate ? new Date(detail.dueDate).toLocaleDateString() : '—'],
                  ['Spec Template', detail.specTemplateName ?? '⚠ None assigned'],
                  ['Condition',     detail.sampleCondition ?? 'OK'],
                  ...(detail.externalBatchId ? [['External Batch', detail.externalBatchId]] : []),
                ] as [string, string | null][]).map(([k, v]) => (
                  <div key={k} style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k}</div>
                    {k === 'Status'
                      ? <Badge status={detail.status} />
                      : <div style={{ fontSize: 13, fontWeight: 600, color: typeof v === 'string' && v.startsWith('⚠') ? '#d97706' : '#111827' }}>{v}</div>
                    }
                  </div>
                ))}
                {detail.isRush && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>🚨 RUSH SAMPLE</div>
                    <div style={{ fontSize: 11, color: '#92400e' }}>Priority processing required</div>
                  </div>
                )}
                {/* Extra fields from table row (Type, Barcode, Source, Log Form, Test Plan) */}
                {extraInfo?.sampleType && (
                  <div style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Sample Type</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{extraInfo.sampleType}</div>
                  </div>
                )}
                {extraInfo && extraInfo.barcodePrinted !== undefined && (
                  <div style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Barcode Label</div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                      background: extraInfo.barcodePrinted ? '#d1fae5' : '#fee2e2',
                      color: extraInfo.barcodePrinted ? '#065f46' : '#991b1b' }}>
                      {extraInfo.barcodePrinted ? '✓ Printed' : '⚠ Not yet printed'}
                    </span>
                  </div>
                )}
                {extraInfo && (extraInfo.isCheckpointLinked !== undefined) && (
                  <div style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Source</div>
                    {extraInfo.isCheckpointLinked
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          📍 Checkpoint ({extraInfo.checkpointCount ?? 0})
                        </span>
                      : <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                          🧪 Lab
                        </span>
                    }
                  </div>
                )}
                {extraInfo && (extraInfo.formTemplateName !== undefined) && (
                  <div style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Log Form</div>
                    {extraInfo.formTemplateName
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                          ✓ {extraInfo.formTemplateName}
                        </span>
                      : <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                          ⚠ No form assigned
                        </span>
                    }
                  </div>
                )}
                {extraInfo && (extraInfo.specVersion !== undefined) && (
                  <div style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Test Plan</div>
                    {extraInfo.specVersion
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#f0fdfa', color: '#0d6e6e', border: '1px solid #99f6e4' }}>
                          v{extraInfo.specVersion} — {extraInfo.specStage}
                        </span>
                      : <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                          ⚠ No spec assigned
                        </span>
                    }
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════
                  WORK QUEUE CONTEXT
              ════════════════════════════════════════════════ */}
              {context === 'workqueue' && (
                <>
                  {/* Test Executions */}
                  <div style={{ marginBottom: 20 }}>
                    <SectionHead title="Test Executions" count={detail.testExecutions.length} />
                    {detail.testExecutions.length === 0 ? (
                      <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                        ⚠ No test executions yet. Assign from Work Queue.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detail.testExecutions.map(e => (
                          <div key={e.executionId} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', background: '#fff' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>#{e.executionId}</span>
                                <Badge status={e.status} />
                                {e.priorityScore !== null && <span style={{ fontSize: 11, fontWeight: 700, background: e.priorityScore === 1 ? '#fee2e2' : '#f3f4f6', color: e.priorityScore === 1 ? '#991b1b' : '#374151', padding: '1px 6px', borderRadius: 4 }}>P{e.priorityScore}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                                👤 {e.analystName} · 🔬 {e.instrumentCode}
                                {e.startedAt && <span> · Started: {new Date(e.startedAt).toLocaleTimeString()}</span>}
                                {e.completedAt && <span> · Done: {new Date(e.completedAt).toLocaleTimeString()}</span>}
                              </div>
                            </div>
                            {onStartTask && e.status === 'Assigned' && (
                              <button onClick={() => { onClose(); onStartTask(e.executionId) }} style={{ padding: '5px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ Start</button>
                            )}
                            {e.status === 'InProgress' && (
                              <a href={`/test-execution/${e.executionId}`} style={{ padding: '5px 14px', background: '#7c3aed', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>📋 Enter Results</a>
                            )}
                            {(e.status === 'Completed' || e.status === 'OOSOpen') && (
                              <a href={`/test-execution/${e.executionId}`} style={{ padding: '5px 14px', background: '#f0fdf4', color: '#065f46', border: '1px solid #86efac', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>🔍 View Results</a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linked Checkpoints */}
                  <div>
                    <SectionHead title="Linked Checkpoints" count={cpLoading ? '…' : checkpoints.length} />
                    {!cpLoading && checkpoints.length === 0 && (
                      <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#9ca3af' }}>No checkpoints linked.</div>
                    )}
                    {!cpLoading && checkpoints.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {checkpoints.map(cp => {
                          const allDone = cp.slotsTotal > 0 && cp.slotsSigned === cp.slotsTotal
                          const partial = cp.slotsTotal > 0 && cp.slotsSigned > 0 && cp.slotsSigned < cp.slotsTotal
                          const noSlots = cp.slotsTotal === 0
                          const sBg    = allDone ? '#d1fae5' : partial ? '#fef9c3' : noSlots ? '#f1f5f9' : '#fef2f2'
                          const sColor = allDone ? '#065f46' : partial ? '#92400e' : noSlots ? '#6b7280' : '#991b1b'
                          const sIcon  = allDone ? '✓' : partial ? '◑' : noSlots ? '—' : '✗'
                          const sText  = noSlots ? 'No slots today' : allDone ? `All ${cp.slotsTotal} signed` : `${cp.slotsSigned} / ${cp.slotsTotal} signed`
                          return (
                            <div key={cp.checkpointId} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${allDone ? '#bbf7d0' : cp.slotsTotal > 0 && !allDone ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, padding: '9px 14px', background: '#fff' }}>
                              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#0f172a', minWidth: 60 }}>{cp.checkpointCode}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{cp.checkpointType}</div>
                                <div style={{ fontSize: 11, color: '#9ca3af' }}>{TRIGGER_LABEL[cp.triggerMode] ?? cp.triggerMode}</div>
                              </div>
                              <span style={{ padding: '3px 12px', borderRadius: 20, background: sBg, color: sColor, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{sIcon} {sText}</span>
                            </div>
                          )
                        })}
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Go to Digital Logbook → Process Log to sign pending slots</p>
                      </div>
                    )}
                  </div>
                  {/* Step 3: Workflow Progress */}
                  {(wfLoading || wfStatus) && (
                    <div style={{ marginTop: 20 }}>
                      <SectionHead title="Workflow Progress" count={wfLoading ? '…' : wfStatus ? `${wfStatus.steps.filter(s => s.gatePassed).length}/${wfStatus.steps.length} done` : undefined} />
                      {wfLoading && <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading workflow…</div>}
                      {wfStatus && (
                        <>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>Template: <strong>{wfStatus.templateName}</strong></div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {wfStatus.steps.map(({ step, gatePassed, gateReason }) => {
                              const isCurrent = step.stepOrder === wfStatus.currentStepOrder
                              const isDone    = step.stepOrder < wfStatus.currentStepOrder
                              const icon  = isDone ? '✓' : isCurrent ? '⏳' : '○'
                              const bg    = isDone ? '#f0fdf4' : isCurrent ? '#fffbeb' : '#f8fafc'
                              const bc    = isDone ? '#bbf7d0' : isCurrent ? '#fde68a' : '#e2e8f0'
                              const iconC = isDone ? '#15803d' : isCurrent ? '#92400e' : '#9ca3af'
                              return (
                                <div key={step.workflowStepId} style={{ background: bg, border: `1.5px solid ${bc}`, borderRadius: 8, padding: '9px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 14, color: iconC, fontWeight: 700, width: 18, flexShrink: 0 }}>{icon}</span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{step.stepName}</span>
                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{step.requiredRole}</span>
                                        {step.requiresESignature && <span style={{ fontSize: 10, color: '#854d0e' }}>🔏</span>}
                                      </div>
                                      {isCurrent && !gatePassed && step.gateCondition && (
                                        <div style={{ marginTop: 4, fontSize: 11, color: '#92400e' }}>
                                          🔒 Blocked: {gateReason}
                                          {GATE_HELP[step.gateCondition] && (
                                            <span style={{ marginLeft: 6, color: '#0369a1' }}>→ {GATE_HELP[step.gateCondition]}</span>
                                          )}
                                        </div>
                                      )}
                                      {isDone && gateReason && (
                                        <div style={{ marginTop: 2, fontSize: 11, color: '#16a34a' }}>{gateReason}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════
                  QA CONTEXT
              ════════════════════════════════════════════════ */}
              {context === 'qa' && (
                <>
                  {/* Results Summary */}
                  <div style={{ marginBottom: 20 }}>
                    <SectionHead title="Results Summary" />
                    {qaLoading ? (
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading results…</div>
                    ) : qaSummary ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                          {[
                            { label: 'Total', value: qaSummary.totalResults, bg: '#f1f5f9', color: '#374151' },
                            { label: 'Pass',  value: qaSummary.passCount,    bg: '#d1fae5', color: '#065f46' },
                            { label: 'Fail',  value: qaSummary.failCount,    bg: '#fee2e2', color: '#991b1b' },
                            { label: 'OOS',   value: qaSummary.oosCount,     bg: qaSummary.oosCount > 0 ? '#fee2e2' : '#f1f5f9', color: qaSummary.oosCount > 0 ? '#dc2626' : '#9ca3af' },
                            { label: 'OOT',   value: qaSummary.ootCount,     bg: qaSummary.ootCount > 0 ? '#fef3c7' : '#f1f5f9', color: qaSummary.ootCount > 0 ? '#92400e' : '#9ca3af' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {qaSummary.openInvestigations > 0 && (
                          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                            ⚠ {qaSummary.openInvestigations} open OOS investigation{qaSummary.openInvestigations > 1 ? 's' : ''} — must be resolved before release
                          </div>
                        )}
                        {qaSummary.openInvestigations === 0 && qaSummary.oosCount === 0 && (
                          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                            ✓ No OOS/OOT flags — ready for CoA generation
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>No results data available.</div>
                    )}
                  </div>

                  {/* Test Executions (read-only for QA) */}
                  <div>
                    <SectionHead title="Test Executions" count={detail.testExecutions.length} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.testExecutions.map(e => (
                        <div key={e.executionId} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', background: '#fff' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>#{e.executionId}</span>
                              <Badge status={e.status} />
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>👤 {e.analystName} · 🔬 {e.instrumentCode}</div>
                          </div>
                          {(e.status === 'Completed' || e.status === 'OOSOpen') && (
                            <a href={`/test-execution/${e.executionId}`} style={{ padding: '5px 14px', background: '#f0fdf4', color: '#065f46', border: '1px solid #86efac', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>🔍 View Results</a>
                          )}
                        </div>
                      ))}
                      {detail.testExecutions.length === 0 && (
                        <div style={{ fontSize: 13, color: '#9ca3af' }}>No executions recorded.</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ════════════════════════════════════════════════
                  RELEASE CONTEXT
              ════════════════════════════════════════════════ */}
              {context === 'release' && (
                <>
                  {/* CoA Status */}
                  <div style={{ marginBottom: 20 }}>
                    <SectionHead title="Certificate of Analysis" />
                    {coaLoading ? (
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading CoA…</div>
                    ) : coa ? (
                      <div style={{ border: `1.5px solid ${coa.status === 'Released' ? '#86efac' : coa.status === 'Rejected' ? '#fca5a5' : '#fde68a'}`, borderRadius: 10, padding: '14px 16px', background: coa.status === 'Released' ? '#f0fdf4' : coa.status === 'Rejected' ? '#fef2f2' : '#fffbeb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{coa.coaNumber}</span>
                          <Badge status={coa.status} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 12 }}>
                          {[
                            ['Customer',      coa.customerName ?? '—'],
                            ['DO Number',     coa.doNumber ?? '—'],
                            ['Despatch Date', coa.despatchDate ?? '—'],
                            ['QA Signed By',  coa.qaSignedBy ?? 'Pending'],
                          ].map(([label, val]) => (
                            <div key={label}><span style={{ color: '#6b7280' }}>{label}: </span><strong>{val}</strong></div>
                          ))}
                        </div>
                        {coa.qaSignedAt && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                            Signed: {new Date(coa.qaSignedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                        ⚠ No CoA generated yet — complete testing and generate CoA from CoA Review tab.
                      </div>
                    )}
                  </div>

                  {/* Test executions summary */}
                  <div>
                    <SectionHead title="Test Executions" count={detail.testExecutions.length} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {detail.testExecutions.map(e => (
                        <div key={e.executionId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12 }}>
                          <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>#{e.executionId}</span>
                          <Badge status={e.status} />
                          <span style={{ color: '#6b7280' }}>👤 {e.analystName}</span>
                        </div>
                      ))}
                      {detail.testExecutions.length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>No executions.</span>}
                    </div>
                  </div>
                </>
              )}

              {/* ════════════════════════════════════════════════
                  DEFAULT CONTEXT
              ════════════════════════════════════════════════ */}
              {context === 'default' && (
                <div>
                  <SectionHead title="Test Executions" count={detail.testExecutions.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.testExecutions.map(e => (
                      <div key={e.executionId} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 14px', background: '#fff' }}>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>#{e.executionId}</span>
                        <Badge status={e.status} />
                        <span style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>👤 {e.analystName} · 🔬 {e.instrumentCode}</span>
                      </div>
                    ))}
                    {detail.testExecutions.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>No test executions.</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
