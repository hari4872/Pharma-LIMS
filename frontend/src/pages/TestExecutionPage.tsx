import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface Execution {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; instrumentCode: string; status: string
  startedAt: string | null
}
interface Parameter {
  parameterId: number; parameterName: string; uom: string; dataType: string; isCritical: boolean
}
interface ResultRow {
  entryId: number; parameterId: number; parameterName: string
  rawValue: string; calculatedResult: number | null
  passFail: string; isOos: boolean; isOot: boolean; isCritical: boolean; hasEvidence: boolean
}

export default function TestExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [execution, setExecution] = useState<Execution | null>(null)
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [entries, setEntries] = useState<Record<number, string>>({})
  const [evidence, setEvidence] = useState<Record<number, string>>({})
  const [results, setResults] = useState<ResultRow[]>([])
  const [hasOos, setHasOos] = useState(false)
  const [hasOot, setHasOot] = useState(false)
  const [showSignOff, setShowSignOff] = useState(false)
  const [signForm, setSignForm] = useState({ password: '', meaning: 'I confirm these test results are accurate and complete', reason: '' })
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.get(`/test-executions?status=InProgress`).then(r => {
      const ex = r.data.find((e: Execution) => e.executionId === Number(id))
      setExecution(ex ?? null)
    })
    api.get(`/test-executions/${id}/parameters`).then(r => setParameters(r.data))
  }, [id])

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
    } catch (err: any) { setError(err.response?.data?.message ?? 'Submit failed') }
    finally { setSubmitting(false) }
  }

  async function submitSignOff(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/test-executions/${id}/sign-off`, signForm)
      navigate('/work-queue')
    } catch (err: any) { setError(err.response?.data?.message ?? 'Sign-off failed') }
    finally { setSaving(false) }
  }

  if (!execution) return <div style={{ padding: 24, color: '#6b7280' }}>Loading task…</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Task header */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#111827' }}>Test Execution — {execution.sampleNumber}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 14 }}>
          <div><span style={{ color: '#6b7280' }}>Material:</span> <strong>{execution.materialName}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Lot:</span> <strong>{execution.lotNumber}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Instrument:</span> <strong>{execution.instrumentCode}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Analyst:</span> <strong>{execution.analystName}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Started:</span> <strong>{execution.startedAt ? new Date(execution.startedAt).toLocaleString() : '—'}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Status:</span> <strong>{execution.status}</strong></div>
        </div>
      </div>

      {/* Step 4: Result Entry */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#374151' }}>Step 4 — Enter Results</h3>
        <form onSubmit={submitResults}>
          {parameters.map(p => (
            <div key={p.parameterId} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr', gap: 12, marginBottom: 12, alignItems: 'end' }}>
              <Field label={<>{p.parameterName} <span style={{ fontSize: 11, color: '#6b7280' }}>({p.uom})</span>{p.isCritical && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>CRITICAL</span>}</>}>
                <input style={inp} value={entries[p.parameterId] ?? ''} onChange={e => setEntries(prev => ({ ...prev, [p.parameterId]: e.target.value }))} placeholder="Enter value…" required />
              </Field>
              {p.isCritical && (
                <Field label="Evidence File Ref (mandatory)">
                  <input style={inp} value={evidence[p.parameterId] ?? ''} onChange={e => setEvidence(prev => ({ ...prev, [p.parameterId]: e.target.value }))} placeholder="e.g. INSTR-OUTPUT-001.pdf" />
                </Field>
              )}
            </div>
          ))}
          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={submitting}
            style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            {submitting ? 'Checking…' : 'Run OOS/OOT Check (Step 5)'}
          </button>
        </form>
      </div>

      {/* Step 5: OOS/OOT Results */}
      {results.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#374151' }}>Step 5 — OOS/OOT Detection Results</h3>
          {(hasOos || hasOot) && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#991b1b' }}>
              {hasOos && '⚠ OOS detected — investigation will be auto-created. '}
              {hasOot && '⚠ OOT flagged — trend alert raised.'}
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Parameter', 'Raw Value', 'Calculated', 'Pass/Fail', 'OOS', 'OOT', 'Critical', 'Evidence'].map(h =>
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#374151' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.entryId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 12px' }}>{r.parameterName}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{r.rawValue}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{r.calculatedResult ?? r.rawValue}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: r.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
                      color: r.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{r.passFail}</span>
                  </td>
                  <td style={{ padding: '8px 12px', color: r.isOos ? '#dc2626' : '#16a34a' }}>{r.isOos ? '⚠ OOS' : '✓'}</td>
                  <td style={{ padding: '8px 12px', color: r.isOot ? '#d97706' : '#16a34a' }}>{r.isOot ? '⚠ OOT' : '✓'}</td>
                  <td style={{ padding: '8px 12px' }}>{r.isCritical ? <span style={{ color: '#991b1b', fontWeight: 500 }}>Yes</span> : '—'}</td>
                  <td style={{ padding: '8px 12px', color: r.hasEvidence ? '#16a34a' : r.isCritical ? '#dc2626' : '#6b7280' }}>
                    {r.hasEvidence ? '✓' : r.isCritical ? '✗ Missing' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button onClick={() => { setShowSignOff(true); setError('') }}
              style={{ padding: '8px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
              Step 7 — Sign Off (§11.50 E-Signature)
            </button>
          </div>
        </div>
      )}

      {/* Step 7: Sign-off modal */}
      {showSignOff && (
        <Modal title="Analyst Sign-Off — Step 7 (§11.50)" onClose={() => setShowSignOff(false)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR §11.50 — Your full name, timestamp UTC, meaning, and reason will be captured and immutably recorded.
            Logbook rows created atomically. {hasOos && <strong style={{ color: '#dc2626' }}>OOS investigations will be auto-raised.</strong>}
          </p>
          <form onSubmit={submitSignOff}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={signForm.password} onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={signForm.meaning} onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={signForm.reason} onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All parameters verified and results confirmed" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSignOff(false)} label="Sign & Submit" />
          </form>
        </Modal>
      )}
    </div>
  )
}
