import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { fmtDate, fmtDateTime } from '@/utils/dateFormat'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { toast } from '@/components/Toast'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

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
  Rejected:   { bg: '#fee2e2', color: '#991b1b' },
  Superseded: { bg: '#f3f4f6', color: '#6b7280' },
}

const STAGES = [
  { key: 'Draft',      label: 'Draft',      color: '#b45309', bg: '#fef9c3' },
  { key: 'Released',   label: 'Released',   color: '#065f46', bg: '#d1fae5' },
  { key: 'Rejected',   label: 'Rejected',   color: '#991b1b', bg: '#fee2e2' },
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
  const [checklistExpanded, setChecklistExpanded] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showConditional, setShowConditional] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [form, setForm] = useState({ password: '', meaning: '', reason: '', justification: '', conditionalJustification: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sample detail sheet
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)

  // Generate CoA state
  const [showGenerate,    setShowGenerate]    = useState(false)
  const [generateExecs,   setGenerateExecs]   = useState<ExecOption[]>([])
  const [generateExecId,  setGenerateExecId]  = useState<number | null>(null)
  const [generateSaving,  setGenerateSaving]  = useState(false)
  const [generateError,   setGenerateError]   = useState('')

  // Reissue CoA state
  const [showReissue,    setShowReissue]    = useState(false)
  const [reissueTarget,  setReissueTarget]  = useState<CoaItem | null>(null)
  const [reissueEsig,    setReissueEsig]    = useState({ password: '', meaning: 'I authorize the reissue of this CoA', reason: '' })
  const [reissueSaving,  setReissueSaving]  = useState(false)
  const [reissueError,   setReissueError]   = useState('')

  // ── Generate CoA ──────────────────────────────────────────────────────────
  async function openGenerate() {
    setShowGenerate(true); setGenerateExecId(null); setGenerateError('')
    try {
      const r = await api.get('/test-executions?status=Completed')
      const list: ExecOption[] = (Array.isArray(r.data) ? r.data : []).map((e: {
        executionId: number
        sampleId?: number; sampleNumber?: string; materialName?: string; lotNumber?: string
        sample?: { sampleId?: number; sampleNumber?: string; materialName?: string; lotNumber?: string }
      }) => ({
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
    } catch (err) {
      setGenerateError(getErrorMessage(err, 'CoA generation failed'))
    } finally { setGenerateSaving(false) }
  }

  // ── Reissue CoA ───────────────────────────────────────────────────────────
  async function submitReissue(ev: React.FormEvent) {
    ev.preventDefault()
    if (!reissueTarget) return
    if (!reissueEsig.password.trim()) { setReissueError('Password is required'); return }
    if (!reissueEsig.meaning.trim())  { setReissueError('Meaning is required'); return }
    if (!reissueEsig.reason.trim())   { setReissueError('Reason is required'); return }
    setReissueSaving(true); setReissueError('')
    try {
      const r = await api.post(`/coas/${reissueTarget.coaId}/reissue`,
        { password: reissueEsig.password, meaning: reissueEsig.meaning, reason: reissueEsig.reason })
      toast(`CoA reissued — new CoA #${r.data?.newCoaId ?? ''} created, original superseded`, 'success')
      setShowReissue(false); setReissueTarget(null); load()
    } catch (err) {
      setReissueError(getErrorMessage(err, 'Reissue failed'))
    } finally { setReissueSaving(false) }
  }

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/coas')
      setData(r.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.createdAt < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, statusFilter, dateFrom, dateTo])

  async function openDetail(coa: CoaItem) {
    setSelected(coa); setChecklistLoading(true); setError(''); setChecklistExpanded(false)
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
      setShowApprove(false); setSelected(null); await load()
      setStatusFilter('Released')
    } catch (err) {
      const msg = getErrorMessage(err, 'Approval failed')
      setError(msg); toast(msg, 'error')
    }
    finally { setSaving(false) }
  }

  async function submitConditional(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/coas/${selected!.coaId}/approve`, {
        password: form.password, meaning: form.meaning, reason: form.reason,
        isConditionalRelease: true, conditionalJustification: form.conditionalJustification
      })
      toast(`CoA ${selected!.coaNumber} conditionally released`, 'success')
      setShowConditional(false); setSelected(null); await load()
      setStatusFilter('Released')
    } catch (err) {
      const msg = getErrorMessage(err, 'Conditional release failed')
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
      setShowReject(false); setSelected(null); await load()
      setStatusFilter('Rejected')
    } catch (err) {
      const msg = getErrorMessage(err, 'Rejection failed')
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

    const allPass    = coa.lines.every(l => l.passFail === 'PASS')
    const conclusion = allPass ? 'CONFORMS TO SPECIFICATION' : 'DOES NOT CONFORM TO SPECIFICATION'
    const conclusionColor = allPass ? '#065f46' : '#991b1b'
    const conclusionBg    = allPass ? '#d1fae5' : '#fee2e2'
    const issuedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    const lineRows = coa.lines.map((l, i) => {
      const specText = l.specMin !== null && l.specMax !== null
        ? `${l.specMin} – ${l.specMax}`
        : l.specMin !== null ? `NLT ${l.specMin}`
        : l.specMax !== null ? `NMT ${l.specMax}`
        : '—'
      const passColor = l.passFail === 'PASS' ? '#065f46' : '#991b1b'
      const passBg    = l.passFail === 'PASS' ? '#d1fae5' : '#fee2e2'
      return `<tr>
        <td style="text-align:center;color:#6b7280">${i + 1}</td>
        <td>${l.parameterName}</td>
        <td style="font-family:monospace;font-size:11px">${l.methodCode}</td>
        <td>${specText}</td>
        <td style="font-family:monospace;font-weight:600">${l.calculatedResult ?? '—'}</td>
        <td><span style="background:${passBg};color:${passColor};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${l.passFail}</span></td>
        <td style="font-size:11px;color:#6b7280">${l.analystName}</td>
      </tr>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head>
    <title>CoA ${coa.coaNumber}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:28px 36px;color:#111827;font-size:13px;line-height:1.5}
      .header-bar{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d9488;padding-bottom:14px;margin-bottom:16px}
      .company{font-size:18px;font-weight:800;color:#0d9488;letter-spacing:.02em}
      .company-sub{font-size:11px;color:#6b7280;margin-top:2px}
      .doc-title{text-align:right}
      .doc-title h1{font-size:17px;font-weight:800;color:#0f172a}
      .doc-title .doc-meta{font-size:11px;color:#6b7280;margin-top:3px}
      .section{margin-bottom:14px}
      .section-head{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;background:#f8fafc;padding:4px 10px;border-left:3px solid #0d9488;margin-bottom:8px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:5px 32px;padding:0 4px}
      .grid2 .row{display:flex;gap:6px;font-size:12.5px}
      .grid2 .lbl{color:#6b7280;min-width:110px;flex-shrink:0}
      .grid2 .val{font-weight:600;color:#0f172a}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:2px}
      thead tr{background:#f1f5f9}
      th{padding:7px 10px;text-align:left;font-weight:700;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e2e8f0}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      tbody tr:nth-child(even){background:#fafafa}
      .conclusion{margin:14px 0;padding:12px 18px;border-radius:8px;border:2px solid ${conclusionColor};background:${conclusionBg};display:flex;align-items:center;gap:12px}
      .conclusion-text{font-size:14px;font-weight:800;color:${conclusionColor};letter-spacing:.02em}
      .sig-box{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px}
      .sig-line{border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;background:#fafafa}
      .sig-line .sig-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px}
      .sig-line .sig-name{font-size:13px;font-weight:700;color:#0f172a}
      .sig-line .sig-date{font-size:11px;color:#6b7280;margin-top:2px}
      .sig-line .sig-esig{font-size:10px;color:#0d9488;margin-top:4px}
      .footer{margin-top:20px;padding-top:10px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af}
      .status-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;background:${coa.status === 'Released' ? '#d1fae5' : '#fef9c3'};color:${coa.status === 'Released' ? '#065f46' : '#854d0e'}}
      @media print{body{padding:16px 20px}@page{margin:12mm}}
    </style>
    </head><body>

    <!-- ── Letterhead ── -->
    <div class="header-bar">
      <div>
        <div class="company">Pharma LIMS</div>
        <div class="company-sub">Quality Control Laboratory · GMP Certified</div>
        <div class="company-sub" style="margin-top:8px;font-size:12px;color:#374151">
          <strong>CERTIFICATE OF ANALYSIS</strong>
        </div>
      </div>
      <div class="doc-title">
        <div style="font-size:13px;font-weight:700;color:#0f172a">${coa.coaNumber}</div>
        <div class="doc-meta">Date of Issue: ${issuedDate}</div>
        <div class="doc-meta">Status: <span class="status-badge">${coa.status}</span></div>
      </div>
    </div>

    <!-- ── Product Information ── -->
    <div class="section">
      <div class="section-head">Product Information</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Product Name</span><span class="val">${coa.materialName}</span></div>
        <div class="row"><span class="lbl">Sample No.</span><span class="val">${coa.sampleNumber}</span></div>
        <div class="row"><span class="lbl">Batch / Lot No.</span><span class="val">${coa.lotNumber}</span></div>
        <div class="row"><span class="lbl">CoA Number</span><span class="val">${coa.coaNumber}</span></div>
      </div>
    </div>

    <!-- ── Customer / Dispatch ── -->
    <div class="section">
      <div class="section-head">Customer &amp; Dispatch</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Customer</span><span class="val">${coa.customerName ?? '—'}</span></div>
        <div class="row"><span class="lbl">DO Number</span><span class="val">${coa.doNumber ?? '—'}</span></div>
        <div class="row"><span class="lbl">Despatch Date</span><span class="val">${coa.despatchDate ?? '—'}</span></div>
        <div class="row"><span class="lbl">Date of Analysis</span><span class="val">${coa.lockedAt ? fmtDate(coa.lockedAt) : issuedDate}</span></div>
      </div>
    </div>

    <!-- ── Test Results ── -->
    <div class="section">
      <div class="section-head">Test Results</div>
      <table>
        <thead>
          <tr>
            <th style="width:30px">#</th>
            <th>Parameter</th>
            <th>Method Code</th>
            <th>Specification</th>
            <th>Result</th>
            <th>Pass / Fail</th>
            <th>Analyst</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
    </div>

    <!-- ── Conclusion ── -->
    <div class="conclusion">
      <span style="font-size:20px">${allPass ? '✓' : '✗'}</span>
      <div>
        <div class="conclusion-text">${conclusion}</div>
        <div style="font-size:11px;color:${conclusionColor};margin-top:2px">
          ${coa.lines.length} parameter${coa.lines.length !== 1 ? 's' : ''} tested ·
          ${coa.lines.filter(l => l.passFail === 'PASS').length} pass ·
          ${coa.lines.filter(l => l.passFail !== 'PASS').length} fail
        </div>
      </div>
    </div>

    <!-- ── Signatures ── -->
    <div class="section">
      <div class="section-head">Authorisation &amp; E-Signatures (21 CFR Part 11)</div>
      <div class="sig-box">
        <div class="sig-line">
          <div class="sig-title">QA Released By</div>
          <div class="sig-name">${coa.qaSignedBy ?? 'Pending'}</div>
          <div class="sig-date">${coa.qaSignedAt ? fmtDateTime(coa.qaSignedAt) : '—'}</div>
          <div class="sig-esig">⚡ Electronic signature — 21 CFR Part 11</div>
        </div>
        <div class="sig-line">
          <div class="sig-title">Document Status</div>
          <div class="sig-name">${coa.status}</div>
          <div class="sig-date">Issued: ${issuedDate}</div>
          <div class="sig-esig">CoA Ref: ${coa.coaNumber}</div>
        </div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="footer">
      <span>This document is an electronic record generated by Pharma LIMS · 21 CFR Part 11 compliant · Do not alter</span>
      <span>${coa.coaNumber} · Page 1 of 1</span>
    </div>

    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
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
        { header: 'Sample', accessor: r => (
          <button
            onClick={() => setDetailSampleId(r.sampleId)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, textDecoration: 'underline dotted' }}>
            {r.sampleNumber}
          </button>
        )},
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot', accessor: 'lotNumber' },
        { header: 'Customer / DO', accessor: r => r.customerName ? `${r.customerName} / ${r.doNumber ?? '—'}` : '—' },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'QA Signed By', accessor: r => r.qaSignedBy
          ? <span style={{ fontSize: 12 }}>{r.qaSignedBy}<br /><span style={{ color: '#6b7280' }}>{fmtDateTime(r.qaSignedAt!)}</span></span>
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
                  onClick={() => { setReissueTarget(r); setReissueEsig({ password: '', meaning: 'I authorize the reissue of this CoA', reason: '' }); setReissueError(''); setShowReissue(true) }}
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
        <Drawer title={`CoA Review — ${selected.coaNumber}`} subtitle="QA validation checklist and release decisions." width={720} onClose={() => setSelected(null)}>
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

          {/* 10-item Checklist — auto-verified items collapsed by default */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>QA Validation Checklist (21 CFR 211.192)</div>
            {checklistLoading && <div style={{ fontSize: 13, color: '#6b7280' }}>Evaluating checklist…</div>}
            {checklist && (() => {
              const failed = checklist.filter(c => !c.pass)
              const passed = checklist.filter(c => c.pass)
              return (
                <>
                  {/* Failed items always visible */}
                  {failed.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 16, color: '#dc2626' }}>✗</span>
                      <span style={{ color: '#dc2626' }}>{item.label}</span>
                    </div>
                  ))}
                  {/* Passed items collapsed */}
                  <button type="button" onClick={() => setChecklistExpanded(e => !e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 600, fontFamily: 'inherit', textAlign: 'left' }}>
                    <span>{checklistExpanded ? '▾' : '▸'}</span>
                    <span>✓ {passed.length}/{checklist.length} system checks passed</span>
                    <span style={{ marginLeft: 'auto', color: '#9ca3af', fontWeight: 400 }}>{checklistExpanded ? 'Hide' : 'Show all'}</span>
                  </button>
                  {checklistExpanded && passed.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 16, color: '#16a34a' }}>✓</span>
                      <span style={{ color: '#374151' }}>{item.label}</span>
                    </div>
                  ))}
                </>
              )
            })()}
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setShowReject(true); setForm(f => ({ ...f, meaning: 'I reject this CoA — see justification', reason: '', password: '', justification: '' })) }}
                style={{ padding: '7px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                Reject CoA
              </button>
              {!allChecklistPassed && (
                <button
                  onClick={() => { setShowConditional(true); setForm(f => ({ ...f, meaning: 'I conditionally release this batch pending resolution of open items.', reason: '', password: '', conditionalJustification: '' })) }}
                  style={{ padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                  Conditional Release
                </button>
              )}
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
                onClick={() => { setReissueTarget(selected); setReissueEsig({ password: '', meaning: 'I authorize the reissue of this CoA', reason: '' }); setReissueError(''); setSelected(null); setShowReissue(true) }}
                style={{ padding: '7px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                🔄 Reissue CoA
              </button>
            </div>
          )}
        </Drawer>
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
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(false)} label="Sign & Approve CoA" />
          </form>
        </Modal>
      )}

      {/* Conditional Release Modal */}
      {showConditional && selected && (
        <Modal title="Conditional Release — E-Signature" onClose={() => setShowConditional(false)}>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
            ⚠ Conditional release bypasses soft checklist items (spec version, evidence). Hard gates (signatures, OOS, completeness) are still enforced. Justification is mandatory and embedded in the locked PDF.
          </div>
          {checklist && (
            <div style={{ marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
              <strong>Items being overridden (soft gates):</strong>{' '}
              {checklist.filter(c => !c.pass && (
                c.label.startsWith('1.') || c.label.startsWith('7.') || c.label.startsWith('8.')
              )).map(c => c.label).join(', ') || '—'}
            </div>
          )}
          <form onSubmit={submitConditional}>
            <Field label="Justification (mandatory)">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.conditionalJustification} onChange={e => setForm(f => ({ ...f, conditionalJustification: e.target.value }))} required placeholder="e.g. Evidence to be submitted within 5 working days per SOP-QC-014…" />
            </Field>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={form.meaning} onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Batch required for urgent supply — evidence pending" /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowConditional(false)} label="Sign & Conditionally Release" />
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
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReject(false)} label="Sign & Reject CoA" />
          </form>
        </Modal>
      )}

      {/* ── Generate CoA Modal ────────────────────────────────────────────── */}
      {showGenerate && (
        <Drawer title="Generate Certificate of Analysis" subtitle="Creates a Draft CoA from a completed test execution." onClose={() => setShowGenerate(false)}>
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
            {generateError && <p style={{ color: '#dc2626', fontSize: 13, margin: '6px 0 0' }}>{generateError}</p>}
            <DrawerFooter saving={generateSaving} onCancel={() => setShowGenerate(false)} label="Generate CoA" />
          </form>
        </Drawer>
      )}

      {/* ── Sample Detail Sheet ──────────────────────────────────────────── */}
      {detailSampleId && (
        <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} context="release" />
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
                style={{ ...inp, height: 70, resize: 'vertical' as const }}
                value={reissueEsig.reason}
                onChange={e => setReissueEsig(p => ({ ...p, reason: e.target.value }))}
                required
                placeholder="e.g. Customer name correction / Updated spec version applied / Transcription error in lot number"
              />
            </Field>
            <Field label="Meaning *">
              <input style={inp} value={reissueEsig.meaning}
                onChange={e => setReissueEsig(p => ({ ...p, meaning: e.target.value }))} required />
            </Field>
            <Field label="Password (re-enter) *">
              <input style={inp} type="password" value={reissueEsig.password}
                onChange={e => setReissueEsig(p => ({ ...p, password: e.target.value }))} required
                placeholder="Re-enter your login password (21 CFR §11.50)" />
            </Field>
            {reissueError && <p style={{ color: '#dc2626', fontSize: 13, margin: '6px 0 0' }}>{reissueError}</p>}
            <ModalFooter saving={reissueSaving} onCancel={() => { setShowReissue(false); setReissueTarget(null) }} label="🔄 Reissue CoA" />
          </form>
        </Modal>
      )}
    </div>
  )
}
