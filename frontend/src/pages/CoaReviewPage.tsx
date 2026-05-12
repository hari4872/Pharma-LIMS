import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface CoaLine {
  coaLineId: number; parameterId: number; parameterName: string; methodCode: string
  specMin: number | null; specMax: number | null; regulatoryTier: string | null
  calculatedResult: number | null; passFail: string; analystName: string; displayOrder: number
}

interface CoaApproval {
  approvalId: number; decision: string; justification: string | null
  signedBy: string; decidedAt: string
}

interface CoaItem {
  coaId: number; sampleId: number; sampleNumber: string
  materialName: string; lotNumber: string
  coaNumber: string; status: string
  createdAt: string; lockedAt: string | null
  customerName: string | null; doNumber: string | null; despatchDate: string | null
  qaSignedBy: string | null; qaSignedAt: string | null
  supersededById: number | null
  lines: CoaLine[]; approvals: CoaApproval[]
}

interface ChecklistItem { label: string; pass: boolean }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:      { bg: '#fef9c3', color: '#854d0e' },
  Released:   { bg: '#d1fae5', color: '#065f46' },
  Superseded: { bg: '#f3f4f6', color: '#6b7280' },
}

export default function CoaReviewPage() {
  const [data, setData] = useState<CoaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Draft')
  const [selected, setSelected] = useState<CoaItem | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [form, setForm] = useState({ password: '', meaning: '', reason: '', justification: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const r = await api.get(`/coas?status=${statusFilter}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  async function openDetail(coa: CoaItem) {
    setSelected(coa); setChecklistLoading(true); setError('')
    try {
      const r = await api.get(`/coas/${coa.coaId}/checklist`)
      const cl = r.data
      setChecklist([
        { label: '1. All test executions complete',          pass: cl.testsComplete },
        { label: '2. No open OOS investigations',           pass: cl.noOpenOos },
        { label: '3. No open OOT investigations',           pass: cl.noOpenOot },
        { label: '4. All analyst e-signatures present',     pass: cl.analystSigsPresent },
        { label: '5. Peer review e-signature present',      pass: cl.peerReviewPresent },
        { label: '6. QC Lead verification e-sig present',   pass: cl.qcLeadVerifPresent },
        { label: '7. Correct approved spec version used',   pass: cl.correctSpecVersion },
        { label: '8. Evidence present (critical params)',   pass: cl.evidencePresent },
        { label: '9. CoA header fully populated',           pass: cl.coaHeaderPopulated },
        { label: '10. CoA body complete (no blank results)', pass: cl.coaBodyComplete },
        { label: '11. Dispatch QC cleared (if DO linked)',   pass: cl.dispatchQcPassed },
      ])
    } catch { setChecklist(null) }
    setChecklistLoading(false)
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/coas/${selected!.coaId}/approve`, {
        password: form.password, meaning: form.meaning, reason: form.reason
      })
      setShowApprove(false); setSelected(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Approval failed') }
    finally { setSaving(false) }
  }

  async function submitReject(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/coas/${selected!.coaId}/reject`, {
        justification: form.justification,
        password: form.password, meaning: form.meaning, reason: form.reason
      })
      setShowReject(false); setSelected(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Rejection failed') }
    finally { setSaving(false) }
  }

  const allChecklistPassed = checklist?.every(c => c.pass) ?? false

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>CoA Review & QA Release</h1>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="Draft">Draft</option>
          <option value="Released">Released</option>
          <option value="Superseded">Superseded</option>
        </select>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        21 CFR 211.194 — QA 10-item checklist must pass before approval. PDF locked server-side atomically on QA §11.50 e-sig.
      </p>

      <DataTable loading={loading} data={data} columns={[
        { header: 'CoA No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.coaNumber}</strong> },
        { header: 'Sample', accessor: 'sampleNumber' },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot', accessor: 'lotNumber' },
        { header: 'Customer / DO', accessor: r => r.customerName ? `${r.customerName} / ${r.doNumber ?? '—'}` : '—' },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'QA Signed By', accessor: r => r.qaSignedBy
          ? <span style={{ fontSize: 12 }}>{r.qaSignedBy}<br /><span style={{ color: '#6b7280' }}>{new Date(r.qaSignedAt!).toLocaleString()}</span></span>
          : '—' },
        { header: 'Actions', accessor: r => (
          <button onClick={() => openDetail(r)} style={{ padding: '3px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            Review
          </button>
        )},
      ]} />

      {/* CoA Detail + Checklist Panel */}
      {selected && !showApprove && !showReject && (
        <Modal title={`CoA Review — ${selected.coaNumber}`} onClose={() => setSelected(null)}>
          {/* Header Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16, fontSize: 13 }}>
            {[
              ['Sample', selected.sampleNumber],
              ['Material / Lot', `${selected.materialName} / ${selected.lotNumber}`],
              ['Customer', selected.customerName ?? '—'],
              ['DO No.', selected.doNumber ?? '—'],
              ['Despatch Date', selected.despatchDate ?? '—'],
            ].map(([label, val]) => (
              <div key={label}><span style={{ color: '#6b7280' }}>{label}:</span> <strong>{val}</strong></div>
            ))}
          </div>

          {/* 10-item Checklist */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>QA Validation Checklist (21 CFR 211.192)</div>
            {checklistLoading && <div style={{ fontSize: 13, color: '#6b7280' }}>Evaluating checklist…</div>}
            {checklist && checklist.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 16, color: item.pass ? '#16a34a' : '#dc2626' }}>{item.pass ? '✓' : '✗'}</span>
                <span style={{ color: item.pass ? '#374151' : '#dc2626' }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* CoA Lines */}
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Test Results ({selected.lines.length} parameters)</div>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Parameter', 'Method', 'Spec Min–Max', 'Result', 'Pass/Fail', 'Analyst'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.lines.map(line => (
                  <tr key={line.coaLineId}>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{line.parameterName}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 11 }}>{line.methodCode}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{line.specMin ?? '—'} – {line.specMax ?? '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{line.calculatedResult ?? '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: line.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
                        color: line.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{line.passFail}</span>
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{line.analystName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Approve / Reject Buttons */}
          {selected.status === 'Draft' && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowReject(true); setForm(f => ({ ...f, meaning: 'I reject this CoA — see justification', reason: '', password: '', justification: '' })) }}
                style={{ padding: '7px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                Reject CoA
              </button>
              <button
                disabled={!allChecklistPassed}
                onClick={() => { setShowApprove(true); setForm(f => ({ ...f, meaning: 'I approve the release of this batch. This CoA is accurate.', reason: '', password: '' })) }}
                style={{ padding: '7px 16px', background: allChecklistPassed ? '#16a34a' : '#9ca3af',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: allChecklistPassed ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                {allChecklistPassed ? 'Approve & Lock CoA' : 'Checklist Incomplete'}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Approve Modal */}
      {showApprove && selected && (
        <Modal title="Approve CoA — QA §11.50 E-Signature" onClose={() => setShowApprove(false)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            This will lock the CoA PDF atomically and release the sample. All 3 e-signatures embedded in locked PDF (21 CFR §11.50).
          </p>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter — §11.300)"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={form.meaning} onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All results reviewed and meet specification" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(false)} label="Sign & Approve CoA" />
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      {showReject && selected && (
        <Modal title="Reject CoA — QA §11.50 E-Signature" onClose={() => setShowReject(false)}>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: 13, color: '#991b1b' }}>
            ⚠ Rejection is permanent and immutable (EU Annex 11 §13). Justification is mandatory.
          </div>
          <form onSubmit={submitReject}>
            <Field label="Justification (mandatory)">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} required placeholder="Reason for rejection…" />
            </Field>
            <Field label="Password (re-enter — §11.300)"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={form.meaning} onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReject(false)} label="Sign & Reject CoA" />
          </form>
        </Modal>
      )}
    </div>
  )
}
