import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useESignConfig } from '@/hooks/useESignConfig'
import { useLabConfig } from '@/hooks/useLabConfig'
import { getErrorMessage, asApiError } from '@/utils/errors'
import Barcode from 'react-barcode'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { fmtDate } from '@/utils/dateFormat'
import { fmtLabel } from '@/utils/formatLabel'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { MasterDetail, DetailPane } from '@/components/MasterDetail'
import { toast } from '@/components/Toast'
import SampleDetailSheet, { type SampleDetailExtraInfo } from '@/components/SampleDetailSheet'
import BatchSampleRegistrationPage from './BatchSampleRegistrationPage'
import DynamicFormRenderer from '@/components/DynamicFormRenderer'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Sample {
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  sampleType: string; status: string; barcodePrinted: boolean; dueDate: string
  analystName: string; createdAt: string; isRush?: boolean
  sampleCondition?: string; specTemplateName?: string; testsAutoCreated?: number; srfSigned?: boolean
  // Extended fields returned by API (not in all endpoints)
  formTemplateName?: string | null
  isCheckpointLinked?: boolean
  checkpointCount?: number
  specVersion?: string | null
  specStage?: string | null
}
interface Parameter  { parameterId: number; parameterName: string; uom: string }
interface Material   { materialId: number; materialName: string; productType: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string; stage: string }
// Container management
interface SampleContainer {
  sampleContainerId: number; containerLabel: string; containerType: string
  volume: number | null; volumeUom: string | null; status: string
  createdBy: string; createdAt: string; destroyedAt: string | null
}

// Phase A — spec match preview
interface SpecCandidate { templateId: number; templateName: string; version: string; approvedAt: string; testCount: number }
interface SpecPreview {
  outcome:    'SingleMatch' | 'MultipleMatches' | 'NoMatch' | 'DraftOnly' | 'ObsoleteOnly'
  templateId: number | null
  candidates: SpecCandidate[]
  message:    string
}

// Post-registration wizard
interface WizardSample {
  sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; sampleTypeName: string; registeredAt: string; testsCreated: number
}
interface WizardSpecTest {
  id: string; name: string; code: string; turnaroundHours: number; isMandatory: boolean
}
interface WizardAssignment {
  containerId: number | null; containerLabel: string; analystId: string; instrumentId: string
  tests: WizardSpecTest[]
}
interface AnalystOption  { userId: number; fullName: string }
interface InstrumentOption { instrumentId: number; instrumentCode: string; instrumentName: string; instrumentType: string; status: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
}

interface PrintSample {
  sampleNumber: string
  materialName: string
  lotNumber: string
  sampleTypeName: string
  registeredAt: string   // YYYY-MM-DD
  testsCreated: number
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ num, title, subtitle, children }: {
  num: number; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '24px 28px', marginBottom: 16
    }}>
      <div style={{ marginBottom: subtitle ? 16 : 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
          {num} · {title}
        </h3>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Label style ───────────────────────────────────────────────────────────────
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
  color: '#6b7280', textTransform: 'uppercase', marginBottom: 6
}

// ── Main page ─────────────────────────────────────────────────────────────────
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

export default function SampleRegistrationPage() {
  const { fullName, labId, role } = useSelector((s: RootState) => s.auth)
  const canRegister = ['Admin', 'LabManager', 'Analyst'].includes(role ?? '')
  const [tab, setTab] = useState<'single' | 'batch'>('single')

  const [data, setData]               = useState<Sample[]>([])
  const [materials, setMaterials]     = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [specTemplateLinks, setSpecTemplateLinks] = useState<{ materialId: number; sampleTypeId: number }[]>([])
  const [loading, setLoading]         = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [showReprint,  setShowReprint]  = useState<number | null>(null)
  const [showRetest,     setShowRetest]     = useState<Sample | null>(null)
  const [retestReason,   setRetestReason]   = useState('')
  const [retestSaving,   setRetestSaving]   = useState(false)
  const [testedParams,   setTestedParams]   = useState<{ parameterId: number; parameterName: string; uom: string; isOos: boolean; isOot: boolean; lastValue: string }[]>([])
  const [selectedParams, setSelectedParams] = useState<number[]>([])
  const [showAddTest,   setShowAddTest]   = useState<Sample | null>(null)
  const [adHocParams,   setAdHocParams]   = useState<Parameter[]>([])
  const [adHocParamId,  setAdHocParamId]  = useState('')
  const [adHocReason,   setAdHocReason]   = useState('')
  const [adHocSaving,   setAdHocSaving]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [error, setError]             = useState('')
  const [reprintReason, setReprintReason] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [materialId, setMaterialId]       = useState('')
  const [sampleTypeId, setSampleTypeId]   = useState('')
  const [tankSourceId, setTankSourceId]   = useState('')
  const [sampleLabel, setSampleLabel]     = useState('')
  const [lotNumber, setLotNumber]         = useState('')
  const [mfgDate, setMfgDate]             = useState('')
  const [expDate, setExpDate]             = useState('')
  // Phase A — receipt fields
  const [receivedTemp,   setReceivedTemp]   = useState('')
  const [sampleCondition, setSampleCondition] = useState('OK')
  const [isRush,         setIsRush]         = useState(false)
  const [externalBatchId, setExternalBatchId] = useState('')
  // Phase A — spec engine
  const [specPreview,   setSpecPreview]   = useState<SpecPreview | null>(null)
  const [specLoading,   setSpecLoading]   = useState(false)
  const [overrideSpecId, setOverrideSpecId] = useState<number | null>(null)
  const [, setLastSpecResult] = useState<{ outcome: string; message: string; testsCreated: number } | null>(null)

  // E-sign config for SRF step
  const { method: srfMethod } = useESignConfig('SampleRegistration.Submit')
  const { value: skipScheduleRaw } = useLabConfig(labId, 'skip_schedule_step', 'false')
  const skipSchedule = skipScheduleRaw === 'true'

  // Post-registration wizard state
  const [wizard, setWizard]               = useState<WizardSample | null>(null)
  const [wizardStep, setWizardStep]       = useState<1|2|3|4|5>(1)
  const [_wizardSplitDone, setWizardSplitDone]   = useState(false)
  const [wizardContainers, setWizardContainers] = useState<SampleContainer[]>([])
  const [wizardSplitting, setWizardSplitting]   = useState(false)
  // Drag-and-drop spec test grouping
  const [wizardSpecTests, setWizardSpecTests]     = useState<WizardSpecTest[]>([])
  const [wizardSpecLoading, setWizardSpecLoading] = useState(false)
  const [wizardTestGroups, setWizardTestGroups]   = useState<string[][]>([[], []])
  const [wizardDragItem, setWizardDragItem]       = useState<string | null>(null)
  const [wizardDragOverGroup, setWizardDragOverGroup] = useState<number | null>(null)
  const [wizardAssignments, setWizardAssignments] = useState<WizardAssignment[]>([])
  const [wizardAnalysts, setWizardAnalysts]       = useState<AnalystOption[]>([])
  const [wizardInstruments, setWizardInstruments] = useState<InstrumentOption[]>([])
  const [wizardAssigning, setWizardAssigning]     = useState(false)
  const [wizardAssignError, setWizardAssignError] = useState('')
  const [wizardActiveTab, setWizardActiveTab]     = useState(0)
  const [wizardSrfToggle, setWizardSrfToggle]     = useState(false)
  const [wizardESign, setWizardESign]             = useState({ password: '', meaning: '', reason: '' })
  const [wizardSigning, setWizardSigning]         = useState(false)
  const [wizardSignError, setWizardSignError]     = useState('')

  // Wizard Step 4 — Schedule (capacity booking linked to assigned instruments)
  interface WizardScheduleRow { containerId: number | null; containerLabel: string; instrumentId: string; instrumentCode: string; startDate: string; startTime: string; endDate: string; endTime: string }
  const [wizardScheduleRows, setWizardScheduleRows]       = useState<WizardScheduleRow[]>([])
  const [wizardScheduleBooking, setWizardScheduleBooking] = useState(false)
  const [wizardScheduleError, setWizardScheduleError]     = useState('')

  // Container management state
  const [containerSample, setContainerSample] = useState<Sample | null>(null)
  const [containers, setContainers]           = useState<SampleContainer[]>([])
  const [containersLoading, setContainersLoading] = useState(false)
  const [splitForm, setSplitForm]             = useState({ count: '3', containerType: 'Aliquot', volumePerContainer: '', volumeUom: '' })
  const [splitSaving, setSplitSaving]         = useState(false)
  const [destroyingId, setDestroyingId]       = useState<number | null>(null)
  const [destroyForm, setDestroyForm]         = useState({ password: '', reason: '' })
  const [destroyError, setDestroyError]       = useState('')
  const [printSample, setPrintSample]         = useState<PrintSample | null>(null)
  const [printContainer, setPrintContainer]   = useState<SampleContainer | null>(null)
  const containerLabelRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [detailExtraInfo, setDetailExtraInfo] = useState<SampleDetailExtraInfo | undefined>(undefined)
  // Master-detail selection
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null)
  const [fillFormSample, setFillFormSample] = useState<Sample | null>(null)
  const [moreMenuRow,   setMoreMenuRow]    = useState<number | null>(null)

  async function loadContainers(sampleId: number) {
    setContainersLoading(true)
    try { const r = await api.get(`/samples/${sampleId}/containers`); setContainers(r.data) }
    catch { setContainers([]) }
    finally { setContainersLoading(false) }
  }

  async function submitSplit(e: React.FormEvent) {
    e.preventDefault(); setSplitSaving(true)
    try {
      const r = await api.post(`/samples/${containerSample!.sampleId}/containers`, {
        count: Number(splitForm.count),
        containerType: splitForm.containerType,
        volumePerContainer: splitForm.volumePerContainer ? Number(splitForm.volumePerContainer) : null,
        volumeUom: splitForm.volumeUom || null,
      })
      toast(`${r.data.count} containers created`, 'success')
      setSplitForm({ count: '3', containerType: 'Aliquot', volumePerContainer: '', volumeUom: '' })
      loadContainers(containerSample!.sampleId)
    } catch (err) { toast(getErrorMessage(err, 'Split failed'), 'error') }
    finally { setSplitSaving(false) }
  }

  async function submitDestroy(containerId: number) {
    setDestroyError('')
    try {
      await api.post(`/samples/${containerSample!.sampleId}/containers/${containerId}/destroy`, destroyForm)
      toast('Container destroyed', 'success')
      setDestroyingId(null); setDestroyForm({ password: '', reason: '' })
      loadContainers(containerSample!.sampleId)
    } catch (err) {
      const e = asApiError(err)
      const msg = getErrorMessage(err, 'Destroy failed')
      if (e.response?.data?.error === 'ESIGN_AUTH_FAILED') setDestroyError('Password incorrect (21 CFR Part 11)')
      else setDestroyError(msg)
    }
  }

  // ── Wizard functions ──────────────────────────────────────────────────────────
  function openWizard(result: { sampleId: number; sampleNumber: string; testsAutoCreated: number }, mat: Material | undefined, st: SampleType | undefined, lot: string) {
    setWizard({ sampleId: result.sampleId, sampleNumber: result.sampleNumber, materialName: mat?.materialName ?? '', lotNumber: lot, sampleTypeName: st?.typeName ?? '', registeredAt: new Date().toISOString().slice(0, 10), testsCreated: result.testsAutoCreated })
    setWizardStep(1); setWizardSplitDone(false); setWizardContainers([])
    setWizardSpecTests([]); setWizardTestGroups([[], []]); setWizardSpecLoading(true)
    setWizardAssignments([]); setWizardActiveTab(0); setWizardSrfToggle(srfMethod !== 'None')
    setWizardESign({ password: '', meaning: '', reason: '' })
    setWizardSignError(''); setWizardAssignError('')
    if (wizardAnalysts.length === 0) api.get('/users').then(r => setWizardAnalysts(r.data)).catch(() => {})
    if (wizardInstruments.length === 0) api.get('/instruments').then(r => setWizardInstruments((r.data as InstrumentOption[]).filter(i => i.status === 'Available'))).catch(() => {})
    // Fetch spec template tests for the drag-and-drop pool
    // Note: /specification-templates/{id} can 500 on prod — use list endpoint and filter instead
    api.get(`/samples/${result.sampleId}/spec-assignment`)
      .then(r => r.data.specTemplateId
        ? api.get('/specification-templates').then(listResp => {
            const match = (listResp.data as Array<{ specTemplateId: number; items?: unknown[] }>)
              .find(t => t.specTemplateId === r.data.specTemplateId)
            return { data: match ?? { items: [] } }
          })
        : Promise.resolve({ data: { items: [] } }))
      .then(r => {
        const items = (r.data.items ?? []) as Array<{ specTemplateItemId: number; parameterName: string; parameterCode: string; turnaroundHours: number; isMandatory: boolean }>
        setWizardSpecTests(items.map(it => ({ id: String(it.specTemplateItemId), name: it.parameterName, code: it.parameterCode ?? '', turnaroundHours: it.turnaroundHours ?? 24, isMandatory: it.isMandatory ?? false })))
      })
      .catch(err => toast(getErrorMessage(err, 'Could not load spec template tests'), 'error'))
      .finally(() => setWizardSpecLoading(false))
  }

  // Called when analyst confirms the test grouping and clicks "Next — Assign Analysts"
  async function wizardConfirmGroups() {
    setWizardSplitting(true)
    try {
      const nonEmpty = wizardTestGroups.filter(g => g.length > 0)
      // When no spec tests, create all defined groups (even empty); otherwise only non-empty groups
      const count = wizardSpecTests.length === 0 ? wizardTestGroups.length : nonEmpty.length
      const r = await api.post(`/samples/${wizard!.sampleId}/containers`, { count, containerType: 'QC' })
      toast(`${r.data.count} QC containers created`, 'success')
      const cr = await api.get(`/samples/${wizard!.sampleId}/containers`)
      const created: SampleContainer[] = cr.data
      setWizardContainers(created); setWizardSplitDone(true)
      wizardGoToAssign(created, nonEmpty)
    } catch (err) { toast(getErrorMessage(err, 'Split failed'), 'error') }
    finally { setWizardSplitting(false) }
  }

  function wizardGoToAssign(containers: SampleContainer[], groups?: string[][]) {
    const rows: WizardAssignment[] = containers.length > 0
      ? containers.map((c, i) => ({
          containerId: c.sampleContainerId,
          containerLabel: c.containerLabel,
          analystId: '',
          instrumentId: '',
          tests: (groups?.[i] ?? []).map(tid => wizardSpecTests.find(t => t.id === tid)).filter(Boolean) as WizardSpecTest[],
        }))
      : [{ containerId: null, containerLabel: wizard!.sampleNumber, analystId: '', instrumentId: '', tests: wizardSpecTests }]
    setWizardAssignments(rows); setWizardAssignError(''); setWizardStep(srfMethod !== 'None' ? 2 : 3)
  }

  // Drag-and-drop helpers
  function wizardDropTest(groupIndex: number) {
    if (!wizardDragItem) return
    const tid = wizardDragItem
    setWizardTestGroups(prev => {
      const next = prev.map(g => g.filter(t => t !== tid))
      next[groupIndex] = [...next[groupIndex], tid]
      return next
    })
    setWizardDragItem(null); setWizardDragOverGroup(null)
  }

  function wizardRemoveTestFromGroup(groupIndex: number, tid: string) {
    setWizardTestGroups(prev => prev.map((g, i) => i === groupIndex ? g.filter(t => t !== tid) : g))
  }

  function wizardAddGroup() {
    if (wizardTestGroups.length >= 6) return
    setWizardTestGroups(prev => [...prev, []])
  }

  function wizardRemoveGroup(groupIndex: number) {
    if (wizardTestGroups.length <= 1) return
    setWizardTestGroups(prev => prev.filter((_, i) => i !== groupIndex))
  }

  async function wizardConfirmAssignments() {
    if (wizardAssignments.some(a => !a.analystId)) { setWizardAssignError('Select an analyst for every row.'); return }
    setWizardAssigning(true); setWizardAssignError('')
    try {
      for (const a of wizardAssignments) {
        // Send the spec template item IDs for this container so the backend only updates
        // the targeted executions — each container gets its own analyst row in the work queue.
        const specTemplateItemIds = a.tests.length > 0
          ? a.tests.map(t => parseInt(t.id))
          : null
        try {
          await api.post('/test-executions', {
            sampleId: wizard!.sampleId,
            analystId: Number(a.analystId),
            instrumentId: a.instrumentId ? Number(a.instrumentId) : null,
            containerId: a.containerId,
            specTemplateItemIds,
          })
        } catch (innerErr) {
          const d = (innerErr as any)?.response?.data
          if (d?.error === 'INVALID_STATE' && typeof d?.message === 'string') {
            if (d.message.includes('InTesting')) break   // all executions already assigned → stop
            if (d.message.includes('InUse')) continue    // this container already assigned → skip to next
          }
          throw innerErr
        }
      }
      // Build schedule rows from assignments that have an instrument selected
      const schedRows = wizardAssignments
        .filter(a => a.instrumentId)
        .map(a => {
          const inst = wizardInstruments.find(i => String(i.instrumentId) === a.instrumentId)
          return {
            containerId: a.containerId,
            containerLabel: a.containerLabel,
            instrumentId: a.instrumentId,
            instrumentCode: inst ? `${inst.instrumentCode} — ${inst.instrumentName || inst.instrumentType}` : a.instrumentId,
            startDate: '', startTime: '', endDate: '', endTime: '',
          }
        })
      setWizardScheduleRows(schedRows)
      setWizardScheduleError('')
      setWizardStep(skipSchedule ? 5 : 4)
    } catch (err) { setWizardAssignError(getErrorMessage(err, 'Assignment failed')) }
    finally { setWizardAssigning(false) }
  }

  async function wizardConfirmSchedule() {
    setWizardScheduleBooking(true); setWizardScheduleError('')
    const skipped: string[] = []
    try {
      const rowsToBook = wizardScheduleRows.filter(r => r.instrumentId && r.startDate && r.startTime && r.endDate && r.endTime)
      for (const row of rowsToBook) {
        try {
          await api.post('/capacity-bookings', {
            instrumentId: Number(row.instrumentId),
            startTime: new Date(`${row.startDate}T${row.startTime}:00`).toISOString(),
            endTime:   new Date(`${row.endDate}T${row.endTime}:00`).toISOString(),
            notes: row.containerLabel,
          })
        } catch (err) {
          // Conflict on one slot — record it as a warning but continue
          skipped.push(getErrorMessage(err, `${row.containerLabel ?? 'slot'} booking failed`))
        }
      }
    } finally { setWizardScheduleBooking(false) }
    if (skipped.length > 0) setWizardScheduleError(`⚠ Some slots skipped (book later in Capacity Booking): ${skipped.join(' · ')}`)
    setWizardStep(5)
  }

  async function wizardFinish() {
    if (wizardSrfToggle) {
      if (srfMethod !== 'SignatureOnly' && !wizardESign.password) { setWizardSignError('Password is required.'); return }
      setWizardSigning(true); setWizardSignError('')
      try {
        await api.post(`/samples/${wizard!.sampleId}/sign-srf`, { password: wizardESign.password, meaning: wizardESign.meaning, reason: wizardESign.reason })
        toast('SRF signed', 'success')
      } catch (err) {
        const e = asApiError(err)
        setWizardSignError(e.response?.data?.error === 'ESIGN_AUTH_FAILED' ? 'Password incorrect (21 CFR Part 11)' : getErrorMessage(err, 'SRF sign failed'))
        setWizardSigning(false); return
      } finally { setWizardSigning(false) }
    }
    setWizardStep(3)
  }

  async function wizardClose() {
    const sn = wizard?.sampleNumber
    const sid = wizard?.sampleId
    try {
      if (sid) await api.post(`/samples/${sid}/start-testing`)
    } catch { /* non-critical — status update best-effort */ }
    setWizard(null)
    toast(`${sn} setup complete — status changed to In Testing`, 'success')
    load()
  }

  function wizardDismiss() {
    setWizard(null)
    load()
  }

  function wizardPrintAll(_sampleNumber: string, _containers: SampleContainer[]) {
    const style = document.createElement('style')
    style.id = 'lims-wizard-print'
    style.textContent = `@media print { body > * { visibility: hidden !important; } #lims-wizard-barcodes, #lims-wizard-barcodes * { visibility: visible !important; } #lims-wizard-barcodes { position: fixed !important; top: 0; left: 0; width: 100%; background: white; } }`
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }


  // ── Post-registration spec assignment ──────────────────────────────────────
  interface SpecAssignData {
    sampleId: number; sampleNumber: string
    specTemplateId: number | null; specTemplateName: string | null
    specAssignedBy: string | null; specAssignedAt: string | null
    testsCreated: number; matchOutcome: string
    candidates: SpecCandidate[]
  }

  const [showAssignSpec, setShowAssignSpec]   = useState<number | null>(null)
  const [specAssignData, setSpecAssignData]   = useState<SpecAssignData | null>(null)
  const [specAssignLoading, setSpecAssignLoading] = useState(false)
  const [selectedNewSpecId, setSelectedNewSpecId] = useState<number | null>(null)
  const [assignError, setAssignError]         = useState('')
  const [assignSaving, setAssignSaving]       = useState(false)

  async function openAssignSpec(sampleId: number) {
    setShowAssignSpec(sampleId); setSpecAssignData(null)
    setSelectedNewSpecId(null); setAssignError('')
    setSpecAssignLoading(true)
    try {
      const r = await api.get(`/samples/${sampleId}/spec-assignment`)
      setSpecAssignData(r.data)
      if (r.data.candidates?.length === 1) setSelectedNewSpecId(r.data.candidates[0].templateId)
    } catch (err) { setAssignError(getErrorMessage(err, 'Failed to load spec candidates')) }
    finally { setSpecAssignLoading(false) }
  }

  async function submitAssignSpec(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedNewSpecId) { setAssignError('Please select a specification template.'); return }
    setAssignSaving(true); setAssignError('')
    try {
      const r = await api.post(`/samples/${showAssignSpec}/apply-spec`, { specTemplateId: selectedNewSpecId })
      toast(`✓ Spec assigned — ${r.data.testsCreated} test(s) created`, 'success')
      setShowAssignSpec(null); load()
    } catch (err) { setAssignError(getErrorMessage(err, 'Assignment failed')) }
    finally { setAssignSaving(false) }
  }

  // ── Load master data ────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const [r, mr, str] = await Promise.all([
        api.get(`/samples${params}`),
        api.get('/materials'),
        api.get('/sample-types'),
      ])
      setData(r.data)
      setMaterials(mr.data)
      setSampleTypes(str.data.filter((t: SampleType) => t.typeCode !== 'DSPQC'))
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to load sample data'), 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [statusFilter])

  // Load spec template links once — materialId → sampleTypeId mappings for auto-select
  useEffect(() => {
    api.get('/specification-templates')
      .then(r => setSpecTemplateLinks(r.data.map((t: any) => ({
        materialId: t.material.materialId,
        sampleTypeId: t.sampleType.sampleTypeId,
      }))))
      .catch(() => {})
  }, [])

  // ── Phase A: spec engine preview ─────────────────────────────────────────
  const fetchSpecPreview = useCallback(async (matId: string, stId: string) => {
    if (!matId || !stId) { setSpecPreview(null); return }
    const st = sampleTypes.find(t => t.sampleTypeId === Number(stId))
    if (!st) return
    setSpecLoading(true)
    try {
      const res = await api.get(`/specification-templates/match?materialId=${matId}&sampleTypeId=${stId}&stage=${st.stage}`)
      setSpecPreview(res.data)
      // Auto-select if single match
      if (res.data.outcome === 'SingleMatch') setOverrideSpecId(null)
    } catch {
      setSpecPreview(null)
    } finally { setSpecLoading(false) }
  }, [sampleTypes])

  useEffect(() => {
    const t = setTimeout(() => { setSpecPreview(null); setOverrideSpecId(null); if (materialId && sampleTypeId) fetchSpecPreview(materialId, sampleTypeId) }, 0)
    return () => clearTimeout(t)
  }, [materialId, sampleTypeId])

  // Checkpoints removed from sample registration — always send empty array

  // Filter sample types to those with spec templates for the selected material
  const validSampleTypes = useMemo(() => {
    if (!materialId || !specTemplateLinks.length) return sampleTypes
    const validIds = new Set(specTemplateLinks.filter(l => l.materialId === Number(materialId)).map(l => l.sampleTypeId))
    if (!validIds.size) return sampleTypes // no templates configured → show all
    return sampleTypes.filter(t => validIds.has(t.sampleTypeId))
  }, [materialId, specTemplateLinks, sampleTypes])

  // When material changes: reset sample type, then auto-select if exactly one valid option
  useEffect(() => {
    setSampleTypeId('')
    if (!materialId || !specTemplateLinks.length || !sampleTypes.length) return
    const validIds = new Set(specTemplateLinks.filter(l => l.materialId === Number(materialId)).map(l => l.sampleTypeId))
    if (!validIds.size) return
    const valid = sampleTypes.filter(t => validIds.has(t.sampleTypeId))
    if (valid.length === 1) setSampleTypeId(String(valid[0].sampleTypeId))
  }, [materialId]) // intentional — only fires on material change

  // Close ⋯ More menu on outside click
  useEffect(() => {
    function close() { setMoreMenuRow(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // ── Reset form ──────────────────────────────────────────────────────────────
  function resetForm() {
    setMaterialId(''); setSampleTypeId('')
    setTankSourceId(''); setSampleLabel(''); setLotNumber('')
    setMfgDate(''); setExpDate(''); setError('')
    // Phase A
    setReceivedTemp(''); setSampleCondition('OK'); setIsRush(false)
    setExternalBatchId(''); setSpecPreview(null); setOverrideSpecId(null)
    setLastSpecResult(null)
  }

  // ── Submit registration ─────────────────────────────────────────────────────
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!materialId) { setError('Please select a Product / Material.'); return }
    if (!sampleTypeId) { setError('Please select a Sample Type.'); return }
    // Block if spec engine says DraftOnly / ObsoleteOnly
    if (specPreview?.outcome === 'DraftOnly' || specPreview?.outcome === 'ObsoleteOnly') {
      setError(specPreview.message); return
    }
    // Require manual pick if multiple templates found
    if (specPreview?.outcome === 'MultipleMatches' && !overrideSpecId) {
      setError('Multiple specifications found — please select which one to apply below.'); return
    }
    setSaving(true); setError('')
    try {
      const res = await api.post('/samples', {
        labId:        labId ?? 1,
        materialId:   Number(materialId),
        lotNumber,
        mfgDate:      mfgDate || null,
        expDate,
        sampleTypeId: Number(sampleTypeId),
        // Phase A receipt fields
        receivedTemp:          receivedTemp ? parseFloat(receivedTemp) : null,
        sampleCondition:       sampleCondition || null,
        isRush,
        externalBatchId:       externalBatchId || null,
        sampleLabel:           sampleLabel || null,
        tankSourceId:          tankSourceId || null,
        overrideSpecTemplateId: overrideSpecId ?? null,
        checkpointIds:         [],
      })
      const result = res.data
      // Offline: request queued — show appropriate message instead of broken barcode modal
      if (result.__offlineQueued) {
        setShowForm(false)
        resetForm()
        toast('Sample registration queued — will sync automatically when back online', 'success')
        return
      }
      setLastSpecResult({ outcome: result.specOutcome, message: result.specMessage, testsCreated: result.testsAutoCreated })
      // Capture form data BEFORE resetForm() clears it
      const mat  = materials.find(m => m.materialId === Number(materialId))
      const st   = sampleTypes.find(t => t.sampleTypeId === Number(sampleTypeId))
      const lot  = lotNumber
      setShowForm(false)
      resetForm()
      setStatusFilter('Registered')   // switch filter so new sample is immediately visible
      toast(`✓ ${result.sampleNumber} registered`, 'success')
      openWizard(result, mat, st, lot)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'))
    } finally { setSaving(false) }
  }


  async function duplicateSample(sampleId: number) {
    if (duplicating) return
    setDuplicating(true)
    try {
      const r = await api.post(`/samples/${sampleId}/duplicate`, {})
      toast(`✓ Duplicate created: ${r.data.sampleNumber}`, 'success')
      load()
    } catch (err) {
      toast(getErrorMessage(err, 'Duplicate failed'), 'error')
    } finally {
      setDuplicating(false)
    }
  }

  async function openAddTest(sample: Sample) {
    setShowAddTest(sample); setAdHocParamId(''); setAdHocReason(''); setAdHocParams([])
    try {
      const r = await api.get('/parameters')
      setAdHocParams(r.data)
    } catch { /* params optional */ }
  }

  async function submitAdHoc(e: React.FormEvent) {
    e.preventDefault(); setAdHocSaving(true)
    try {
      const r = await api.post('/test-executions/ad-hoc', {
        sampleId: showAddTest!.sampleId,
        parameterId: Number(adHocParamId),
        reason: adHocReason,
      })
      toast(`Additional test added — ${r.data.parameterName} (Execution #${r.data.executionId})`, 'success')
      setShowAddTest(null); load()
    } catch (err) { toast(getErrorMessage(err, 'Failed to add test'), 'error') }
    finally { setAdHocSaving(false) }
  }

  async function submitRetest(e: React.FormEvent) {
    e.preventDefault(); setRetestSaving(true)
    try {
      const body = {
        retestReason,
        parameterIds: selectedParams.length > 0 ? selectedParams : null,  // null = full retest
      }
      const r = await api.post(`/samples/${showRetest!.sampleId}/retest`, body)
      const msg = selectedParams.length > 0
        ? `Selective retest — ${r.data.sampleNumber} (${selectedParams.length} parameter(s))`
        : `Full retest registered — ${r.data.sampleNumber}`
      toast(msg, 'success')
      setShowRetest(null); setRetestReason(''); setSelectedParams([]); setTestedParams([]); load()
    } catch (err) { toast(getErrorMessage(err, 'Retest failed'), 'error') }
    finally { setRetestSaving(false) }
  }

  async function submitReprint(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showReprint}/barcode-reprint`, { reason: reprintReason })
      // Find the sample row to populate the label
      const row = data.find(s => s.sampleId === showReprint)
      setShowReprint(null); setReprintReason(''); load()
      if (row) {
        setPrintSample({
          sampleNumber:   row.sampleNumber,
          materialName:   row.materialName,
          lotNumber:      row.lotNumber,
          sampleTypeName: row.sampleType,
          registeredAt:   row.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          testsCreated:   0,
        })
      }
    } catch (err) { setError(getErrorMessage(err, 'Reprint failed')) }
    finally { setSaving(false) }
  }

  function doPrint() {
    const el = labelRef.current
    if (!el) return
    const style = document.createElement('style')
    style.id = 'lims-print-only'
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #lims-barcode-label, #lims-barcode-label * { visibility: visible !important; }
        #lims-barcode-label {
          position: fixed !important; top: 10mm; left: 10mm;
          width: 80mm; background: white;
        }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  function doContainerPrint() {
    const el = containerLabelRef.current
    if (!el) return
    const style = document.createElement('style')
    style.id = 'lims-print-only'
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #lims-container-barcode-label, #lims-container-barcode-label * { visibility: visible !important; }
        #lims-container-barcode-label {
          position: fixed !important; top: 10mm; left: 10mm;
          width: 80mm; background: white;
        }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }


  return (
    <div>
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === 'single')} onClick={() => setTab('single')}>
          <span>📋</span> Single
        </button>
        <button style={TAB_STYLE(tab === 'batch')} onClick={() => setTab('batch')}>
          <span>🗂</span> Batch
        </button>
      </div>

      {tab === 'batch' && <BatchSampleRegistrationPage />}
      {tab === 'single' && <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Sample Registration</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Register incoming samples and route to the testing work queue</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select style={{ ...inp, width: 180, margin: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected'].map(s =>
              <option key={s} value={s}>{s}</option>)}
          </select>
          {canRegister && (
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              + Register Sample
            </button>
          )}
        </div>
      </div>

      {/* ── Workflow timeline ─────────────────────────────────────────────── */}
      {!loading && data.length > 0 && (() => {
        const stages = [
          { key: 'Registered',      label: 'Registered',       color: '#2563eb', bg: '#dbeafe' },
          { key: 'PendingTesting',  label: 'Pending Testing',  color: '#d97706', bg: '#fef3c7' },
          { key: 'InTesting',       label: 'In Testing',       color: '#9a3412', bg: '#fde8d8' },
          { key: 'PendingQAReview', label: 'Pending QA',       color: '#6d28d9', bg: '#ede9fe' },
          { key: 'Released',        label: 'Released',         color: '#065f46', bg: '#d1fae5' },
          { key: 'Rejected',        label: 'Rejected',         color: '#991b1b', bg: '#fee2e2' },
        ]
        const counts = stages.reduce((acc, s) => {
          acc[s.key] = data.filter(d => d.status === s.key).length
          return acc
        }, {} as Record<string, number>)
        return (
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {stages.map((s, i) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${statusFilter === s.key ? s.color : '#e5e7eb'}`,
                    background: statusFilter === s.key ? s.bg : '#fff',
                    transition: 'all 0.12s',
                  }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 6,
                    background: s.bg, color: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>{counts[s.key] ?? 0}</span>
                  <span style={{ fontSize: 12, fontWeight: statusFilter === s.key ? 700 : 500, color: statusFilter === s.key ? s.color : '#374151', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </button>
                {i < stages.length - 1 && (
                  <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                    <path d="M4 8h8M9 5l3 3-3 3" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Sample list table ─────────────────────────────────────────────── */}
      <MasterDetail
        onCloseDetail={() => setSelectedSample(null)}
        detailTitle="Sample Detail"
        detail={selectedSample ? (
          <DetailPane
            title={selectedSample.sampleNumber}
            subtitle={`${selectedSample.materialName} · ${selectedSample.lotNumber}`}
            onClose={() => setSelectedSample(null)}
            actions={
              <button
                onClick={() => {
                  setDetailSampleId(selectedSample.sampleId)
                  setDetailExtraInfo({
                    sampleType:         selectedSample.sampleType,
                    formTemplateName:   selectedSample.formTemplateName ?? null,
                    isCheckpointLinked: selectedSample.isCheckpointLinked ?? false,
                    checkpointCount:    selectedSample.checkpointCount ?? 0,
                    specVersion:        selectedSample.specVersion ?? null,
                    specStage:          selectedSample.specStage ?? null,
                    barcodePrinted:     selectedSample.barcodePrinted,
                  })
                }}
                style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: '#374151' }}
              >
                Full Details
              </button>
            }
          >
            {/* Status + flags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {(() => {
                const c = STATUS_COLORS[selectedSample.status] ?? { bg: '#f3f4f6', color: '#374151' }
                return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{selectedSample.status}</span>
              })()}
              {selectedSample.isRush && <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>RUSH</span>}
              {selectedSample.sampleCondition && selectedSample.sampleCondition !== 'OK' && (
                <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#991b1b' }}>
                  {selectedSample.sampleCondition.toUpperCase()}
                </span>
              )}
            </div>

            {/* Detail fields */}
            {[
              { label: 'Material',     value: selectedSample.materialName },
              { label: 'Lot / Batch',  value: selectedSample.lotNumber },
              { label: 'Sample Type',  value: selectedSample.sampleType },
              { label: 'Analyst',      value: selectedSample.analystName || '—' },
              { label: 'Due Date',     value: selectedSample.dueDate ? fmtDate(selectedSample.dueDate) : '—' },
              { label: 'Registered',   value: fmtDate(selectedSample.createdAt) },
              { label: 'SRF Signed',   value: selectedSample.srfSigned ? '✓ Signed' : '✗ Pending' },
              { label: 'Barcode',      value: selectedSample.barcodePrinted ? '✓ Printed' : '✗ Pending' },
              ...(selectedSample.specTemplateName ? [{ label: 'Spec Template', value: selectedSample.specTemplateName }] : []),
            ].map(({ label: lbl, value }) => (
              <div key={lbl} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{value}</div>
              </div>
            ))}

            {/* Quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
              {!selectedSample.specTemplateName && (
                <button
                  onClick={() => { openAssignSpec(selectedSample.sampleId); setSelectedSample(null) }}
                  style={{ padding: '9px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}
                >
                  📋 Assign Test Plan
                </button>
              )}
              {(selectedSample.status === 'Released' || selectedSample.status === 'Rejected') && (
                <button
                  onClick={async () => {
                    setShowRetest(selectedSample); setRetestReason(''); setTestedParams([]); setSelectedParams([])
                    setSelectedSample(null)
                    try {
                      const res = await api.get(`/samples/${selectedSample.sampleId}/tested-parameters`)
                      setTestedParams(res.data)
                      setSelectedParams(res.data.filter((p: { isOos: boolean; parameterId: number }) => p.isOos).map((p: { isOos: boolean; parameterId: number }) => p.parameterId))
                    } catch { setTestedParams([]) }
                  }}
                  style={{ padding: '9px 14px', background: '#c2410c', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}
                >
                  🔁 Retest
                </button>
              )}
            </div>
          </DetailPane>
        ) : null}
      >
      <DataTable loading={loading} data={data}
        onRowClick={row => setSelectedSample(row)}
        selectedRow={selectedSample ?? undefined}
        columns={[
        { header: 'Sample No.', accessor: r => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>
              {r.sampleNumber}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {r.isRush && <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>RUSH</span>}
              {r.sampleCondition && r.sampleCondition !== 'OK' && (
                <span style={{ fontSize: 9, background: '#fef2f2', color: '#991b1b', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                  {r.sampleCondition === 'Damaged' ? 'DAMAGED' : 'COMPROMISED'}
                </span>
              )}
              {r.barcodePrinted
                ? <span style={{ fontSize: 9, color: '#16a34a' }}>🖨 Printed</span>
                : <span style={{ fontSize: 9, color: '#dc2626' }}>🖨 Pending</span>}
            </div>
          </div>
        ) },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot / Batch', accessor: 'lotNumber' },
        {
          header: 'Status', accessor: r => {
            const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>{fmtLabel(r.status)}</span>
          }
        },
        { header: 'Due', accessor: r => r.dueDate ? fmtDate(r.dueDate) : '—' },
        { header: 'Analyst', accessor: 'analystName' },
        {
          header: 'Actions', accessor: r => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>

              {/* ── Primary actions: visible only when action is required ── */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(r.status === 'Released' || r.status === 'Rejected') && (
                  <button onClick={async () => {
                    setShowRetest(r); setRetestReason(''); setTestedParams([]); setSelectedParams([])
                    try {
                      const res = await api.get(`/samples/${r.sampleId}/tested-parameters`)
                      setTestedParams(res.data)
                      setSelectedParams(res.data.filter((p: { isOos: boolean; parameterId: number }) => p.isOos).map((p: { isOos: boolean; parameterId: number }) => p.parameterId))
                    } catch { setTestedParams([]) }
                  }}
                    style={{ padding: '4px 10px', background: '#c2410c', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    🔁 Retest
                  </button>
                )}
              </div>

              {/* ── ⋯ More dropdown ── */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMoreMenuRow(moreMenuRow === r.sampleId ? null : r.sampleId) }}
                  style={{ padding: '4px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  ⋯ More
                </button>
                {moreMenuRow === r.sampleId && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
                    minWidth: 170, overflow: 'hidden',
                  }}>
                    {[
                      { label: '🖨  Reprint Label',    onClick: () => { setShowReprint(r.sampleId); setError(''); setMoreMenuRow(null) } },
                      { label: '⧉  Duplicate',         onClick: () => { duplicateSample(r.sampleId); setMoreMenuRow(null) } },
                      ...(r.status !== 'Rejected' ? [{ label: '＋  Add Ad-hoc Test', onClick: () => { openAddTest(r); setMoreMenuRow(null) } }] : []),
                      { label: '🧪  Containers',       onClick: () => { setContainerSample(r); loadContainers(r.sampleId); setMoreMenuRow(null) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.onClick}
                        style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 12, color: '#374151', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )
        },
      ]} />
      </MasterDetail>

      {/* ── Registration form — contained modal with sticky header + footer ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
          <div style={{
            position: 'relative',
            width: 760, maxWidth: '95vw',
            height: '100%',
            display: 'flex', flexDirection: 'column',
            background: '#fff', borderLeft: '1px solid #e2e8f0',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}>
            {/* Sticky modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>New Sample Registration</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Complete all sections · Barcode auto-printed on submit</p>
              </div>
              <button onClick={() => setShowForm(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, color: '#374151', fontSize: 18, width: 32, height: 32, cursor: 'pointer', lineHeight: '32px', textAlign: 'center', flexShrink: 0 }}>
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <form id="sample-reg-form" onSubmit={submitRegister}>

              {/* ── Section 1: Product & Type ──────────────────────────── */}
              <Section num={1} title="Product & Type" subtitle="Requestor is auto-filled from your login.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Requestor — read-only */}
                  <div>
                    <span style={label}>Requestor</span>
                    <div style={{ ...inp, background: '#f9fafb', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>👤</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{fullName ?? 'Loading…'}</span>
                    </div>
                  </div>

                  {/* Product / Material */}
                  <div>
                    <span style={label}>Product <span style={{ color: '#dc2626' }}>*</span></span>
                    <select style={inp} value={materialId} onChange={e => setMaterialId(e.target.value)} required>
                      <option value="">— Select a product —</option>
                      {materials.map(m => (
                        <option key={m.materialId} value={m.materialId}>
                          {m.materialName}{m.productType ? ` (${m.productType})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sample Type — shown after product selected */}
                {materialId && (
                  <div style={{ marginTop: 16 }}>
                    <span style={label}>Test Plan <span style={{ color: '#dc2626' }}>*</span></span>
                    <select style={inp} value={sampleTypeId} onChange={e => setSampleTypeId(e.target.value)} required>
                      <option value="">— Select sample type —</option>
                      {validSampleTypes.map(t => (
                        <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                      ))}
                    </select>
                    {validSampleTypes.length === 1 && sampleTypeId && (
                      <p style={{ fontSize: 11, color: '#059669', marginTop: 4, marginBottom: 0 }}>
                        Auto-selected — only type configured for this material
                      </p>
                    )}
                    {validSampleTypes.length > 1 && validSampleTypes.length < sampleTypes.length && (
                      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, marginBottom: 0 }}>
                        Showing {validSampleTypes.length} of {sampleTypes.length} types · filtered by material
                      </p>
                    )}
                  </div>
                )}

                {/* ── Phase A: Spec Engine Banner ─────────────────────── */}
                {materialId && sampleTypeId && (
                  <div style={{ marginTop: 14 }}>
                    {specLoading && (
                      <div style={{ padding: '10px 14px', background: '#f0f4f8', borderRadius: 8, fontSize: 13, color: '#5f6368' }}>
                        🔍 Checking specification templates…
                      </div>
                    )}

                    {!specLoading && specPreview && (() => {
                      const bannerStyle: Record<string, { bg: string; border: string; color: string; icon: string }> = {
                        SingleMatch:      { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '✓' },
                        MultipleMatches:  { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
                        NoMatch:          { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
                        DraftOnly:        { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '✗' },
                        ObsoleteOnly:     { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '✗' },
                      }
                      const bs = bannerStyle[specPreview.outcome] ?? bannerStyle.NoMatch
                      return (
                        <div style={{ padding: '10px 14px', background: bs.bg, border: `1px solid ${bs.border}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: bs.color, marginBottom: specPreview.outcome === 'MultipleMatches' ? 8 : 0 }}>
                            {bs.icon} {specPreview.message.replace(/^[✓⚠✗]\s*/, '')}
                          </div>
                          {/* Multiple match picker */}
                          {specPreview.outcome === 'MultipleMatches' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                              {specPreview.candidates.map(c => (
                                <label key={c.templateId} style={{
                                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                  padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${overrideSpecId === c.templateId ? '#0d6e6e' : '#e0e0e0'}`,
                                  background: overrideSpecId === c.templateId ? '#f0fdfa' : '#fff',
                                }}>
                                  <input type="radio" name="specTemplate" checked={overrideSpecId === c.templateId}
                                    onChange={() => setOverrideSpecId(c.templateId)}
                                    style={{ accentColor: '#0d6e6e' }} />
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>{c.templateName}</span>
                                    <span style={{ fontSize: 11, color: '#5f6368', marginLeft: 8 }}>v{c.version}</span>
                                    <span style={{ fontSize: 11, color: '#5f6368', marginLeft: 8 }}>{c.testCount} tests</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </Section>

              {/* ── Section 2: Sample Details ───────────────────────────── */}
              <Section num={2} title="Sample Details" subtitle="Batch identification, receipt condition, and optional references.">

                {/* ── 2a: Batch Identification ─────────────────────────── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Batch Identification
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <span style={label}>Batch / Lot No. <span style={{ color: '#dc2626' }}>*</span></span>
                    <input style={inp} value={lotNumber} onChange={e => setLotNumber(e.target.value)}
                      required placeholder="e.g. B-20260422-03" />
                  </div>
                  <div>
                    <span style={label}>Expiry Date <span style={{ color: '#dc2626' }}>*</span></span>
                    <input style={inp} type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required />
                  </div>
                </div>

                {/* ── 2b: Receipt Condition ─────────────────────────────── */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Receipt Condition
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                    <div>
                      <span style={label}>Sample Condition <span style={{ color: '#dc2626' }}>*</span></span>
                      <select style={inp} value={sampleCondition} onChange={e => setSampleCondition(e.target.value)}>
                        <option value="OK">✓ OK — Acceptable</option>
                        <option value="Damaged">⚠ Damaged — Physical damage noted</option>
                        <option value="Compromised">✗ Compromised — Integrity at risk</option>
                      </select>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${isRush ? '#fca5a5' : '#e5e7eb'}`, background: isRush ? '#fff5f5' : '#f9fafb', marginBottom: sampleCondition !== 'OK' ? 10 : 0 }}>
                    <input type="checkbox" checked={isRush} onChange={e => setIsRush(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#dc2626', cursor: 'pointer' }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isRush ? '#dc2626' : '#374151' }}>🚨 Rush Sample</span>
                      <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>Flags for expedited testing and elevated Work Queue priority</span>
                    </div>
                  </label>
                  {sampleCondition !== 'OK' && (
                    <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>⚠ Non-OK condition recorded — QA will be notified for review</span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 11, color: '#9ca3af', margin: '14px 0 0' }}>ℹ Sample ID is server-generated · Barcode auto-printed · 5 GMP checks run server-side</p>
              </Section>

            </form>
            </div>{/* end scrollable body */}

            {/* Sticky footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 24px', borderTop: '1px solid #e5e7eb',
              background: '#f8fafc', flexShrink: 0,
            }}>
              <div style={{ flex: 1 }}>
                {error && (
                  <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>⚠ {error}</p>
                )}
              </div>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '9px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button form="sample-reg-form" type="submit" disabled={saving}
                style={{ padding: '9px 22px', background: saving ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Registering…' : 'Register'}
              </button>
            </div>

          </div>{/* end modal panel */}
        </div>
      )}


      {/* ── Add Test (Ad-hoc) Drawer ────────────────────────────────────── */}
      {showAddTest && (
        <Drawer title={`Add Test — ${showAddTest.sampleNumber}`} subtitle="Single-parameter ad-hoc test outside normal workflow." onClose={() => setShowAddTest(null)}>
          <form onSubmit={submitAdHoc}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Parameter *
            </label>
            <select required value={adHocParamId} onChange={e => setAdHocParamId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box' as const }}>
              <option value="">Select parameter…</option>
              {adHocParams.map(p => (
                <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.uom})</option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Reason *
            </label>
            <textarea rows={3} required value={adHocReason} onChange={e => setAdHocReason(e.target.value)}
              placeholder="e.g. Confirmatory test requested by QA — borderline Assay result"
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
            />
            <DrawerFooter saving={adHocSaving} onCancel={() => setShowAddTest(null)} label="Add Test" disabled={!adHocParamId || !adHocReason.trim()} />
          </form>
        </Drawer>
      )}

      {/* ── Retest Drawer ───────────────────────────────────────────────── */}
      {showRetest && (
        <Drawer title={`Request Retest — ${showRetest.sampleNumber}`} subtitle="FDA OOS Guidance 2006 §IV — OOS parameters pre-selected." onClose={() => setShowRetest(null)}>
          <form onSubmit={submitRetest}>

            {/* Parameter selection */}
            {testedParams.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Select Parameters to Retest
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: '#9ca3af' }}>
                    ({selectedParams.length} selected — uncheck to skip)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {testedParams.map(p => (
                    <label key={p.parameterId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 7, cursor: 'pointer',
                      border: `1.5px solid ${p.isOos ? '#fca5a5' : p.isOot ? '#fde68a' : '#e5e7eb'}`,
                      background: p.isOos ? '#fff1f2' : p.isOot ? '#fffbeb' : '#fafafa',
                    }}>
                      <input type="checkbox"
                        checked={selectedParams.includes(p.parameterId)}
                        onChange={e => setSelectedParams(prev =>
                          e.target.checked ? [...prev, p.parameterId] : prev.filter(id => id !== p.parameterId)
                        )}
                        style={{ accentColor: '#c2410c', width: 15, height: 15 }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.parameterName}</span>
                        {p.uom && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>({p.uom})</span>}
                        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>Last: {p.lastValue}</span>
                      </div>
                      {p.isOos && <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4 }}>OOS</span>}
                      {p.isOot && !p.isOos && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4 }}>OOT</span>}
                      {!p.isOos && !p.isOot && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ PASS</span>}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => setSelectedParams(testedParams.map(p => p.parameterId))}
                    style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Select all
                  </button>
                  <span style={{ color: '#d1d5db' }}>|</span>
                  <button type="button" onClick={() => setSelectedParams(testedParams.filter(p => p.isOos).map(p => p.parameterId))}
                    style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    OOS only
                  </button>
                  <span style={{ color: '#d1d5db' }}>|</span>
                  <button type="button" onClick={() => setSelectedParams([])}
                    style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Clear all (full retest via spec engine)
                  </button>
                </div>
              </div>
            )}

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Retest Reason *
            </label>
            <textarea rows={3} required value={retestReason} onChange={e => setRetestReason(e.target.value)}
              placeholder="e.g. OOS result on Assay — retesting per SOP-LAB-012"
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />

            <DrawerFooter
              saving={retestSaving}
              onCancel={() => setShowRetest(null)}
              label={selectedParams.length > 0 ? `Retest ${selectedParams.length} Parameter(s)` : 'Full Retest'}
              disabled={!retestReason.trim()}
            />
          </form>
        </Drawer>
      )}

      {/* ── Barcode Reprint ───────────────────────────────────────────────── */}
      {showReprint && (
        <Drawer title="Barcode Label Reprint" subtitle="21 CFR 211.170 — Reprint is audit-logged with your name and reason." onClose={() => setShowReprint(null)} blocking>
          <form onSubmit={submitReprint}>
            <Field label="Reason (mandatory)">
              <input style={inp} value={reprintReason} onChange={e => setReprintReason(e.target.value)}
                required placeholder="e.g. Label damaged during storage" autoFocus />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowReprint(null)} label="Reprint Label" />
          </form>
        </Drawer>
      )}

      {/* ── Barcode Label Modal ─────────────────────────────────────────────── */}
      {printSample && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>🖨 Barcode Label</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Ready to print · 21 CFR 211.170</p>
              </div>
              <button onClick={() => setPrintSample(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {/* Label preview */}
            <div style={{ padding: '20px 24px' }}>
              <div id="lims-barcode-label" ref={labelRef} style={{
                border: '1.5px solid #d1d5db', borderRadius: 8, padding: '16px 20px',
                background: '#fff', textAlign: 'center', fontFamily: 'monospace'
              }}>
                {/* Branding line */}
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 10, textTransform: 'uppercase' }}>
                  Pharma LIMS · Sample Label
                </div>
                {/* Barcode */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <Barcode
                    value={printSample.sampleNumber}
                    format="CODE128"
                    width={1.6}
                    height={56}
                    fontSize={11}
                    margin={0}
                    background="#ffffff"
                    lineColor="#111827"
                  />
                </div>
                {/* Divider */}
                <div style={{ borderTop: '1px dashed #d1d5db', margin: '10px 0' }} />
                {/* Sample details */}
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
                  <tbody>
                    {[
                      ['Sample No.', printSample.sampleNumber],
                      ['Material',   printSample.materialName],
                      ['Lot / Batch',printSample.lotNumber || '—'],
                      ['Type',       printSample.sampleTypeName],
                      ['Date',       printSample.registeredAt],
                      ...(printSample.testsCreated > 0 ? [['Tests', `${printSample.testsCreated} auto-assigned`]] : []),
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#6b7280', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap', width: '38%' }}>{k}</td>
                        <td style={{ color: '#111827', fontWeight: 600, paddingBottom: 3 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Footer */}
                <div style={{ marginTop: 10, fontSize: 9, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                  Printed by system · ALCOA+ compliant · Do not alter label
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPrintSample(null)}
                style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                Close
              </button>
              <button onClick={doPrint}
                style={{ padding: '8px 22px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                🖨 Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-Registration Wizard ─────────────────────────────────────── */}
      {wizard && (() => {
        const srfEnabled = srfMethod !== 'None'
        const stepLabels = srfEnabled
          ? (skipSchedule ? ['Container Split', 'SRF E-Sign', 'Assign Analyst', 'Print Barcodes'] : ['Container Split', 'SRF E-Sign', 'Assign Analyst', 'Schedule', 'Print Barcodes'])
          : (skipSchedule ? ['Container Split', 'Assign Analyst', 'Print Barcodes'] : ['Container Split', 'Assign Analyst', 'Schedule', 'Print Barcodes'])
        const totalSteps = stepLabels.length
        // Map actual step (1/2/3/4/5) to display index (0-based), accounting for SRF + schedule skips
        const displayIdx = (() => {
          if (srfEnabled && !skipSchedule) return wizardStep - 1
          if (srfEnabled &&  skipSchedule) return wizardStep === 1 ? 0 : wizardStep === 2 ? 1 : wizardStep === 3 ? 2 : 3
          if (!srfEnabled && !skipSchedule) return wizardStep === 1 ? 0 : wizardStep === 3 ? 1 : wizardStep === 4 ? 2 : 3
          // !srfEnabled && skipSchedule
          return wizardStep === 1 ? 0 : wizardStep === 3 ? 1 : 2
        })()
        const btnBase: React.CSSProperties = { padding: '8px 20px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
        return (
          <Drawer
            title={`Setup — ${wizard.sampleNumber}`}
            subtitle={`Step ${displayIdx + 1} of ${totalSteps} · ${stepLabels[displayIdx]}`}
            width={720}
            onClose={wizardDismiss}
            blocking={wizardStep === 2 && srfEnabled}
          >
            {/* ── Step progress bar ── */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
              {stepLabels.map((s, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: displayIdx > i ? '#10b981' : displayIdx === i ? '#0369a1' : '#e5e7eb', color: displayIdx >= i ? '#fff' : '#9ca3af', transition: 'all 0.2s' }}>
                    {displayIdx > i ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: displayIdx === i ? 700 : 400, color: displayIdx === i ? '#0369a1' : '#9ca3af', textAlign: 'center' }}>{s}</div>
                </div>
              ))}
            </div>

            {/* ── Step 1: Group Tests into Containers ── */}
            {wizardStep === 1 && (() => {
              const assignedIds = new Set(wizardTestGroups.flat())
              const unassigned = wizardSpecTests.filter(t => !assignedIds.has(t.id))
              const allAssigned = wizardSpecTests.length > 0 && unassigned.length === 0
              const GROUP_COLORS = ['#0369a1','#7c3aed','#b45309','#15803d','#be123c','#0e7490']
              const GROUP_BG    = ['#eff6ff','#faf5ff','#fffbeb','#f0fdf4','#fff1f2','#ecfeff']
              return (
                <div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                    Drag each test into a container group. Each group becomes one physical QC container in the work queue.
                  </p>

                  {wizardSpecLoading && (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 13 }}>Loading spec tests…</div>
                  )}

                  {!wizardSpecLoading && wizardSpecTests.length === 0 && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                      No spec template found for this sample. Proceed as single sample or split below.
                    </div>
                  )}

                  {!wizardSpecLoading && (
                    <div style={{ display: 'grid', gridTemplateColumns: wizardSpecTests.length > 0 ? '220px 1fr' : '1fr', gap: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                      {/* Left: test pool — only when spec tests exist */}
                      {wizardSpecTests.length > 0 && <div style={{ borderRight: '1px solid #e5e7eb', padding: 12, background: '#f9fafb' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: 10 }}>
                          Spec Tests
                          {unassigned.length > 0 && <span style={{ marginLeft: 6, background: '#fbbf24', color: '#78350f', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>{unassigned.length} left</span>}
                          {allAssigned && <span style={{ marginLeft: 6, background: '#d1fae5', color: '#065f46', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>✓ all placed</span>}
                        </div>
                        {wizardSpecTests.map(test => {
                          const isAssigned = assignedIds.has(test.id)
                          const groupIdx = wizardTestGroups.findIndex(g => g.includes(test.id))
                          return (
                            <div key={test.id}
                              draggable={!isAssigned}
                              onDragStart={() => setWizardDragItem(test.id)}
                              onDragEnd={() => { setWizardDragItem(null); setWizardDragOverGroup(null) }}
                              style={{
                                background: isAssigned ? '#f3f4f6' : '#fff',
                                border: `1.5px solid ${isAssigned ? '#e5e7eb' : '#d1d5db'}`,
                                borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                                cursor: isAssigned ? 'default' : 'grab', opacity: isAssigned ? .45 : 1,
                                transition: 'opacity .15s',
                              }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isAssigned ? '#9ca3af' : '#111827' }}>
                                {test.name}
                                {test.isMandatory && <span style={{ marginLeft: 5, fontSize: 9, background: '#fee2e2', color: '#991b1b', borderRadius: 3, padding: '1px 5px' }}>Mandatory</span>}
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{test.code}</div>
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                                {test.turnaroundHours}h TAT
                                {isAssigned && groupIdx >= 0 && <span style={{ marginLeft: 6, color: GROUP_COLORS[groupIdx % GROUP_COLORS.length], fontWeight: 700 }}>→ Q{String(groupIdx + 1).padStart(3, '0')}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>}

                      {/* Right: container buckets — always shown */}
                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280' }}>
                            Container Groups · {wizardTestGroups.filter(g => g.length > 0).length || wizardTestGroups.length} containers
                          </div>
                          {wizardTestGroups.length < 6 && (
                            <button type="button" onClick={wizardAddGroup}
                              style={{ fontSize: 11, padding: '3px 10px', background: '#eff6ff', color: '#0369a1', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer' }}>
                              + Add Container
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {wizardTestGroups.map((group, gi) => {
                            const color = GROUP_COLORS[gi % GROUP_COLORS.length]
                            const bg    = GROUP_BG[gi % GROUP_BG.length]
                            const isDragOver = wizardDragOverGroup === gi
                            return (
                              <div key={gi}
                                onDragOver={e => { e.preventDefault(); setWizardDragOverGroup(gi) }}
                                onDragLeave={() => setWizardDragOverGroup(null)}
                                onDrop={() => wizardDropTest(gi)}
                                style={{
                                  width: 160, minHeight: 130, borderRadius: 8, padding: 10,
                                  border: `2px ${group.length > 0 ? 'solid' : 'dashed'} ${isDragOver ? color : group.length > 0 ? color : '#d1d5db'}`,
                                  background: isDragOver ? bg : group.length > 0 ? bg : 'transparent',
                                  transition: 'border-color .15s, background .15s',
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, background: color, color: '#fff', borderRadius: 3, padding: '1px 7px' }}>
                                    Q{String(gi + 1).padStart(3, '0')}
                                  </span>
                                  {wizardTestGroups.length > 1 && (
                                    <button type="button" onClick={() => wizardRemoveGroup(gi)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                                  )}
                                </div>
                                {group.map(tid => {
                                  const t = wizardSpecTests.find(x => x.id === tid)
                                  if (!t) return null
                                  return (
                                    <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, padding: '5px 7px', marginBottom: 4 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                      <div style={{ fontSize: 11, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{t.name}</div>
                                      <button type="button" onClick={() => wizardRemoveTestFromGroup(gi, tid)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                                    </div>
                                  )
                                })}
                                {group.length === 0 && (
                                  <div style={{ border: '1px dashed #d1d5db', borderRadius: 5, padding: '12px 8px', textAlign: 'center', fontSize: 10, color: '#9ca3af' }}>
                                    {wizardSpecTests.length > 0 ? 'Drop tests here' : 'Empty container'}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {!allAssigned && wizardSpecTests.length > 0 && (
                          <div style={{ marginTop: 10, fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px' }}>
                            ⚠ {unassigned.length} test{unassigned.length > 1 ? 's' : ''} not placed — assign all tests before continuing.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                    <button type="button" onClick={() => { setWizardSplitDone(true); wizardGoToAssign([]) }}
                      style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>
                      No Split — Single Sample
                    </button>
                    <button type="button"
                      disabled={wizardSplitting || (!allAssigned && wizardSpecTests.length > 0)}
                      onClick={wizardConfirmGroups}
                      style={{ ...btnBase, background: (wizardSplitting || (!allAssigned && wizardSpecTests.length > 0)) ? '#9ca3af' : '#15803d', color: '#fff' }}>
                      {wizardSplitting ? 'Creating containers…' : 'Create Containers →'}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* ── Step 2: SRF E-Sign ── */}
            {wizardStep === 2 && srfEnabled && (
              <div>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>Sign Sample Receipt Form (SRF)?</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>21 CFR Part 11 — e-signature is audit-logged and immutable.</div>
                </div>
                {/* Toggle */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[false, true].map(v => (
                    <button key={String(v)} type="button" onClick={() => { setWizardSrfToggle(v); setWizardSignError('') }}
                      style={{ ...btnBase, flex: 1, border: `2px solid ${wizardSrfToggle === v ? (v ? '#0369a1' : '#9ca3af') : '#e5e7eb'}`, background: wizardSrfToggle === v ? (v ? '#eff6ff' : '#f9fafb') : '#fff', color: wizardSrfToggle === v ? (v ? '#0369a1' : '#374151') : '#9ca3af' }}>
                      {v ? '✓ Yes — Sign Now' : '✕ No — Sign Later'}
                    </button>
                  ))}
                </div>
                {/* E-sign fields — shown only when toggle = Yes */}
                {wizardSrfToggle && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {srfMethod !== 'SignatureOnly' && (
                      <Field label="Password (21 CFR §11.300)">
                        <input type="password" style={inp} value={wizardESign.password} autoComplete="current-password"
                          onChange={e => setWizardESign(f => ({ ...f, password: e.target.value }))} placeholder="Enter your password" />
                      </Field>
                    )}
                    {srfMethod !== 'PasswordOnly' && (
                      <>
                        <Field label="Meaning of Signature">
                          <input style={inp} value={wizardESign.meaning}
                            onChange={e => setWizardESign(f => ({ ...f, meaning: e.target.value }))} placeholder='e.g. "I certify this sample was received in acceptable condition"' />
                        </Field>
                        <Field label="Reason">
                          <input style={inp} value={wizardESign.reason}
                            onChange={e => setWizardESign(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Sample registration complete" />
                        </Field>
                      </>
                    )}
                    {wizardSignError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{wizardSignError}</p>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <button onClick={() => setWizardStep(1)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>← Back</button>
                  <button onClick={wizardFinish} disabled={wizardSigning}
                    style={{ ...btnBase, background: wizardSigning ? '#9ca3af' : '#15803d', color: '#fff' }}>
                    {wizardSigning ? 'Signing…' : (wizardSrfToggle ? 'Sign & Continue →' : 'Skip — Continue →')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Assign Tests ── */}
            {wizardStep === 3 && (
              <div>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  Assign an analyst and instrument for each {wizardAssignments.length > 1 ? 'container' : 'sample'}.
                </p>

                {/* Tabs — Container tabs for split flow, single Sample tab for no-split */}
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20, overflowX: 'auto', gap: 0 }}>
                  {wizardAssignments.map((a, i) => {
                    const isContainer = a.containerId !== null
                    const accentColor = isContainer ? '#0369a1' : '#7c3aed'
                    const isActive = wizardActiveTab === i
                    return (
                      <button key={i} type="button" onClick={() => setWizardActiveTab(i)}
                        style={{
                          padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                          borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                          marginBottom: -2, whiteSpace: 'nowrap',
                          color: isActive ? accentColor : '#6b7280',
                          fontWeight: isActive ? 700 : 400, fontSize: 12,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <span style={{ fontSize: 10, background: isActive ? accentColor : '#e5e7eb', color: isActive ? '#fff' : '#6b7280', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
                          {isContainer ? 'Container' : 'Sample'}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.containerLabel}</span>
                        {a.analystId && <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Analyst + Instrument */}
                {(() => {
                  const idx = wizardActiveTab < wizardAssignments.length ? wizardActiveTab : 0
                  const a = wizardAssignments[idx]
                  if (!a) return null
                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <Field label="Analyst *">
                          <select style={{ ...inp, margin: 0 }} value={a.analystId}
                            onChange={e => setWizardAssignments(prev => prev.map((r, j) => j === idx ? { ...r, analystId: e.target.value } : r))}>
                            <option value="">— Select Analyst —</option>
                            {wizardAnalysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                          </select>
                        </Field>
                        <Field label="Instrument (optional)">
                          <select style={{ ...inp, margin: 0 }} value={a.instrumentId}
                            onChange={e => setWizardAssignments(prev => prev.map((r, j) => j === idx ? { ...r, instrumentId: e.target.value } : r))}>
                            <option value="">— None —</option>
                            {wizardInstruments.map(inst => <option key={inst.instrumentId} value={inst.instrumentId}>{inst.instrumentCode} ({inst.instrumentType})</option>)}
                          </select>
                        </Field>
                      </div>
                      {/* Tests in this container */}
                      {a.tests.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Tests in this container ({a.tests.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {a.tests.map(t => (
                              <span key={t.id} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 500 }}>
                                {t.name}
                                {t.isMandatory && <span style={{ marginLeft: 4, fontSize: 9, background: '#fee2e2', color: '#991b1b', borderRadius: 3, padding: '1px 4px' }}>M</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Progress indicator for multi-container */}
                      {wizardAssignments.length > 1 && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          <span style={{ color: wizardAssignments.every(a => a.analystId) ? '#10b981' : '#d97706', fontWeight: 600 }}>
                            {wizardAssignments.filter(a => a.analystId).length} of {wizardAssignments.length}
                          </span>
                          {' '}containers assigned
                        </div>
                      )}
                    </div>
                  )
                })()}

                {wizardAssignError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{wizardAssignError}</p>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setWizardStep(srfEnabled ? 2 : 1)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>← Back</button>
                  <button onClick={wizardConfirmAssignments} disabled={wizardAssigning}
                    style={{ ...btnBase, background: wizardAssigning ? '#9ca3af' : '#0369a1', color: '#fff' }}>
                    {wizardAssigning ? 'Assigning…' : skipSchedule ? 'Next — Print Barcodes →' : 'Next — Schedule →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Schedule ── */}
            {wizardStep === 4 && !skipSchedule && (
              <div>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  Book time slots for the instruments assigned in the previous step. This is optional — you can also book later in Capacity Booking.
                </p>
                {wizardScheduleRows.length === 0 ? (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
                    No instruments were assigned — nothing to schedule.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {wizardScheduleRows.map((row, idx) => (
                      <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa', padding: '10px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#eff6ff', color: '#0369a1', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px' }}>{row.containerLabel}</span>
                          <span style={{ color: '#6b7280', fontWeight: 400 }}>{row.instrumentCode}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'Start Date', type: 'date', val: row.startDate, key: 'startDate' },
                            { label: 'Start Time', type: 'time', val: row.startTime, key: 'startTime' },
                            { label: 'End Date',   type: 'date', val: row.endDate,   key: 'endDate' },
                            { label: 'End Time',   type: 'time', val: row.endTime,   key: 'endTime' },
                          ].map(({ label, type, val, key }) => (
                            <div key={key}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                              <input type={type} style={{ ...inp, margin: 0, fontSize: 12, width: '100%' }} value={val}
                                onChange={e => setWizardScheduleRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: e.target.value } : r))} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {wizardScheduleError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{wizardScheduleError}</p>}
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>ℹ Booked slots appear on the Capacity Booking calendar immediately.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <button onClick={() => setWizardStep(3)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>← Back</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setWizardStep(5)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>
                      Skip →
                    </button>
                    <button onClick={wizardConfirmSchedule} disabled={wizardScheduleBooking || wizardScheduleRows.length === 0}
                      style={{ ...btnBase, background: (wizardScheduleBooking || wizardScheduleRows.length === 0) ? '#9ca3af' : '#0369a1', color: '#fff' }}>
                      {wizardScheduleBooking ? 'Booking…' : 'Confirm & Continue →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Print Barcodes ── */}
            {wizardStep === 5 && (
              <div>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  Print labels for the {wizardContainers.length > 0 ? 'QC containers' : 'sample'}.
                  Once you click <strong>Finish</strong>, the sample status will change to <strong>In Testing</strong>.
                </p>
                <div id="lims-wizard-barcodes" style={{ display: 'grid', gridTemplateColumns: wizardContainers.length > 0 ? 'repeat(auto-fill, minmax(200px, 1fr))' : '200px', gap: 16, marginBottom: 20 }}>
                  {/* Sample barcode */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Sample</div>
                    <Barcode value={wizard.sampleNumber} format="CODE128" width={1.4} height={48} fontSize={10} margin={0} />
                    <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>{wizard.materialName}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>Lot: {wizard.lotNumber}</div>
                    <button onClick={() => { setPrintSample({ sampleNumber: wizard.sampleNumber, materialName: wizard.materialName, lotNumber: wizard.lotNumber, sampleTypeName: wizard.sampleTypeName, registeredAt: wizard.registeredAt, testsCreated: wizard.testsCreated }) }}
                      style={{ marginTop: 8, padding: '3px 10px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      🖨 Print
                    </button>
                  </div>
                  {/* Container barcodes */}
                  {wizardContainers.map(c => (
                    <div key={c.sampleContainerId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 6, textTransform: 'uppercase' }}>QC Container</div>
                      <Barcode value={c.containerLabel} format="CODE128" width={1.4} height={48} fontSize={10} margin={0} />
                      <div style={{ fontSize: 10, color: '#374151', marginTop: 4, fontFamily: 'monospace', fontWeight: 600 }}>{c.containerLabel}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>{c.containerType} · {c.status}</div>
                      <button onClick={() => setPrintContainer(c)}
                        style={{ marginTop: 8, padding: '3px 10px', background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                        🖨 Print
                      </button>
                    </div>
                  ))}
                </div>
                {wizardContainers.length > 0 && (
                  <button onClick={() => wizardPrintAll(wizard.sampleNumber, wizardContainers)}
                    style={{ ...btnBase, background: '#374151', color: '#fff', marginBottom: 16 }}>
                    🖨 Print All Labels
                  </button>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <button onClick={() => setWizardStep(skipSchedule ? 3 : 4)} style={{ ...btnBase, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>← Back</button>
                  <button onClick={wizardClose} style={{ ...btnBase, background: '#15803d', color: '#fff' }}>
                    Finish — Set In Testing ✓
                  </button>
                </div>
              </div>
            )}
          </Drawer>
        )
      })()}

      {/* ── Container Barcode Modal ─────────────────────────────────────── */}
      {printContainer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>🖨 Container Barcode Label</h3>
              <button onClick={() => setPrintContainer(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div id="lims-container-barcode-label" ref={containerLabelRef} style={{
                border: '1.5px solid #d1d5db', borderRadius: 8, padding: '16px 20px',
                background: '#fff', textAlign: 'center', fontFamily: 'monospace'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 10, textTransform: 'uppercase' }}>
                  Pharma LIMS · Container Label
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <Barcode
                    value={printContainer.containerLabel}
                    format="CODE128"
                    width={1.6}
                    height={56}
                    fontSize={11}
                    margin={0}
                    background="#ffffff"
                    lineColor="#111827"
                  />
                </div>
                <div style={{ borderTop: '1px dashed #d1d5db', margin: '10px 0' }} />
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11 }}>
                  <tbody>
                    {[
                      ['Container', printContainer.containerLabel],
                      ['Type',      printContainer.containerType],
                      ['Status',    printContainer.status],
                      ...(printContainer.volume != null ? [['Volume', `${printContainer.volume} ${printContainer.volumeUom ?? ''}`]] : []),
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#6b7280', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap', width: '38%' }}>{k}</td>
                        <td style={{ color: '#111827', fontWeight: 600, paddingBottom: 3 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: 9, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                  Printed by system · ALCOA+ compliant · Do not alter label
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPrintContainer(null)}
                style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                Close
              </button>
              <button onClick={doContainerPrint}
                style={{ padding: '8px 22px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                🖨 Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Container Management Drawer ─────────────────────────────────── */}
      {containerSample && (
        <Drawer title={`Containers — ${containerSample.sampleNumber}`} subtitle="Split into aliquots or manage existing sub-containers." width={680} onClose={() => setContainerSample(null)}>
          {/* Split form */}
          <form onSubmit={submitSplit}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Create aliquots or sub-containers from this sample.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <Field label="Count (1–100)">
                <input type="number" min={1} max={100} style={inp} value={splitForm.count}
                  onChange={e => setSplitForm(f => ({ ...f, count: e.target.value }))} required />
              </Field>
              <Field label="Container Type">
                <select style={inp} value={splitForm.containerType} onChange={e => setSplitForm(f => ({ ...f, containerType: e.target.value }))}>
                  {['Aliquot','Primary','RetainSample','Stability','QC'].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Volume (opt)">
                <input type="number" step="0.01" style={inp} value={splitForm.volumePerContainer}
                  onChange={e => setSplitForm(f => ({ ...f, volumePerContainer: e.target.value }))} placeholder="e.g. 5" />
              </Field>
              <Field label="UOM (opt)">
                <input style={inp} value={splitForm.volumeUom}
                  onChange={e => setSplitForm(f => ({ ...f, volumeUom: e.target.value }))} placeholder="mL, g…" />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" disabled={splitSaving}
                style={{ padding: '7px 18px', background: splitSaving ? '#9ca3af' : '#6d28d9', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: splitSaving ? 'not-allowed' : 'pointer' }}>
                {splitSaving ? 'Splitting…' : 'Split into Containers'}
              </button>
            </div>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

          {/* Container list */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Existing Containers {containersLoading && <span style={{ fontWeight: 400, color: '#9ca3af' }}>Loading…</span>}
          </div>
          {!containersLoading && containers.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No containers yet — split the sample above.</p>
          )}
          {containers.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Label','Type','Volume','Status','Created By','Actions'].map(h =>
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {containers.map(c => {
                  const statusStyle: Record<string, { bg: string; color: string }> = {
                    Available:  { bg: '#d1fae5', color: '#065f46' },
                    InUse:      { bg: '#dbeafe', color: '#1e40af' },
                    Consumed:   { bg: '#f3f4f6', color: '#6b7280' },
                    Destroyed:  { bg: '#fee2e2', color: '#991b1b' },
                  }
                  const sc = statusStyle[c.status] ?? { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <>
                      <tr key={c.sampleContainerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{c.containerLabel}</td>
                        <td style={{ padding: '7px 10px', color: '#374151' }}>{c.containerType}</td>
                        <td style={{ padding: '7px 10px', color: '#374151' }}>{c.volume != null ? `${c.volume} ${c.volumeUom ?? ''}` : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color }}>{fmtLabel(c.status)}</span>
                        </td>
                        <td style={{ padding: '7px 10px', color: '#6b7280' }}>{c.createdBy}</td>
                        <td style={{ padding: '7px 10px', display: 'flex', gap: 6 }}>
                          <button onClick={() => setPrintContainer(c)}
                            style={{ padding: '2px 8px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                            🖨 Barcode
                          </button>
                          {c.status !== 'Destroyed' && (
                            <button onClick={() => { setDestroyingId(c.sampleContainerId); setDestroyForm({ password: '', reason: '' }); setDestroyError('') }}
                              style={{ padding: '2px 8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              Destroy
                            </button>
                          )}
                        </td>
                      </tr>
                      {destroyingId === c.sampleContainerId && (
                        <tr key={`destroy-${c.sampleContainerId}`}>
                          <td colSpan={6} style={{ padding: '10px 12px', background: '#fff5f5', borderBottom: '1px solid #fecaca' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: 4 }}>Password (e-sig)</div>
                                <input type="password" style={{ ...inp, margin: 0, width: 140 }} value={destroyForm.password}
                                  onChange={e => setDestroyForm(f => ({ ...f, password: e.target.value }))} placeholder="Your password" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: 4 }}>Reason</div>
                                <input style={{ ...inp, margin: 0 }} value={destroyForm.reason}
                                  onChange={e => setDestroyForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Stability testing complete" />
                              </div>
                              <button type="button" onClick={() => submitDestroy(c.sampleContainerId)}
                                style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                Confirm Destroy
                              </button>
                              <button type="button" onClick={() => setDestroyingId(null)}
                                style={{ padding: '7px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </div>
                            {destroyError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{destroyError}</p>}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </Drawer>
      )}

      {detailSampleId !== null && (
        <SampleDetailSheet
          sampleId={detailSampleId}
          onClose={() => { setDetailSampleId(null); setDetailExtraInfo(undefined) }}
          extraInfo={detailExtraInfo}
        />
      )}

      {/* ── Assign Spec Drawer ───────────────────────────────────────────── */}
      {showAssignSpec && (
        <Drawer title="Assign Specification Template" subtitle="Select a product test plan for this sample." onClose={() => setShowAssignSpec(null)}>
          {specAssignLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              🔍 Loading specification candidates…
            </div>
          ) : specAssignData ? (
            <form onSubmit={submitAssignSpec}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Sample</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                  {specAssignData.sampleNumber}
                </div>
                {specAssignData.specTemplateName && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, fontSize: 12, color: '#0d6e6e' }}>
                    Currently assigned: <strong>{specAssignData.specTemplateName}</strong>
                    {specAssignData.testsCreated > 0 && ` (${specAssignData.testsCreated} tests active)`}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: 10 }}>
                  Available Product Test Plans
                </div>
                {specAssignData.candidates.length === 0 ? (
                  <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                    ⚠ No approved specification templates found for this material/sample type combination.{' '}
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/settings?tab=spec-templates' }}
                      style={{ color: '#b45309', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
                    >
                      Go to Settings → Product Test Plans
                    </button>{' '}to create and approve one first.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {specAssignData.candidates.map(c => (
                      <label key={c.templateId} style={{
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        padding: '10px 14px', borderRadius: 8,
                        border: `1.5px solid ${selectedNewSpecId === c.templateId ? '#0d6e6e' : '#e5e7eb'}`,
                        background: selectedNewSpecId === c.templateId ? '#f0fdfa' : '#fafafa',
                        transition: 'all 0.12s',
                      }}>
                        <input type="radio" name="newSpec" checked={selectedNewSpecId === c.templateId}
                          onChange={() => setSelectedNewSpecId(c.templateId)}
                          style={{ accentColor: '#0d6e6e' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.templateName}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            Version {c.version} · {c.testCount} test(s) · Approved {fmtDate(c.approvedAt)}
                          </div>
                        </div>
                        {selectedNewSpecId === c.templateId && (
                          <span style={{ color: '#0d6e6e', fontSize: 16 }}>✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {assignError && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{assignError}</p>
              )}

              {specAssignData.candidates.length > 0 && (
                <DrawerFooter saving={assignSaving} onCancel={() => setShowAssignSpec(null)} label="Apply Spec & Create Tests" />
              )}
              {specAssignData.candidates.length === 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowAssignSpec(null)}
                    style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div style={{ padding: '16px', color: '#dc2626', fontSize: 13 }}>{assignError || 'Failed to load data.'}</div>
          )}
        </Drawer>
      )}


      {/* ── Dynamic Form Renderer ────────────────────────────────────────────── */}
      {fillFormSample && (
        <DynamicFormRenderer
          sampleId={fillFormSample.sampleId}
          sampleNumber={fillFormSample.sampleNumber}
          onClose={() => setFillFormSample(null)}
          onSubmitted={() => { setFillFormSample(null); load() }}
        />
      )}

    </div>}
    </div>
  )
}
