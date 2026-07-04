import { useEffect, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { fmtDate } from '@/utils/dateFormat'
import { getErrorMessage } from '@/utils/errors'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { toast } from '@/components/Toast'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface Execution {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; status: string; startedAt?: string; completedAt?: string
  testLabel: string | null
}

interface SampleReviewGroup {
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  analystName: string; executions: Execution[]; overallStatus: string; completedAt: string | null
  pendingPeerIds: number[]; pendingQCIds: number[]
}

function groupBySample(items: Execution[]): SampleReviewGroup[] {
  const map = new Map<number, Execution[]>()
  for (const item of items) {
    if (!map.has(item.sampleId)) map.set(item.sampleId, [])
    map.get(item.sampleId)!.push(item)
  }
  return Array.from(map.values()).map(execs => {
    const statuses = execs.map(e => e.status)
    const pendingPeerIds = execs.filter(e => e.status === 'Completed').map(e => e.executionId)
    const pendingQCIds   = execs.filter(e => e.status === 'PeerReviewed').map(e => e.executionId)

    let overallStatus = 'QCVerified'
    if (statuses.some(s => s === 'Assigned' || s === 'InProgress')) overallStatus = 'InProgress'
    else if (statuses.some(s => s === 'OOSOpen'))                    overallStatus = 'OOSOpen'
    else if (statuses.some(s => s === 'Completed'))                  overallStatus = 'Completed'
    else if (statuses.some(s => s === 'PeerReviewed'))               overallStatus = 'PeerReviewed'

    const analysts = [...new Set(execs.map(e => e.analystName).filter(Boolean))]
    const analystName = analysts.length === 0 ? '—' : analysts.length === 1 ? analysts[0] : 'Multiple'

    const dates = execs.map(e => e.completedAt).filter(Boolean) as string[]
    const completedAt = dates.length > 0 ? [...dates].sort().reverse()[0] : null

    return {
      sampleId: execs[0].sampleId, sampleNumber: execs[0].sampleNumber,
      materialName: execs[0].materialName, lotNumber: execs[0].lotNumber,
      analystName, executions: execs, overallStatus, completedAt,
      pendingPeerIds, pendingQCIds,
    }
  })
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  Completed:    { bg: '#dbeafe', color: '#1d4ed8', label: 'Pending Peer Review' },
  OOSOpen:      { bg: '#fef3c7', color: '#b45309', label: 'OOS Investigation Open' },
  PeerReviewed: { bg: '#fef9c3', color: '#b45309', label: 'Pending QC Verify' },
  QCVerified:   { bg: '#dcfce7', color: '#166534', label: 'QC Verified' },
  InProgress:   { bg: '#f3e8ff', color: '#6b21a8', label: 'In Progress' },
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

function ReviewSteps({ status }: { status: string }) {
  const steps = [
    { key: 'Completed',    short: 'Signed Off' },
    { key: 'PeerReviewed', short: 'Peer Review' },
    { key: 'QCVerified',   short: 'QC Verified' },
  ]
  const currentIdx = status === 'QCVerified' || status === 'Approved' ? 2
    : status === 'PeerReviewed' ? 1 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {steps.map((s, i) => (
        <span key={s.key} style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
          background: i <= currentIdx ? '#2563eb' : '#e5e7eb',
          color: i <= currentIdx ? '#fff' : '#9ca3af', whiteSpace: 'nowrap',
        }}>{s.short}</span>
      ))}
    </div>
  )
}

function Chip({ label, count, color, bg, active, onClick, showArrow }:
  { label: string; count: number; color: string; bg: string; active: boolean; onClick: () => void; showArrow?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
        border: `1.5px solid ${active ? color : '#e5e7eb'}`,
        background: active ? bg : '#fff', transition: 'all 0.12s',
      }}>
        <span style={{ minWidth: 22, height: 22, borderRadius: 6, background: bg, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700 }}>{count}</span>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap',
          fontWeight: active ? 700 : 500, color: active ? color : '#374151' }}>{label}</span>
      </button>
      {showArrow && (
        <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
          <path d="M4 8h8M9 5l3 3-3 3" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
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

  const [showReview, setShowReview] = useState<{ executionIds: number[]; type: 'peer' | 'qclead' } | null>(null)
  const [reviewForm, setReviewForm] = useState({ reviewerUsername: '', password: '', meaning: '', reason: '', notes: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [pdfDropdown, setPdfDropdown] = useState<number | null>(null)

  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  const canPeerReview = ['Admin', 'Analyst', 'QCLead', 'QA'].includes(role)
  const canQCVerify   = ['Admin', 'QCLead', 'QA'].includes(role)

  async function load() {
    setLoading(true)
    try {
      const c = await api.get('/test-executions')
      setAll(c.data ?? [])
    } catch { setAll([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (pdfDropdown === null) return
    const close = () => setPdfDropdown(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pdfDropdown])

  const groups = useMemo(() => groupBySample(all), [all])

  const inProgress  = groups.filter(g => g.overallStatus === 'InProgress' || g.overallStatus === 'Assigned').length
  const pendingPeer = groups.filter(g => g.overallStatus === 'Completed' || g.overallStatus === 'OOSOpen').length
  const pendingQC   = groups.filter(g => g.overallStatus === 'PeerReviewed').length
  const doneQC      = groups.filter(g => g.overallStatus === 'QCVerified').length

  const CHIPS = [
    { key: 'All',         label: 'All',                 color: '#374151', bg: '#f1f5f9', count: groups.length },
    { key: 'InProgress',  label: 'In Progress',         color: '#6b21a8', bg: '#f3e8ff', count: inProgress },
    { key: 'PendingPeer', label: 'Pending Peer Review', color: '#1e40af', bg: '#dbeafe', count: pendingPeer },
    { key: 'PendingQC',   label: 'Pending QC Verify',   color: '#b45309', bg: '#fef9c3', count: pendingQC },
    { key: 'QCVerified',  label: 'QC Verified',         color: '#166534', bg: '#dcfce7', count: doneQC },
  ]

  const filtered = useMemo(() => {
    let rows = groups
    if (statusFilter === 'InProgress')
      rows = rows.filter(g => g.overallStatus === 'Assigned' || g.overallStatus === 'InProgress')
    else if (statusFilter === 'PendingPeer')
      rows = rows.filter(g => g.overallStatus === 'Completed' || g.overallStatus === 'OOSOpen')
    else if (statusFilter === 'PendingQC')
      rows = rows.filter(g => g.overallStatus === 'PeerReviewed')
    else if (statusFilter === 'QCVerified')
      rows = rows.filter(g => g.overallStatus === 'QCVerified')

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(g =>
        g.sampleNumber.toLowerCase().includes(q) ||
        g.materialName.toLowerCase().includes(q) ||
        g.lotNumber.toLowerCase().includes(q) ||
        g.analystName?.toLowerCase().includes(q)
      )
    }
    if (dateFrom) rows = rows.filter(g => g.completedAt && g.completedAt >= dateFrom)
    if (dateTo)   rows = rows.filter(g => g.completedAt && g.completedAt <= dateTo + 'T23:59:59')
    return rows
  }, [groups, statusFilter, search, dateFrom, dateTo])

  function openReview(executionIds: number[], type: 'peer' | 'qclead') {
    setShowReview({ executionIds, type })
    setReviewForm({
      reviewerUsername: '',
      password: '',
      meaning: type === 'peer'
        ? 'I have reviewed and verified these test results'
        : 'I verify these results meet specification and are ready for release',
      reason: '', notes: '',
    })
    setError('')
  }

  async function downloadExecutionPdf(executionId: number, sampleNumber: string) {
    try {
      const res = await api.get(`/results-review/${executionId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `BatchAnalysis_${String(executionId).padStart(5, '0')}_${sampleNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      let message = 'PDF download failed'
      const blob = err?.response?.data
      if (blob instanceof Blob) {
        try { const j = JSON.parse(await blob.text()); message = j.message ?? j.error ?? message } catch { /* not JSON */ }
      } else {
        message = err?.response?.data?.message ?? err?.response?.data?.error ?? message
      }
      toast(message, 'error')
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const type     = showReview!.type
      const endpoint = type === 'peer' ? 'peer-review' : 'qc-lead-verify'
      const payload = reviewForm.reviewerUsername.trim()
        ? { ...reviewForm, reviewerUsername: reviewForm.reviewerUsername.trim() }
        : { password: reviewForm.password, meaning: reviewForm.meaning, reason: reviewForm.reason, notes: reviewForm.notes }
      for (const executionId of showReview!.executionIds) {
        await api.post(`/results-review/${executionId}/${endpoint}`, payload)
      }
      setShowReview(null)
      await load()
      setStatusFilter(type === 'peer' ? 'PendingQC' : 'All')
      toast('Review recorded successfully', 'success')
    } catch (err) { setError(getErrorMessage(err, 'Review failed')) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
        {CHIPS.map((c, i) => (
          <Chip key={c.key} label={c.label} count={c.count} color={c.color} bg={c.bg}
            active={statusFilter === c.key} onClick={() => setStatusFilter(c.key)}
            showArrow={i < CHIPS.length - 1} />
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#374151', outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#374151', outline: 'none' }} />
        </div>

        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sample, material, lot…"
            style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid #d1d5db',
              borderRadius: 20, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: '#374151' }} />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : `${filtered.length} sample${filtered.length !== 1 ? 's' : ''} (${filtered.reduce((n, g) => n + g.executions.length, 0)} tests)`}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['SAMPLE NUMBER', 'MATERIAL', 'LOT', 'ANALYST', 'REVIEW STAGE', 'STATUS', 'COMPLETED', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11,
                  fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No samples to review</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>All completed samples have been reviewed, or none match your filters.</div>
              </td></tr>
            ) : (
              filtered.map((g, i) => {
                const canPeer = g.pendingPeerIds.length > 0
                const canQC   = g.pendingQCIds.length > 0
                return (
                  <tr key={g.sampleId}
                    style={{ borderBottom: '1px solid #f3f4f6',
                      background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <div onClick={() => setDetailSampleId(g.sampleId)}
                        style={{ fontSize: 13, fontWeight: 700, color: '#2563eb',
                          cursor: 'pointer', fontFamily: 'monospace', textDecoration: 'underline dotted' }}>
                        {g.sampleNumber}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {g.executions.length} test{g.executions.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{g.materialName}</div>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                      {g.lotNumber}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>
                      {g.analystName}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <ReviewSteps status={g.overallStatus} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={g.overallStatus} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {g.completedAt ? fmtDate(g.completedAt) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {canPeer && canPeerReview && (
                          <button onClick={() => openReview(g.pendingPeerIds, 'peer')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, color: '#2563eb', padding: 0 }}>
                            Peer Review
                          </button>
                        )}
                        {canQC && canQCVerify && (
                          <button onClick={() => openReview(g.pendingQCIds, 'qclead')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, color: '#7c3aed', padding: 0 }}>
                            QC Verify
                          </button>
                        )}
                        {/* PDF download — one per execution */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (g.executions.length === 1) {
                                downloadExecutionPdf(g.executions[0].executionId, g.sampleNumber)
                              } else {
                                setPdfDropdown(pdfDropdown === g.sampleId ? null : g.sampleId)
                              }
                            }}
                            style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                              cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#374151',
                              padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg viewBox="0 0 24 24" fill="none" width="11" height="11">
                              <path d="M12 16l-4-4h3V4h2v8h3l-4 4zM4 20h16v-2H4v2z"
                                fill="#374151"/>
                            </svg>
                            PDF{g.executions.length > 1 ? ` (${g.executions.length})` : ''}
                          </button>
                          {pdfDropdown === g.sampleId && (
                            <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20,
                              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 190, padding: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af',
                                textTransform: 'uppercase', padding: '4px 8px 6px', letterSpacing: 0.5 }}>
                                Download per test
                              </div>
                              {g.executions.map((ex, idx) => (
                                <button key={ex.executionId}
                                  onClick={e => { e.stopPropagation(); downloadExecutionPdf(ex.executionId, g.sampleNumber); setPdfDropdown(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    textAlign: 'left', padding: '6px 10px', borderRadius: 6,
                                    border: 'none', cursor: 'pointer', fontSize: 12,
                                    background: 'none', color: '#111827', fontFamily: 'inherit' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                                    EXE-{String(ex.executionId).padStart(5, '0')}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{ex.testLabel ?? `Test ${idx + 1}`}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* E-Signature Drawer */}
      {showReview && (
        <Drawer
          title={showReview.type === 'peer' ? 'Peer Review — E-Signature' : 'QC Lead Verification — E-Signature'}
          onClose={() => { setShowReview(null); setError('') }}
          blocking width={460}
        >
          {showReview.executionIds.length > 1 && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0f9ff',
              border: '1px solid #bae6fd', borderRadius: 6, fontSize: 13, color: '#0369a1' }}>
              This will apply to all <strong>{showReview.executionIds.length} tests</strong> for this sample.
            </div>
          )}
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
            <strong>21 CFR Part 11:</strong> {showReview.type === 'peer'
              ? 'You must not be the original analyst.'
              : 'You must be different from both the analyst and peer reviewer.'}
            {' '}Your name, timestamp (UTC), meaning and reason will be immutably recorded.
          </p>
          <form onSubmit={submitReview}>
            <Field label={showReview.type === 'peer' ? 'Reviewer Username (if different from you)' : 'QC Lead Username (if different from you)'}>
              <input style={inp} value={reviewForm.reviewerUsername}
                onChange={e => setReviewForm(f => ({ ...f, reviewerUsername: e.target.value }))}
                placeholder="e.g. srikanth — leave blank to use your own account" />
            </Field>
            <Field label="Password (re-enter to confirm identity)">
              <input style={inp} type="password" autoFocus value={reviewForm.password}
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
                padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 8 }}>⚠ {error}</div>
            )}
            <DrawerFooter saving={saving} onCancel={() => { setShowReview(null); setError('') }}
              label={showReview.type === 'peer' ? 'Sign Peer Review' : 'Sign QC Lead Verification'} />
          </form>
        </Drawer>
      )}

      {detailSampleId !== null && (
        <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} context="qa" />
      )}
    </div>
  )
}
