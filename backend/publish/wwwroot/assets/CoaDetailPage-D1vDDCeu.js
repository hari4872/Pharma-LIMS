import{i as e}from"./rolldown-runtime-DWdDZTNf.js";import{n as t}from"./vendor-barcode-DCfq23xi.js";import{t as n}from"./vendor-react-D06tajg5.js";import{c as r,l as i}from"./vendor-router-47qnFaKB.js";import{t as a}from"./client-D6kcnD5G.js";import{n as o,o as s}from"./index-BWa_uNWF.js";import{n as c,t as l}from"./dateFormat-CEafDaMn.js";import{t as u}from"./formatLabel-oLrF4DH_.js";var d=e(t(),1),f=n();function p(){let{coaId:e}=i(),t=r(),[n,p]=(0,d.useState)(null),[m,h]=(0,d.useState)(null),[g,_]=(0,d.useState)(!0),[v,y]=(0,d.useState)(``),[b,x]=(0,d.useState)(!1);(0,d.useEffect)(()=>{e&&S(Number(e))},[e]);async function S(e){_(!0),y(``);try{p((await a.get(`/coas/${e}`)).data),a.get(`/coas/${e}/checklist`).then(e=>h(e.data)).catch(()=>{})}catch{y(`CoA not found or you do not have permission to view it.`)}finally{_(!1)}}async function C(){if(n)try{let e=await a.get(`/coas/${n.coaId}/pdf`,{responseType:`blob`}),t=URL.createObjectURL(new Blob([e.data],{type:`application/pdf`})),r=document.createElement(`a`);r.href=t,r.download=`CoA_${n.coaNumber}.pdf`,r.click(),URL.revokeObjectURL(t),o(`CoA ${n.coaNumber} PDF downloaded`,`success`)}catch(e){o(s(e,`PDF generation failed — please contact IT`),`error`)}}function w(){if(!n)return;let e=window.open(``,`_blank`,`width=900,height=700`);if(!e)return;let t=n.lines.filter(e=>e.passFail!==`N/A`),r=t.length>0&&t.every(e=>e.passFail===`PASS`),i=r?`CONFORMS TO SPECIFICATION`:`DOES NOT CONFORM TO SPECIFICATION`,a=r?`#065f46`:`#991b1b`,o=r?`#d1fae5`:`#fee2e2`,s=new Date().toLocaleDateString(`en-GB`,{day:`2-digit`,month:`short`,year:`numeric`}),d=n.lines.map((e,t)=>{let n=e.specMin!==null&&e.specMax!==null?`${e.specMin} – ${e.specMax}`:e.specMin===null?e.specMax===null?`—`:`NMT ${e.specMax}`:`NLT ${e.specMin}`,r=e.passFail===`N/A`,i=e.passFail===`PASS`?`#065f46`:r?`#6b7280`:`#991b1b`,a=e.passFail===`PASS`?`#d1fae5`:r?`#f1f5f9`:`#fee2e2`;return`<tr>
        <td style="text-align:center;color:#6b7280">${t+1}</td>
        <td>${e.parameterName}</td>
        <td style="font-family:monospace;font-size:11px">${e.methodCode}</td>
        <td>${n}</td>
        <td style="font-family:monospace;font-weight:600">${e.calculatedResult==null?`—`:u(e.calculatedResult)}</td>
        <td><span style="background:${a};color:${i};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${r?`—`:e.passFail}</span></td>
        <td style="font-size:11px;color:#6b7280">${e.analystName}</td>
      </tr>`}).join(``);e.document.write(`<!DOCTYPE html><html><head>
    <title>CoA ${n.coaNumber}</title>
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
      .conclusion{margin:14px 0;padding:12px 18px;border-radius:8px;border:2px solid ${a};background:${o};display:flex;align-items:center;gap:12px}
      .conclusion-text{font-size:14px;font-weight:800;color:${a};letter-spacing:.02em}
      .sig-box{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px}
      .sig-line{border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;background:#fafafa}
      .sig-line .sig-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px}
      .sig-line .sig-name{font-size:13px;font-weight:700;color:#0f172a}
      .sig-line .sig-date{font-size:11px;color:#6b7280;margin-top:2px}
      .sig-line .sig-esig{font-size:10px;color:#0d9488;margin-top:4px}
      .footer{margin-top:20px;padding-top:10px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af}
      .status-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;background:${n.status===`Released`?`#d1fae5`:`#fef9c3`};color:${n.status===`Released`?`#065f46`:`#854d0e`}}
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
        <div style="font-size:13px;font-weight:700;color:#0f172a">${n.coaNumber}</div>
        <div class="doc-meta">Date of Issue: ${s}</div>
        <div class="doc-meta">Status: <span class="status-badge">${n.status}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Product Information</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Product Name</span><span class="val">${n.materialName}</span></div>
        <div class="row"><span class="lbl">Sample No.</span><span class="val">${n.sampleNumber}</span></div>
        <div class="row"><span class="lbl">Batch / Lot No.</span><span class="val">${n.lotNumber}</span></div>
        <div class="row"><span class="lbl">CoA Number</span><span class="val">${n.coaNumber}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Customer &amp; Dispatch</div>
      <div class="grid2">
        <div class="row"><span class="lbl">Customer</span><span class="val">${n.customerName??`—`}</span></div>
        <div class="row"><span class="lbl">DO Number</span><span class="val">${n.doNumber??`—`}</span></div>
        <div class="row"><span class="lbl">Despatch Date</span><span class="val">${n.despatchDate??`—`}</span></div>
        <div class="row"><span class="lbl">Date of Analysis</span><span class="val">${n.lockedAt?l(n.lockedAt):s}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Test Results</div>
      <table>
        <thead><tr>
          <th style="width:30px">#</th><th>Parameter</th><th>Method Code</th>
          <th>Specification</th><th>Result</th><th>Pass / Fail</th><th>Analyst</th>
        </tr></thead>
        <tbody>${d}</tbody>
      </table>
    </div>
    <div class="conclusion">
      <span style="font-size:20px">${r?`✓`:`✗`}</span>
      <div>
        <div class="conclusion-text">${i}</div>
        <div style="font-size:11px;color:${a};margin-top:2px">
          ${n.lines.length} parameter${n.lines.length===1?``:`s`} tested ·
          ${n.lines.filter(e=>e.passFail===`PASS`).length} pass ·
          ${n.lines.filter(e=>e.passFail===`FAIL`).length} fail ·
          ${n.lines.filter(e=>e.passFail===`N/A`).length} informational
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Authorisation &amp; E-Signatures (21 CFR Part 11)</div>
      <div class="sig-box">
        <div class="sig-line">
          <div class="sig-title">QA Released By</div>
          <div class="sig-name">${n.qaSignedBy??`Pending`}</div>
          <div class="sig-date">${n.qaSignedAt?c(n.qaSignedAt):`—`}</div>
          <div class="sig-esig">⚡ Electronic signature — 21 CFR Part 11</div>
        </div>
        <div class="sig-line">
          <div class="sig-title">Document Status</div>
          <div class="sig-name">${n.status}</div>
          <div class="sig-date">Issued: ${s}</div>
          <div class="sig-esig">CoA Ref: ${n.coaNumber}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span>Electronic record — Pharma LIMS · 21 CFR Part 11 compliant · Do not alter</span>
      <span>${n.coaNumber} · Page 1 of 1</span>
    </div>
    </body></html>`),e.document.close(),e.focus(),setTimeout(()=>e.print(),500)}if(g)return(0,f.jsx)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`center`,height:`60vh`,fontSize:14,color:`#6b7280`},children:`Loading CoA…`});if(v||!n)return(0,f.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,alignItems:`center`,justifyContent:`center`,height:`60vh`,gap:12},children:[(0,f.jsx)(`div`,{style:{fontSize:14,color:`#dc2626`},children:v||`CoA not found.`}),(0,f.jsx)(`button`,{onClick:()=>t(`/release-dispatch`),style:{padding:`6px 16px`,borderRadius:7,border:`1px solid #e5e7eb`,background:`#fff`,cursor:`pointer`,fontSize:13},children:`← Back to Release & Dispatch`})]});let T={Draft:{bg:`#fef9c3`,color:`#854d0e`},Released:{bg:`#d1fae5`,color:`#065f46`},Rejected:{bg:`#fee2e2`,color:`#991b1b`},Superseded:{bg:`#f3f4f6`,color:`#6b7280`}}[n.status]??{bg:`#f3f4f6`,color:`#374151`};return(0,f.jsxs)(`div`,{style:{maxWidth:900,margin:`0 auto`,padding:`24px 24px 48px`},children:[(0,f.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:8,marginBottom:20},children:[(0,f.jsx)(`button`,{onClick:()=>t(`/release-dispatch`),style:{display:`flex`,alignItems:`center`,gap:4,padding:`5px 12px`,border:`1px solid #e5e7eb`,borderRadius:7,background:`#fff`,cursor:`pointer`,fontSize:12,color:`#374151`},children:`← Back`}),(0,f.jsx)(`span`,{style:{flex:1}}),n.status===`Released`&&(0,f.jsx)(`button`,{onClick:C,style:{display:`flex`,alignItems:`center`,gap:6,padding:`5px 14px`,border:`none`,borderRadius:7,background:`#065f46`,color:`#fff`,cursor:`pointer`,fontSize:12,fontWeight:700},children:`📄 Download CoA PDF`}),(0,f.jsxs)(`button`,{onClick:w,style:{display:`flex`,alignItems:`center`,gap:6,padding:`5px 12px`,border:`1px solid #e5e7eb`,borderRadius:7,background:`#fff`,cursor:`pointer`,fontSize:12,fontWeight:600,color:`#374151`},children:[(0,f.jsx)(`svg`,{viewBox:`0 0 24 24`,fill:`none`,width:`13`,height:`13`,children:(0,f.jsx)(`path`,{d:`M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z`,stroke:`currentColor`,strokeWidth:`1.8`,strokeLinecap:`round`,strokeLinejoin:`round`})}),`Print CoA`]})]}),(0,f.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`,borderBottom:`3px solid #0d9488`,paddingBottom:14,marginBottom:20},children:[(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`div`,{style:{fontSize:20,fontWeight:800,color:`#0d9488`},children:`Pharma LIMS`}),(0,f.jsx)(`div`,{style:{fontSize:11,color:`#6b7280`,marginTop:2},children:`Quality Control Laboratory · GMP Certified`}),(0,f.jsx)(`div`,{style:{fontSize:13,fontWeight:700,color:`#0f172a`,marginTop:8},children:`CERTIFICATE OF ANALYSIS`})]}),(0,f.jsxs)(`div`,{style:{textAlign:`right`},children:[(0,f.jsx)(`div`,{style:{fontSize:16,fontWeight:800,color:`#0f172a`},children:n.coaNumber}),(0,f.jsxs)(`div`,{style:{fontSize:11,color:`#6b7280`,marginTop:4},children:[`Created: `,l(n.createdAt)]}),(0,f.jsx)(`span`,{style:{display:`inline-block`,marginTop:6,padding:`2px 10px`,borderRadius:10,fontSize:11,fontWeight:700,background:T.bg,color:T.color},children:n.status})]})]}),(0,f.jsxs)(`div`,{style:{marginBottom:16},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:800,letterSpacing:`.08em`,textTransform:`uppercase`,color:`#6b7280`,background:`#f8fafc`,padding:`4px 10px`,borderLeft:`3px solid #0d9488`,marginBottom:10},children:`Product Information`}),(0,f.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`6px 32px`,padding:`0 4px`,fontSize:13},children:[[`Product Name`,n.materialName],[`Sample No.`,n.sampleNumber],[`Batch / Lot No.`,n.lotNumber],[`CoA Number`,n.coaNumber]].map(([e,t])=>(0,f.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,f.jsx)(`span`,{style:{color:`#6b7280`,minWidth:110,flexShrink:0},children:e}),(0,f.jsx)(`strong`,{style:{color:`#0f172a`},children:t})]},e))})]}),(0,f.jsxs)(`div`,{style:{marginBottom:16},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:800,letterSpacing:`.08em`,textTransform:`uppercase`,color:`#6b7280`,background:`#f8fafc`,padding:`4px 10px`,borderLeft:`3px solid #0d9488`,marginBottom:10},children:`Customer & Dispatch`}),(0,f.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`6px 32px`,padding:`0 4px`,fontSize:13},children:[[`Customer`,n.customerName??`—`],[`DO Number`,n.doNumber??`—`],[`Despatch Date`,n.despatchDate??`—`],[`Date of Analysis`,n.lockedAt?l(n.lockedAt):`—`]].map(([e,t])=>(0,f.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,f.jsx)(`span`,{style:{color:`#6b7280`,minWidth:110,flexShrink:0},children:e}),(0,f.jsx)(`strong`,{style:{color:`#0f172a`},children:t})]},e))})]}),m&&(0,f.jsxs)(`div`,{style:{marginBottom:16},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:800,letterSpacing:`.08em`,textTransform:`uppercase`,color:`#6b7280`,background:`#f8fafc`,padding:`4px 10px`,borderLeft:`3px solid #0d9488`,marginBottom:10},children:`QA Validation Checklist (21 CFR 211.192)`}),(()=>{let e=m.filter(e=>!e.pass),t=m.filter(e=>e.pass);return(0,f.jsxs)(f.Fragment,{children:[e.map(e=>(0,f.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:8,padding:`4px 0`,fontSize:13,borderBottom:`1px solid #f3f4f6`},children:[(0,f.jsx)(`span`,{style:{fontSize:16,color:`#dc2626`},children:`✗`}),(0,f.jsx)(`span`,{style:{color:`#dc2626`},children:e.label})]},e.label)),(0,f.jsxs)(`button`,{type:`button`,onClick:()=>x(e=>!e),style:{display:`flex`,alignItems:`center`,gap:6,width:`100%`,padding:`6px 0`,background:`none`,border:`none`,cursor:`pointer`,fontSize:12,color:`#16a34a`,fontWeight:600,fontFamily:`inherit`,textAlign:`left`},children:[(0,f.jsx)(`span`,{children:b?`▾`:`▸`}),(0,f.jsxs)(`span`,{children:[`✓ `,t.length,`/`,m.length,` system checks passed`]}),(0,f.jsx)(`span`,{style:{marginLeft:`auto`,color:`#9ca3af`,fontWeight:400},children:b?`Hide`:`Show all`})]}),b&&t.map(e=>(0,f.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:8,padding:`4px 0`,fontSize:13,borderBottom:`1px solid #f3f4f6`},children:[(0,f.jsx)(`span`,{style:{fontSize:16,color:`#16a34a`},children:`✓`}),(0,f.jsx)(`span`,{style:{color:`#374151`},children:e.label})]},e.label))]})})()]}),(0,f.jsxs)(`div`,{style:{marginBottom:16},children:[(0,f.jsxs)(`div`,{style:{fontSize:10,fontWeight:800,letterSpacing:`.08em`,textTransform:`uppercase`,color:`#6b7280`,background:`#f8fafc`,padding:`4px 10px`,borderLeft:`3px solid #0d9488`,marginBottom:10},children:[`Test Results (`,n.lines.length,` parameters)`]}),(0,f.jsx)(`div`,{style:{overflowX:`auto`},children:(0,f.jsxs)(`table`,{style:{width:`100%`,borderCollapse:`collapse`,fontSize:12},children:[(0,f.jsx)(`thead`,{children:(0,f.jsx)(`tr`,{style:{background:`#f9fafb`},children:[`Parameter`,`Method`,`Spec Min–Max`,`Result`,`Pass/Fail`,`Analyst`].map(e=>(0,f.jsx)(`th`,{style:{padding:`6px 8px`,textAlign:`left`,borderBottom:`1px solid #e5e7eb`,color:`#6b7280`,fontWeight:500,fontSize:11},children:e},e))})}),(0,f.jsx)(`tbody`,{children:n.lines.map(e=>{let t=e.specMin!==null&&e.specMax!==null?`${e.specMin} – ${e.specMax}`:e.specMin===null?e.specMax===null?`—`:`NMT ${e.specMax}`:`NLT ${e.specMin}`;return(0,f.jsxs)(`tr`,{children:[(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`},children:e.parameterName}),(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`,fontFamily:`monospace`,fontSize:11},children:e.methodCode}),(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`},children:t}),(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`,fontFamily:`monospace`},children:e.calculatedResult==null?`—`:u(e.calculatedResult)}),(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`},children:(0,f.jsx)(`span`,{style:{padding:`1px 6px`,borderRadius:8,fontSize:11,fontWeight:600,background:e.passFail===`PASS`?`#d1fae5`:e.passFail===`N/A`?`#f1f5f9`:`#fee2e2`,color:e.passFail===`PASS`?`#065f46`:e.passFail===`N/A`?`#6b7280`:`#991b1b`},children:e.passFail===`N/A`?`—`:e.passFail})}),(0,f.jsx)(`td`,{style:{padding:`5px 8px`,borderBottom:`1px solid #f3f4f6`},children:e.analystName})]},e.coaLineId)})})]})})]}),(()=>{let e=n.lines.filter(e=>e.passFail!==`N/A`),t=e.length>0&&e.every(e=>e.passFail===`PASS`);return(0,f.jsxs)(`div`,{style:{margin:`14px 0`,padding:`12px 18px`,borderRadius:8,border:`2px solid ${t?`#065f46`:`#991b1b`}`,background:t?`#d1fae5`:`#fee2e2`,display:`flex`,alignItems:`center`,gap:12},children:[(0,f.jsx)(`span`,{style:{fontSize:20},children:t?`✓`:`✗`}),(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`div`,{style:{fontSize:14,fontWeight:800,color:t?`#065f46`:`#991b1b`},children:t?`CONFORMS TO SPECIFICATION`:`DOES NOT CONFORM TO SPECIFICATION`}),(0,f.jsxs)(`div`,{style:{fontSize:11,color:t?`#065f46`:`#991b1b`,marginTop:2},children:[n.lines.length,` parameter`,n.lines.length===1?``:`s`,` tested ·`,` `,n.lines.filter(e=>e.passFail===`PASS`).length,` pass ·`,` `,n.lines.filter(e=>e.passFail===`FAIL`).length,` fail ·`,` `,n.lines.filter(e=>e.passFail===`N/A`).length,` informational`]})]})]})})(),(0,f.jsxs)(`div`,{style:{marginBottom:16},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:800,letterSpacing:`.08em`,textTransform:`uppercase`,color:`#6b7280`,background:`#f8fafc`,padding:`4px 10px`,borderLeft:`3px solid #0d9488`,marginBottom:10},children:`Authorisation & E-Signatures (21 CFR Part 11)`}),(0,f.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:12},children:[(0,f.jsxs)(`div`,{style:{border:`1px solid #e2e8f0`,borderRadius:6,padding:`10px 14px`,background:`#fafafa`},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:700,textTransform:`uppercase`,letterSpacing:`.06em`,color:`#6b7280`,marginBottom:6},children:`QA Released By`}),(0,f.jsx)(`div`,{style:{fontSize:13,fontWeight:700,color:`#0f172a`},children:n.qaSignedBy??`Pending`}),(0,f.jsx)(`div`,{style:{fontSize:11,color:`#6b7280`,marginTop:2},children:n.qaSignedAt?c(n.qaSignedAt):`—`}),(0,f.jsx)(`div`,{style:{fontSize:10,color:`#0d9488`,marginTop:4},children:`⚡ Electronic signature — 21 CFR Part 11`})]}),(0,f.jsxs)(`div`,{style:{border:`1px solid #e2e8f0`,borderRadius:6,padding:`10px 14px`,background:`#fafafa`},children:[(0,f.jsx)(`div`,{style:{fontSize:10,fontWeight:700,textTransform:`uppercase`,letterSpacing:`.06em`,color:`#6b7280`,marginBottom:6},children:`Document Status`}),(0,f.jsx)(`div`,{style:{fontSize:13,fontWeight:700,color:`#0f172a`},children:n.status}),(0,f.jsxs)(`div`,{style:{fontSize:11,color:`#6b7280`,marginTop:2},children:[`CoA Ref: `,n.coaNumber]})]})]})]}),(0,f.jsxs)(`div`,{style:{marginTop:24,paddingTop:10,borderTop:`2px solid #e2e8f0`,display:`flex`,justifyContent:`space-between`,fontSize:10,color:`#9ca3af`},children:[(0,f.jsx)(`span`,{children:`Electronic record — Pharma LIMS · 21 CFR Part 11 compliant · Do not alter`}),(0,f.jsxs)(`span`,{children:[n.coaNumber,` · Page 1 of 1`]})]})]})}export{p as default};