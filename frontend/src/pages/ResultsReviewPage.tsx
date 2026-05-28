import { useEffect, useState, useMemo } from 'react'
import api from '@/api/client'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Execution {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; status: string; startedAt?: string; completedAt?: string
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  Completed:    { bg: '#dbeafe', color: '#1d4ed8', label: 'Pending Peer Review' },
  SignedOff:    { bg: '#fef9c3', color: '#a16207', label: 'Pending Peer Review' },
  PeerReviewed: { bg: '#fef3c7', color: '#b45309', label: 'Pending QC Verify' },
  QCVerified:   { bg: '#dcfce7', color: '#166534', label: 'QC Verified' },
  Approved:     { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  Rejected:     { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  default:      { bg: '#f3f4f6', color: '#374151', label: '' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.default
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label || status}
    </span>
  )
}

// ── Review step pill ───────────────────────────────────────────────────────
function ReviewSteps({ status }: { status: string }) {
  const steps = [
    { key: 'Completed',    short: '① Signed Off' },
    { key: 'PeerReviewed', short: '② Peer Review' },
    { key: 'QCVerified',   short: '③ QC Verified' },
  ]
  const currentIdx = status === 'QCVerified' || status === 'Approved' ? 2
    : status === 'PeerReviewed' ? 1
    : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {steps.map((s, i) => (
        <span key={s.key} style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
          background: i <= currentIdx ? '#2563eb' : '#e5e7eb',
          color: i <= currentIdx ? '#fff' : '#9ca3af',
          whiteSpace: 'nowrap',
        }}>
          {s.short}
        </span>
      ))}
    </div>
  )
}

// ── Filter chip ────────────────────────────────────────────────────────────
function Chip({ label, color, active, onClick }:
  { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      border: `1.5px solid ${active ? color : '#e5e7eb'}`,
      background: active ? color : '#fff',
      color: active ? '#fff' : '#374151',
      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ResultsReviewPage() {
  const [all, setAll]         = useState<Execution[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [search, setSearch]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  // Modal
  const [showReview, setShowReview] = useState<{ executionId: number; type: 'peer' | 'qclead' } | null>(null)
  const [reviewForm, setReviewForm] = useState({ password: '', meaning: '', reason: '', notes: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    try {
      // Fetch all review-relevant statuses
      const [c, p] = await Promise.all([
        api.get('/test-executions?status=Completed'),
        api.get('/test-executions?status=PeerReviewed'),
      ])
      setAll([...(c.data ?? []), ...(p.data ?? [])])
    } catch { setAll([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Derived filter counts for chips ─────────────────────────────────────
  const pendingPeer  = all.filter(r => r.status === 'Completed' || r.status === 'SignedOff').length
  const pendingQC    = all.filter(r => r.status === 'PeerReviewed').length

  const CHIPS = [
    { key: 'All',            label: `All`,                  color: '#374151' },
    { key: 'PendingPeer',    label: `Pending Peer Review`,  color: '#2563eb' },
    { key: 'PendingQC',      label: `Pending QC Verify`,    color: '#d97706' },
  ]

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = all
    if (statusFilter === 'PendingPeer')
      rows = rows.filter(r => r.status === 'Completed' || r.status === 'SignedOff')
    else if (statusFilter === 'PendingQC')
      rows = rows.filter(r => r.status === 'PeerReviewed')

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.sampleNumber.toLowerCase().includes(q) ||
        r.materialName.toLowerCase().includes(q) ||
        r.lotNumber.toLowerCase().includes(q) ||
        r.analystName?.toLowerCase().includes(q)
      )
    }
    if (dateFrom)
      rows = rows.filter(r => r.completedAt && r.completedAt >= dateFrom)
    if (dateTo)
      rows = rows.filter(r => r.completedAt && r.completedAt <= dateTo + 'T23:59:59')

    return rows
  }, [all, statusFilter, search, dateFrom, dateTo])

  // ── Actions ──────────────────────────────────────────────────────────────
  function openReview(executionId: number, type: 'peer' | 'qclead') {
    setShowReview({ executionId, type })
    setReviewForm({
      password: '',
      meaning: type === 'peer'
        ? 'I have reviewed and verified these test results'
        : 'I verify these results meet specification and are ready for release',
      reason: '', notes: '',
    })
    setError('')
  }

  async function downloadPdf(item: Execution) {
    try {
      const r = await api.get(`/results-review/${item.executionId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url
      a.download = `BatchAnalysis_${String(item.executionId).padStart(5,'0')}_${item.sampleNumber}.pdf`
      a.click(); URL.revokeObjectURL(url)
      toast(`Report downloaded — ${item.sampleNumber}`, 'success')
    } catch { toast('Failed to download PDF', 'error') }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const endpoint = showReview!.type === 'peer' ? 'peer-review' : 'qc-lead-verify'
      await api.post(`/results-review/${showReview!.executionId}/${endpoint}`, reviewForm)
      setShowReview(null); load()
      toast('Review recorded successfully', 'success')
    } catch (err: any) { setError(err.response?.data?.message ?? 'Review failed') }
    finally { setSaving(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '4px 0' }}>
      {/* Toolbar: chips + date range + search + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CHIPS.map(c => (
          <Chip key={c.key} label={c.label} color={c.color}
            active={statusFilter === c.key} onClick={() => setStatusFilter(c.key)} />
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 12, color: '#374151', outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 12, color: '#374151', outline: 'none' }} />
        </div>

        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#9ca3af', fontSize: 14 }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sample, material, lot…"
            style={{ width: '100%', padding: '6px 10px 6px 30px',
              border: '1px solid #d1d5db', borderRadius: 20, fontSize: 12,
              outline: 'none', boxSizing: 'border-box', color: '#374151' }}
          />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : `${filtered.length} execution${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['SAMPLE NUMBER', 'MATERIAL', 'LOT', 'ANALYST', 'REVIEW STAGE', 'STATUS', 'COMPLETED', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                  fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Loading executions…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No executions to review</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>All completed executions have been reviewed, or no results match your filters.</div>
              </td></tr>
            ) : (
              filtered.map((r, i) => {
                const canPeer = r.status === 'Completed' || r.status === 'SignedOff'
                const canQC   = r.status === 'PeerReviewed'
                return (
                  <tr key={r.executionId}
                    style={{ borderBottom: '1px solid #f3f4f6',
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                      transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    {/* Sample Number — hyperlink style + execution ID sub-text */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb',
                        cursor: 'pointer', fontFamily: 'monospace' }}>
                        {r.sampleNumber}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        Exec #{r.executionId}
                      </div>
                    </td>

                    {/* Material */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{r.materialName}</div>
                    </td>

                    {/* Lot */}
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                      {r.lotNumber}
                    </td>

                    {/* Analyst */}
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>
                      {r.analystName}
                    </td>

                    {/* Review stage progress */}
                    <td style={{ padding: '10px 16px' }}>
                      <ReviewSteps status={r.status} />
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Completed date */}
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>

                    {/* Actions — link-style like the screenshot */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {canPeer && (
                          <button onClick={() => openReview(r.executionId, 'peer')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, color: '#2563eb', padding: 0 }}>
                            Peer Review
                          </button>
                        )}
                        {canQC && (
                          <button onClick={() => openReview(r.executionId, 'qclead')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, color: '#7c3aed', padding: 0 }}>
                            QC Verify
                          </button>
                        )}
                        {!canPeer && !canQC && (
                          <span style={{ fontSize: 13, color: '#9ca3af' }}>View</span>
                        )}
                        <button onClick={() => downloadPdf(r)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: '#0369a1', padding: 0 }}>
                          📄 PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* E-Signature Modal */}
      {showReview && (
        <Modal
          title={showReview.type === 'peer' ? 'Peer Review — E-Signature (§11.50)' : 'QC Lead Verification — E-Signature (§11.50)'}
          onClose={() => setShowReview(null)}
        >
          {showReview.type === 'qclead' && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef9c3',
              borderRadius: 6, fontSize: 13, color: '#854d0e', display: 'flex', gap: 8 }}>
              <span>ℹ️</span>
              <span>OOS gate enforced — all open OOS investigations must be closed before QC Lead verification is permitted.</span>
            </div>
          )}
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            <strong>21 CFR Part 11:</strong> {showReview.type === 'peer'
              ? 'You must not be the original analyst.'
              : 'You must be different from both the analyst and peer reviewer.'}
            {' '}Your name, timestamp (UTC), meaning and reason will be immutably recorded.
          </p>
          <form onSubmit={submitReview}>
            <Field label="Password (re-enter to confirm identity)">
              <input style={inp} type="password" value={reviewForm.password}
                onChange={e => setReviewForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={reviewForm.meaning}
                onChange={e => setReviewForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={reviewForm.reason}
                onChange={e => setReviewForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. All results reviewed and confirmed correct" />
            </Field>
            <Field label="Notes (optional)">
              <input style={inp} value={reviewForm.notes}
                onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional observations…" />
            </Field>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6,
                padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 8 }}>
                ⚠ {error}
              </div>
            )}
            <ModalFooter saving={saving} onCancel={() => setShowReview(null)}
              label={showReview.type === 'peer' ? 'Sign Peer Review' : 'Sign QC Lead Verification'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
