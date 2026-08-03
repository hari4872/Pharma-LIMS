import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { useTranslation } from '@/i18n/TranslationContext'
import { getErrorMessage, asApiError } from '@/utils/errors'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { fmtDate, fmtDateTime } from '@/utils/dateFormat'
import { fmtLabel } from '@/utils/formatLabel'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { MasterDetail, DetailPane } from '@/components/MasterDetail'
import { toast } from '@/components/Toast'
import SampleDetailSheet from '@/components/SampleDetailSheet'
import BatchResultEntryPage from './BatchResultEntryPage'
import DynamicFormRenderer from '@/components/DynamicFormRenderer'

interface WorkItem {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  materialId: number; lotNumber: string; analystName: string; instrumentCode: string
  status: string; priorityScore: number | null
  startedAt: string | null; completedAt: string | null
  dueDate: string | null; createdAt: string
  testLabel: string | null
  containerId: number | null; containerLabel: string | null
  containerType: string | null; containerStatus: string | null
}

interface SampleContainerOption {
  sampleContainerId: number; containerLabel: string
  containerType: string; status: string; volume: number | null; volumeUom: string | null
}

interface SampleGroup {
  sampleId: number
  sampleNumber: string
  materialName: string
  lotNumber: string
  executions: WorkItem[]
  overallStatus: string
  totalCount: number
  completedCount: number
  inProgressCount: number
  analystName: string
  minPriority: number | null
  earliestDue: string | null
  anyOverdue: boolean
}

interface ContainerGroup {
  containerId: number
  containerLabel: string
  containerType: string
  containerStatus: string
  executions: WorkItem[]
  sampleNumbers: string[]
  overallStatus: string
  analystName: string
  totalCount: number
  completedCount: number
}

interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; specTemplateId?: number }
interface Analyst { userId: number; fullName: string }
interface InstrumentOption { instrumentId: number; instrumentCode: string; instrumentName: string; status: string }

interface SpcPoint { value: number; isOos: boolean; isOot: boolean; sampleNumber: string; measuredAt: string }
interface SpcStat {
  parameterId: number; parameterName: string; unit: string | null
  n: number; mean: number; stddev: number; ucl: number; lcl: number
  usl: number | null; lsl: number | null; cp: number | null; cpk: number | null
  outOfControl: boolean; rules: string[]; points: SpcPoint[]
}

function LeveyJenningsChart({ spc }: { spc: SpcStat }) {
  const pts = spc.points
  if (pts.length < 3) return <div style={{ fontSize: 11, color: '#9ca3af', padding: '6px 0' }}>Not enough data (n={spc.n}, need ≥3)</div>
  const VW = 500, VH = 120, PL = 52, PR = 8, PT = 10, PB = 22
  const sigma = spc.stddev || 0.0001
  const refs = { ucl: spc.ucl, p2s: spc.mean + 2 * sigma, p1s: spc.mean + sigma, mean: spc.mean, n1s: spc.mean - sigma, n2s: spc.mean - 2 * sigma, lcl: spc.lcl }
  const allVals = [...pts.map(p => p.value), spc.ucl, spc.lcl]
  if (spc.usl != null) allVals.push(spc.usl)
  if (spc.lsl != null) allVals.push(spc.lsl)
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const rangeV = maxV - minV || 1
  const IW = VW - PL - PR, IH = VH - PT - PB
  const sy = (v: number) => PT + ((maxV - v) / rangeV) * IH
  const sx = (i: number) => PL + (i / Math.max(pts.length - 1, 1)) * IW
  const dotColor = (p: SpcPoint) => {
    if (p.isOos) return '#dc2626'
    const z = Math.abs(p.value - spc.mean) / sigma
    if (z > 3 || p.isOot) return '#dc2626'
    if (z > 2) return '#d97706'
    if (z > 1) return '#f59e0b'
    return '#16a34a'
  }
  const polyPts = pts.map((p, i) => `${sx(i)},${sy(p.value)}`).join(' ')
  const hline = (v: number, color: string, dash: string, w: number, key: string) => (
    <line key={key} x1={PL} x2={PL + IW} y1={sy(v)} y2={sy(v)} stroke={color} strokeWidth={w} strokeDasharray={dash} />
  )
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', maxHeight: 140, display: 'block' }}>
      {/* Zones */}
      <rect x={PL} y={PT} width={IW} height={Math.max(0, sy(refs.ucl) - PT)} fill="#fee2e2" opacity={0.35} />
      <rect x={PL} y={sy(refs.lcl)} width={IW} height={Math.max(0, VH - PB - sy(refs.lcl))} fill="#fee2e2" opacity={0.35} />
      <rect x={PL} y={sy(refs.ucl)} width={IW} height={Math.max(0, sy(refs.p2s) - sy(refs.ucl))} fill="#fef3c7" opacity={0.5} />
      <rect x={PL} y={sy(refs.n2s)} width={IW} height={Math.max(0, sy(refs.lcl) - sy(refs.n2s))} fill="#fef3c7" opacity={0.5} />
      <rect x={PL} y={sy(refs.p2s)} width={IW} height={Math.max(0, sy(refs.n2s) - sy(refs.p2s))} fill="#d1fae5" opacity={0.35} />
      {/* Reference lines */}
      {hline(refs.ucl, '#dc2626', '4,3', 1.2, 'ucl')}
      {hline(refs.p2s, '#d97706', '3,3', 0.8, 'p2s')}
      {hline(refs.mean, '#16a34a', '', 1.5, 'mean')}
      {hline(refs.n2s, '#d97706', '3,3', 0.8, 'n2s')}
      {hline(refs.lcl, '#dc2626', '4,3', 1.2, 'lcl')}
      {spc.usl != null && hline(spc.usl, '#7c3aed', '6,3', 1, 'usl')}
      {spc.lsl != null && hline(spc.lsl, '#7c3aed', '6,3', 1, 'lsl')}
      {/* Data line + points */}
      <polyline points={polyPts} fill="none" stroke="#94a3b8" strokeWidth={1} />
      {pts.map((p, i) => <circle key={i} cx={sx(i)} cy={sy(p.value)} r={3.5} fill={dotColor(p)} stroke="#fff" strokeWidth={1} />)}
      {/* Axis labels */}
      <text x={PL - 4} y={sy(refs.ucl) + 4} textAnchor="end" fontSize="9" fill="#dc2626">UCL</text>
      <text x={PL - 4} y={sy(refs.mean) + 4} textAnchor="end" fontSize="9" fill="#16a34a">μ</text>
      <text x={PL - 4} y={sy(refs.lcl) + 4} textAnchor="end" fontSize="9" fill="#dc2626">LCL</text>
      {spc.usl != null && <text x={PL - 4} y={sy(spc.usl) + 4} textAnchor="end" fontSize="9" fill="#7c3aed">USL</text>}
      {spc.lsl != null && <text x={PL - 4} y={sy(spc.lsl) + 4} textAnchor="end" fontSize="9" fill="#7c3aed">LSL</text>}
      {pts.length > 1 && <>
        <text x={PL} y={VH - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">{pts[0].sampleNumber.slice(-8)}</text>
        <text x={PL + IW} y={VH - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">{pts[pts.length - 1].sampleNumber.slice(-8)}</text>
      </>}
    </svg>
  )
}

interface AnalystLoad { userId: number; fullName: string; assigned: number; inProgress: number; overdue: number }
interface PriorityBand { band: string; count: number }
interface QueueIntelligence { labId: number; totalOpen: number; overdue: number; oosOpen: number; avgTatHours: number | null; analystLoads: AnalystLoad[]; priorityBands: PriorityBand[] }
interface WorkloadSuggestion { userId: number; fullName: string; activeCount: number; reason: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Assigned:   { bg: '#dbeafe', color: '#1e40af' },
  InProgress: { bg: '#fef9c3', color: '#854d0e' },
  Completed:  { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:    { bg: '#fee2e2', color: '#991b1b' },
}

const BAND_COLORS: Record<string, { bg: string; color: string }> = {
  Critical: { bg: '#fee2e2', color: '#991b1b' },
  High:     { bg: '#fef3c7', color: '#92400e' },
  Medium:   { bg: '#dbeafe', color: '#1e40af' },
  Low:      { bg: '#f3f4f6', color: '#374151' },
}

function priorityBadge(score: number | null): { label: string; bg: string; color: string; border: string } {
  if (score === null)  return { label: '⚪ Unset',   bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
  if (score === 1)     return { label: '🔴 URGENT',  bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
  if (score <= 10)     return { label: '🟠 HIGH',    bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
  if (score <= 50)     return { label: '🟡 MEDIUM',  bg: '#fefce8', color: '#854d0e', border: '#fde68a' }
  return                      { label: '🟢 NORMAL',  bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
}

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', border: 'none',
  borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
  background: 'transparent',
  color: active ? '#0d9488' : '#6b7280',
  fontWeight: active ? 700 : 500,
  fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', marginBottom: -2,
  transition: 'all 0.15s',
})

function groupBySample(items: WorkItem[]): SampleGroup[] {
  // Only non-container executions — split samples appear exclusively in By Container tab
  const map = new Map<number, WorkItem[]>()
  for (const item of items.filter(i => i.containerId === null)) {
    if (!map.has(item.sampleId)) map.set(item.sampleId, [])
    map.get(item.sampleId)!.push(item)
  }
  return Array.from(map.values()).map(execs => {
    const completed  = execs.filter(e => e.status === 'Completed' || e.status === 'QCVerified').length
    const inProgress = execs.filter(e => e.status === 'InProgress').length
    const hasOOS     = execs.some(e => e.status === 'OOSOpen')

    let overallStatus = 'Assigned'
    if (hasOOS)                        overallStatus = 'OOSOpen'
    else if (inProgress > 0)           overallStatus = 'InProgress'
    else if (completed === execs.length) overallStatus = 'Completed'

    const analysts   = [...new Set(execs.map(e => e.analystName).filter(Boolean))]
    const analystName = analysts.length === 0 ? '—' : analysts.length === 1 ? analysts[0] : 'Multiple'

    const priorities = execs.map(e => e.priorityScore).filter((p): p is number => p !== null)
    const minPriority = priorities.length > 0 ? Math.min(...priorities) : null

    const dues = execs.map(e => e.dueDate).filter(Boolean) as string[]
    const earliestDue = dues.length > 0 ? dues.sort()[0] : null

    const now = new Date()
    const anyOverdue = execs.some(e =>
      e.dueDate && new Date(e.dueDate) < now &&
      (e.status === 'Assigned' || e.status === 'InProgress')
    )

    return {
      sampleId: execs[0].sampleId,
      sampleNumber: execs[0].sampleNumber,
      materialName: execs[0].materialName,
      lotNumber: execs[0].lotNumber,
      executions: execs,
      overallStatus,
      totalCount: execs.length,
      completedCount: completed,
      inProgressCount: inProgress,
      analystName,
      minPriority,
      earliestDue,
      anyOverdue,
    }
  })
}

const CONTAINER_STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Available: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  InUse:     { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  Consumed:  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Destroyed: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
}

function groupByContainer(items: WorkItem[]): ContainerGroup[] {
  const linked = items.filter(i => i.containerId !== null)
  const map = new Map<number, WorkItem[]>()
  for (const item of linked) {
    const key = item.containerId!
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.values()).map(execs => {
    const completed  = execs.filter(e => e.status === 'Completed' || e.status === 'QCVerified').length
    const inProgress = execs.filter(e => e.status === 'InProgress').length
    const hasOOS     = execs.some(e => e.status === 'OOSOpen')
    let overallStatus = 'Assigned'
    if (hasOOS)                         overallStatus = 'OOSOpen'
    else if (inProgress > 0)            overallStatus = 'InProgress'
    else if (completed === execs.length) overallStatus = 'Completed'
    const analysts   = [...new Set(execs.map(e => e.analystName).filter(Boolean))]
    const analystName = analysts.length === 0 ? '—' : analysts.length === 1 ? analysts[0] : 'Multiple'
    const sampleNumbers = [...new Set(execs.map(e => e.sampleNumber))]
    return {
      containerId:     execs[0].containerId!,
      containerLabel:  execs[0].containerLabel  ?? `#${execs[0].containerId}`,
      containerType:   execs[0].containerType   ?? '—',
      containerStatus: execs[0].containerStatus ?? '—',
      executions: execs,
      sampleNumbers,
      overallStatus,
      analystName,
      totalCount: execs.length,
      completedCount: completed,
    }
  })
}

export default function WorkQueuePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [tab, setTab] = useState<'queue' | 'container' | 'batch'>('queue')
  const [data, setData] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [samples, setSamples] = useState<Sample[]>([])
  const [analysts, setAnalysts] = useState<Analyst[]>([])
  const [form, setForm] = useState({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '', containerId: '' })
  const [containers, setContainers] = useState<SampleContainerOption[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sampleSearch, setSampleSearch] = useState('')
  const [sampleDropOpen, setSampleDropOpen] = useState(false)
  const [reassignItem, setReassignItem]   = useState<WorkItem | null>(null)
  const [reassignForm, setReassignForm]   = useState({ analystId: '', instrumentId: '', priorityScore: '' })
  const [reassignSaving, setReassignSaving] = useState(false)
  const [reassignError, setReassignError]   = useState('')
  const [showAi, setShowAi]           = useState(false)
  const [aiData, setAiData]           = useState<QueueIntelligence | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<WorkloadSuggestion | null>(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [handoverOpen, setHandoverOpen]   = useState(false)
  const [handoverData, setHandoverData]   = useState<{ summary: string; generatedAt: string } | null>(null)
  const [handoverLoading, setHandoverLoading] = useState(false)
  const [scanQuery, setScanQuery]       = useState('')
  const [scanSampleIds, setScanSampleIds] = useState<Set<number> | null>(null)
  const [scanContainerIds, setScanContainerIds] = useState<Set<number> | null>(null)
  const scanInputRef                    = useRef<HTMLInputElement>(null)
  const scanBuffer                      = useRef('')
  const scanLastKey                     = useRef(0)
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<SampleGroup | null>(null)
  const [selectedContainerGroup, setSelectedContainerGroup] = useState<ContainerGroup | null>(null)
  const [fillFormSample, setFillFormSample] = useState<{ sampleId: number; sampleNumber: string } | null>(null)
  const [expandedExecId, setExpandedExecId] = useState<number | null>(null)
  const [execResults, setExecResults] = useState<Record<number, {
    parameterId: number; parameterName: string; uom: string
    rawValue: string; calculatedResult: number | null; passFail: string; isOos: boolean; isOot: boolean
  }[]>>({})
  const [spcByParam, setSpcByParam] = useState<Record<number, SpcStat>>({})
  const [spcExpandedParam, setSpcExpandedParam] = useState<number | null>(null)

  // CSV import state
  const [importExecId, setImportExecId] = useState<number | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{
    totalRows: number; matchedRows: number; skippedRows: number
    rows: { parameterName: string; rawValue: string | null; matched: boolean; passFail: string; isOos: boolean; isOot: boolean; skipReason: string | null }[]
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  const canAssign = ['Admin', 'QA', 'LabManager', 'QCLead'].includes(role)

  async function load() {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const r = await api.get(`/test-executions${params}`)
      setData(r.data)
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to load work queue'), 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [statusFilter])

  const groups = groupBySample(data)
  const containerGroups = groupByContainer(data)

  const displayGroups = scanSampleIds !== null
    ? groups.filter(g => scanSampleIds.has(g.sampleId))
    : groups

  const displayContainerGroups = scanContainerIds !== null
    ? containerGroups.filter(g => scanContainerIds.has(g.containerId))
    : containerGroups

  const runScan = useCallback((value: string) => {
    const q = value.trim().toUpperCase()
    if (!q) { setScanSampleIds(null); setScanContainerIds(null); return }

    if (tab === 'container') {
      // Container tab: accumulate — each scan adds to the selection
      const matched = data.filter(w => w.containerLabel?.toUpperCase().includes(q))
      if (matched.length > 0) {
        const newCids = matched.map(w => w.containerId).filter((id): id is number => id !== null)
        if (newCids.length === 0) {
          toast(`Container "${value.trim()}" has no assigned container ID`, 'error')
          return
        }
        setScanSampleIds(null)
        setScanContainerIds(prev => {
          const merged = new Set(prev ?? [])
          for (const id of newCids) merged.add(id)
          return merged
        })
        // Clear the input so the user can immediately scan the next barcode
        setScanQuery('')
        if (scanInputRef.current) scanInputRef.current.value = ''
      } else {
        toast(`Container "${value.trim()}" not found`, 'error')
      }
      return
    }

    if (tab === 'batch') return

    // Queue tab: match by sample number, fall back to container label (auto-switch tab)
    const matchedBySample = data.filter(w => w.sampleNumber?.toUpperCase().includes(q))
    if (matchedBySample.length > 0) {
      setScanContainerIds(null)
      setScanSampleIds(new Set(matchedBySample.map(w => w.sampleId)))
      return
    }

    const matchedByContainer = data.filter(w => w.containerLabel?.toUpperCase().includes(q))
    if (matchedByContainer.length > 0) {
      setScanSampleIds(null)
      const cids = new Set(matchedByContainer.map(w => w.containerId).filter((id): id is number => id !== null))
      setScanContainerIds(cids)
      setTab('container')
      if (cids.size === 1) {
        const [cid] = [...cids]
        const autoGroup = groupByContainer(data).find(g => g.containerId === cid)
        if (autoGroup) setSelectedContainerGroup(autoGroup)
      }
      return
    }

    toast(`No work items found for "${value.trim()}"`, 'error')
    setScanSampleIds(new Set())
    setScanContainerIds(new Set())
  }, [data, tab])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inOtherInput = ['INPUT','SELECT','TEXTAREA'].includes(target.tagName) &&
                           target.id !== 'wq-scan-input'
      if (inOtherInput) return

      const now = Date.now()
      if (now - scanLastKey.current > 80) scanBuffer.current = ''
      scanLastKey.current = now

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 3) {
          const val = scanBuffer.current
          setScanQuery(val)
          scanBuffer.current = ''
          if (scanInputRef.current) scanInputRef.current.value = val
          runScan(val)
          e.preventDefault()
        }
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runScan])

  async function toggleAi() {
    if (showAi) { setShowAi(false); return }
    setShowAi(true)
    if (aiData) return
    setAiLoading(true)
    try {
      const [qr, sr] = await Promise.all([
        api.get('/test-executions/queue-intelligence').catch(() => ({ data: null })),
        api.get('/test-executions/suggest-analyst').catch(() => ({ data: null })),
      ])
      if (qr.data === null && sr.data === null) {
        toast('Failed to load AI intelligence', 'error')
      } else {
        setAiData(qr.data)
        setAiSuggestion(sr.data)
      }
    } catch {
      toast('Failed to load AI intelligence', 'error')
    } finally { setAiLoading(false) }
  }

  async function openHandover() {
    setHandoverOpen(true)
    setHandoverLoading(true)
    try {
      const res = await api.get('/shift-handover/summary')
      setHandoverData(res.data)
    } catch {
      toast('Failed to generate shift handover summary', 'error')
      setHandoverOpen(false)
    } finally {
      setHandoverLoading(false)
    }
  }

  async function openAssign() {
    const [sr, ur, ir] = await Promise.all([
      api.get('/samples?status=PendingTesting').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: [] })),
      api.get('/instruments').catch(() => ({ data: [] })),
    ])
    setSamples(sr.data); setAnalysts(ur.data)
    setInstruments((ir.data as InstrumentOption[]).filter(i => i.status !== 'OutOfCalibration' && i.status !== 'Maintenance'))
    setContainers([])
    setForm({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '', containerId: '' })
    setShowAssign(true)
  }

  async function loadContainersForSample(sampleId: string) {
    if (!sampleId) { setContainers([]); return }
    try {
      const r = await api.get(`/samples/${sampleId}/containers?status=Available`)
      setContainers(r.data ?? [])
    } catch { setContainers([]) }
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/test-executions', {
        sampleId: Number(form.sampleId),
        analystId: Number(form.analystId),
        instrumentId: form.instrumentId ? Number(form.instrumentId) : null,
        priorityScore: form.priorityScore ? Number(form.priorityScore) : null,
        containerId: form.containerId ? Number(form.containerId) : null,
      })
      setShowAssign(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Assignment failed')) }
    finally { setSaving(false) }
  }

  async function openReassign(item: WorkItem) {
    const loads: Promise<any>[] = []
    if (analysts.length === 0) loads.push(api.get('/users').catch(() => ({ data: [] })).then(r => setAnalysts(r.data)))
    if (instruments.length === 0) loads.push(api.get('/instruments').catch(() => ({ data: [] })).then(r => setInstruments((r.data as InstrumentOption[]).filter((i: InstrumentOption) => i.status !== 'OutOfCalibration' && i.status !== 'Maintenance'))))
    await Promise.all(loads)
    setReassignItem(item)
    setReassignForm({ analystId: '', instrumentId: '', priorityScore: item.priorityScore != null ? String(item.priorityScore) : '' })
    setReassignError('')
  }

  async function submitReassign(e: React.FormEvent) {
    e.preventDefault(); setReassignSaving(true); setReassignError('')
    try {
      await api.post(`/test-executions/${reassignItem!.executionId}/assign`, {
        analystId:     Number(reassignForm.analystId),
        instrumentId:  reassignForm.instrumentId ? Number(reassignForm.instrumentId) : null,
        priorityScore: reassignForm.priorityScore ? Number(reassignForm.priorityScore) : null,
      })
      toast('Execution re-assigned successfully', 'success')
      setReassignItem(null); load()
    } catch (err) {
      const e = asApiError(err)
      const code = e.response?.data?.error
      if (code === 'TRAINING_EXPIRED') setReassignError('Analyst training expired — cannot assign (21 CFR 11.10(i))')
      else if (code === 'INSTRUMENT_OOC') setReassignError('Instrument out of calibration (21 CFR 211.68)')
      else setReassignError(getErrorMessage(err, 'Re-assign failed'))
    } finally { setReassignSaving(false) }
  }

  async function toggleExecResults(executionId: number) {
    if (expandedExecId === executionId) { setExpandedExecId(null); setSpcExpandedParam(null); return }
    setExpandedExecId(executionId)
    setSpcExpandedParam(null)
    if (execResults[executionId]) return
    try {
      const res = await api.get(`/digital-logbook?executionId=${executionId}`)
      const entries = res.data ?? []
      setExecResults(prev => ({ ...prev, [executionId]: entries }))
      // Layer 1+2: fetch SPC batch for all parameters in this execution (non-critical)
      const paramIds = entries.map((p: { parameterId: number }) => p.parameterId).join(',')
      if (paramIds) {
        api.get(`/spc/batch?parameterIds=${paramIds}&points=20`)
          .then(sr => setSpcByParam(prev => ({ ...prev, ...(sr.data as Record<string, SpcStat>) })))
          .catch(() => {})
      }
    } catch { setExecResults(prev => ({ ...prev, [executionId]: [] })) }
  }

  async function startTask(executionId: number) {
    try {
      await api.post(`/test-executions/${executionId}/start`, {})
      navigate(`/test-execution/${executionId}`)
    } catch (err) {
      const e = asApiError(err)
      const status = e.response?.status
      if (status === 403) toast('Permission denied — only Analyst, QC Lead or Admin can start tasks', 'error')
      else toast(getErrorMessage(err, 'Start failed — please try again'), 'error')
    }
  }

  function openImport(execId: number) {
    setImportExecId(execId)
    setImportResult(null)
    setTimeout(() => importFileRef.current?.click(), 50)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || importExecId === null) return
    e.target.value = ''
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/test-executions/${importExecId}/import-results`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      toast(`Imported ${res.data.matchedRows} of ${res.data.totalRows} rows`, res.data.skippedRows > 0 ? 'warning' : 'success')
      load()
    } catch (err) {
      toast(getErrorMessage(err, 'Import failed'), 'error')
      setImportExecId(null)
    } finally { setImportLoading(false) }
  }

  return (
    <div>
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === 'queue')} onClick={() => setTab('queue')}>
          <span>📋</span> {t('wq.queue')}
        </button>
        <button style={TAB_STYLE(tab === 'container')} onClick={() => setTab('container')}>
          <span>🧪</span> {t('wq.byContainer')}
          {containerGroups.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#0d9488', color: '#fff', borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>
              {containerGroups.length}
            </span>
          )}
        </button>
        <button style={TAB_STYLE(tab === 'batch')} onClick={() => setTab('batch')}>
          <span>🔬</span> {t('wq.batchEntry')}
        </button>
      </div>

      {/* ── Barcode Scan Bar (visible on Queue and Container tabs) ───────── */}
      {tab !== 'batch' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 18 }}>📷</span>
          <input
            id="wq-scan-input"
            ref={scanInputRef}
            type="text"
            placeholder={tab === 'container'
            ? 'Scan container barcode (ALQ-…) — filters this tab directly'
            : 'Scan sample barcode (LAB-ST-…) — or scan container label to switch tab'}
            value={scanQuery}
            onChange={e => setScanQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { runScan(scanQuery); e.preventDefault() } }}
            style={{
              flex: 1, border: '1px solid #cbd5e1', borderRadius: 7, padding: '7px 12px',
              fontSize: 13, fontFamily: 'monospace', outline: 'none', background: '#fff',
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => runScan(scanQuery)}
            style={{ padding: '7px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Search
          </button>
          {scanContainerIds !== null && scanContainerIds.size > 0 && (
            <span style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a',
              whiteSpace: 'nowrap',
            }}>
              🧪 {scanContainerIds.size} container{scanContainerIds.size > 1 ? 's' : ''} scanned
            </span>
          )}
          {(tab === 'container'
            ? (scanContainerIds !== null && scanContainerIds.size > 0)
            : scanSampleIds !== null
          ) && (
            <button
              onClick={() => { setScanSampleIds(null); setScanContainerIds(null); setScanQuery(''); if (scanInputRef.current) scanInputRef.current.value = '' }}
              style={{ padding: '7px 12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
          <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            Click field · scan label · Enter
          </span>
        </div>
      )}

      {tab === 'batch' && <BatchResultEntryPage />}

      {tab === 'container' && (
        <MasterDetail
          onCloseDetail={() => setSelectedContainerGroup(null)}
          detailTitle="Container Tests"
          detail={selectedContainerGroup ? (
            <DetailPane
              title={selectedContainerGroup.containerLabel}
              subtitle={`${selectedContainerGroup.containerType} · ${fmtLabel(selectedContainerGroup.containerStatus)}`}
              onClose={() => setSelectedContainerGroup(null)}
            >
              {/* Container status badge */}
              <div style={{ marginBottom: 16 }}>
                {(() => {
                  const c = CONTAINER_STATUS_COLORS[selectedContainerGroup.containerStatus] ?? { bg: '#f1f5f9', color: '#374151', border: '#e2e8f0' }
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                        🧪 {fmtLabel(selectedContainerGroup.containerStatus)}
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Type: {selectedContainerGroup.containerType}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Samples: {selectedContainerGroup.sampleNumbers.join(', ')}</span>
                    </div>
                  )
                })()}
                {/* Progress bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    {selectedContainerGroup.completedCount} of {selectedContainerGroup.totalCount} tests complete
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 6, transition: 'width 0.3s',
                      background: selectedContainerGroup.completedCount === selectedContainerGroup.totalCount ? '#10b981' : '#3b82f6',
                      width: `${selectedContainerGroup.totalCount > 0 ? (selectedContainerGroup.completedCount / selectedContainerGroup.totalCount) * 100 : 0}%`,
                    }} />
                  </div>
                </div>
              </div>

              {/* Linked executions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedContainerGroup.executions.map((exec, idx) => {
                  const sc = STATUS_COLORS[exec.status] ?? { bg: '#f3f4f6', color: '#374151' }
                  const isDone = exec.status === 'Completed' || exec.status === 'QCVerified'
                  return (
                    <div key={exec.executionId} style={{
                      border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
                      background: isDone ? '#f0fdf4' : '#fafafa',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                          {exec.testLabel ?? exec.materialName ?? `Test ${idx + 1}`}
                        </span>
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{fmtLabel(exec.status)}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>#{exec.executionId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e3a5f' }}>{exec.sampleNumber}</span>
                        {exec.analystName && <span>👤 {exec.analystName}</span>}
                        {exec.instrumentCode && <span>🔬 {exec.instrumentCode}</span>}
                        {exec.dueDate && <span>📅 {fmtDate(exec.dueDate)}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {exec.status === 'Assigned' && (
                          <button onClick={() => startTask(exec.executionId)}
                            style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            ▶ Start
                          </button>
                        )}
                        {exec.status === 'InProgress' && (
                          <>
                            <a href={`/test-execution/${exec.executionId}`}
                              style={{ padding: '4px 12px', background: '#7c3aed', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                              ✏ Enter Results
                            </a>
                            <button
                              onClick={() => openImport(exec.executionId)}
                              disabled={importLoading && importExecId === exec.executionId}
                              style={{ padding: '4px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: importLoading && importExecId === exec.executionId ? 0.6 : 1 }}>
                              {importLoading && importExecId === exec.executionId ? '⏳ Importing…' : '📂 Import CSV'}
                            </button>
                          </>
                        )}
                        {isDone && (
                          <a href={`/test-execution/${exec.executionId}`}
                            style={{ padding: '4px 12px', background: '#f0fdf4', color: '#065f46', border: '1px solid #86efac', borderRadius: 6, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                            🔍 View Results
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </DetailPane>
          ) : null}
        >
          {displayContainerGroups.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🧪</div>
              No containers linked to any test execution yet.<br />
              <span style={{ fontSize: 12 }}>Assign a task with a container to see it here.</span>
            </div>
          ) : (
            <DataTable
              loading={loading}
              data={displayContainerGroups}
              onRowClick={row => setSelectedContainerGroup(row)}
              selectedRow={selectedContainerGroup ?? undefined}
              rowStyle={row => scanContainerIds !== null && scanContainerIds.has(row.containerId)
                ? { background: '#fffbeb', outline: '2px solid #fcd34d', outlineOffset: '-2px' }
                : {}
              }
              columns={[
                { header: 'Container', accessor: r => (
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{r.containerLabel}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>{r.containerType}</span>
                    {scanContainerIds?.has(r.containerId) && <span style={{ marginLeft: 6, fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>● MATCHED</span>}
                  </div>
                )},
                { header: 'Container Status', accessor: r => {
                  const c = CONTAINER_STATUS_COLORS[r.containerStatus] ?? { bg: '#f1f5f9', color: '#374151', border: '#e2e8f0' }
                  return <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{fmtLabel(r.containerStatus)}</span>
                }},
                { header: 'Samples', accessor: r => (
                  <div>
                    {r.sampleNumbers.slice(0, 2).map(sn => (
                      <span key={sn} style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1e3a5f', marginRight: 6 }}>{sn}</span>
                    ))}
                    {r.sampleNumbers.length > 2 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{r.sampleNumbers.length - 2} more</span>}
                  </div>
                )},
                { header: 'Progress', accessor: r => (
                  <div style={{ minWidth: 100 }}>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 3, fontWeight: 600 }}>
                      {r.completedCount}/{r.totalCount} tests
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: r.completedCount === r.totalCount ? '#10b981' : '#3b82f6',
                        width: `${r.totalCount > 0 ? (r.completedCount / r.totalCount) * 100 : 0}%`,
                      }} />
                    </div>
                  </div>
                )},
                { header: 'Analyst', accessor: 'analystName' },
                { header: 'Status', accessor: r => {
                  const c = STATUS_COLORS[r.overallStatus] ?? { bg: '#f3f4f6', color: '#374151' }
                  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{fmtLabel(r.overallStatus)}</span>
                }},
              ]}
            />
          )}
        </MasterDetail>
      )}

      {tab === 'queue' && <div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        <select style={{ ...inp, width: 180, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Assigned', 'InProgress', 'Completed', 'OOSOpen'].map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
        </select>
        <button
          onClick={toggleAi}
          style={{
            padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${showAi ? '#14b8a6' : '#99f6e4'}`,
            background: showAi ? '#14b8a6' : '#f0fdfa', color: showAi ? '#fff' : '#0f766e',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          🧠 AI Intelligence
        </button>
        <button
          onClick={openHandover}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1.5px solid #c7d2fe',
            background: '#eef2ff', color: '#4338ca',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          📋 Shift Handover
        </button>
        {canAssign && (
          <button onClick={openAssign} style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + Assign Task
          </button>
        )}
      </div>

      {/* ── AI Intelligence Panel ───────────────────────────────────────── */}
      {showAi && (
        <div style={{
          background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 12,
          padding: '18px 20px', marginBottom: 18, position: 'relative',
        }}>
          <button
            onClick={() => setShowAi(false)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: 18, color: '#0f766e', cursor: 'pointer', lineHeight: 1 }}
            title="Close"
          >×</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>🧠 AI Queue Intelligence</span>
            {aiLoading && <span style={{ fontSize: 12, color: '#0d9488' }}>Loading…</span>}
            {!aiLoading && aiData && (
              <button
                onClick={() => { setAiData(null); setAiSuggestion(null); toggleAi() }}
                style={{ marginLeft: 'auto', marginRight: 28, fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >Refresh</button>
            )}
          </div>

          {aiLoading && <div style={{ color: '#0d9488', fontSize: 13, padding: '8px 0' }}>Fetching queue intelligence…</div>}

          {!aiLoading && aiData && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Open', value: String(aiData.totalOpen), alert: false },
                  { label: 'Overdue', value: String(aiData.overdue), alert: aiData.overdue > 0 },
                  { label: 'OOS Open', value: String(aiData.oosOpen), alert: aiData.oosOpen > 0 },
                  { label: 'Avg TAT (hrs)', value: aiData.avgTatHours != null ? aiData.avgTatHours.toFixed(1) : '—', alert: false },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: '#fff', border: `1.5px solid ${stat.alert ? '#fca5a5' : '#ccfbf1'}`,
                    borderRadius: 10, padding: '10px 18px', minWidth: 110, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.alert ? '#dc2626' : '#0f766e' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {aiData.analystLoads.length > 0 && (
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Analyst Loads</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#ccfbf1' }}>
                          {['Analyst', 'Assigned', 'In Progress', 'Overdue'].map(h => (
                            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: '#0f766e', fontWeight: 600, borderBottom: '1px solid #99f6e4' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {aiData.analystLoads.map(al => (
                          <tr key={al.userId} style={{ borderBottom: '1px solid #e6fffa' }}>
                            <td style={{ padding: '5px 10px', color: '#111', fontWeight: 500 }}>{al.fullName}</td>
                            <td style={{ padding: '5px 10px', color: '#374151', textAlign: 'center' }}>{al.assigned}</td>
                            <td style={{ padding: '5px 10px', color: '#92400e', textAlign: 'center' }}>{al.inProgress}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              {al.overdue > 0
                                ? <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>{al.overdue}</span>
                                : <span style={{ color: '#6b7280' }}>0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {aiData.priorityBands.length > 0 && (
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Priority Bands</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {aiData.priorityBands.map(pb => {
                        const c = BAND_COLORS[pb.band] ?? { bg: '#f3f4f6', color: '#374151' }
                        return (
                          <span key={pb.band} style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {pb.band}
                            <span style={{ background: c.color, color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{pb.count}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {aiSuggestion && (
                <div style={{ marginTop: 14, background: '#fff', border: '1.5px solid #a7f3d0', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <div>
                    <span style={{ fontWeight: 700, color: '#065f46' }}>Suggested: {aiSuggestion.fullName}</span>
                    <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>(Active: {aiSuggestion.activeCount})</span>
                    <span style={{ color: '#374151', fontSize: 13, marginLeft: 8 }}>— {aiSuggestion.reason}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Main Table (1 row per sample) ──────────────────────────────────── */}
      <MasterDetail
        onCloseDetail={() => setSelectedGroup(null)}
        detailTitle="Sample Tests"
        detail={selectedGroup ? (
          <DetailPane
            title={selectedGroup.sampleNumber}
            subtitle={`${selectedGroup.materialName} · ${selectedGroup.lotNumber}`}
            onClose={() => setSelectedGroup(null)}
            actions={
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setDetailSampleId(selectedGroup.sampleId)}
                  style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: '#374151' }}
                >
                  Sample Info
                </button>
                <button
                  onClick={() => setFillFormSample({ sampleId: selectedGroup.sampleId, sampleNumber: selectedGroup.sampleNumber })}
                  style={{ padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                >
                  📋 Monitoring Form
                </button>
              </div>
            }
          >
            {/* Progress summary */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {(() => {
                  const c = STATUS_COLORS[selectedGroup.overallStatus] ?? { bg: '#f3f4f6', color: '#374151' }
                  return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{fmtLabel(selectedGroup.overallStatus)}</span>
                })()}
                {selectedGroup.anyOverdue && <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>OVERDUE</span>}
              </div>
              {/* Progress bar */}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                {selectedGroup.completedCount} of {selectedGroup.totalCount} tests complete
              </div>
              <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6, transition: 'width 0.3s',
                  background: selectedGroup.completedCount === selectedGroup.totalCount ? '#10b981' : '#3b82f6',
                  width: `${selectedGroup.totalCount > 0 ? (selectedGroup.completedCount / selectedGroup.totalCount) * 100 : 0}%`,
                }} />
              </div>
            </div>

            {/* Individual test executions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedGroup.executions.map((exec, idx) => {
                const sc = STATUS_COLORS[exec.status] ?? { bg: '#f3f4f6', color: '#374151' }
                const isOverdue = exec.dueDate && new Date(exec.dueDate) < new Date() &&
                  (exec.status === 'Assigned' || exec.status === 'InProgress')
                const isDone = exec.status === 'Completed' || exec.status === 'QCVerified'
                const isExpanded = expandedExecId === exec.executionId
                const params = execResults[exec.executionId]
                const hasOos = params?.some(p => p.isOos)
                return (
                  <div key={exec.executionId} style={{
                    border: `1px solid ${hasOos ? '#fca5a5' : isExpanded ? '#bfdbfe' : '#e5e7eb'}`,
                    borderRadius: 8, overflow: 'hidden',
                    background: isDone ? '#f0fdf4' : '#fafafa',
                  }}>
                    {/* Header row */}
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                          {exec.testLabel ?? exec.materialName ?? `Test ${idx + 1}`}
                        </span>
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{fmtLabel(exec.status)}</span>
                        {isOverdue && <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>OVERDUE</span>}
                        {hasOos && <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>OOS</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>#{exec.executionId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                        {exec.analystName && <span>👤 {exec.analystName}</span>}
                        {exec.instrumentCode && <span>🔬 {exec.instrumentCode}</span>}
                        {exec.dueDate && <span style={{ color: isOverdue ? '#dc2626' : '#6b7280' }}>📅 {fmtDate(exec.dueDate)}</span>}
                        {exec.startedAt && <span>▶ {fmtDateTime(exec.startedAt)}</span>}
                        {exec.containerLabel && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: '#f0fdf4', color: '#065f46', border: '1px solid #6ee7b7',
                          }}>
                            🧪 {exec.containerLabel} · {exec.containerType}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {exec.status === 'Assigned' && (
                          <button onClick={() => startTask(exec.executionId)}
                            style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            ▶ Start
                          </button>
                        )}
                        {exec.status === 'InProgress' && (
                          <>
                            <a href={`/test-execution/${exec.executionId}`}
                              style={{ padding: '5px 12px', background: '#7c3aed', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                              ✏ Enter Results
                            </a>
                            <button
                              onClick={() => openImport(exec.executionId)}
                              disabled={importLoading && importExecId === exec.executionId}
                              style={{ padding: '5px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: importLoading && importExecId === exec.executionId ? 0.6 : 1 }}>
                              {importLoading && importExecId === exec.executionId ? '⏳ Importing…' : '📂 Import CSV'}
                            </button>
                          </>
                        )}
                        {(exec.status === 'Assigned' || exec.status === 'InProgress') && canAssign && (
                          <button onClick={() => openReassign(exec)}
                            style={{ padding: '5px 12px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            ↩ Re-assign
                          </button>
                        )}
                        {exec.status === 'OOSOpen' && (
                          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠ OOS Investigation</span>
                        )}
                        {isDone && (
                          <button onClick={() => toggleExecResults(exec.executionId)}
                            style={{ marginLeft: 'auto', padding: '4px 10px', background: isExpanded ? '#dbeafe' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontWeight: 600, color: isExpanded ? '#1d4ed8' : '#374151', cursor: 'pointer' }}>
                            {isExpanded ? '▲ Hide Results' : '▼ View Results'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Parameter results — expanded */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 12px', background: '#f8fafc' }}>
                        {!params ? (
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>
                        ) : params.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>No results recorded.</div>
                        ) : (
                          <>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                {['Parameter', 'Value', 'Calculated', 'Pass/Fail', 'SPC'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {params.map(p => {
                                const pfBg    = p.passFail === 'PASS' ? '#d1fae5' : p.passFail === 'FAIL' ? '#fee2e2' : '#f1f5f9'
                                const pfColor = p.passFail === 'PASS' ? '#065f46' : p.passFail === 'FAIL' ? '#991b1b' : '#374151'
                                const spc = spcByParam[p.parameterId]
                                const spcStatus = spc && spc.n >= 5
                                  ? (!spc.outOfControl ? 'ok' : spc.rules.some(r => r.includes('Rule 1')) ? 'oot' : 'trend')
                                  : null
                                const spcCfg = {
                                  ok:    { label: '✓ In Control', bg: '#d1fae5', color: '#065f46' },
                                  trend: { label: '↗ Trending',   bg: '#fef3c7', color: '#92400e' },
                                  oot:   { label: '⚠ OOT',        bg: '#fee2e2', color: '#991b1b' },
                                }
                                return (
                                  <tr key={p.parameterId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: 600, color: '#111827' }}>
                                      {p.parameterName}
                                      {p.isOos && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>OOS</span>}
                                      {p.isOot && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 4 }}>OOT</span>}
                                    </td>
                                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#374151' }}>{p.rawValue} {p.uom}</td>
                                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#6b7280' }}>{p.calculatedResult != null ? `${p.calculatedResult} ${p.uom}` : '—'}</td>
                                    <td style={{ padding: '5px 8px' }}>
                                      {p.passFail ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: pfBg, color: pfColor }}>{p.passFail}</span> : '—'}
                                    </td>
                                    <td style={{ padding: '5px 8px' }}>
                                      {spcStatus && spc ? (
                                        <button
                                          onClick={() => setSpcExpandedParam(spcExpandedParam === p.parameterId ? null : p.parameterId)}
                                          title={`n=${spc.n} · μ=${spc.mean.toFixed(3)} · σ=${spc.stddev.toFixed(3)}${spc.cpk != null ? ` · Cpk=${spc.cpk.toFixed(2)}` : ''}${spc.rules.length ? ' · ' + spc.rules.join('; ') : ''}`}
                                          style={{
                                            fontSize: 10, fontWeight: 700,
                                            background: spcExpandedParam === p.parameterId ? spcCfg[spcStatus].color : spcCfg[spcStatus].bg,
                                            color: spcExpandedParam === p.parameterId ? '#fff' : spcCfg[spcStatus].color,
                                            padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {spcCfg[spcStatus].label}
                                          {spc.cpk != null && <span style={{ marginLeft: 3, opacity: 0.85 }}>Cpk {spc.cpk.toFixed(2)}</span>}
                                        </button>
                                      ) : spc && spc.n < 5 ? (
                                        <span style={{ fontSize: 10, color: '#9ca3af' }}>n={spc.n} (need 5+)</span>
                                      ) : (
                                        <span style={{ fontSize: 10, color: '#d1d5db' }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {/* Layer 2 — Levey-Jennings chart for clicked parameter */}
                          {spcExpandedParam !== null && spcByParam[spcExpandedParam] && (() => {
                            const spc = spcByParam[spcExpandedParam]
                            const status = !spc.outOfControl ? 'ok' : spc.rules.some(r => r.includes('Rule 1')) ? 'oot' : 'trend'
                            const statusLabel = { ok: 'In Control', trend: 'Trending', oot: 'OOT — Rule Violation' }[status]
                            const statusColor = { ok: '#065f46', trend: '#92400e', oot: '#991b1b' }[status]
                            return (
                              <div style={{ marginTop: 10, border: `1px solid ${status === 'ok' ? '#86efac' : status === 'trend' ? '#fde68a' : '#fca5a5'}`, borderRadius: 8, padding: '10px 12px', background: status === 'ok' ? '#f0fdf4' : status === 'trend' ? '#fffbeb' : '#fff5f5' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>
                                    {'\u{1F4CA}'} {spc.parameterName} {'—'} Levey-Jennings
                                  </span>
                                  <span style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                                    n={spc.n} {'·'} {'μ'}={spc.mean.toFixed(3)}{spc.unit ? ` ${spc.unit}` : ''} {'·'} {'σ'}={spc.stddev.toFixed(3)}
                                    {spc.cpk != null && <> {'·'} Cpk=<b style={{ color: spc.cpk < 1.33 ? '#d97706' : '#065f46' }}>{spc.cpk.toFixed(2)}</b></>}
                                  </span>
                                  <button onClick={() => setSpcExpandedParam(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 16, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>x</button>
                                </div>
                                {spc.rules.length > 0 && (
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                    {spc.rules.map((rule, i) => (
                                      <span key={i} style={{ fontSize: 10, fontWeight: 600, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4 }}>{rule}</span>
                                    ))}
                                  </div>
                                )}
                                <LeveyJenningsChart spc={spc} />
                                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, display: 'flex', gap: 12 }}>
                                  <span style={{ color: '#dc2626', fontWeight: 700 }}>&#9679;</span> OOS/OOT
                                  <span style={{ color: '#d97706', fontWeight: 700 }}>&#9679;</span> {'±2'}{'–'}3{'σ'} zone
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>&#9679;</span> In control
                                  <span style={{ marginLeft: 'auto' }}>Last {spc.points.length} measurements</span>
                                </div>
                              </div>
                            )
                          })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </DetailPane>
        ) : null}
      >
        <DataTable
          loading={loading}
          data={displayGroups}
          onRowClick={row => setSelectedGroup(row)}
          selectedRow={selectedGroup ?? undefined}
          rowStyle={row => scanSampleIds !== null && scanSampleIds.has(row.sampleId)
            ? { background: '#fffbeb', outline: '2px solid #fcd34d', outlineOffset: '-2px' }
            : {}
          }
          columns={[
            { header: 'Sample No.', accessor: 'sampleNumber', render: r => (
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{r.sampleNumber}</span>
                {r.anyOverdue && <span style={{ marginLeft: 6, fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 8 }}>OVERDUE</span>}
                {scanSampleIds?.has(r.sampleId) && <span style={{ marginLeft: 6, fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>● MATCHED</span>}
              </div>
            )},
            { header: 'Material / Lot', accessor: r => (
              <span>{r.materialName}<br /><span style={{ fontSize: 12, color: '#6b7280' }}>{r.lotNumber}</span></span>
            )},
            { header: 'Analyst', accessor: 'analystName' },
            { header: 'Progress', accessor: r => (
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 600 }}>
                  {r.completedCount}/{r.totalCount} tests
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: r.completedCount === r.totalCount ? '#10b981' : '#3b82f6',
                    width: `${r.totalCount > 0 ? (r.completedCount / r.totalCount) * 100 : 0}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )},
            { header: 'Priority', accessor: 'minPriority', render: r => {
              const pb = priorityBadge(r.minPriority)
              return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: pb.bg, color: pb.color, border: `1px solid ${pb.border}` }}>{pb.label}</span>
            }},
            { header: 'Status', accessor: r => {
              const c = STATUS_COLORS[r.overallStatus] ?? { bg: '#f3f4f6', color: '#374151' }
              return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{fmtLabel(r.overallStatus)}</span>
            }},
            { header: 'Due', accessor: r => r.earliestDue
              ? <span style={{ color: r.anyOverdue ? '#dc2626' : '#374151' }}>{fmtDate(r.earliestDue)}</span>
              : '—'
            },
          ]}
        />
      </MasterDetail>

      {/* ── Re-assign Drawer ─────────────────────────────────────────────── */}
      {reassignItem && (
        <Drawer
          title={`Re-assign — ${reassignItem.sampleNumber}`}
          subtitle={`Execution #${reassignItem.executionId} · Training & calibration checks enforced server-side.`}
          onClose={() => setReassignItem(null)}
        >
          <form onSubmit={submitReassign}>
            <Field label="New Analyst">
              <select style={inp} value={reassignForm.analystId} onChange={e => setReassignForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Equipment / Instrument (optional)">
              <select style={inp} value={reassignForm.instrumentId} onChange={e => setReassignForm(f => ({ ...f, instrumentId: e.target.value }))}>
                <option value="">Keep current / No instrument</option>
                {instruments.map(i => (
                  <option key={i.instrumentId} value={i.instrumentId}>
                    {i.instrumentCode}{i.instrumentName ? ` — ${i.instrumentName}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority Score (optional)">
              <input style={inp} type="number" min="1" max="100" value={reassignForm.priorityScore}
                onChange={e => setReassignForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="1–100 (lower = higher priority)" />
            </Field>
            {reassignError && <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0' }}>{reassignError}</p>}
            <DrawerFooter saving={reassignSaving} onCancel={() => setReassignItem(null)} label="Re-assign" />
          </form>
        </Drawer>
      )}

      {showAssign && (
        <Drawer title="Assign Task" subtitle="WAP rules enforced: trained analyst + calibrated instrument + capacity check server-side." onClose={() => setShowAssign(false)}>
          <form onSubmit={submitAssign}>
            <Field label="Sample (PendingTesting)">
              {/* Custom sample picker — shows product name + lot clearly */}
              <div style={{ position: 'relative' }}>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => { setSampleDropOpen(o => !o); setSampleSearch('') }}
                  style={{
                    ...inp, width: '100%', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#fff', marginTop: 0,
                  }}
                >
                  {form.sampleId
                    ? (() => {
                        const s = samples.find(s => String(s.sampleId) === form.sampleId)
                        return s
                          ? <span><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{s.sampleNumber}</span><span style={{ color: '#6b7280', marginLeft: 8 }}>{s.materialName}</span></span>
                          : 'Select sample…'
                      })()
                    : <span style={{ color: '#9ca3af' }}>Select sample…</span>
                  }
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>▼</span>
                </button>

                {sampleDropOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 2,
                  }}>
                    {/* Search */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by sample no. or product…"
                        value={sampleSearch}
                        onChange={e => setSampleSearch(e.target.value)}
                        style={{
                          width: '100%', border: '1px solid #e2e8f0', borderRadius: 6,
                          padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {/* List */}
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {samples
                        .filter(s => {
                          const q = sampleSearch.toLowerCase()
                          return !q ||
                            s.sampleNumber.toLowerCase().includes(q) ||
                            s.materialName.toLowerCase().includes(q) ||
                            s.lotNumber.toLowerCase().includes(q)
                        })
                        .map(s => (
                          <div
                            key={s.sampleId}
                            onClick={() => {
                              setForm(f => ({ ...f, sampleId: String(s.sampleId), containerId: '' }))
                              setSampleDropOpen(false)
                              loadContainersForSample(String(s.sampleId))
                            }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: String(s.sampleId) === form.sampleId ? '#f0fdf4' : '#fff',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.background = String(s.sampleId) === form.sampleId ? '#f0fdf4' : '#fff')}
                          >
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>
                              {s.sampleNumber}
                            </div>
                            <div style={{ fontSize: 13, color: '#111827', marginTop: 2 }}>
                              {s.materialName}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                              Lot: {s.lotNumber}
                            </div>
                          </div>
                        ))
                      }
                      {samples.filter(s => {
                        const q = sampleSearch.toLowerCase()
                        return !q || s.sampleNumber.toLowerCase().includes(q) || s.materialName.toLowerCase().includes(q) || s.lotNumber.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                          No samples found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Hidden required input for form validation */}
              <input type="hidden" value={form.sampleId} required />
            </Field>
            <Field label="Analyst">
              <select style={inp} value={form.analystId} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Equipment / Instrument (optional)">
              <select style={inp} value={form.instrumentId} onChange={e => setForm(f => ({ ...f, instrumentId: e.target.value }))}>
                <option value="">No instrument selected</option>
                {instruments.map(i => (
                  <option key={i.instrumentId} value={i.instrumentId}>
                    {i.instrumentCode}{i.instrumentName ? ` — ${i.instrumentName}` : ''}
                  </option>
                ))}
              </select>
              {instruments.length === 0 && (
                <p style={{ fontSize: 11, color: '#f59e0b', margin: '4px 0 0' }}>
                  No calibrated instruments available
                </p>
              )}
            </Field>
            <Field label="Priority Score (lower = higher priority)">
              <input style={inp} type="number" min="1" max="100" value={form.priorityScore} onChange={e => setForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="e.g. 1 (urgent)" />
            </Field>
            <Field label="Container (optional)">
              {!form.sampleId ? (
                <div style={{ ...inp, color: '#9ca3af', background: '#f9fafb', cursor: 'not-allowed' }}>Select a sample first…</div>
              ) : containers.length === 0 ? (
                <div style={{ ...inp, color: '#9ca3af', background: '#f9fafb' }}>No available containers for this sample</div>
              ) : (
                <select style={inp} value={form.containerId} onChange={e => setForm(f => ({ ...f, containerId: e.target.value }))}>
                  <option value="">No container (unlinked)</option>
                  {containers.map(c => (
                    <option key={c.sampleContainerId} value={c.sampleContainerId}>
                      {c.containerLabel} · {c.containerType}{c.volume ? ` · ${c.volume} ${c.volumeUom ?? ''}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowAssign(false)} label="Assign" />
          </form>
        </Drawer>
      )}

      {detailSampleId !== null && (
        <SampleDetailSheet
          sampleId={detailSampleId}
          onClose={() => setDetailSampleId(null)}
          onStartTask={startTask}
          context="workqueue"
        />
      )}

      {/* ── Shift Handover Drawer ─────────────────────────────────────────── */}
      {handoverOpen && (
        <Drawer title="Shift Handover Report" subtitle="AI-generated summary · Read-only · Print for physical handover record." width={540} onClose={() => setHandoverOpen(false)}>
          {handoverLoading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#4338ca', fontSize: 14 }}>
              Generating AI shift handover summary…
            </div>
          )}
          {!handoverLoading && handoverData && (
            <>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Generated at: {fmtDateTime(handoverData.generatedAt)}</p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
                <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#1e293b' }}>
                  {handoverData.summary}
                </pre>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => window.print()}
                  style={{ padding: '9px 18px', background: '#4338ca', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >🖨 Print / Save</button>
                <button
                  onClick={() => setHandoverOpen(false)}
                  style={{ padding: '9px 18px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >Close</button>
              </div>
            </>
          )}
        </Drawer>
      )}
    </div>}

    {/* ── Monitoring Form Drawer ─────────────────────────────────────────── */}
    {fillFormSample && (
      <DynamicFormRenderer
        sampleId={fillFormSample.sampleId}
        sampleNumber={fillFormSample.sampleNumber}
        onClose={() => setFillFormSample(null)}
        onSubmitted={() => { setFillFormSample(null); load() }}
      />
    )}

    {/* ── Hidden CSV file input ─────────────────────────────────────────── */}
    <input
      ref={importFileRef}
      type="file"
      accept=".csv,text/csv"
      style={{ display: 'none' }}
      onChange={handleImportFile}
    />

    {/* ── CSV Import Result Modal ───────────────────────────────────────── */}
    {importResult && importExecId !== null && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📂</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>CSV Import — Execution #{importExecId}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {importResult.matchedRows} matched · {importResult.skippedRows} skipped · {importResult.totalRows} total rows
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {importResult.matchedRows > 0 && (
                <span style={{ padding: '3px 10px', background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  ✓ {importResult.matchedRows} Imported
                </span>
              )}
              {importResult.skippedRows > 0 && (
                <span style={{ padding: '3px 10px', background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  ⚠ {importResult.skippedRows} Skipped
                </span>
              )}
            </div>
          </div>

          {/* Result table */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Parameter', 'Raw Value', 'Pass/Fail', 'OOS', 'OOT', 'Note'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importResult.rows.map((row, i) => {
                  const pfBg    = row.matched ? (row.passFail === 'PASS' ? '#d1fae5' : row.passFail === 'FAIL' ? '#fee2e2' : '#f1f5f9') : '#fef3c7'
                  const pfColor = row.matched ? (row.passFail === 'PASS' ? '#065f46' : row.passFail === 'FAIL' ? '#991b1b' : '#374151') : '#92400e'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: !row.matched ? '#fffbeb' : undefined }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#374151' }}>{row.parameterName}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1e293b' }}>{row.rawValue ?? '—'}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: pfBg, color: pfColor }}>
                          {row.matched ? row.passFail : 'SKIP'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', color: row.isOos ? '#dc2626' : '#9ca3af', fontWeight: row.isOos ? 700 : 400 }}>{row.isOos ? '⚠ YES' : '—'}</td>
                      <td style={{ padding: '7px 10px', color: row.isOot ? '#d97706' : '#9ca3af', fontWeight: row.isOot ? 700 : 400 }}>{row.isOot ? '⚠ YES' : '—'}</td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>{row.skipReason ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setImportExecId(null); setImportResult(null) }}
              style={{ padding: '9px 20px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >Close</button>
            <button
              onClick={() => {
                setImportResult(null)
                setTimeout(() => importFileRef.current?.click(), 50)
              }}
              style={{ padding: '9px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >📂 Import Another File</button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
