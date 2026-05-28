import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

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

export default function BatchReleasePage() {
  const [data,       setData]       = useState<BatchRelease[]>([])
  const [loading,    setLoading]    = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
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

  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const r = await api.get(`/batch-releases${params}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  async function openDetail(id: number) {
    const r = await api.get(`/batch-releases/${id}`)
    setDetail(r.data); setShowDetail(true)
  }

  async function openInitiate() {
    const r = await api.get('/samples?status=PendingQAReview')
    setSamples(r.data); setForm({ sampleId: '' }); setError(''); setShowInitiate(true)
  }

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/batch-releases', { sampleId: Number(form.sampleId) })
      setShowInitiate(false); load()
    } catch (err: any) { setError(err.response?.data?.error ?? 'Failed to initiate review') }
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
      setShowDecide(false); setShowDetail(false); load()
    } catch (err: any) { setError(err.response?.data?.error ?? err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  const allChecksPassed = detail?.checkItems.every(c => c.passed) ?? false

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <PageHeader title="Batch Release (21 CFR 211.192)" onAdd={openInitiate} addLabel="Initiate Review" />
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
          QA reviews each batch before release — automated checklist + e-signature required
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select style={{ ...inp, width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['PendingReview', 'InReview', 'Released', 'Rejected', 'OnHold'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample', accessor: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{r.sampleNumber}</span> },
        { header: 'Material / Lot', accessor: r => <span>{r.materialName}<br /><span style={{ fontSize: 11, color: '#6b7280' }}>{r.lotNumber}</span></span> },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Decision', accessor: r => {
          if (!r.decision) return <span style={{ color: '#9ca3af' }}>—</span>
          const c = DECISION_COLORS[r.decision] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{r.decision}</span>
        }},
        { header: 'Initiated By', accessor: r => <span style={{ fontSize: 12 }}>{r.initiatedBy}</span> },
        { header: 'Reviewed By', accessor: r => <span style={{ fontSize: 12 }}>{r.reviewedBy ?? '—'}</span> },
        { header: 'Date', accessor: r => <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(r.initiatedAt).toLocaleDateString()}</span> },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openDetail(r.batchReleaseId)}
              style={{ padding: '3px 8px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              View Checklist
            </button>
            {(r.status === 'InReview' || r.status === 'PendingReview') && (
              <button onClick={() => openDecide(r.batchReleaseId)}
                style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Make Decision
              </button>
            )}
          </div>
        )},
      ]} />

      {/* ── Initiate Modal ── */}
      {showInitiate && (
        <Modal title="Initiate Batch Release Review" onClose={() => setShowInitiate(false)}>
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
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowInitiate(false)} label="Initiate Review" />
          </form>
        </Modal>
      )}

      {/* ── Detail + Checklist Modal ── */}
      {showDetail && detail && (
        <Modal title={`Batch Release — ${detail.sampleNumber}`} onClose={() => setShowDetail(false)}>
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
                <span style={{ fontSize: 16, marginTop: 0, flexShrink: 0 }}>{ci.passed ? '✅' : '❌'}</span>
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
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Reviewed by: {detail.reviewedBy} on {detail.decidedAt ? new Date(detail.decidedAt).toLocaleString() : '—'}</div>
            </div>
          )}

          {(detail.status === 'InReview' || detail.status === 'PendingReview') && (
            <button onClick={() => { setShowDetail(false); openDecide(detail.batchReleaseId) }}
              style={{ width: '100%', padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              → Make Release Decision
            </button>
          )}
        </Modal>
      )}

      {/* ── Decision Modal ── */}
      {showDecide && (
        <Modal title="QA Batch Release Decision" onClose={() => setShowDecide(false)}>
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
                <input type="password" style={inp} value={decideForm.password} onChange={e => setDecideForm(f => ({ ...f, password: e.target.value }))} required />
              </Field>
              <Field label="Meaning of Signature">
                <input style={inp} value={decideForm.meaning} onChange={e => setDecideForm(f => ({ ...f, meaning: e.target.value }))} required />
              </Field>
              <Field label="Reason for Signing">
                <input style={inp} value={decideForm.reason} onChange={e => setDecideForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Batch review complete — all criteria met" required />
              </Field>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowDecide(false)} label="Submit Decision" />
          </form>
        </Modal>
      )}
    </div>
  )
}
