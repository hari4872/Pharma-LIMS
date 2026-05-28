import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'
import PipelineBar from '@/components/PipelineBar'

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
interface ExecOption { executionId: number; sampleId: number; sampleNumber: string; materialName: string; lotNumber: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:      { bg: '#fef9c3', color: '#854d0e' },
  Released:   { bg: '#d1fae5', color: '#065f46' },
  Superseded: { bg: '#f3f4f6', color: '#6b7280' },
}

const STAGES = [
  { key: 'Draft',      label: 'Draft',      color: '#b45309', bg: '#fef9c3' },
  { key: 'Released',   label: 'Released',   color: '#065f46', bg: '#d1fae5' },
  { key: 'Superseded', label: 'Superseded', color: '#374151', bg: '#f3f4f6' },
]

export default function CoaReviewPage() {
  const [data, setData] = useState<CoaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Draft')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<CoaItem | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [form, setForm] = useState({ password: '', meaning: '', reason: '', justification: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Generate CoA state
  const [showGenerate,    setShowGenerate]    = useState(false)
  const [generateExecs,   setGenerateExecs]   = useState<ExecOption[]>([])
  const [generateExecId,  setGenerateExecId]  = useState<number | null>(null)
  const [generateSaving,  setGenerateSaving]  = useState(false)
  const [generateError,   setGenerateError]   = useState('')

  // Reissue CoA state
  const [showReissue,    setShowReissue]    = useState(false)
  const [reissueTarget,  setReissueTarget]  = useState<CoaItem | null>(null)
  const [reissueReason,  setReissueReason]  = useState('')
  const [reissueSaving,  setReissueSaving]  = useState(false)
  const [reissueError,   setReissueError]   = useState('')

  // ── Generate CoA ──────────────────────────────────────────────────────────
  async function openGenerate() {
    setShowGenerate(true); setGenerateExecId(null); setGenerateError('')
    try {
      const r = await api.get('/test-executions?status=Completed')
      const list: ExecOption[] = (Array.isArray(r.data) ? r.data : []).map((e: any) => ({
        executionId: e.executionId,
        sampleId:    e.sampleId ?? e.sample?.sampleId ?? 0,
        sampleNumber: e.sampleNumber ?? e.sample?.sampleNumber ?? '',
        materialName: e.materialName ?? e.sample?.materialName ?? '',
        lotNumber:   e.lotNumber    ?? e.sample?.lotNumber    ?? '',
      }))
      setGenerateExecs(list)
      if (list.length > 0) setGenerateExecId(list[0].executionId)
    } catch { setGenerateExecs([]) }
  }

  async function submitGenerate(ev: React.FormEvent) {
    ev.preventDefault()
    const exec = generateExecs.find(e => e.executionId === generateExecId)
    if (!exec) return
    setGenerateSaving(true); setGenerateError('')
    try {
      const r = await api.post('/coas/generate', { sampleId: exec.sampleId, executionId: exec.executionId })
      toast(`CoA generated successfully — CoA #${r.data?.coaId ?? ''}`, 'success')
      setShowGenerate(false); load()
    } catch (err: any) {
      setGenerateError(err.response?.data?.message ?? 'CoA generation failed')
    } finally { setGenerateSaving(false) }
  }

  // ── Reissue CoA ───────────────────────────────────────────────────────────
  async function submitReissue(ev: React.FormEvent) {
    ev.preventDefault()
    if (!reissueTarget) return
    setReissueSaving(true); setReissueError('')
    try {
      const r = await api.post(`/coas/${reissueTarget.coaId}/reissue`, { reason: reissueReason })
      toast(`CoA reissued — new CoA #${r.data?.newCoaId ?? ''} created, original superseded`, 'success')
      setShowReissue(false); setReissueTarget(null); load()
    } catch (err: any) {
      setReissueError(err.response?.data?.message ?? 'Reissue failed')
    } finally { setReissueSaving(false) }
  }

  async function load() {
    setLoading(true)
    const r = await api.get('/coas')
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.createdAt < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, statusFilter, dateFrom, dateTo])

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
      toast(`CoA ${selected!.coaNumber} approved and locked successfully`, 'success')
      setShowApprove(false); setSelected(null); load()
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Approval failed'
      setError(msg); toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  async function submitReject(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/coas/${selected!.coaId}/reject`, {
        justification: form.justification,
        password: form.password, meaning: form.meaning, reason: form.reason
      })
      toast(`CoA ${selected!.coaNumber} rejected`, 'warning')
      setShowReject(false); setSelected(null); load()
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Rejection failed'
      setError(msg); toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  async function downloadPdf(coa: CoaItem) {
    try {
      const r = await api.get(`/coas/${coa.coaId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `CoA_${coa.coaNumber}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast(`CoA ${coa.coaNumber} PDF downloaded`, 'success')
    } catch {
      toast('Failed to download PDF — CoA may not be approved yet', 'error')
    }
  }

  function handlePrint(coa: CoaItem) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    const lines = coa.lines.map(l =>
      `<tr><td>${l.parameterName}</td><td style="font-family:monospace">${l.methodCode}</td><td>${l.specMin ?? '—'} – ${l.specMax ?? '—'}</td><td style="font-family:monospace">${l.calculatedResult ?? '—'}</td><td style="font-weight:600;color:${l.passFail === 'PASS' ? '#065f46' : '#991b1b'}">${l.passFail}</td><td>${l.analystName}</td></tr>`
    ).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>CoA ${coa.coaNumber}</title>
    <style>
      body{font-family:'Segoe UI',system-ui,sans-serif;padding:32px;color:#111827;font-size:13px}
      h1{font-size:20px;font-weight:700;margin:0 0 4px}
      h2{font-size:14px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #e5e7eb}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px;margin-bottom:16px}
      .meta span{color:#6b7280}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{padding:7px 10px;text-align:left;background:#f8fafc;border-bottom:2px solid #e5e7eb;font-weight:600;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
      .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
      .pass{background:#d1fae5;color:#065f46}.fail{background:#fee2e2;color:#991b1b}
      .footer{margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-size:12px;color:#6b7280}
      @media print{body{padding:16px}}
    </style>
    </head><body>
    <h1>Certificate of Analysis</h1>
    <p style="color:#6b7280;margin:0 0 16px">Generated by Pharma-LIMS — 21 CFR Part 11 Compliant</p>
    <h2>Header</h2>
    <div class="meta">
      <div><span>CoA Number:</span> <strong>${coa.coaNumber}</strong></div>
      <div><span>Status:</span> <strong>${coa.status}</strong></div>
      <div><span>Sample No.:</span> <strong>${coa.sampleNumber}</strong></div>
      <div><span>Material / Lot:</span> <strong>${coa.materialName} / ${coa.lotNumber}</strong></div>
      <div><span>Customer:</span> <strong>${coa.customerName ?? '—'}</strong></div>
      <div><span>DO Number:</span> <strong>${coa.doNumber ?? '—'}</strong></div>
      <div><span>Despatch Date:</span> <strong>${coa.despatchDate ?? '—'}</strong></div>
      <div><span>QA Signed By:</span> <strong>${coa.qaSignedBy ?? 'Pending'}</strong></div>
    </div>
    <h2>Test Results</h2>
    <table>
      <thead><tr><th>Parameter</th><th>Method</th><th>Spec Range</th><th>Result</th><th>Pass/Fail</th><th>Analyst</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="footer">
      <span>Pharma-LIMS — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      <span>21 CFR Part 11 Electronic Signature</span>
    </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const allChecklistPassed = checklist?.every(c => c.pass) ?? false

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827', marginRight: 4 }}>CoA Review &amp; QA Release</h1>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        21 CFR 211.194 — QA 10-item checklist must pass before approval. PDF locked server-side atomically on QA e-signature.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={statusFilter} onChange={setStatusFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={openGenerate} style={{
            padding: '7px 16px', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13,
            fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Generate CoA
          </button>
        </div>
      </div>

      <DataTable loading={loading} data={filtered} exportFilename="CoA_Review" columns={[
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => openDetail(r)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Review
            </button>
            {r.status === 'Released' && (
              <>
                <button onClick={() => downloadPdf(r)} style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                  PDF
                </button>
                <button
                  onClick={() => { setReissueTarget(r); setReissueReason(''); setReissueError(''); setShowReissue(true) }}
                  title="Issue a replacement CoA — supersedes this one"
                  style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                  Reissue
                </button>
              </>
            )}
          </div>
        )},
      ]} />

      {/* CoA Detail + Checklist Panel */}
      {selected && !showApprove && !showReject && (
        <Modal title={`CoA Review — ${selected.coaNumber}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            {selected.status === 'Released' && (
              <button onClick={() => downloadPdf(selected)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', border: 'none', borderRadius: 7, background: '#065f46', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                📄 Download CoA PDF
              </button>
            )}
            <button onClick={() => handlePrint(selected)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Print CoA
            </button>
          </div>
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

          {/* Reissue button — for Released CoAs only */}
          {selected.status === 'Released' && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setReissueTarget(selected); setReissueReason(''); setReissueError(''); setSelected(null); setShowReissue(true) }}
                style={{ padding: '7px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                🔄 Reissue CoA
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Approve Modal */}
      {showApprove && selected && (
        <Modal title="Approve CoA — E-Signature" onClose={() => setShowApprove(false)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            This will lock the CoA PDF atomically and release the sample. All 3 e-signatures embedded in locked PDF (21 CFR Part 11).
          </p>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={form.meaning} onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All results reviewed and meet specification" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(false)} label="Sign & Approve CoA" />
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      {showReject && selected && (
        <Modal title="Reject CoA — E-Signature" onClose={() => setShowReject(false)}>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: 13, color: '#991b1b' }}>
            ⚠ Rejection is permanent and immutable. Justification is mandatory.
          </div>
          <form onSubmit={submitReject}>
            <Field label="Justification (mandatory)">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} required placeholder="Reason for rejection…" />
            </Field>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={form.meaning} onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReject(false)} label="Sign & Reject CoA" />
          </form>
        </Modal>
      )}

      {/* ── Generate CoA Modal ────────────────────────────────────────────── */}
      {showGenerate && (
        <Modal title="Generate Certificate of Analysis" onClose={() => setShowGenerate(false)}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
            Generates a new CoA in <strong>Draft</strong> status from a completed test execution.
            Select the execution below — the CoA will pull all test results and can then be reviewed and approved.
          </p>
          <form onSubmit={submitGenerate}>
            <Field label="Select Completed Execution *">
              {generateExecs.length === 0 ? (
                <div style={{ padding: '10px 12px', background: '#fef9c3', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                  No completed executions found. Complete a test execution first (Work Queue → Start → Submit Results).
                </div>
              ) : (
                <select style={inp} value={generateExecId ?? ''} onChange={e => setGenerateExecId(Number(e.target.value))} required>
                  {generateExecs.map(ex => (
                    <option key={ex.executionId} value={ex.executionId}>
                      #{ex.executionId} — {ex.sampleNumber} · {ex.materialName}{ex.lotNumber ? ` / ${ex.lotNumber}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {generateError && <p style={{ color: '#ef4444', fontSize: 13, margin: '6px 0 0' }}>{generateError}</p>}
            <ModalFooter saving={generateSaving} onCancel={() => setShowGenerate(false)} label="Generate CoA" />
          </form>
        </Modal>
      )}

      {/* ── Reissue CoA Modal ─────────────────────────────────────────────── */}
      {showReissue && reissueTarget && (
        <Modal title={`Reissue CoA — ${reissueTarget.coaNumber}`} onClose={() => { setShowReissue(false); setReissueTarget(null) }}>
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Reissue creates a new replacement CoA</strong> in Draft status.<br />
            The current CoA <code>{reissueTarget.coaNumber}</code> will be marked <strong>Superseded</strong>.<br />
            This action is recorded in the audit trail (21 CFR Part 11).
          </div>
          <form onSubmit={submitReissue}>
            <Field label="Reason for Reissue *">
              <textarea
                style={{ ...inp, height: 80, resize: 'vertical' as const }}
                value={reissueReason}
                onChange={e => setReissueReason(e.target.value)}
                required
                placeholder="e.g. Customer name correction / Updated spec version applied / Transcription error in lot number"
              />
            </Field>
            {reissueError && <p style={{ color: '#ef4444', fontSize: 13, margin: '6px 0 0' }}>{reissueError}</p>}
            <ModalFooter saving={reissueSaving} onCancel={() => { setShowReissue(false); setReissueTarget(null) }} label="🔄 Reissue CoA" />
          </form>
        </Modal>
      )}
    </div>
  )
}
