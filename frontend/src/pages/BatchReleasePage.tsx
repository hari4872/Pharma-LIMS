import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { fmtDate, fmtDateTime } from '@/utils/dateFormat'
import { fmtLabel } from '@/utils/formatLabel'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { MasterDetail, DetailPane } from '@/components/MasterDetail'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

// ─── Types ───────────────────────────────────────────────────────────────────
interface BatchRelease {
  batchReleaseId: number; sampleId: number; sampleNumber: string
  materialName: string; lotNumber: string; status: string
  decision: string | null; decisionReason: string | null
  initiatedBy: string; reviewedBy: string | null
  initiatedAt: string; decidedAt: string | null
}
interface CheckItem { checkType: string; passed: boolean; detail: string }
interface ReleaseDetail extends BatchRelease {
  checkItems: CheckItem[]
}
interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; status: string }
interface RiskScore { riskLevel: string; score: number; factors: { factor: string; count: number; impact: string }[]; recommendation: string }

const RISK_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Critical: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  High:     { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  Medium:   { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  Low:      { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PendingReview: { bg: '#dbeafe', color: '#1e40af' },
  InReview:      { bg: '#fef9c3', color: '#854d0e' },
  Released:      { bg: '#d1fae5', color: '#065f46' },
  Rejected:      { bg: '#fee2e2', color: '#991b1b' },
  OnHold:        { bg: '#fff7ed', color: '#9a3412' },
}

const DECISION_COLORS: Record<string, { bg: string; color: string }> = {
  Released: { bg: '#d1fae5', color: '#065f46' },
  Rejected: { bg: '#fee2e2', color: '#991b1b' },
  OnHold:   { bg: '#fff7ed', color: '#9a3412' },
}

const CHECK_LABELS: Record<string, string> = {
  AllTestsComplete: 'All Tests Completed',
  NoOpenOOS:        'No Open OOS Investigations',
  CoAApproved:      'Certificate of Analysis Approved',
  NoOpenCapa:       'No Open CAPA Actions',
  LogbookSigned:    'All Logbook Entries Signed',
}

const STAGES = [
  { key: 'PendingReview', label: 'Pending Review', color: '#1e40af', bg: '#dbeafe' },
  { key: 'InReview',      label: 'In Review',      color: '#b45309', bg: '#fef9c3' },
  { key: 'Released',      label: 'Released',       color: '#065f46', bg: '#d1fae5' },
  { key: 'Rejected',      label: 'Rejected',       color: '#991b1b', bg: '#fee2e2' },
  { key: 'OnHold',        label: 'On Hold',        color: '#9a3412', bg: '#fff7ed' },
]

export default function BatchReleasePage() {
  const [data,       setData]       = useState<BatchRelease[]>([])
  const [loading,    setLoading]    = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [detail,     setDetail]     = useState<ReleaseDetail | null>(null)
  const [showInitiate, setShowInitiate] = useState(false)
  const [showDecide, setShowDecide] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [samples,    setSamples]    = useState<Sample[]>([])
  const [form,       setForm]       = useState({ sampleId: '' })
  const [decideForm, setDecideForm] = useState({ decision: 'Released', decisionReason: '', password: '', meaning: 'QA Batch Release Decision', reason: '' })
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [riskScore,    setRiskScore]    = useState<RiskScore | null>(null)
  const [riskLoading,  setRiskLoading]  = useState(false)
  const [riskExpanded, setRiskExpanded] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/batch-releases')
      setData(Array.isArray(r.data) ? r.data : [])
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.initiatedAt < dateFrom) return false
      if (dateTo && r.initiatedAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, statusFilter, dateFrom, dateTo])

  async function openDetail(id: number) {
    const r = await api.get(`/batch-releases/${id}`)
    setDetail(r.data); setRiskScore(null); setShowDetail(true)
    setRiskLoading(true)
    try {
      const rs = await api.get(`/batch-releases/${id}/risk-score`)
      setRiskScore(rs.data)
    } catch { /* non-fatal */ } finally { setRiskLoading(false) }
  }

  async function openInitiate() {
    setForm({ sampleId: '' }); setError(''); setShowInitiate(true)
    try {
      const r = await api.get('/samples?status=PendingQAReview')
      setSamples(Array.isArray(r.data) ? r.data : [])
    } catch {
      setSamples([])
      setError('Could not load samples — check connection and try again.')
    }
  }

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/batch-releases', { sampleId: Number(form.sampleId) })
      setShowInitiate(false); await load()
      setStatusFilter('PendingReview')
    } catch (err) { setError(getErrorMessage(err, 'Failed to initiate review')) }
    finally { setSaving(false) }
  }

  function openDecide(id: number) {
    setSelectedId(id)
    setDecideForm({ decision: 'Released', decisionReason: '', password: '', meaning: 'QA Batch Release Decision', reason: '' })
    setError(''); setShowDecide(true)
  }

  async function submitDecide(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/batch-releases/${selectedId}/decide`, {
        decision:       decideForm.decision,
        decisionReason: decideForm.decisionReason,
        password:       decideForm.password,
        meaning:        decideForm.meaning,
        reason:         decideForm.reason,
      })
      setShowDecide(false); setShowDetail(false)
      await load()
      // Navigate to the filter matching the decision so user sees the result immediately
      setStatusFilter(decideForm.decision)   // 'Released' | 'Rejected' | 'OnHold'
    } catch (err) { setError(getErrorMessage(err, 'Failed')) }
    finally { setSaving(false) }
  }

  const allChecksPassed = detail?.checkItems.every(c => c.passed) ?? false

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Batch Release (21 CFR 211.192)</h2>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
          QA reviews each batch before release — automated checklist + e-signature required
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, marginTop: 14 }}>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={statusFilter} onChange={setStatusFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={openInitiate}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Initiate Review
          </button>
        </div>
      </div>

      {/* ── Table + Detail ── */}
      <MasterDetail
        detail={showDetail && detail ? (
          <DetailPane
            title={`Batch Release — ${detail.sampleNumber}`}
            subtitle="Release checklist and AI risk assessment."
            onClose={() => setShowDetail(false)}
          >
            {/* Risk Score */}
            {riskLoading && (
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
                Calculating risk score…
              </div>
            )}
            {!riskLoading && riskScore && (() => {
              const rc = RISK_COLORS[riskScore.riskLevel] ?? RISK_COLORS.Low
              return (
                <div style={{ borderRadius: 8, border: `1px solid ${rc.border}`, marginBottom: 14, overflow: 'hidden' }}>
                  {/* Collapsed summary row — always visible */}
                  <button type="button" onClick={() => setRiskExpanded(e => !e)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: rc.bg, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: rc.color }}>{riskScore.riskLevel} Risk</span>
                    <span style={{ fontSize: 12, color: rc.color, fontWeight: 700 }}>Score: {riskScore.score}/100</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: rc.color, opacity: 0.7 }}>{riskExpanded ? '▾ Hide detail' : '▸ Show detail'}</span>
                  </button>
                  {/* Expanded detail */}
                  {riskExpanded && (
                    <div style={{ padding: '10px 14px', background: rc.bg, borderTop: `1px solid ${rc.border}` }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {riskScore.factors.map((f, i) => (
                          <span key={i} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#fff', color: rc.color, border: `1px solid ${rc.border}`, fontWeight: 600 }}>
                            {f.factor} ({f.count})
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: rc.color, fontStyle: 'italic' }}>{riskScore.recommendation}</div>
                    </div>
                  )}
                </div>
              )
            })()}
            {/* Checklist */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Release Checklist</div>
              {detail.checkItems.map((ci, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 12px', borderRadius: 6, marginBottom: 6,
                  background: ci.passed ? '#f0fdf4' : '#fff1f2',
                  border: `1px solid ${ci.passed ? '#bbf7d0' : '#fecaca'}`,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                    background: ci.passed ? '#d1fae5' : '#fee2e2',
                    color: ci.passed ? '#166534' : '#991b1b',
                    border: `1px solid ${ci.passed ? '#6ee7b7' : '#fca5a5'}`,
                    letterSpacing: '0.04em',
                  }}>
                    {ci.passed ? 'PASS' : 'FAIL'}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ci.passed ? '#166534' : '#991b1b' }}>
                      {CHECK_LABELS[ci.checkType] ?? ci.checkType}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{ci.detail}</div>
                  </div>
                </div>
              ))}
              {!allChecksPassed && (
                <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }}>
                  ⚠ One or more checklist items failed. QA can still make a decision (with documented justification).
                </div>
              )}
            </div>

            {/* Decision info if already decided */}
            {detail.decision && (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Decision: <span style={{ color: detail.decision === 'Released' ? '#166534' : '#991b1b' }}>{detail.decision}</span></div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{detail.decisionReason}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Reviewed by: {detail.reviewedBy} on {detail.decidedAt ? fmtDateTime(detail.decidedAt) : '—'}</div>
              </div>
            )}

            {(detail.status === 'InReview' || detail.status === 'PendingReview') && (
              <button onClick={() => { setShowDetail(false); openDecide(detail.batchReleaseId) }}
                style={{ width: '100%', padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                → Make Release Decision
              </button>
            )}
          </DetailPane>
        ) : null}
        onCloseDetail={() => setShowDetail(false)}
      >
        <DataTable loading={loading} data={filtered} columns={[
          { header: 'Sample', accessor: r => (
            <button onClick={() => setDetailSampleId(r.sampleId)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}>
              {r.sampleNumber}
            </button>
          )},
          { header: 'Material / Lot', accessor: r => <span>{r.materialName}<br /><span style={{ fontSize: 11, color: '#6b7280' }}>{r.lotNumber}</span></span> },
          { header: 'Status', accessor: r => {
            const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{fmtLabel(r.status)}</span>
          }},
          { header: 'Decision', accessor: r => {
            if (!r.decision) return <span style={{ color: '#9ca3af' }}>—</span>
            const c = DECISION_COLORS[r.decision] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{fmtLabel(r.decision)}</span>
          }},
          { header: 'Initiated By', accessor: r => <span style={{ fontSize: 12 }}>{r.initiatedBy}</span> },
          { header: 'Reviewed By', accessor: r => <span style={{ fontSize: 12 }}>{r.reviewedBy ?? '—'}</span> },
          { header: 'Date', accessor: r => <span style={{ fontSize: 11, color: '#6b7280' }}>{fmtDate(r.initiatedAt)}</span> },
          { header: 'Actions', accessor: r => (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openDetail(r.batchReleaseId)}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                View Checklist
              </button>
              {(r.status === 'InReview' || r.status === 'PendingReview') && (
                <button onClick={() => openDecide(r.batchReleaseId)}
                  style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                  Make Decision
                </button>
              )}
            </div>
          )},
        ]} />
      </MasterDetail>

      {detailSampleId !== null && <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} context="release" />}

      {/* ── Initiate Modal ── */}
      {showInitiate && (
        <Drawer title="Initiate Batch Release Review" subtitle="Select a sample in PendingQAReview — auto-evaluates the release checklist." onClose={() => setShowInitiate(false)}>
          <form onSubmit={submitInitiate}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Select a sample in PendingQAReview status. The system will auto-evaluate the release checklist.
            </p>
            <Field label="Sample (PendingQAReview) *">
              <select style={inp} value={form.sampleId} onChange={e => setForm({ sampleId: e.target.value })} required>
                <option value="">Select sample…</option>
                {samples.map(s => <option key={s.sampleId} value={s.sampleId}>{s.sampleNumber} — {s.materialName} / {s.lotNumber}</option>)}
              </select>
            </Field>
            {samples.length === 0 && <p style={{ fontSize: 12, color: '#d97706' }}>⚠ No samples in PendingQAReview status.</p>}
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowInitiate(false)} label="Initiate Review" />
          </form>
        </Drawer>
      )}

      {/* ── Decision Drawer ── */}
      {showDecide && (
        <Drawer title="QA Batch Release Decision" subtitle="21 CFR 211.192 — permanently audit-logged" onClose={() => { setShowDecide(false); setError('') }} blocking width={460}>
          <form onSubmit={submitDecide}>
            <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 8, marginBottom: 14, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>⚖ 21 CFR 211.192 Compliance</div>
              <div style={{ fontSize: 11, color: '#78350f', marginTop: 3 }}>This decision is final and e-signature verified. The action will be permanently audit-logged.</div>
            </div>
            <Field label="Decision *">
              <select style={{ ...inp, fontWeight: 700 }} value={decideForm.decision} onChange={e => setDecideForm(f => ({ ...f, decision: e.target.value }))}>
                <option value="Released">✅ Released — Approve for distribution</option>
                <option value="Rejected">❌ Rejected — Batch fails specification</option>
                <option value="OnHold">⏸ On Hold — Pending further investigation</option>
              </select>
            </Field>
            <Field label="Decision Reason / Justification *">
              <textarea style={{ ...inp, height: 90, resize: 'vertical' }}
                value={decideForm.decisionReason}
                onChange={e => setDecideForm(f => ({ ...f, decisionReason: e.target.value }))}
                placeholder="Mandatory: document the basis for this decision…"
                required />
            </Field>
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0d6e6e', marginBottom: 8 }}>🔐 Electronic Signature</div>
              <Field label="Your Password *">
                <input type="password" autoFocus style={inp} value={decideForm.password} onChange={e => setDecideForm(f => ({ ...f, password: e.target.value }))} required />
              </Field>
              <Field label="Meaning of Signature">
                <input style={inp} value={decideForm.meaning} onChange={e => setDecideForm(f => ({ ...f, meaning: e.target.value }))} required />
              </Field>
              <Field label="Reason for Signing">
                <input style={inp} value={decideForm.reason} onChange={e => setDecideForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Batch review complete — all criteria met" required />
              </Field>
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => { setShowDecide(false); setError('') }} label="Submit Decision" />
          </form>
        </Drawer>
      )}
    </div>
  )
}
