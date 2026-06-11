import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { fmtDate, fmtDateTime } from '@/utils/dateFormat'
import { toast } from '@/components/Toast'

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

export default function CoaDetailPage() {
  const { coaId } = useParams<{ coaId: string }>()
  const navigate = useNavigate()

  const [coa,              setCoa]              = useState<CoaItem | null>(null)
  const [checklist,        setChecklist]        = useState<ChecklistItem[] | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [checklistExpanded, setChecklistExpanded] = useState(false)

  useEffect(() => {
    if (!coaId) return
    load(Number(coaId))
  }, [coaId])

  async function load(id: number) {
    setLoading(true); setError('')
    try {
      const r = await api.get(`/coas/${id}`)
      setCoa(r.data)
      // Load checklist silently — non-blocking
      api.get(`/coas/${id}/checklist`)
        .then(cr => setChecklist(cr.data))
        .catch(() => {/* checklist optional */})
    } catch {
      setError('CoA not found or you do not have permission to view it.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf() {
    if (!coa) return
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

  function handlePrint() {
    if (!coa) return
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
    <div class="header-bar">
      <div>
        <div class="company">Pharma LIMS</div>
        <div class="company-sub">Quality Control Laboratory · GMP Certified</div>
        <div class="company-sub" style="margin-top:8px;font-size:12px;color:#374151"><strong>CERTIFICATE OF ANALYSIS</strong></div>
      </div>
      <div class="doc-title">
        <div style="font-size:13px;font-weight:700;color:#0f172a">${coa.coaNumber}</div>
        <div class="doc-meta">Date of Issue: ${issuedDate}</div>
        <div class="doc-meta">Status: <span class="status-badge">${coa.status}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Product Information</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Product Name</span><span class="val">${coa.materialName}</span></div>
        <div class="row"><span class="lbl">Sample No.</span><span class="val">${coa.sampleNumber}</span></div>
        <div class="row"><span class="lbl">Batch / Lot No.</span><span class="val">${coa.lotNumber}</span></div>
        <div class="row"><span class="lbl">CoA Number</span><span class="val">${coa.coaNumber}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Customer &amp; Dispatch</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Customer</span><span class="val">${coa.customerName ?? '—'}</span></div>
        <div class="row"><span class="lbl">DO Number</span><span class="val">${coa.doNumber ?? '—'}</span></div>
        <div class="row"><span class="lbl">Despatch Date</span><span class="val">${coa.despatchDate ?? '—'}</span></div>
        <div class="row"><span class="lbl">Date of Analysis</span><span class="val">${coa.lockedAt ? fmtDate(coa.lockedAt) : issuedDate}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Test Results</div>
      <table>
        <thead><tr>
          <th style="width:30px">#</th><th>Parameter</th><th>Method Code</th>
          <th>Specification</th><th>Result</th><th>Pass / Fail</th><th>Analyst</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </div>
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
    <div class="footer">
      <span>Electronic record — Pharma LIMS · 21 CFR Part 11 compliant · Do not alter</span>
      <span>${coa.coaNumber} · Page 1 of 1</span>
    </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontSize: 14, color: '#6b7280' }}>
      Loading CoA…
    </div>
  )

  if (error || !coa) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <div style={{ fontSize: 14, color: '#dc2626' }}>{error || 'CoA not found.'}</div>
      <button onClick={() => navigate('/release-dispatch')} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        ← Back to Release &amp; Dispatch
      </button>
    </div>
  )

  const statusColors: Record<string, { bg: string; color: string }> = {
    Draft:      { bg: '#fef9c3', color: '#854d0e' },
    Released:   { bg: '#d1fae5', color: '#065f46' },
    Rejected:   { bg: '#fee2e2', color: '#991b1b' },
    Superseded: { bg: '#f3f4f6', color: '#6b7280' },
  }
  const sc = statusColors[coa.status] ?? { bg: '#f3f4f6', color: '#374151' }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={() => navigate('/release-dispatch')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' }}>
          ← Back
        </button>
        <span style={{ flex: 1 }} />
        {coa.status === 'Released' && (
          <button onClick={downloadPdf}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', border: 'none', borderRadius: 7, background: '#065f46', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            📄 Download CoA PDF
          </button>
        )}
        <button onClick={handlePrint}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Print CoA
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0d9488', paddingBottom: 14, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0d9488' }}>Pharma LIMS</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Quality Control Laboratory · GMP Certified</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 8 }}>CERTIFICATE OF ANALYSIS</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{coa.coaNumber}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Created: {fmtDate(coa.createdAt)}
          </div>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
            {coa.status}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', background: '#f8fafc', padding: '4px 10px', borderLeft: '3px solid #0d9488', marginBottom: 10 }}>Product Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', padding: '0 4px', fontSize: 13 }}>
          {[
            ['Product Name', coa.materialName],
            ['Sample No.', coa.sampleNumber],
            ['Batch / Lot No.', coa.lotNumber],
            ['CoA Number', coa.coaNumber],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#6b7280', minWidth: 110, flexShrink: 0 }}>{label}</span>
              <strong style={{ color: '#0f172a' }}>{val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Customer & Dispatch */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', background: '#f8fafc', padding: '4px 10px', borderLeft: '3px solid #0d9488', marginBottom: 10 }}>Customer &amp; Dispatch</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', padding: '0 4px', fontSize: 13 }}>
          {[
            ['Customer', coa.customerName ?? '—'],
            ['DO Number', coa.doNumber ?? '—'],
            ['Despatch Date', coa.despatchDate ?? '—'],
            ['Date of Analysis', coa.lockedAt ? fmtDate(coa.lockedAt) : '—'],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#6b7280', minWidth: 110, flexShrink: 0 }}>{label}</span>
              <strong style={{ color: '#0f172a' }}>{val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist (if loaded) */}
      {checklist && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', background: '#f8fafc', padding: '4px 10px', borderLeft: '3px solid #0d9488', marginBottom: 10 }}>QA Validation Checklist (21 CFR 211.192)</div>
          {(() => {
            const failed = checklist.filter(c => !c.pass)
            const passed = checklist.filter(c => c.pass)
            return (
              <>
                {failed.map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 16, color: '#dc2626' }}>✗</span>
                    <span style={{ color: '#dc2626' }}>{item.label}</span>
                  </div>
                ))}
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
      )}

      {/* Test Results */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', background: '#f8fafc', padding: '4px 10px', borderLeft: '3px solid #0d9488', marginBottom: 10 }}>Test Results ({coa.lines.length} parameters)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Parameter', 'Method', 'Spec Min–Max', 'Result', 'Pass/Fail', 'Analyst'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coa.lines.map(line => {
                const specText = line.specMin !== null && line.specMax !== null
                  ? `${line.specMin} – ${line.specMax}`
                  : line.specMin !== null ? `NLT ${line.specMin}`
                  : line.specMax !== null ? `NMT ${line.specMax}`
                  : '—'
                return (
                  <tr key={line.coaLineId}>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{line.parameterName}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 11 }}>{line.methodCode}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{specText}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{line.calculatedResult ?? '—'}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: line.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
                        color: line.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{line.passFail}</span>
                    </td>
                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #f3f4f6' }}>{line.analystName}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conclusion */}
      {(() => {
        const allPass = coa.lines.every(l => l.passFail === 'PASS')
        return (
          <div style={{ margin: '14px 0', padding: '12px 18px', borderRadius: 8,
            border: `2px solid ${allPass ? '#065f46' : '#991b1b'}`,
            background: allPass ? '#d1fae5' : '#fee2e2',
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>{allPass ? '✓' : '✗'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: allPass ? '#065f46' : '#991b1b' }}>
                {allPass ? 'CONFORMS TO SPECIFICATION' : 'DOES NOT CONFORM TO SPECIFICATION'}
              </div>
              <div style={{ fontSize: 11, color: allPass ? '#065f46' : '#991b1b', marginTop: 2 }}>
                {coa.lines.length} parameter{coa.lines.length !== 1 ? 's' : ''} tested ·{' '}
                {coa.lines.filter(l => l.passFail === 'PASS').length} pass ·{' '}
                {coa.lines.filter(l => l.passFail !== 'PASS').length} fail
              </div>
            </div>
          </div>
        )
      })()}

      {/* Signatures */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', background: '#f8fafc', padding: '4px 10px', borderLeft: '3px solid #0d9488', marginBottom: 10 }}>Authorisation &amp; E-Signatures (21 CFR Part 11)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#fafafa' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6b7280', marginBottom: 6 }}>QA Released By</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{coa.qaSignedBy ?? 'Pending'}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{coa.qaSignedAt ? fmtDateTime(coa.qaSignedAt) : '—'}</div>
            <div style={{ fontSize: 10, color: '#0d9488', marginTop: 4 }}>⚡ Electronic signature — 21 CFR Part 11</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#fafafa' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6b7280', marginBottom: 6 }}>Document Status</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{coa.status}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>CoA Ref: {coa.coaNumber}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 10, borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
        <span>Electronic record — Pharma LIMS · 21 CFR Part 11 compliant · Do not alter</span>
        <span>{coa.coaNumber} · Page 1 of 1</span>
      </div>
    </div>
  )
}
