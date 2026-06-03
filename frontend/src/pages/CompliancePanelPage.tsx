import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { Field, Modal, ModalFooter, inp } from './master-data/LaboratoriesPage'

// FR-18 / FR-20: Compliance & Governance — audit trail, signature log, validation reviews
// QA/Admin access only

type Tab = 'audit' | 'signatures' | 'reviews' | 'formTemplates' | 'loginAudit'

interface AuditItem  { logId: number; entityType: string; entityId: string; action: string; changedBy: string; changedAt: string; before: string | null; after: string | null }
interface SigItem    { signatureId: number; userId: number; fullName: string; meaning: string; reason: string; signedAt: string }
interface ReviewItem { reviewId: number; reviewType: string; reviewedBy: string; reviewedAt: string; outcome: string; notes: string | null; nextReviewDue: string }
interface FtItem     { templateId: number; templateName: string; status: string; createdAt: string; createdBy: string }
interface LoginAuditRow { loginAuditLogId: number; username: string; userId: number | null; ipAddress: string; userAgent: string | null; outcome: string; attemptedAt: string }

interface AuditPage  { items: AuditItem[];  totalCount: number; page: number; pageSize: number }
interface SigPage    { items: SigItem[];    totalCount: number; page: number; pageSize: number }

const outcomeColour = (o: string) => o === 'Passed' ? '#d1fae5' : o === 'FailedWithActions' ? '#fee2e2' : '#fef3c7'

// ── Before / After diff viewer ────────────────────────────────────────────────
function DiffCell({ label, json }: { label: string; json: string | null }) {
  const [open, setOpen] = useState(false)
  if (!json) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(json) } catch { return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{json}</span> }
  const keys = Object.keys(parsed)
  const bg = label === 'Before' ? '#fff7ed' : '#f0fdf4'
  const border = label === 'Before' ? '#fed7aa' : '#bbf7d0'
  const color = label === 'Before' ? '#9a3412' : '#166534'
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
        background: bg, border: `1px solid ${border}`, color, fontFamily: 'inherit'
      }}>
        {open ? '▲' : '▼'} {label} ({keys.length} field{keys.length !== 1 ? 's' : ''})
      </button>
      {open && (
        <div style={{ marginTop: 4, padding: '6px 10px', background: bg, border: `1px solid ${border}`, borderRadius: 4, fontSize: 11, fontFamily: 'monospace', maxWidth: 280, overflowX: 'auto' }}>
          {keys.map(k => (
            <div key={k} style={{ marginBottom: 2 }}>
              <span style={{ color: '#6b7280' }}>{k}: </span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{String(parsed[k] ?? '—')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompliancePanelPage() {
  const [tab, setTab] = useState<Tab>('audit')

  // Audit
  const [audit, setAudit]           = useState<AuditPage | null>(null)
  const [auditPage, setAuditPage]   = useState(1)
  const [auditType, setAuditType]   = useState('')
  const [auditFrom, setAuditFrom]   = useState('')
  const [auditTo,   setAuditTo]     = useState('')

  // Signatures
  const [sigs, setSigs]             = useState<SigPage | null>(null)
  const [sigPage, setSigPage]       = useState(1)

  // Reviews
  const [reviews, setReviews]       = useState<ReviewItem[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({ reviewType: 'Annual', outcome: 'Passed', notes: '', password: '', meaning: '', reason: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Form templates pending
  const [ftPending, setFtPending]   = useState<FtItem[]>([])

  // Login Audit
  const [loginAuditRows, setLoginAuditRows]   = useState<LoginAuditRow[]>([])
  const [loginAuditLoading, setLoginAuditLoading] = useState(false)
  const [loginAuditOutcome, setLoginAuditOutcome] = useState('')
  const [loginAuditFrom, setLoginAuditFrom]   = useState('')
  const [loginAuditTo, setLoginAuditTo]       = useState('')

  const [loading, setLoading] = useState(false)

  async function loadAudit(page = auditPage) {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, pageSize: 50 }
      if (auditType) params.entityType = auditType
      if (auditFrom) params.from = new Date(auditFrom).toISOString()
      if (auditTo)   params.to   = new Date(auditTo + 'T23:59:59').toISOString()
      const r = await api.get('/compliance/audit-trail', { params })
      setAudit(r.data)
    } catch { setAudit({ items: [], totalCount: 0, page: 1, pageSize: 50 }) }
    finally { setLoading(false) }
  }

  async function loadSigs(page = sigPage) {
    setLoading(true)
    try {
      const r = await api.get('/compliance/signatures', { params: { page, pageSize: 50 } })
      setSigs(r.data)
    } catch { setSigs({ items: [], totalCount: 0, page: 1, pageSize: 50 }) }
    finally { setLoading(false) }
  }

  async function loadReviews() {
    setLoading(true)
    try {
      const r = await api.get('/compliance/validation-reviews')
      setReviews(r.data)
    } catch { setReviews([]) }
    finally { setLoading(false) }
  }

  async function loadLoginAudit() {
    setLoginAuditLoading(true)
    const params: Record<string, string> = {}
    if (loginAuditOutcome) params.outcome = loginAuditOutcome
    if (loginAuditFrom)    params.from    = new Date(loginAuditFrom).toISOString()
    if (loginAuditTo)      params.to      = new Date(loginAuditTo + 'T23:59:59').toISOString()
    try {
      const r = await api.get('/audit/login-history', { params })
      setLoginAuditRows(r.data)
    } catch { setLoginAuditRows([]) }
    finally { setLoginAuditLoading(false) }
  }

  async function loadFtPending() {
    setLoading(true)
    try {
      const r = await api.get('/compliance/form-templates/pending-review')
      setFtPending(r.data)
    } catch { setFtPending([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === 'audit')        loadAudit(1)
      if (tab === 'signatures')   loadSigs(1)
      if (tab === 'reviews')      loadReviews()
      if (tab === 'formTemplates') loadFtPending()
    }, 0)
    return () => clearTimeout(t)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitReview(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/compliance/validation-reviews', reviewForm)
      setShowReviewForm(false)
      setReviewForm({ reviewType: 'Annual', outcome: 'Passed', notes: '', password: '', meaning: '', reason: '' })
      loadReviews()
    } catch (err) { setError(getErrorMessage(err, 'Failed')) }
    finally { setSaving(false) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'audit',        label: 'Audit Trail' },
    { key: 'signatures',   label: 'Signature Log' },
    { key: 'reviews',      label: 'Validation Reviews' },
    { key: 'formTemplates', label: `Form Templates${ftPending.length ? ` (${ftPending.length})` : ''}` },
    { key: 'loginAudit',  label: '🔐 Login Audit' },
  ]

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em' }}>Compliance &amp; Governance</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e0e0e0', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '9px 18px', border: 'none', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontWeight: tab === t.key ? 700 : 500, fontSize: 14, background: 'none', color: tab === t.key ? '#2563eb' : '#111111', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Audit Trail ── */}
      {tab === 'audit' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select style={{ ...inp, width: 200, margin: 0 }} value={auditType} onChange={e => setAuditType(e.target.value)}>
              <option value="">All Entity Types</option>
              {['Laboratory','Instrument','Material','SampleType','Reagent','TestMethod','Parameter','SpecLimit','FormTemplate','SpecificationTemplate','SamplingPlan','StabilityProtocol','UserTrainingRecord','User','Checkpoint','WorkflowTemplate'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input type="date" style={{ ...inp, width: 160, margin: 0 }} value={auditFrom} onChange={e => setAuditFrom(e.target.value)} title="From date" />
            <input type="date" style={{ ...inp, width: 160, margin: 0 }} value={auditTo} onChange={e => setAuditTo(e.target.value)} title="To date" />
            <button onClick={() => loadAudit(1)} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              🔍 Filter
            </button>
            {(auditType || auditFrom || auditTo) && (
              <button onClick={() => { setAuditType(''); setAuditFrom(''); setAuditTo(''); setTimeout(() => loadAudit(1), 50) }}
                style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                ✕ Clear
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#5f6368' }}>{audit ? `${audit.totalCount.toLocaleString()} total entries` : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['ID', 'Entity Type', 'Entity ID', 'Action', 'Changed By', 'Changed At', 'Before', 'After'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
                {!loading && audit?.items.map(a => (
                  <tr key={a.logId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={td}>{a.logId}</td>
                    <td style={td}><span style={{ padding: '2px 6px', background: '#eff6ff', borderRadius: 4, fontSize: 11, color: '#1d4ed8' }}>{a.entityType}</span></td>
                    <td style={td}>{a.entityId}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 11,
                        background: a.action === 'Created' ? '#d1fae5' : a.action === 'Retired' || a.action === 'Deactivated' ? '#fee2e2' : a.action === 'Approved' ? '#dbeafe' : '#fef3c7'
                      }}>{a.action}</span>
                    </td>
                    <td style={td}>{a.changedBy}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{a.changedAt?.replace('T', ' ').slice(0, 19)} UTC</td>
                    <td style={{ ...td, minWidth: 120 }}><DiffCell label="Before" json={a.before} /></td>
                    <td style={{ ...td, minWidth: 120 }}><DiffCell label="After" json={a.after} /></td>
                  </tr>
                ))}
                {!loading && (audit?.items.length ?? 0) === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No audit records</td></tr>}
              </tbody>
            </table>
          </div>
          {audit && audit.totalCount > 50 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button disabled={auditPage <= 1} onClick={() => { setAuditPage(p => p - 1); loadAudit(auditPage - 1) }} style={pagBtn}>← Prev</button>
              <span style={{ fontSize: 13, color: '#111111', alignSelf: 'center' }}>Page {auditPage}</span>
              <button disabled={auditPage * 50 >= audit.totalCount} onClick={() => { setAuditPage(p => p + 1); loadAudit(auditPage + 1) }} style={pagBtn}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ── Signature Log ── */}
      {tab === 'signatures' && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Sig. ID', 'User', 'Meaning', 'Reason', 'Signed At (UTC)'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
                {!loading && sigs?.items.map(s => (
                  <tr key={s.signatureId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={td}>{s.signatureId}</td>
                    <td style={td}>{s.fullName}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.meaning}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.reason}</td>
                    <td style={td}>{s.signedAt?.replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))}
                {!loading && (sigs?.items.length ?? 0) === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No signatures</td></tr>}
              </tbody>
            </table>
          </div>
          {sigs && sigs.totalCount > 50 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button disabled={sigPage <= 1} onClick={() => { setSigPage(p => p - 1); loadSigs(sigPage - 1) }} style={pagBtn}>← Prev</button>
              <span style={{ fontSize: 13, color: '#111111', alignSelf: 'center' }}>Page {sigPage}</span>
              <button disabled={sigPage * 50 >= sigs.totalCount} onClick={() => { setSigPage(p => p + 1); loadSigs(sigPage + 1) }} style={pagBtn}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ── Validation Reviews ── */}
      {tab === 'reviews' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowReviewForm(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>+ Record Review</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['ID', 'Type', 'Reviewed By', 'Reviewed At', 'Outcome', 'Next Due', 'Notes'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
                {!loading && reviews.map(r => (
                  <tr key={r.reviewId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={td}>{r.reviewId}</td>
                    <td style={td}>{r.reviewType}</td>
                    <td style={td}>{r.reviewedBy}</td>
                    <td style={td}>{r.reviewedAt?.replace('T', ' ').slice(0, 16)} UTC</td>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: outcomeColour(r.outcome) }}>{r.outcome}</span></td>
                    <td style={td}>{r.nextReviewDue?.replace('T', ' ').slice(0, 10)}</td>
                    <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#5f6368' }}>{r.notes ?? '—'}</td>
                  </tr>
                ))}
                {!loading && reviews.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No reviews recorded</td></tr>}
              </tbody>
            </table>
          </div>
          {showReviewForm && (
            <Modal title="Record Validation Review" onClose={() => setShowReviewForm(false)}>
              <form onSubmit={submitReview}>
                <Field label="Review Type">
                  <select style={inp} value={reviewForm.reviewType} onChange={e => setReviewForm(f => ({ ...f, reviewType: e.target.value }))}>
                    {['Annual', 'Triggered', 'PostChange'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Outcome">
                  <select style={inp} value={reviewForm.outcome} onChange={e => setReviewForm(f => ({ ...f, outcome: e.target.value }))}>
                    {['Passed', 'FailedWithActions', 'Deferred'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Notes (optional)">
                  <textarea style={{ ...inp, height: 72, resize: 'vertical' }} value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))} />
                </Field>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '12px 0 0', fontWeight: 500 }}>Electronic Signature (21 CFR Part 11)</p>
                <Field label="Password (re-enter)"><input style={inp} type="password" value={reviewForm.password} onChange={e => setReviewForm(f => ({ ...f, password: e.target.value }))} required /></Field>
                <Field label="Meaning"><input style={inp} value={reviewForm.meaning} onChange={e => setReviewForm(f => ({ ...f, meaning: e.target.value }))} required placeholder="e.g. Periodic re-validation approval" /></Field>
                <Field label="Reason"><input style={inp} value={reviewForm.reason} onChange={e => setReviewForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Annual review cycle completed" /></Field>
                {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
                <ModalFooter saving={saving} onCancel={() => setShowReviewForm(false)} label="Record Review" />
              </form>
            </Modal>
          )}
        </>
      )}

      {/* ── Form Templates Pending Approval ── */}
      {tab === 'formTemplates' && (
        <>
          {ftPending.length > 0 && (
            <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ {ftPending.length} form template(s) have been in Draft/UnderReview status — QA review required
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Template ID', 'Name', 'Status', 'Created At', 'Created By'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
                {!loading && ftPending.map(t => (
                  <tr key={t.templateId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={td}>{t.templateId}</td>
                    <td style={td}>{t.templateName}</td>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#fef3c7', color: '#92400e' }}>{t.status}</span></td>
                    <td style={td}>{t.createdAt?.replace('T', ' ').slice(0, 16)} UTC</td>
                    <td style={td}>{t.createdBy}</td>
                  </tr>
                ))}
                {!loading && ftPending.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No pending reviews — all form templates are approved ✓</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Login Audit Trail ── */}
      {tab === 'loginAudit' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select style={{ ...inp, width: 200, margin: 0 }} value={loginAuditOutcome} onChange={e => setLoginAuditOutcome(e.target.value)}>
              <option value="">All Outcomes</option>
              {['Success','InvalidPassword','UserNotFound','AccountLocked','AccountInactive'].map(o => <option key={o}>{o}</option>)}
            </select>
            <input type="date" style={{ ...inp, width: 160, margin: 0 }} value={loginAuditFrom} onChange={e => setLoginAuditFrom(e.target.value)} placeholder="From" />
            <input type="date" style={{ ...inp, width: 160, margin: 0 }} value={loginAuditTo}   onChange={e => setLoginAuditTo(e.target.value)}   placeholder="To" />
            <button onClick={loadLoginAudit} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Load</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>{loginAuditRows.length} record{loginAuditRows.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Date / Time (UTC)', 'Username', 'IP Address', 'Outcome', 'User Agent'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loginAuditLoading && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
                {!loginAuditLoading && loginAuditRows.map(row => {
                  const outcomeStyle: Record<string, { bg: string; color: string }> = {
                    Success:         { bg: '#d1fae5', color: '#065f46' },
                    InvalidPassword: { bg: '#fee2e2', color: '#991b1b' },
                    UserNotFound:    { bg: '#fee2e2', color: '#991b1b' },
                    AccountLocked:   { bg: '#fef3c7', color: '#92400e' },
                    AccountInactive: { bg: '#f3f4f6', color: '#6b7280' },
                  }
                  const oc = outcomeStyle[row.outcome] ?? { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <tr key={row.loginAuditLogId} style={{ borderBottom: '1px solid #f1f3f4' }}>
                      <td style={td}>{new Date(row.attemptedAt).toLocaleString()}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{row.username}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{row.ipAddress}</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: oc.bg, color: oc.color }}>{row.outcome}</span></td>
                      <td style={{ ...td, fontSize: 11, color: '#6b7280', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.userAgent ?? '—'}</td>
                    </tr>
                  )
                })}
                {!loginAuditLoading && loginAuditRows.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Click Load to fetch login records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 13, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e0e0e0', background: '#f8f9fa' }
const td: React.CSSProperties = { padding: '12px 14px', color: '#111111', fontSize: 14 }
const pagBtn: React.CSSProperties = { padding: '6px 14px', border: '1px solid #dadce0', borderRadius: 6, cursor: 'pointer', background: '#fff', fontSize: 13, color: '#111111' }
