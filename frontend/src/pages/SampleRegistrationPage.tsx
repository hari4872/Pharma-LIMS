import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Sample {
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  sampleType: string; status: string; barcodePrinted: boolean; dueDate: string
  analystName: string; createdAt: string; isRush?: boolean
  sampleCondition?: string; specTemplateName?: string; testsAutoCreated?: number
}
interface Material   { materialId: number; materialName: string; productType: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string; stage: string }
interface Checkpoint {
  checkpointId: number; checkpointCode: string; triggerMode: string
  checkpointType: string; shiftIntervalHrs: number; isActive: boolean
}

// Phase A — spec match preview
interface SpecCandidate { templateId: number; templateName: string; version: string; approvedAt: string; testCount: number }
interface SpecPreview {
  outcome:    'SingleMatch' | 'MultipleMatches' | 'NoMatch' | 'DraftOnly' | 'ObsoleteOnly'
  templateId: number | null
  candidates: SpecCandidate[]
  message:    string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
}

const TRIGGER_LABEL: Record<string, string> = {
  TimeBased:     'Time-Based schedule',
  OperatorScan:  'Per-batch (operator scan)',
  ProcessLog:    'Process log entry',
  DispatchEvent: 'Dispatch event trigger',
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
export default function SampleRegistrationPage() {
  const { fullName, labId } = useSelector((s: RootState) => s.auth)

  const [data, setData]               = useState<Sample[]>([])
  const [materials, setMaterials]     = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading, setLoading]         = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [showSRF, setShowSRF]         = useState<number | null>(null)
  const [showReprint, setShowReprint] = useState<number | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [reprintReason, setReprintReason] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [materialId, setMaterialId]       = useState('')
  const [sampleTypeId, setSampleTypeId]   = useState('')
  const [selectedCps, setSelectedCps]     = useState<number[]>([])
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
  const [lastSpecResult, setLastSpecResult] = useState<{ outcome: string; message: string; testsCreated: number } | null>(null)

  const [srfForm, setSrfForm] = useState({
    password: '', meaning: 'I confirm this Sample Registration Form', reason: ''
  })

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
    } catch { setAssignError('Failed to load spec candidates') }
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
    } catch (err: any) { setAssignError(err.response?.data?.message ?? 'Assignment failed') }
    finally { setAssignSaving(false) }
  }

  // ── Load master data ────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const [r, mr, str, cpr] = await Promise.all([
      api.get(`/samples${params}`),
      api.get('/materials'),
      api.get('/sample-types'),
      api.get('/checkpoints'),
    ])
    setData(r.data)
    setMaterials(mr.data)
    setSampleTypes(str.data.filter((t: SampleType) => t.typeCode !== 'DSPQC'))
    setCheckpoints(cpr.data.filter((c: Checkpoint) => c.isActive))
    setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  // Pre-select all active checkpoints when the list loads or when the form is opened
  useEffect(() => {
    if (showForm && checkpoints.length > 0 && selectedCps.length === 0) {
      setSelectedCps(checkpoints.map(c => c.checkpointId))
    }
  }, [showForm, checkpoints])

  function toggleCheckpoint(id: number) {
    setSelectedCps(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

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
    setSpecPreview(null); setOverrideSpecId(null)
    if (materialId && sampleTypeId) fetchSpecPreview(materialId, sampleTypeId)
  }, [materialId, sampleTypeId])

  // ── Frequency summary ───────────────────────────────────────────────────────
  function frequencySummary() {
    if (selectedCps.length === 0) return null
    const selected = checkpoints.filter(c => selectedCps.includes(c.checkpointId))
    const modes = [...new Set(selected.map(c => c.triggerMode))]
    if (modes.length === 1) {
      return TRIGGER_LABEL[modes[0]] ?? modes[0]
    }
    return modes.map(m => TRIGGER_LABEL[m] ?? m).join(' · ')
  }

  function hasClockTime() {
    const selected = checkpoints.filter(c => selectedCps.includes(c.checkpointId))
    return selected.some(c => c.triggerMode === 'TimeBased')
  }

  // ── Reset form ──────────────────────────────────────────────────────────────
  function resetForm() {
    setMaterialId(''); setSampleTypeId('')
    setSelectedCps(checkpoints.map(c => c.checkpointId))
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
        mfgDate,
        expDate,
        sampleTypeId: Number(sampleTypeId),
        // Phase A receipt fields
        receivedTemp:          receivedTemp ? parseFloat(receivedTemp) : null,
        sampleCondition:       sampleCondition || null,
        isRush,
        externalBatchId:       externalBatchId || null,
        overrideSpecTemplateId: overrideSpecId ?? null,
        checkpointIds:         selectedCps,
      })
      const result = res.data
      setLastSpecResult({ outcome: result.specOutcome, message: result.specMessage, testsCreated: result.testsAutoCreated })
      setShowForm(false)
      resetForm()
      load()
      // Show outcome toast
      if (result.specOutcome === 'AutoMatch') {
        toast(`✓ ${result.sampleNumber} registered — ${result.testsAutoCreated} test(s) auto-assigned from spec template`, 'success')
      } else if (result.specOutcome === 'ManualOverride') {
        toast(`✓ ${result.sampleNumber} registered — spec applied manually (${result.testsAutoCreated} tests)`, 'success')
      } else {
        toast(`✓ ${result.sampleNumber} registered — assign tests manually in Work Queue`, 'success')
      }
    } catch (err: any) {
      setError(err.friendlyMessage ?? err.response?.data?.message ?? 'Registration failed')
    } finally { setSaving(false) }
  }

  async function submitSRF(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showSRF}/sign-srf`, srfForm)
      setShowSRF(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'E-signature failed') }
    finally { setSaving(false) }
  }

  async function submitReprint(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showReprint}/barcode-reprint`, { reason: reprintReason })
      setShowReprint(null); setReprintReason(''); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Reprint failed') }
    finally { setSaving(false) }
  }

  const freqText = frequencySummary()

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Sample Registration</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Register incoming samples and route to the testing work queue</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select style={{ ...inp, width: 180, margin: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected'].map(s =>
              <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Register Sample
          </button>
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
      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample No.', accessor: r => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.sampleNumber}</strong>
            {r.isRush && (
              <span style={{ padding: '1px 7px', background: '#fee2e2', color: '#dc2626', borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                RUSH
              </span>
            )}
            {r.sampleCondition && r.sampleCondition !== 'OK' && (
              <span style={{ padding: '1px 7px', background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                {r.sampleCondition.toUpperCase()}
              </span>
            )}
          </div>
        ) },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot / Batch', accessor: 'lotNumber' },
        { header: 'Type', accessor: 'sampleType' },
        {
          header: 'Status', accessor: r => {
            const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>{r.status}</span>
          }
        },
        { header: 'Label', accessor: r => <span style={{ fontSize: 12, color: r.barcodePrinted ? '#16a34a' : '#dc2626' }}>{r.barcodePrinted ? '✓ Printed' : '✗ Pending'}</span> },
        {
          header: 'Spec Template', accessor: r => r.specTemplateName
            ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0fdfa', color: '#0d6e6e', fontWeight: 600, border: '1px solid #99f6e4', whiteSpace: 'nowrap' }}>
                ✓ {r.specTemplateName}
              </span>
            : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#92400e', fontWeight: 600, border: '1px solid #fde68a' }}>
                ⚠ Unassigned
              </span>
        },
        { header: 'Due', accessor: r => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
        { header: 'Analyst', accessor: 'analystName' },
        {
          header: 'Actions', accessor: r => (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {r.status === 'Registered' && (
                <button onClick={() => { setShowSRF(r.sampleId); setError('') }}
                  style={{ padding: '3px 9px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  Sign SRF
                </button>
              )}
              {!r.specTemplateName && (
                <button onClick={() => openAssignSpec(r.sampleId)}
                  style={{ padding: '3px 9px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  Assign Spec
                </button>
              )}
              <button onClick={() => { setShowReprint(r.sampleId); setError('') }}
                style={{ padding: '3px 9px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Reprint
              </button>
            </div>
          )
        },
      ]} />

      {/* ── Registration form — 4-section stepped layout ──────────────────── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '32px 16px', overflowY: 'auto'
        }}>
          <div style={{ width: '100%', maxWidth: 760, position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>New Sample Registration</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Complete all sections · Barcode auto-printed on submit</p>
              </div>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 20, width: 34, height: 34, cursor: 'pointer', lineHeight: '34px', textAlign: 'center' }}>
                ×
              </button>
            </div>

            <form onSubmit={submitRegister}>

              {/* ── Section 1: Requestor & Product ─────────────────────── */}
              <Section num={1} title="Requestor & Product" subtitle="Requestor is auto-filled from your login.">
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
                    <span style={label}>Product / Test Type <span style={{ color: '#ef4444' }}>*</span></span>
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
                    <span style={label}>Sample Type <span style={{ color: '#ef4444' }}>*</span></span>
                    <select style={inp} value={sampleTypeId} onChange={e => setSampleTypeId(e.target.value)} required>
                      <option value="">— Select sample type —</option>
                      {sampleTypes.map(t => (
                        <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                      ))}
                    </select>
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
                            {bs.icon} {specPreview.message}
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

              {/* ── Section 2: Checkpoints ──────────────────────────────── */}
              <Section num={2} title="Checkpoints" subtitle="All active checkpoints are pre-selected. Uncheck any that do not apply to this sample.">
                {checkpoints.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No active checkpoints configured. Please add checkpoints in master data first.</p>
                ) : (
                  <>
                    {/* Select / deselect all controls */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <button type="button"
                        onClick={() => setSelectedCps(checkpoints.map(c => c.checkpointId))}
                        style={{ fontSize: 12, color: '#1e3a5f', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                        ✓ Select All
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button type="button"
                        onClick={() => setSelectedCps([])}
                        style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        ✗ Clear All
                      </button>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                        {selectedCps.length} / {checkpoints.length} selected
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {checkpoints.map(cp => {
                        const checked = selectedCps.includes(cp.checkpointId)
                        return (
                          <label key={cp.checkpointId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                              background: checked ? '#eff6ff' : '#f9fafb',
                              border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`,
                              transition: 'all 0.15s'
                            }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCheckpoint(cp.checkpointId)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1e3a5f' }}
                            />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{cp.checkpointCode}</span>
                              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>{cp.checkpointType}</span>
                            </div>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                              background: checked ? '#dbeafe' : '#f3f4f6',
                              color: checked ? '#1e40af' : '#9ca3af'
                            }}>
                              {TRIGGER_LABEL[cp.triggerMode] ?? cp.triggerMode}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </Section>

              {/* ── Section 3: Frequency ────────────────────────────────── */}
              <Section num={3} title="Frequency" subtitle="">
                {selectedCps.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Select checkpoints above to see frequency information.</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 20,
                      background: hasClockTime() ? '#fef9c3' : '#d1fae5',
                      borderRadius: 8, width: 40, height: 40,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {hasClockTime() ? '🕐' : '📋'}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{freqText}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        {hasClockTime()
                          ? 'One or more checkpoints require a scheduled clock time.'
                          : `${selectedCps.length} checkpoint${selectedCps.length > 1 ? 's' : ''} selected — all per-batch; no clock time required.`}
                      </p>
                    </div>
                  </div>
                )}
              </Section>

              {/* ── Section 4: Sample Source ─────────────────────────────── */}
              <Section num={4} title="Sample Source" subtitle="Helps the lab identify the physical sample.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <span style={label}>Tank / Source ID</span>
                    <input style={inp} value={tankSourceId} onChange={e => setTankSourceId(e.target.value)}
                      placeholder="e.g. 1T4002" />
                  </div>
                  <div>
                    <span style={label}>Sample Label</span>
                    <input style={inp} value={sampleLabel} onChange={e => setSampleLabel(e.target.value)}
                      placeholder="As written on the bottle" />
                  </div>
                  <div>
                    <span style={label}>D.O. / Batch / Lot No. <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} value={lotNumber} onChange={e => setLotNumber(e.target.value)}
                      required placeholder="e.g. B-20260422-03" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={label}>Manufacturing Date <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} required />
                  </div>
                  <div>
                    <span style={label}>Expiry Date <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required />
                  </div>
                </div>
                {/* Phase A — Receipt Condition */}
                <div style={{ marginTop: 18, padding: '16px 18px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#475569', marginBottom: 14 }}>
                    📦 Receipt Condition
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <span style={label}>Received Temp (°C)</span>
                      <input
                        type="number" step="0.1" style={inp}
                        value={receivedTemp}
                        onChange={e => setReceivedTemp(e.target.value)}
                        placeholder="e.g. 5.2"
                      />
                    </div>
                    <div>
                      <span style={label}>Sample Condition <span style={{ color: '#ef4444' }}>*</span></span>
                      <select style={inp} value={sampleCondition} onChange={e => setSampleCondition(e.target.value)}>
                        <option value="OK">✓ OK — Acceptable condition</option>
                        <option value="Damaged">⚠ Damaged — Physical damage noted</option>
                        <option value="Compromised">✗ Compromised — Integrity at risk</option>
                      </select>
                    </div>
                    <div>
                      <span style={label}>External Batch ID</span>
                      <input
                        style={inp}
                        value={externalBatchId}
                        onChange={e => setExternalBatchId(e.target.value)}
                        placeholder="MES / ERP batch ref"
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${isRush ? '#fca5a5' : '#e5e7eb'}`, background: isRush ? '#fff5f5' : '#fff', transition: 'all 0.15s' }}>
                      <input
                        type="checkbox"
                        checked={isRush}
                        onChange={e => setIsRush(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#dc2626', cursor: 'pointer' }}
                      />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isRush ? '#dc2626' : '#374151' }}>
                          🚨 Rush Sample
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>
                          Flags this sample for expedited testing and elevated priority in the Work Queue
                        </span>
                      </div>
                    </label>
                  </div>
                  {sampleCondition !== 'OK' && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                        ⚠ Non-OK condition recorded — QA will be notified for review
                      </span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0' }}>
                  ℹ Sample ID is server-generated · Barcode auto-printed · 5 GMP checks run server-side
                </p>
              </Section>

              {/* ── Submit ──────────────────────────────────────────────── */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠ {error}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '10px 22px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Registering…' : 'Register + Print Barcode'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Sign SRF — §11.50 e-sig ──────────────────────────────────────── */}
      {showSRF && (
        <Modal title="Sign Sample Registration Form (§11.50)" onClose={() => setShowSRF(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR §11.50 — Your full name, timestamp, meaning, and reason will be captured and immutably recorded.
          </p>
          <form onSubmit={submitSRF}>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={srfForm.password}
                onChange={e => setSrfForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={srfForm.meaning}
                onChange={e => setSrfForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={srfForm.reason}
                onChange={e => setSrfForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Sample verified and ready for testing" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSRF(null)} label="Sign & Submit to Work Queue" />
          </form>
        </Modal>
      )}

      {/* ── Barcode Reprint ───────────────────────────────────────────────── */}
      {showReprint && (
        <Modal title="Barcode Label Reprint" onClose={() => setShowReprint(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR 211.170 — Reprint is audit-logged with your name and reason.
          </p>
          <form onSubmit={submitReprint}>
            <Field label="Reason (mandatory)">
              <input style={inp} value={reprintReason} onChange={e => setReprintReason(e.target.value)}
                required placeholder="e.g. Label damaged during storage" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReprint(null)} label="Reprint Label" />
          </form>
        </Modal>
      )}

      {/* ── Assign Spec Modal ─────────────────────────────────────────────── */}
      {showAssignSpec && (
        <Modal title="Assign Specification Template" onClose={() => setShowAssignSpec(null)}>
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
                  Available Spec Templates
                </div>
                {specAssignData.candidates.length === 0 ? (
                  <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                    ⚠ No approved specification templates found for this material/sample type combination.
                    Create and approve a specification template in Settings → Spec Templates first.
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
                            Version {c.version} · {c.testCount} test(s) · Approved {new Date(c.approvedAt).toLocaleDateString()}
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
                <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{assignError}</p>
              )}

              {specAssignData.candidates.length > 0 && (
                <ModalFooter saving={assignSaving} onCancel={() => setShowAssignSpec(null)} label="Apply Spec & Create Tests" />
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
            <div style={{ padding: '16px', color: '#ef4444', fontSize: 13 }}>{assignError || 'Failed to load data.'}</div>
          )}
        </Modal>
      )}
    </div>
  )
}
