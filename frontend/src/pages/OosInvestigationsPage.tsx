import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { fmtDate } from '@/utils/dateFormat'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface OosItem {
  investigationId: number; executionId: number; sampleId: number; sampleNumber: string
  parameterId: number; parameterName: string
  flagType: string; phase: string; status: string
  rootCause: string | null; capaRef: string | null
  openedAt: string; closedAt: string | null; createdBy: string
}

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
  const [closeForm, setCloseForm] = useState({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [rcSuggestions, setRcSuggestions] = useState<{cause:string,confidence:string,reasoning:string}[]>([])
  const [rcLoading, setRcLoading] = useState(false)

  // Phase 2 escalation modal
  const [showEscalate, setShowEscalate] = useState<OosItem | null>(null)
  const [escalateForm, setEscalateForm] = useState({ escalationReason: '', capaRef: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' })
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

  // Auto-fetch AI suggestions when Close modal opens — no button needed
  useEffect(() => { if (showClose) fetchRcSuggestions() }, [showClose])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/oos-investigations')
      setData(r.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

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
      a.click()
      URL.revokeObjectURL(url)
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
      setEscalateForm({ escalationReason: '', capaRef: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' })
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
      setCloseForm({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
      setShowClose(null); await load()
      setStatusFilter('Closed')
    } catch (err) { setError(getErrorMessage(err, 'Close failed')) }
    finally { setSaving(false) }
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
        { header: 'Phase', accessor: r => <span style={{ fontSize: 12, color: '#6b7280' }}>{r.phase}</span> },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
            background: r.status === 'Open' ? '#fee2e2' : '#d1fae5',
            color: r.status === 'Open' ? '#991b1b' : '#065f46', fontWeight: 500 }}>{r.status}</span>
        )},
        { header: 'Root Cause', accessor: r => r.rootCause ? <span style={{ fontSize: 12 }}>{r.rootCause}</span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>Pending investigation</span> },
        { header: 'CAPA Ref', accessor: r => r.capaRef || '—' },
        { header: 'Opened', accessor: r => fmtDate(r.openedAt) },
        { header: 'Closed', accessor: r => r.closedAt ? fmtDate(r.closedAt) : '—' },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
            {r.status === 'Open' && r.phase === 'Phase1' && (
              <button
                onClick={() => { setShowEscalate(r); setEscalateForm({ escalationReason: '', capaRef: '', password: '', meaning: 'I authorise escalation of this investigation to Phase 2', reason: '' }); setEscalateError('') }}
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
                onClick={() => { setShowClose(r); setCloseForm({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' }); setError(''); setRcSuggestions([]) }}
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
        <Modal title="Add OOS / OOT Investigation" onClose={() => setShowAdd(false)}>
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
                      {en.parameterName} — result: {en.calculatedResult ?? en.rawValue} ({en.passFail})
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
              <ModalFooter saving={addSaving} onCancel={() => setShowAdd(false)} label="Create Investigation" />
            </form>
          )}
        </Modal>
      )}

      {showEscalate && (
        <Modal title={`Escalate to Phase 2 — ${showEscalate.sampleNumber}`} onClose={() => setShowEscalate(null)}>
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
            <Field label="CAPA Reference">
              <input style={inp} value={escalateForm.capaRef}
                onChange={e => setEscalateForm(f => ({ ...f, capaRef: e.target.value }))}
                placeholder="e.g. CAPA-2026-007" />
            </Field>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 4 }}>E-Signature (21 CFR §11.300)</p>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={escalateForm.password}
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
            <ModalFooter saving={escalateSaving} onCancel={() => setShowEscalate(null)} label="Escalate & Sign" />
          </form>
        </Modal>
      )}

      {showClose && (
        <Modal title={`Close ${showClose.flagType} Investigation — ${showClose.sampleNumber}`} onClose={() => setShowClose(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            FDA OOS Guidance Phase 1 — Root cause and CAPA reference required before investigation can be closed.
          </p>
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
            <Field label="CAPA Reference">
              <input style={inp} value={closeForm.capaRef} onChange={e => setCloseForm(f => ({ ...f, capaRef: e.target.value }))} placeholder="e.g. CAPA-2026-005" />
            </Field>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={closeForm.password} onChange={e => setCloseForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={closeForm.meaning} onChange={e => setCloseForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={closeForm.reason} onChange={e => setCloseForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Phase 1 investigation complete, root cause identified" /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowClose(null)} label="Close & Sign" />
          </form>
        </Modal>
      )}
    </div>
  )
}
