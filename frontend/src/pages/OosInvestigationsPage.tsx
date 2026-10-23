import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { fmtDate } from '@/utils/dateFormat'
import { fmtLabel, fmtCalc } from '@/utils/formatLabel'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { toast } from '@/components/Toast'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface OosItem {
  investigationId: number; executionId: number; sampleId: number; sampleNumber: string
  parameterId: number; parameterName: string
  flagType: string; phase: string; status: string
  rootCause: string | null
  openedAt: string; closedAt: string | null; createdBy: string
  retestExecutionId?: number
  retestCompleted?: boolean
  retestCycleCount?: number
  resolutionType?: string
  // Group C — Genuine OOS rework path
  reworkExecutionId?: number
  postReworkRetestExecutionId?: number
  postReworkRetestCompleted?: boolean
  finalDecision?: string
  inspectionScope?: string
}

interface ComparisonEntry { rawValue: string; calculatedResult: number | null; specMin?: number | null; specMax?: number | null; passFail: string; date: string; analystName?: string }
interface RetestCycleEntry { cycleNumber: number; executionId: number; completed: boolean; rawValue?: string | null; calculatedResult?: number | null; specMin?: number | null; specMax?: number | null; passFail?: string | null; analystName?: string; date?: string | null }
interface ComparisonData { parameterId: number; parameterName: string; uom: string; original: ComparisonEntry; retestCycles?: RetestCycleEntry[]; retest?: ComparisonEntry | null; postReworkRetest?: ComparisonEntry | null }

const FLAG_COLORS: Record<string, { bg: string; color: string }> = {
  OOS: { bg: '#fee2e2', color: '#991b1b' },
  OOT: { bg: '#fef9c3', color: '#854d0e' },
}

const STAGES = [
  { key: 'Open',   label: 'Open',   color: '#991b1b', bg: '#fee2e2' },
  { key: 'Closed', label: 'Closed', color: '#065f46', bg: '#d1fae5' },
]

interface EligibleEntry {
  entryId: number; executionId: number; parameterName: string
  rawValue: string; calculatedResult: number | null; passFail: string
  isOos: boolean; isOot: boolean; createdAt: string
}

export default function OosInvestigationsPage() {
  const [data, setData] = useState<OosItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Open')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showClose, setShowClose] = useState<OosItem | null>(null)
  const [closeForm, setCloseForm] = useState({ rootCause: '', resolutionType: 'LabError', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [rcSuggestions, setRcSuggestions] = useState<{cause:string,confidence:string,reasoning:string}[]>([])
  const [rcLoading, setRcLoading] = useState(false)

  // Phase 2 escalation modal
  const [showEscalate, setShowEscalate] = useState<OosItem | null>(null)
  const [escalateForm, setEscalateForm] = useState({ escalationReason: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' })
  const [escalateSaving, setEscalateSaving] = useState(false)
  const [escalateError, setEscalateError] = useState('')

  // Add Record modal
  const [showAdd, setShowAdd] = useState(false)
  const [addSampleNumber, setAddSampleNumber] = useState('')
  const [addSearching, setAddSearching] = useState(false)
  const [addEntries, setAddEntries] = useState<EligibleEntry[]>([])
  const [addSearchError, setAddSearchError] = useState('')
  const [addForm, setAddForm] = useState({ entryId: '', flagType: 'OOS' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  // Retest modal state
  const [showRetest, setShowRetest] = useState<OosItem | null>(null)
  const [retestForm, setRetestForm] = useState({ notes: '' })
  const [retestSaving, setRetestSaving] = useState(false)
  const [retestError, setRetestError] = useState('')


  // Authorize Rework drawer (Phase 2 GenuineOOS path)
  const [showRework, setShowRework] = useState<OosItem | null>(null)
  const [reworkNotes, setReworkNotes] = useState('')
  const [reworkSaving, setReworkSaving] = useState(false)
  const [reworkError, setReworkError] = useState('')

  // Create Post-Rework Retest drawer
  const [showPostReworkRetest, setShowPostReworkRetest] = useState<OosItem | null>(null)
  const [postReworkNotes, setPostReworkNotes] = useState('')
  const [postReworkSaving, setPostReworkSaving] = useState(false)
  const [postReworkError, setPostReworkError] = useState('')

  // QA Final Decision drawer
  const [showFinalDecision, setShowFinalDecision] = useState<OosItem | null>(null)
  const [finalDecisionForm, setFinalDecisionForm] = useState({ decision: 'Release', notes: '', password: '', meaning: 'I confirm the QA final disposition of this batch', reason: '' })
  const [finalDecisionSaving, setFinalDecisionSaving] = useState(false)
  const [finalDecisionError, setFinalDecisionError] = useState('')
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)

  // Auto-fetch AI suggestions + retest cycle data when Close modal opens
  useEffect(() => {
    if (showClose) {
      fetchRcSuggestions()
      loadComparison(showClose.investigationId)
    }
  }, [showClose])
  // Auto-set resolution type from the latest completed retest cycle result
  useEffect(() => {
    if (!showClose || !comparisonData) return
    const cycles = comparisonData.retestCycles ?? []
    const lastCompleted = [...cycles].reverse().find(c => c.completed && c.passFail != null)
    if (!lastCompleted) return
    const suggested = lastCompleted.passFail === 'Pass' ? 'LabError' : 'GenuineOOS'
    setCloseForm(f => ({ ...f, resolutionType: suggested }))
  }, [comparisonData])

  // Auto-fetch comparison data when Final Decision drawer opens
  useEffect(() => { if (showFinalDecision) loadComparison(showFinalDecision.investigationId) }, [showFinalDecision])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/oos-investigations')
      setData(r.data)
    } finally { setLoading(false) }
  }
  useEffect(() => {
    const t = setTimeout(load, 0)
    const interval = setInterval(load, 30000)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.openedAt < dateFrom) return false
      if (dateTo && r.openedAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, statusFilter, dateFrom, dateTo])

  async function downloadPdf(item: OosItem) {
    try {
      const r = await api.get(`/oos-investigations/${item.investigationId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `OOS_${String(item.investigationId).padStart(5,'0')}_${item.sampleNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(`OOS-${String(item.investigationId).padStart(5,'0')} report downloaded`, 'success')
    } catch {
      toast('Failed to download PDF', 'error')
    }
  }

  async function fetchRcSuggestions() {
    if (!showClose) return
    setRcLoading(true)
    try {
      const r = await api.post(`/oos-investigations/${showClose.investigationId}/suggest-root-cause`, {})
      setRcSuggestions(r.data.suggestions ?? [])
    } catch {
      setRcSuggestions([
        { cause: 'Analyst error or technique deviation', confidence: 'Medium', reasoning: 'Re-test with a second analyst per FDA OOS guidance.' },
        { cause: 'Instrument calibration drift', confidence: 'Medium', reasoning: 'Verify instrument calibration status and last service record.' },
        { cause: 'Sample integrity deviation', confidence: 'Low', reasoning: 'Check storage conditions and sample container closure.' },
      ])
    } finally { setRcLoading(false) }
  }

  async function submitEscalate(e: React.FormEvent) {
    e.preventDefault(); setEscalateSaving(true); setEscalateError('')
    try {
      await api.post(`/oos-investigations/${showEscalate!.investigationId}/escalate-phase2`, escalateForm)
      setShowEscalate(null)
      setEscalateForm({ escalationReason: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' })
      await load()
      toast(`Investigation escalated to Phase 2`, 'success')
    } catch (err) { setEscalateError(getErrorMessage(err, 'Escalation failed')) }
    finally { setEscalateSaving(false) }
  }

  async function searchEligibleEntries(e: React.FormEvent) {
    e.preventDefault()
    setAddSearching(true); setAddSearchError(''); setAddEntries([]); setAddForm(f => ({ ...f, entryId: '' }))
    try {
      const r = await api.get(`/oos-investigations/eligible-entries?sampleNumber=${encodeURIComponent(addSampleNumber.trim())}`)
      if (r.data.entries.length === 0) {
        setAddSearchError('No eligible logbook entries found for this sample (all may already have investigations).')
      } else {
        setAddEntries(r.data.entries)
        setAddForm(f => ({ ...f, entryId: String(r.data.entries[0].entryId) }))
      }
    } catch (err) { setAddSearchError(getErrorMessage(err, 'Sample not found')) }
    finally { setAddSearching(false) }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault(); setAddSaving(true); setAddError('')
    try {
      await api.post('/oos-investigations', { entryId: Number(addForm.entryId), flagType: addForm.flagType })
      setShowAdd(false)
      setAddSampleNumber(''); setAddEntries([]); setAddForm({ entryId: '', flagType: 'OOS' })
      setAddSearchError(''); setAddError('')
      await load()
      setStatusFilter('Open')
      toast('Investigation created successfully', 'success')
    } catch (err) { setAddError(getErrorMessage(err, 'Failed to create investigation')) }
    finally { setAddSaving(false) }
  }

  async function submitClose(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/oos-investigations/${showClose!.investigationId}/close`, closeForm)
      setCloseForm({ rootCause: '', resolutionType: 'LabError', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
      setShowClose(null); await load()
      setStatusFilter('Closed')
    } catch (err) { setError(getErrorMessage(err, 'Close failed')) }
    finally { setSaving(false) }
  }

  async function submitRetest(e: React.FormEvent) {
    e.preventDefault(); setRetestSaving(true); setRetestError('')
    try {
      await api.post(`/oos-investigations/${showRetest!.investigationId}/create-retest`, { notes: retestForm.notes || null })
      setShowRetest(null)
      setRetestForm({ notes: '' })
      await load()
      toast(`Retest task created for ${showRetest!.sampleNumber}`, 'success')
    } catch (err) { setRetestError(getErrorMessage(err, 'Failed to create retest')) }
    finally { setRetestSaving(false) }
  }

  async function submitRework(e: React.FormEvent) {
    e.preventDefault(); setReworkSaving(true); setReworkError('')
    try {
      await api.post(`/oos-investigations/${showRework!.investigationId}/authorize-rework`, { notes: reworkNotes || null })
      setShowRework(null); setReworkNotes('')
      await load()
      toast(`Rework task authorized for ${showRework!.sampleNumber}`, 'success')
    } catch (err) { setReworkError(getErrorMessage(err, 'Failed to authorize rework')) }
    finally { setReworkSaving(false) }
  }

  async function submitPostReworkRetest(e: React.FormEvent) {
    e.preventDefault(); setPostReworkSaving(true); setPostReworkError('')
    try {
      await api.post(`/oos-investigations/${showPostReworkRetest!.investigationId}/create-postrework-retest`, { notes: postReworkNotes || null })
      setShowPostReworkRetest(null); setPostReworkNotes('')
      await load()
      toast(`Post-rework retest created for ${showPostReworkRetest!.sampleNumber}`, 'success')
    } catch (err) { setPostReworkError(getErrorMessage(err, 'Failed to create post-rework retest')) }
    finally { setPostReworkSaving(false) }
  }

  async function loadComparison(investigationId: number) {
    setComparisonLoading(true); setComparisonData(null)
    try {
      const r = await api.get(`/oos-investigations/${investigationId}/comparison`)
      setComparisonData(r.data)
    } catch { /* non-critical — drawer still works without data */ }
    finally { setComparisonLoading(false) }
  }

  async function submitFinalDecision(e: React.FormEvent) {
    e.preventDefault(); setFinalDecisionSaving(true); setFinalDecisionError('')
    try {
      await api.post(`/oos-investigations/${showFinalDecision!.investigationId}/final-decision`, finalDecisionForm)
      setShowFinalDecision(null)
      setFinalDecisionForm({ decision: 'Release', notes: '', password: '', meaning: 'I confirm the QA final disposition of this batch', reason: '' })
      setComparisonData(null)
      await load()
      toast(`QA final decision recorded: ${finalDecisionForm.decision}`, 'success')
    } catch (err) { setFinalDecisionError(getErrorMessage(err, 'Failed to record final decision')) }
    finally { setFinalDecisionSaving(false) }
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', marginRight: 4 }}>OOS / OOT Investigations</h2>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={statusFilter} onChange={setStatusFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setShowAdd(true); setAddSampleNumber(''); setAddEntries([]); setAddForm({ entryId: '', flagType: 'OOS' }); setAddSearchError(''); setAddError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(220,38,38,0.25)',
            }}>
            + Add Record
          </button>
        </div>
      </div>

      <DataTable loading={loading} data={filtered} columns={[
        { header: 'Sample', accessor: r => (
          <button onClick={() => setDetailSampleId(r.sampleId)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline' }}>
            {r.sampleNumber}
          </button>
        )},
        { header: 'Parameter', accessor: 'parameterName' },
        { header: 'Type', accessor: r => {
          const c = FLAG_COLORS[r.flagType] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{r.flagType}</span>
        }},
        { header: 'Phase', accessor: r => <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtLabel(r.phase)}</span> },
        { header: 'Status', accessor: r => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
              background: r.status === 'Open' ? '#fee2e2' : '#d1fae5',
              color: r.status === 'Open' ? '#991b1b' : '#065f46', fontWeight: 500 }}>{fmtLabel(r.status)}</span>
            {r.retestExecutionId && (
              <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: r.retestCompleted ? '#dcfce7' : '#ede9fe',
                color: r.retestCompleted ? '#16a34a' : '#6d28d9', width: 'fit-content' }}>
                {r.retestCompleted ? '✓ Retest Done' : 'Retest Pending'}
              </span>
            )}
          </div>
        )},
        { header: 'Opened', accessor: r => fmtDate(r.openedAt) },
        { header: 'Closed', accessor: r => r.closedAt ? fmtDate(r.closedAt) : '—' },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
            {r.status === 'Open' && r.phase === 'Phase1' && (
              <button
                onClick={() => { setShowEscalate(r); setEscalateForm({ escalationReason: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' }); setEscalateError('') }}
                title="Escalate to Phase 2 — FDA OOS Guidance"
                style={{
                  background: '#fef3c7', border: '1px solid #fcd34d',
                  color: '#92400e', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                ↑ Phase 2
              </button>
            )}
            {r.status === 'Open' && (
              <button
                onClick={() => { setShowRetest(r); setRetestForm({ notes: '' }); setRetestError('') }}
                title={`Create Retest Task — same analyst, same parameter${r.retestCycleCount ? ` (${r.retestCycleCount} previous)` : ''}`}
                style={{
                  background: '#ede9fe', border: '1px solid #c4b5fd',
                  color: '#6d28d9', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                🔁 Retest{r.retestCycleCount ? ` (${r.retestCycleCount})` : ''}
              </button>
            )}
            {r.status === 'Open' && r.phase === 'Phase2' && !r.reworkExecutionId && (
              <button
                onClick={() => { setShowRework(r); setReworkNotes(''); setReworkError('') }}
                title="Authorize Rework — genuine OOS batch rework"
                style={{
                  background: '#fff7ed', border: '1px solid #fdba74',
                  color: '#c2410c', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                🔧 Authorize Rework
              </button>
            )}
            {r.status === 'Open' && r.reworkExecutionId && !r.postReworkRetestExecutionId && (
              <button
                onClick={() => { setShowPostReworkRetest(r); setPostReworkNotes(''); setPostReworkError('') }}
                title="Create Post-Rework Retest — confirm rework result"
                style={{
                  background: '#ede9fe', border: '1px solid #c4b5fd',
                  color: '#7c3aed', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                🔁 Post-Rework Test
              </button>
            )}
            {r.status === 'Open' && r.postReworkRetestExecutionId && !r.finalDecision && (
              <button
                onClick={() => { setShowFinalDecision(r); setFinalDecisionForm({ decision: 'Release', notes: '', password: '', meaning: 'I confirm the QA final disposition of this batch', reason: '' }); setFinalDecisionError('') }}
                title="QA Final Decision — Release or Reject batch"
                style={{
                  background: '#eff6ff', border: '1px solid #93c5fd',
                  color: '#1d4ed8', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                ⚖️ QA Decision
              </button>
            )}
            {r.status === 'Open' && (
              <button
                onClick={() => { setShowClose(r); setCloseForm({ rootCause: '', resolutionType: 'LabError', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' }); setError(''); setRcSuggestions([]) }}
                style={{
                  background: '#dcfce7', border: '1px solid #86efac',
                  color: '#15803d', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(22,163,74,0.15)',
                }}>
                ✓ Close
              </button>
            )}
            <button
              onClick={() => downloadPdf(r)}
              title="Download OOS Investigation Report PDF"
              style={{
                background: '#ede9fe', border: '1px solid #c4b5fd',
                color: '#7c3aed', cursor: 'pointer', fontSize: 12,
                fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              }}>
              PDF
            </button>
          </div>
        )},
      ]} />

      {detailSampleId !== null && <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} context="qa" />}

      {showAdd && (
        <Drawer title="Add OOS / OOT Investigation" subtitle="Manually open an investigation for a result not automatically flagged." onClose={() => setShowAdd(false)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Manually open an investigation for a logbook entry that was not automatically flagged.
          </p>

          {/* Step 1: sample search */}
          <Field label="Sample Number">
            <form onSubmit={searchEligibleEntries} style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }}
                value={addSampleNumber}
                onChange={e => { setAddSampleNumber(e.target.value); setAddEntries([]); setAddSearchError('') }}
                placeholder="e.g. LAB-001-2026-001"
                required />
              <button type="submit" disabled={addSearching}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {addSearching ? 'Searching…' : 'Search'}
              </button>
            </form>
            {addSearchError && <p style={{ margin: '4px 0 0', color: '#dc2626', fontSize: 12 }}>{addSearchError}</p>}
          </Field>

          {/* Step 2: entry + flag selection, shown after successful search */}
          {addEntries.length > 0 && (
            <form onSubmit={submitAdd}>
              <Field label="Logbook Entry / Parameter">
                <select style={inp} value={addForm.entryId} onChange={e => setAddForm(f => ({ ...f, entryId: e.target.value }))} required>
                  {addEntries.map(en => (
                    <option key={en.entryId} value={en.entryId}>
                      {en.parameterName} — result: {en.calculatedResult != null ? fmtCalc(en.calculatedResult) : en.rawValue} ({en.passFail})
                      {en.isOos ? ' ⚠ OOS' : ''}{en.isOot ? ' ⚠ OOT' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Investigation Type">
                <div style={{ display: 'flex', gap: 12 }}>
                  {['OOS', 'OOT'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, fontWeight: addForm.flagType === type ? 700 : 400 }}>
                      <input type="radio" name="flagType" value={type}
                        checked={addForm.flagType === type}
                        onChange={() => setAddForm(f => ({ ...f, flagType: type }))} />
                      <span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        background: type === 'OOS' ? '#fee2e2' : '#fef9c3',
                        color: type === 'OOS' ? '#991b1b' : '#854d0e',
                      }}>{type}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {addError && <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0' }}>{addError}</p>}
              <DrawerFooter saving={addSaving} onCancel={() => setShowAdd(false)} label="Create Investigation" />
            </form>
          )}
        </Drawer>
      )}

      {showEscalate && (
        <Drawer title={`Escalate to Phase 2 — ${showEscalate.sampleNumber}`} onClose={() => setShowEscalate(null)} blocking width={460}>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>FDA OOS Guidance — Phase 2 Escalation</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f' }}>
              Phase 2 investigation involves laboratory investigation by a second analyst and/or supervisor review. E-signature required (21 CFR §11.50).
            </p>
          </div>
          <form onSubmit={submitEscalate}>
            <Field label="Escalation Reason (mandatory)">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }}
                value={escalateForm.escalationReason}
                onChange={e => setEscalateForm(f => ({ ...f, escalationReason: e.target.value }))}
                required placeholder="Describe why Phase 1 investigation is insufficient and Phase 2 escalation is required…" />
            </Field>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 4 }}>E-Signature (21 CFR §11.300)</p>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" autoFocus value={escalateForm.password}
                onChange={e => setEscalateForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={escalateForm.meaning}
                onChange={e => setEscalateForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={escalateForm.reason}
                onChange={e => setEscalateForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Phase 1 inconclusive — lab error not confirmed, phase 2 required per SOP" />
            </Field>
            {escalateError && <p style={{ color: '#dc2626', fontSize: 13 }}>{escalateError}</p>}
            <DrawerFooter saving={escalateSaving} onCancel={() => setShowEscalate(null)} label="Escalate & Sign" />
          </form>
        </Drawer>
      )}

      {showRetest && (
        <Drawer title={`Create Retest Task — ${showRetest.sampleNumber}${showRetest.retestCycleCount ? ` (Cycle ${showRetest.retestCycleCount + 1})` : ''}`} onClose={() => setShowRetest(null)} blocking width={460}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
              {showRetest.retestCycleCount ? `Creating Retest Cycle ${showRetest.retestCycleCount + 1} of 5.` : 'Same analyst will be pre-assigned to the retest.'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#1e3a8a' }}>
              A new test execution appears in the Work Queue tagged <b>RETEST</b>. The Lab Manager can reassign if required. The original FAIL result is permanently retained per 21 CFR Part 11.
            </p>
          </div>
          <form onSubmit={submitRetest}>
            <Field label="Notes (optional)">
              <textarea style={{ ...inp, height: 72, resize: 'vertical' }}
                value={retestForm.notes}
                onChange={e => setRetestForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Analyst technique suspected — retest with same reagent batch…" />
            </Field>
            {retestError && <p style={{ color: '#dc2626', fontSize: 13 }}>{retestError}</p>}
            <DrawerFooter saving={retestSaving} onCancel={() => setShowRetest(null)} label="🔁 Create Retest Task" />
          </form>
        </Drawer>
      )}

      {showRework && (
        <Drawer title={`Authorize Rework — ${showRework.sampleNumber}`} onClose={() => setShowRework(null)} blocking width={460}>
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#c2410c', fontWeight: 600 }}>Genuine OOS — Phase 2 Rework Authorization</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9a3412' }}>
              This creates a <b>REWORK</b> task in the Work Queue. The batch will be physically reprocessed, then a post-rework retest confirms the result. The original OOS record is permanently retained per 21 CFR Part 11.
            </p>
          </div>
          <form onSubmit={submitRework}>
            <Field label="Authorization Notes (optional)">
              <textarea style={{ ...inp, height: 72, resize: 'vertical' }}
                value={reworkNotes}
                onChange={e => setReworkNotes(e.target.value)}
                placeholder="e.g. Batch authorized for rework — moisture content deviation confirmed genuine…" />
            </Field>
            {reworkError && <p style={{ color: '#dc2626', fontSize: 13 }}>{reworkError}</p>}
            <DrawerFooter saving={reworkSaving} onCancel={() => setShowRework(null)} label="🔧 Authorize Rework" />
          </form>
        </Drawer>
      )}

      {showPostReworkRetest && (
        <Drawer title={`Create Post-Rework Retest — ${showPostReworkRetest.sampleNumber}`} onClose={() => setShowPostReworkRetest(null)} blocking width={460}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af', fontWeight: 600 }}>Post-Rework Retest</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#1e3a8a' }}>
              Confirms whether the reworked product now meets specification. A new <b>RETEST</b> task appears in the Work Queue. Once complete, you can record the QA Final Decision.
            </p>
          </div>
          <form onSubmit={submitPostReworkRetest}>
            <Field label="Notes (optional)">
              <textarea style={{ ...inp, height: 72, resize: 'vertical' }}
                value={postReworkNotes}
                onChange={e => setPostReworkNotes(e.target.value)}
                placeholder="e.g. Post-rework retest — verify moisture content after drying step…" />
            </Field>
            {postReworkError && <p style={{ color: '#dc2626', fontSize: 13 }}>{postReworkError}</p>}
            <DrawerFooter saving={postReworkSaving} onCancel={() => setShowPostReworkRetest(null)} label="🔁 Create Post-Rework Retest" />
          </form>
        </Drawer>
      )}

      {showFinalDecision && (
        <Drawer title={`QA Final Decision — ${showFinalDecision.sampleNumber}`} onClose={() => setShowFinalDecision(null)} blocking width={520}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            FDA OOS Guidance — final QA disposition after rework and post-rework retest. This action closes the investigation and updates the sample status.
          </p>

          {/* Comparison Table */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>Result Comparison</p>
            {comparisonLoading ? (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '12px 0' }}>Loading comparison data…</div>
            ) : comparisonData ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Stage</th>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Calc. Result</th>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Spec</th>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>P/F</th>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Analyst</th>
                    <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Date / Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Original', data: comparisonData.original as ComparisonEntry | null, bg: '#fef2f2', cycleNum: 0 },
                    // Multi-cycle retests (new path)
                    ...(comparisonData.retestCycles ?? []).map(c => ({
                      label: `Retest ${c.cycleNumber}`,
                      data: c.completed && c.rawValue != null ? {
                        rawValue: c.rawValue!, calculatedResult: c.calculatedResult ?? null,
                        specMin: c.specMin, specMax: c.specMax,
                        passFail: c.passFail ?? 'Pending', date: c.date ?? '', analystName: c.analystName
                      } as ComparisonEntry : null,
                      pendingLabel: !c.completed ? `Retest ${c.cycleNumber} — pending` : null,
                      bg: '#f0fdf4', cycleNum: c.cycleNumber,
                    })),
                    // Legacy single-retest fallback (investigations before multi-cycle)
                    ...((comparisonData.retestCycles ?? []).length === 0 && comparisonData.retest
                      ? [{ label: 'Retest', data: comparisonData.retest, bg: '#f0fdf4', cycleNum: 1, pendingLabel: undefined }]
                      : []),
                    { label: 'Post-Rework Retest', data: comparisonData.postReworkRetest ?? null, bg: '#f0fdf4', cycleNum: 0 },
                  ].filter(row => row.data || (row as any).pendingLabel).map(row => {
                    if ((row as any).pendingLabel) return (
                      <tr key={row.label} style={{ background: '#f8fafc' }}>
                        <td colSpan={6} style={{ padding: '6px 10px', fontSize: 12, color: '#6b7280', fontStyle: 'italic', borderBottom: '1px solid #e2e8f0' }}>
                          {(row as any).pendingLabel} — analyst has not submitted results yet
                        </td>
                      </tr>
                    )
                    const val = row.data!.calculatedResult != null
                      ? fmtCalc(row.data!.calculatedResult)
                      : row.data!.rawValue
                    const pf = row.data!.passFail
                    const pfBg = pf === 'Pass' ? '#dcfce7' : pf === 'Fail' ? '#fee2e2' : '#f1f5f9'
                    const pfColor = pf === 'Pass' ? '#15803d' : pf === 'Fail' ? '#991b1b' : '#374151'
                    // Parse unit counts from JSON rawValue (UnitBased parameters)
                    let unitCounts: { inspected?: string; passed?: string; failed?: string } | null = null
                    try {
                      if (row.data!.rawValue?.startsWith('{')) {
                        const o = JSON.parse(row.data!.rawValue)
                        if (o.UNITS_INSPECTED != null || o.UNITS_PASSED != null || o.UNITS_FAILED != null)
                          unitCounts = { inspected: o.UNITS_INSPECTED, passed: o.UNITS_PASSED, failed: o.UNITS_FAILED }
                      }
                    } catch {}
                    return (
                    <tr key={row.label} style={{ background: row.bg }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{row.label}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #e2e8f0', color: pf === 'Fail' ? '#dc2626' : '#111827' }}>
                        {val} {comparisonData.uom}
                        {unitCounts && (
                          <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'sans-serif', marginTop: 2 }}>
                            {unitCounts.inspected && `${unitCounts.inspected} inspected`}
                            {unitCounts.passed && ` · ${unitCounts.passed} passed`}
                            {unitCounts.failed && <span style={{ color: '#dc2626' }}> · {unitCounts.failed} failed</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#6b7280', borderBottom: '1px solid #e2e8f0' }}>
                        {row.data!.specMin != null ? `${row.data!.specMin} – ${row.data!.specMax} ${comparisonData.uom}` : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: pfBg, color: pfColor }}>{pf ?? '—'}</span>
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', color: '#6b7280' }}>{row.data!.analystName ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', color: '#6b7280' }}>
                        {row.data!.date ? new Date(row.data!.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            ) : (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                Comparison data not available — results are visible in the Work Queue.
              </div>
            )}
          </div>

          <form onSubmit={submitFinalDecision}>
            <Field label="Decision">
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { value: 'Release', label: '✅ Release', desc: 'Rework successful — send to QA Review', bg: '#dcfce7', border: '#86efac', text: '#15803d' },
                  { value: 'Reject',  label: '❌ Reject',  desc: 'Rework failed — batch rejected',       bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', flex: 1, padding: '8px 10px', borderRadius: 8, border: `2px solid ${finalDecisionForm.decision === opt.value ? opt.border : '#e5e7eb'}`, background: finalDecisionForm.decision === opt.value ? opt.bg : '#fff' }}>
                    <input type="radio" name="decision" value={opt.value}
                      checked={finalDecisionForm.decision === opt.value}
                      onChange={() => setFinalDecisionForm(f => ({ ...f, decision: opt.value }))}
                      style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: finalDecisionForm.decision === opt.value ? opt.text : '#1e1b4b' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Notes (optional)">
              <textarea style={{ ...inp, height: 60, resize: 'vertical' }}
                value={finalDecisionForm.notes}
                onChange={e => setFinalDecisionForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Post-rework retest passed — batch meets all specification limits…" />
            </Field>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 4 }}>E-Signature (21 CFR §11.300)</p>
            <Field label="Password (re-enter)"><input style={inp} type="password" autoFocus value={finalDecisionForm.password} onChange={e => setFinalDecisionForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={finalDecisionForm.meaning} onChange={e => setFinalDecisionForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={finalDecisionForm.reason} onChange={e => setFinalDecisionForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Post-rework retest confirms batch now meets specification" /></Field>
            {finalDecisionError && <p style={{ color: '#dc2626', fontSize: 13 }}>{finalDecisionError}</p>}
            <DrawerFooter saving={finalDecisionSaving} onCancel={() => setShowFinalDecision(null)} label="⚖️ Record Final Decision" />
          </form>
        </Drawer>
      )}

      {showClose && (
        <Drawer title={`Close ${showClose.flagType} Investigation — ${showClose.sampleNumber}`} onClose={() => setShowClose(null)} blocking width={480}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            FDA OOS Guidance Phase 1 — Root cause required before investigation can be closed.
          </p>

          {/* Retest cycle summary — shown when any cycle data exists */}
          {(comparisonData?.retestCycles ?? []).length > 0 && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#334155' }}>Retest Results</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {comparisonData!.retestCycles!.map(c => {
                  const pf = c.passFail
                  const pfColor = pf === 'Pass' ? '#15803d' : pf === 'Fail' ? '#dc2626' : '#6b7280'
                  const pfBg = pf === 'Pass' ? '#dcfce7' : pf === 'Fail' ? '#fee2e2' : '#f1f5f9'
                  return (
                    <div key={c.cycleNumber} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#374151', minWidth: 60 }}>Retest {c.cycleNumber}</span>
                      {c.completed ? (
                        <>
                          <span style={{ fontFamily: 'monospace', color: pfColor }}>
                            {c.calculatedResult != null ? fmtCalc(c.calculatedResult) : c.rawValue ?? '—'}
                          </span>
                          <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: pfBg, color: pfColor }}>{pf ?? '—'}</span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 11 }}>Analyst has not submitted yet</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <form onSubmit={submitClose}>
            <Field label="Root Cause (mandatory)">
              {rcLoading && (
                <div style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Analysing root cause…
                </div>
              )}
              {rcSuggestions.length > 0 && (
                <div style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#1e40af' }}>
                    AI suggestions — click to use:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rcSuggestions.map((s, i) => {
                      const confStyle: Record<string, { bg: string; color: string }> = {
                        High:   { bg: '#dcfce7', color: '#15803d' },
                        Medium: { bg: '#fef9c3', color: '#854d0e' },
                        Low:    { bg: '#f3f4f6', color: '#374151' },
                      }
                      const cs = confStyle[s.confidence] ?? confStyle.Low
                      return (
                        <button key={i} type="button"
                          onClick={() => setCloseForm(f => ({ ...f, rootCause: s.cause }))}
                          title={s.reasoning}
                          style={{
                            background: '#fff', border: '1px solid #bfdbfe',
                            borderRadius: 6, padding: '6px 10px',
                            cursor: 'pointer', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                          <span style={{ fontSize: 12, color: '#1e293b', flex: 1 }}>{s.cause}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '1px 7px', borderRadius: 10,
                            background: cs.bg, color: cs.color,
                            whiteSpace: 'nowrap',
                          }}>{s.confidence}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
                    AI suggestion only — investigator must verify per 21 CFR 211.192
                  </p>
                </div>
              )}
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={closeForm.rootCause} onChange={e => setCloseForm(f => ({ ...f, rootCause: e.target.value }))} required placeholder="Describe the root cause of the OOS/OOT result…" />
            </Field>

            {/* Resolution suggestion banner derived from latest retest cycle */}
            {(() => {
              const cycles = comparisonData?.retestCycles ?? []
              const last = [...cycles].reverse().find(c => c.completed && c.passFail != null)
              if (!last) return null
              const isPass = last.passFail === 'Pass'
              return (
                <div style={{
                  background: isPass ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${isPass ? '#86efac' : '#fca5a5'}`,
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                }}>
                  <span style={{ fontSize: 16 }}>{isPass ? '✅' : '❌'}</span>
                  <span style={{ color: isPass ? '#15803d' : '#991b1b' }}>
                    <strong>Retest {last.cycleNumber} {isPass ? 'passed' : 'failed'}</strong>
                    {' — '}
                    {isPass
                      ? 'Lab Error auto-selected. OOS flag will be cleared on close.'
                      : 'Genuine OOS auto-selected. Sample will be placed on Hold.'}
                  </span>
                </div>
              )
            })()}

            <Field label="Resolution Type">
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { value: 'LabError', label: 'Lab Error', desc: 'Clerical / instrument / analyst error — OOS flag cleared' },
                  { value: 'GenuineOOS', label: 'Genuine OOS', desc: 'Product failure — sample placed on Hold' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', flex: 1, padding: '8px 10px', borderRadius: 8, border: `2px solid ${closeForm.resolutionType === opt.value ? '#6d28d9' : '#e5e7eb'}`, background: closeForm.resolutionType === opt.value ? '#faf5ff' : '#fff' }}>
                    <input type="radio" name="resolutionType" value={opt.value}
                      checked={closeForm.resolutionType === opt.value}
                      onChange={() => setCloseForm(f => ({ ...f, resolutionType: opt.value }))}
                      style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 4 }}>E-Signature (21 CFR §11.300)</p>
            <Field label="Password (re-enter)"><input style={inp} type="password" autoFocus value={closeForm.password} onChange={e => setCloseForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={closeForm.meaning} onChange={e => setCloseForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={closeForm.reason} onChange={e => setCloseForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Phase 1 investigation complete, root cause identified" /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowClose(null)} label="Close & Sign" />
          </form>
        </Drawer>
      )}
    </div>
  )
}
