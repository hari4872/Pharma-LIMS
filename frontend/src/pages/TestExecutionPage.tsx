import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { getErrorMessage } from '@/utils/errors'

interface Execution {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  materialId: number; lotNumber: string; analystName: string; instrumentCode: string
  status: string; startedAt: string | null; dueDate: string | null
}
interface Parameter {
  parameterId: number; parameterCode: string; parameterName: string
  uom: string; dataType: string; isCritical: boolean; isMandatory: boolean
  calcFormula: string | null; decimalPlaces: number | null
}
interface EvidenceFile {
  evidenceId: number; fileRef: string; description: string | null
  uploadedByName: string; uploadedAt: string
}
interface SpecLimit {
  specLimitId: number; parameterId: number
  minValue: number | null; maxValue: number | null
  ootMinValue: number | null; ootMaxValue: number | null
}
interface ResultRow {
  entryId: number; parameterId: number; parameterName: string
  rawValue: string; calculatedResult: number | null
  passFail: string; isOos: boolean; isOot: boolean; isCritical: boolean; hasEvidence: boolean
}

const DRAFT_KEY = (id: string) => `lims-draft-exec-${id}`

function formatSpec(s: SpecLimit | undefined): string {
  if (!s) return '—'
  if (s.minValue !== null && s.maxValue !== null) return `${s.minValue} – ${s.maxValue}`
  if (s.minValue !== null) return `NLT ${s.minValue}`
  if (s.maxValue !== null) return `NMT ${s.maxValue}`
  return '—'
}

function evalValue(raw: string, spec: SpecLimit | undefined, dataType: string): 'pass' | 'fail' | 'oot' | 'pending' {
  if (!raw.trim()) return 'pending'
  if (dataType === 'Numeric' || dataType === 'Calculated') {
    const n = parseFloat(raw)
    if (isNaN(n)) return 'pending'
    if (!spec) return 'pending'
    if ((spec.minValue !== null && n < spec.minValue) || (spec.maxValue !== null && n > spec.maxValue)) return 'fail'
    if (spec.ootMinValue !== null && n < spec.ootMinValue) return 'oot'
    if (spec.ootMaxValue !== null && n > spec.ootMaxValue) return 'oot'
    return 'pass'
  }
  return spec ? 'pass' : 'pending'
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pass:    { bg: '#d1fae5', color: '#065f46', label: '✅ PASS' },
  fail:    { bg: '#fee2e2', color: '#991b1b', label: '❌ OOS' },
  oot:     { bg: '#fef3c7', color: '#92400e', label: '⚠ OOT' },
  pending: { bg: '#f3f4f6', color: '#6b7280', label: '—' },
}


export default function TestExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // elapsed timer driven by tick state below

  const [execution,   setExecution]   = useState<Execution | null>(null)
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [specLimits,  setSpecLimits]  = useState<SpecLimit[]>([])
  const [entries,     setEntries]     = useState<Record<number, string>>({})
  const [evidence,    setEvidence]    = useState<Record<number, string>>({})
  const [results,     setResults]     = useState<ResultRow[]>([])
  const [uploadFiles, setUploadFiles] = useState<Record<number, { file: File | null; desc: string; uploading: boolean; files: EvidenceFile[]; open: boolean }>>({})
  const [hasOos,      setHasOos]      = useState(false)
  const [hasOot,      setHasOot]      = useState(false)
  const [showSignOff, setShowSignOff] = useState(false)
  const [signForm,    setSignForm]    = useState({ password: '', meaning: 'I confirm these test results are accurate and complete', reason: '' })
  const [saving,      setSaving]      = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [draftSaved,  setDraftSaved]  = useState(false)
  const [error,       setError]       = useState('')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [elapsedDisplay, setElapsedDisplay] = useState('00:00:00')

  // Elapsed timer — recompute once per second from the start time. Kept inside
  // the effect (not during render) so the Date.now() read stays pure.
  useEffect(() => {
    const compute = () => {
      if (!startedAt) { setElapsedDisplay('00:00:00'); return }
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const h = String(Math.floor(secs / 3600)).padStart(2, '0')
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
      const s = String(secs % 60).padStart(2, '0')
      setElapsedDisplay(`${h}:${m}:${s}`)
    }
    const t0 = setTimeout(compute, 0)
    const t = setInterval(compute, 1000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [startedAt])

  useEffect(() => {
    if (!id) return
    // Load execution
    api.get(`/test-executions/${id}`)
      .then(r => {
        const ex = r.data
        if (ex) {
          setExecution(ex); setStartedAt(ex.startedAt)
          // For completed executions load actual submitted results from the
          // digital logbook so values show correctly regardless of localStorage
          if (ex.status === 'Completed') {
            api.get(`/digital-logbook?executionId=${id}`)
              .then(lr => {
                const logbookEntries: { parameterId: number; rawValue: string; entryId: number; calculatedResult: number | null; parameterName: string }[] = lr.data ?? []
                // Populate entries state so VALUE column shows real data
                const entryMap: Record<number, string> = {}
                logbookEntries.forEach(e => { entryMap[e.parameterId] = e.rawValue })
                setEntries(entryMap)
                // Also populate results so evidence upload knows entry IDs
                setResults(logbookEntries.map(e => ({
                  entryId: e.entryId,
                  parameterId: e.parameterId,
                  parameterName: e.parameterName,
                  rawValue: e.rawValue,
                  calculatedResult: e.calculatedResult,
                })))
              })
              .catch(() => {/* non-blocking — form still shows, just without prefilled values */})
          }
        }
      })
      .catch(() => setError('Failed to load execution.'))
    // Load parameters
    api.get(`/test-executions/${id}/parameters`)
      .then(r => setParameters(r.data))
      .catch(() => setError('Failed to load parameters.'))
  }, [id])

  // Load spec limits once we have materialId
  useEffect(() => {
    if (!execution?.materialId) return
    api.get(`/spec-limits?materialId=${execution.materialId}&status=Approved`)
      .then(r => setSpecLimits(r.data))
      .catch(() => {/* spec limits optional */})
  }, [execution?.materialId])

  // Restore draft
  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => {
      const saved = localStorage.getItem(DRAFT_KEY(id))
      if (saved) {
        try {
          const { entries: e, evidence: ev } = JSON.parse(saved)
          if (e) setEntries(e)
          if (ev) setEvidence(ev)
        } catch { /* ignore */ }
      }
    }, 0)
    return () => clearTimeout(t)
  }, [id])

  async function loadEvidence(entryId: number, parameterId: number) {
    try {
      const r = await api.get(`/digital-logbook/entries/${entryId}/evidence`)
      setUploadFiles(prev => ({ ...prev, [parameterId]: { ...prev[parameterId], files: r.data } }))
    } catch { /* optional */ }
  }

  async function uploadEvidence(entryId: number, parameterId: number) {
    const state = uploadFiles[parameterId]
    if (!state?.file || !execution) return
    setUploadFiles(prev => ({ ...prev, [parameterId]: { ...prev[parameterId], uploading: true } }))
    try {
      const fd = new FormData()
      fd.append('file', state.file)
      fd.append('sampleId', String(execution.sampleId))
      if (state.desc) fd.append('description', state.desc)
      await api.post(`/digital-logbook/entries/${entryId}/evidence`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadFiles(prev => ({ ...prev, [parameterId]: { ...prev[parameterId], file: null, desc: '', uploading: false } }))
      loadEvidence(entryId, parameterId)
    } catch {
      setUploadFiles(prev => ({ ...prev, [parameterId]: { ...prev[parameterId], uploading: false } }))
    }
  }

  function saveDraft() {
    if (!id) return
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ entries, evidence }))
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  function specFor(parameterId: number): SpecLimit | undefined {
    return specLimits.find(s => s.parameterId === parameterId)
  }

  async function submitResults(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError('')
    try {
      const entryList = Object.entries(entries).map(([pid, raw]) => ({
        parameterId: Number(pid), rawValue: raw,
        evidenceFileRef: evidence[Number(pid)] || undefined
      }))
      const r = await api.post(`/test-executions/${id}/results`, { entries: entryList, entryMethod: 'Manual' })
      setResults(r.data.results)
      setHasOos(r.data.hasOos)
      setHasOot(r.data.hasOot)
      // Clear draft on successful submit
      if (id) localStorage.removeItem(DRAFT_KEY(id))
    } catch (err) { setError(getErrorMessage(err, 'Submit failed')) }
    finally { setSubmitting(false) }
  }

  async function submitSignOff(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/test-executions/${id}/sign-off`, signForm)
      navigate('/work-queue')
    } catch (err) { setError(getErrorMessage(err, 'Sign-off failed')) }
    finally { setSaving(false) }
  }

  if (!execution) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
      {error ? <p style={{ color: '#ef4444' }}>{error}</p> : 'Loading task…'}
    </div>
  )

  const isOverdue = execution.dueDate && new Date(execution.dueDate) < new Date()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 40px' }}>

      {/* ── Task Header ────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0d6e6e 100%)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 20, color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {execution.sampleNumber}
              </span>
              {execution.status && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.2)' }}>
                  {execution.status}
                </span>
              )}
              {isOverdue && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: '#ef4444' }}>
                  ⚠ OVERDUE
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{execution.materialName}</div>
          </div>
          {/* Live timer */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>ELAPSED TIME</div>
            <div style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>
              ⏱ {elapsedDisplay}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, opacity: 0.85, flexWrap: 'wrap' }}>
          <span>📦 Lot: <strong>{execution.lotNumber}</strong></span>
          <span>🔬 Instrument: <strong>{execution.instrumentCode}</strong></span>
          <span>👤 Analyst: <strong>{execution.analystName}</strong></span>
          {execution.dueDate && (
            <span style={{ color: isOverdue ? '#fca5a5' : 'inherit' }}>
              📅 Due: <strong>{new Date(execution.dueDate).toLocaleDateString()}</strong>
            </span>
          )}
          {execution.startedAt && (
            <span>🕐 Started: <strong>{new Date(execution.startedAt).toLocaleTimeString()}</strong></span>
          )}
        </div>
      </div>

      {/* ── Completed banner ──────────────────────────────────────────── */}
      {execution.status === 'Completed' && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>Test Completed — Results Locked</div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>This execution has been signed off. Results cannot be modified.</div>
          </div>
        </div>
      )}

      {/* ── Result Entry Form ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px 28px', marginBottom: 20,
        opacity: execution.status === 'Completed' ? 0.6 : 1, pointerEvents: execution.status === 'Completed' ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            📋 Enter Results
            <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', marginLeft: 10 }}>
              {parameters.length} parameter{parameters.length !== 1 ? 's' : ''}
            </span>
          </h3>
          {specLimits.length === 0 && (
            <span style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: 6 }}>
              ⚠ No approved spec limits found — pass/fail unavailable
            </span>
          )}
        </div>

        <form onSubmit={submitResults}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 2fr 1.4fr 1.4fr 100px',
            gap: 12, padding: '6px 10px', marginBottom: 6,
            fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            <span>#</span><span>Parameter</span><span>Spec Limit</span><span>Value</span><span>Status</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {parameters.map((p, idx) => {
              const spec   = specFor(p.parameterId)
              const raw    = entries[p.parameterId] ?? ''
              const status = evalValue(raw, spec, p.dataType)
              const ss     = STATUS_STYLE[status]
              const isNum  = p.dataType === 'Numeric' || p.dataType === 'Calculated'

              return (
                <div key={p.parameterId} style={{
                  border: `1.5px solid ${status === 'fail' ? '#fca5a5' : status === 'oot' ? '#fde68a' : status === 'pass' ? '#bbf7d0' : '#e5e7eb'}`,
                  borderRadius: 8, padding: '12px 14px',
                  background: status === 'fail' ? '#fff8f8' : status === 'oot' ? '#fffdf0' : '#fff',
                  transition: 'all 0.15s'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1.4fr 1.4fr 100px', gap: 12, alignItems: 'center' }}>
                    {/* Row # */}
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</span>

                    {/* Parameter name */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{p.parameterName}</span>
                        {p.isCritical && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4 }}>
                            🔴 CRITICAL
                          </span>
                        )}
                        {p.isMandatory && !p.isCritical && (
                          <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>
                            Required
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {p.calcFormula && (
                          <span title={`Formula: ${p.calcFormula}`}
                            style={{ fontSize: 10, fontWeight: 700, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', padding: '1px 6px', borderRadius: 4 }}>
                            ⚡ Calculated
                          </span>
                        )}
                        {p.decimalPlaces !== null && p.decimalPlaces !== undefined && (
                          <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 4 }}>
                            {p.decimalPlaces} dp
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Spec limit */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: spec ? '#1e3a5f' : '#9ca3af' }}>
                        {formatSpec(spec)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.uom || '—'}</div>
                    </div>

                    {/* Value input */}
                    <input
                      type={isNum ? 'number' : 'text'}
                      step={isNum ? 'any' : undefined}
                      value={raw}
                      onChange={e => setEntries(prev => ({ ...prev, [p.parameterId]: e.target.value }))}
                      required={p.isMandatory}
                      placeholder={isNum ? '0.000' : 'Enter value…'}
                      style={{
                        ...inp,
                        margin: 0,
                        borderColor: status === 'fail' ? '#fca5a5' : status === 'oot' ? '#fde68a' : status === 'pass' ? '#bbf7d0' : '#d1d5db',
                        fontFamily: 'monospace', fontWeight: 600, fontSize: 14,
                        background: '#fafafa',
                      }}
                    />

                    {/* Live status badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: ss.bg, color: ss.color, whiteSpace: 'nowrap'
                    }}>
                      {ss.label}
                    </span>
                  </div>

                  {/* Evidence — collapsed by default, expand on click */}
                  <div style={{ marginTop: 8 }}>
                    <button type="button"
                      onClick={() => setUploadFiles(prev => ({
                        ...prev,
                        [p.parameterId]: { file: null, desc: '', uploading: false, files: prev[p.parameterId]?.files ?? [], open: !prev[p.parameterId]?.open }
                      }))}
                      style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{uploadFiles[p.parameterId]?.open ? '▾' : '▸'}</span>
                      <span>📎 Attach Evidence</span>
                      {(uploadFiles[p.parameterId]?.files?.length ?? 0) > 0 && (
                        <span style={{ fontSize: 10, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 10, padding: '0 6px' }}>
                          {uploadFiles[p.parameterId].files.length} file{uploadFiles[p.parameterId].files.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    {uploadFiles[p.parameterId]?.open && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e5e7eb' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            accept="image/*,.pdf,.xlsx,.csv"
                            onChange={e => setUploadFiles(prev => ({ ...prev, [p.parameterId]: { ...prev[p.parameterId], file: e.target.files?.[0] ?? null } }))}
                            style={{ fontSize: 12, flex: 1 }}
                          />
                          <input
                            style={{ ...inp, margin: 0, fontSize: 12, width: 160 }}
                            placeholder="Description…"
                            value={uploadFiles[p.parameterId]?.desc ?? ''}
                            onChange={e => setUploadFiles(prev => ({ ...prev, [p.parameterId]: { ...prev[p.parameterId], desc: e.target.value } }))}
                          />
                          <button type="button"
                            disabled={!uploadFiles[p.parameterId]?.file || uploadFiles[p.parameterId]?.uploading || results.length === 0}
                            title={results.length === 0 ? "Submit results first before uploading evidence" : undefined}
                            onClick={() => {
                              const resultEntry = results.find(r => r.parameterId === p.parameterId)
                              if (resultEntry) uploadEvidence(resultEntry.entryId, p.parameterId)
                            }}
                            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {uploadFiles[p.parameterId]?.uploading ? 'Uploading…' : 'Upload'}
                          </button>
                        </div>
                        {(uploadFiles[p.parameterId]?.files ?? []).map(f => (
                          <div key={f.evidenceId} style={{ fontSize: 11, color: '#374151', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📎</span>
                            <a href={`/uploads/${f.fileRef}`} target="_blank" rel="noreferrer" style={{ color: '#0d9488' }}>{f.fileRef.split('/').pop()}</a>
                            {f.description && <span style={{ color: '#6b7280' }}>— {f.description}</span>}
                            <span style={{ color: '#9ca3af' }}>{new Date(f.uploadedAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
            <button type="button" onClick={saveDraft}
              style={{ padding: '9px 18px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
              {draftSaved ? '✓ Draft Saved' : '💾 Save Draft'}
            </button>
            <div style={{ flex: 1 }} />
            <button type="submit" disabled={submitting}
              style={{ padding: '9px 24px', background: submitting ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Checking…' : 'Submit & Run OOS/OOT Check →'}
            </button>
          </div>
        </form>
      </div>

      {/* ── OOS/OOT Results ────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
            🔬 OOS / OOT Detection Results
          </h3>

          {(hasOos || hasOot) && (
            <div style={{ marginBottom: 14, padding: '10px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
              {hasOos && '⚠ OOS detected — investigation will be auto-created. '}
              {hasOot && '⚠ OOT flagged — trend alert raised.'}
            </div>
          )}
          {!hasOos && !hasOot && (
            <div style={{ marginBottom: 14, padding: '10px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 13, color: '#065f46', fontWeight: 600 }}>
              ✅ All results within specification — no OOS/OOT detected.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {['Parameter', 'Entered Value', 'Spec Limit', 'Calculated', 'Pass/Fail', 'OOS', 'OOT', 'Evidence'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const spec = specFor(r.parameterId)
                  return (
                    <tr key={r.entryId} style={{ borderBottom: '1px solid #e5e7eb', background: r.isOos ? '#fff8f8' : r.isOot ? '#fffdf0' : '#fff' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {r.parameterName}
                        {r.isCritical && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>CRITICAL</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.rawValue}</td>
                      <td style={{ padding: '10px 12px', color: '#1e3a5f', fontWeight: 500 }}>{formatSpec(spec)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{r.calculatedResult ?? r.rawValue}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: r.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
                          color: r.passFail === 'PASS' ? '#065f46' : '#991b1b'
                        }}>{r.passFail}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: r.isOos ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{r.isOos ? '⚠ OOS' : '✓'}</td>
                      <td style={{ padding: '10px 12px', color: r.isOot ? '#d97706' : '#16a34a', fontWeight: 600 }}>{r.isOot ? '⚠ OOT' : '✓'}</td>
                      <td style={{ padding: '10px 12px', color: r.hasEvidence ? '#16a34a' : '#9ca3af' }}>
                        {r.hasEvidence ? '✓ Filed' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowSignOff(true); setError('') }}
              style={{ padding: '10px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✍ Sign Off (E-Signature) →
            </button>
          </div>
        </div>
      )}

      {/* ── E-Signature Modal ──────────────────────────────────────────── */}
      {showSignOff && (
        <Modal title="Analyst Sign-Off — E-Signature" onClose={() => setShowSignOff(false)}>
          <div style={{ padding: '4px 0 12px', fontSize: 13, color: '#6b7280' }}>
            Your name, timestamp (UTC), meaning and reason are immutably recorded.
            {hasOos && <span style={{ color: '#dc2626', fontWeight: 600 }}> OOS investigations will be auto-raised.</span>}
          </div>
          <form onSubmit={submitSignOff}>
            <Field label="Password (re-enter to confirm identity)">
              <input style={inp} type="password" value={signForm.password} onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Meaning of signature">
              <input style={inp} value={signForm.meaning} onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={signForm.reason} onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All parameters verified and results confirmed" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSignOff(false)} label="✍ Sign & Submit" />
          </form>
        </Modal>
      )}
    </div>
  )
}
