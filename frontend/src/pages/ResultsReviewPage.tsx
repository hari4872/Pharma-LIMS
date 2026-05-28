import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface Execution {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; analystName: string; status: string
}

export default function ResultsReviewPage() {
  const [data, setData] = useState<Execution[]>([])
  const [loading, setLoading] = useState(false)
  const [showReview, setShowReview] = useState<{ executionId: number; type: 'peer' | 'qclead' } | null>(null)
  const [reviewForm, setReviewForm] = useState({ password: '', meaning: '', reason: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const r = await api.get('/test-executions?status=Completed')
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openReview(executionId: number, type: 'peer' | 'qclead') {
    setShowReview({ executionId, type })
    setReviewForm({
      password: '',
      meaning: type === 'peer' ? 'I have reviewed and verified these test results' : 'I verify these results meet specification and are ready for release',
      reason: '',
      notes: ''
    })
    setError('')
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const endpoint = showReview!.type === 'peer' ? 'peer-review' : 'qc-lead-verify'
      await api.post(`/results-review/${showReview!.executionId}/${endpoint}`, reviewForm)
      setShowReview(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Review failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 800, color: '#111827' }}>Results Review (4-Eyes)</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        GMP 4-eyes principle: Peer reviewer ≠ original analyst. QC Lead ≠ analyst ≠ peer reviewer. OOS gate enforced before QC Lead verification.
      </p>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot', accessor: 'lotNumber' },
        { header: 'Analyst (original)', accessor: 'analystName' },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, background: '#d1fae5', color: '#065f46', fontWeight: 500 }}>{r.status}</span>
        )},
        { header: 'Review Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openReview(r.executionId, 'peer')}
              style={{ padding: '3px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              Peer Review (Step 2)
            </button>
            <button onClick={() => openReview(r.executionId, 'qclead')}
              style={{ padding: '3px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              QC Lead Verify (Step 4)
            </button>
          </div>
        )},
      ]} />

      {showReview && (
        <Modal
          title={showReview.type === 'peer' ? 'Peer Review — E-Signature' : 'QC Lead Verification — E-Signature'}
          onClose={() => setShowReview(null)}
        >
          {showReview.type === 'qclead' && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fef9c3', borderRadius: 6, fontSize: 13, color: '#854d0e' }}>
              ℹ OOS gate enforced: if any OOS investigation is still open, this verification will be blocked. Close all OOS investigations first.
            </div>
          )}
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR Part 11 — {showReview.type === 'peer' ? 'You must not be the original analyst.' : 'You must be different from both the analyst and peer reviewer.'}
            Your full name, timestamp UTC, meaning, and reason will be immutably recorded.
          </p>
          <form onSubmit={submitReview}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={reviewForm.password} onChange={e => setReviewForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={reviewForm.meaning} onChange={e => setReviewForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={reviewForm.reason} onChange={e => setReviewForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All results reviewed and confirmed correct" /></Field>
            <Field label="Notes (optional)"><input style={inp} value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional observations…" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReview(null)} label={showReview.type === 'peer' ? 'Sign Peer Review' : 'Sign QC Lead Verification'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
