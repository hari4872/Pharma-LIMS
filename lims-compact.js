const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'WebSynergies (S) Pte Ltd';
pres.title = 'Pharma-LIMS — All Modules';

const C = {
  dark:'071E2B',teal:'028090',teal2:'005F6B',seafoam:'00A896',mint:'02C39A',
  white:'FFFFFF',lightBg:'F0FDFE',gray:'64748B',lightGray:'E2E8F0',
  analyst:'1D4ED8',qa:'7C3AED',labMgr:'D97706',admin:'DC2626',
  system:'475569',pass:'059669',gate:'D97706',esign:'7C3AED',
  red:'DC2626',
};
const FF = 'Calibri';
const mkSh = () => ({type:'outer',color:'000000',blur:6,offset:2,angle:135,opacity:0.09});
const ROLE_C = {Analyst:C.analyst,QA:C.qa,LabManager:C.labMgr,Admin:C.admin,System:C.system,Any:C.teal};

// ── Helpers ───────────────────────────────────────────────────────────────
function addHeader(sl, tag, title) {
  sl.background = {color:C.lightBg};
  sl.addShape(pres.shapes.RECTANGLE,{x:0.35,y:0.17,w:1.05,h:0.3,fill:{color:C.teal},line:{color:C.teal}});
  sl.addText(tag,{x:0.35,y:0.17,w:1.05,h:0.3,fontSize:8.5,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
  sl.addText(title,{x:1.52,y:0.17,w:8.1,h:0.3,fontSize:19,bold:true,color:C.dark,fontFace:FF,margin:0});
  sl.addShape(pres.shapes.LINE,{x:0.35,y:0.54,w:9.3,h:0,line:{color:C.lightGray,width:0.75}});
}

function sectionBar(sl, x, y, w, label, color) {
  color=color||C.teal;
  sl.addShape(pres.shapes.RECTANGLE,{x,y,w,h:0.27,fill:{color},line:{color}});
  sl.addText(label,{x,y,w,h:0.27,fontSize:9.5,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
}

function step(sl, x, y, w, h, num, title, role, flags) {
  flags=flags||{};
  const bc=flags.done?C.pass:flags.gate?C.gate:flags.esign?C.esign:C.teal;
  const bg=flags.done?'F0FDF4':flags.gate?'FFFBEB':flags.esign?'F5F3FF':'FFFFFF';
  const tc=flags.done?'14532D':flags.gate?'92400E':flags.esign?'4C1D95':'0F172A';
  sl.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:bg},line:{color:bc,width:1.3},shadow:mkSh()});
  sl.addShape(pres.shapes.OVAL,{x:x+0.07,y:y+0.06,w:0.22,h:0.22,fill:{color:bc},line:{color:bc}});
  sl.addText(String(num),{x:x+0.07,y:y+0.06,w:0.22,h:0.22,fontSize:6.5,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
  sl.addText(title,{x:x+0.04,y:y+0.04,w:w-0.08,h:h-0.28,fontSize:8,bold:true,color:tc,align:'center',valign:'middle',fontFace:FF,margin:0});
  if(role){
    const rc=ROLE_C[role]||C.teal;
    sl.addShape(pres.shapes.RECTANGLE,{x:x+w-0.72,y:y+h-0.19,w:0.67,h:0.15,fill:{color:rc},line:{color:rc}});
    sl.addText(role,{x:x+w-0.72,y:y+h-0.19,w:0.67,h:0.15,fontSize:5.5,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
  }
  if(flags.gate||flags.esign){
    const ft=(flags.gate?'🔒':'')+( flags.gate&&flags.esign?' ':'')+(flags.esign?'✍':'');
    sl.addText(ft,{x:x+0.04,y:y+h-0.19,w:w*0.4,h:0.15,fontSize:7,color:bc,fontFace:FF,margin:0});
  }
}

function arrow(sl, x1, ym, x2) {
  sl.addShape(pres.shapes.LINE,{x:x1,y:ym,w:x2-x1,h:0,line:{color:C.teal,width:1.1}});
  sl.addText('▶',{x:x2-0.1,y:ym-0.09,w:0.14,h:0.18,fontSize:7,color:C.teal,align:'center',valign:'middle',margin:0,fontFace:FF});
}

function moduleCard(sl, x, y, w, h, title, color, bullets) {
  sl.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:C.white},line:{color:C.lightGray,width:0.75},shadow:mkSh()});
  sl.addShape(pres.shapes.RECTANGLE,{x,y,w,h:0.3,fill:{color},line:{color}});
  sl.addText(title,{x,y,w,h:0.3,fontSize:10,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
  const items=bullets.map((b,i)=>({text:'• '+b,options:{breakLine:i<bullets.length-1,fontSize:8.5,color:C.gray}}));
  sl.addText(items,{x:x+0.1,y:y+0.34,w:w-0.2,h:h-0.4,fontFace:FF,margin:0});
}

// Calc xs for N horizontal steps within available width (startX to 9.65)
function calcXs(n, startX, endX) {
  const total = endX - startX;
  const gap = 0.28;
  const bw = (total - (n-1)*gap) / n;
  return Array.from({length:n}, (_,i) => ({x: startX + i*(bw+gap), w: bw}));
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  sl.background = {color:C.dark};
  sl.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:0.12,h:5.625,fill:{color:C.seafoam},line:{color:C.seafoam}});
  sl.addShape(pres.shapes.RECTANGLE,{x:7.5,y:0,w:2.5,h:1.6,fill:{color:C.teal2},line:{color:C.teal2}});
  sl.addText('WebSynergies (S) Pte Ltd',{x:0.45,y:0.3,w:6.5,h:0.28,fontSize:11,color:C.seafoam,fontFace:FF,margin:0,charSpacing:2});
  sl.addText('Pharma-LIMS',{x:0.45,y:0.75,w:8.5,h:0.95,fontSize:52,bold:true,color:C.white,fontFace:FF,margin:0});
  sl.addText('All Modules — Complete System Overview',{x:0.45,y:1.82,w:8,h:0.48,fontSize:22,color:C.seafoam,fontFace:FF,margin:0});

  const modules=['Request Flow','Checkpoints','Testing & OOS','Results Review','CoA Generation','Batch Release','Instruments','Reporting & Admin'];
  modules.forEach((m,i)=>{
    const px=0.45+i*1.15;
    sl.addText(m,{x:px,y:2.65,w:1.1,h:0.24,fontSize:7,color:'9ABFC5',fontFace:FF,margin:0,align:'center'});
    if(i<modules.length-1) sl.addText('›',{x:px+1.1,y:2.65,w:0.08,h:0.24,fontSize:8.5,color:C.seafoam,margin:0,fontFace:FF,align:'center',valign:'middle'});
  });
  sl.addShape(pres.shapes.LINE,{x:0.45,y:3.1,w:7.0,h:0,line:{color:C.teal,width:0.5}});

  const stats=[{v:'8',l:'System Modules'},{v:'6',l:'Workflow Phases'},{v:'8',l:'Gate Conditions'},{v:'21 CFR',l:'Part 11 Compliant'}];
  stats.forEach((s,i)=>{
    const sx=0.45+i*2.1;
    sl.addText(s.v,{x:sx,y:3.35,w:1.9,h:0.52,fontSize:28,bold:true,color:C.mint,fontFace:FF,margin:0});
    sl.addText(s.l,{x:sx,y:3.9,w:1.9,h:0.24,fontSize:8.5,color:'7AABB5',fontFace:FF,margin:0});
  });
  sl.addText('Confidential  |  For Internal Presentation Use Only  |  2026',{x:0.45,y:5.2,w:9,h:0.22,fontSize:8.5,color:'3A5F6A',fontFace:FF,margin:0});
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — All Modules Grid (8 modules, 2 cols × 4 rows)
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'MODULES','System Modules — At a Glance');

  const modules=[
    {title:'Request Flow Management',    color:C.teal,    desc:'Complete sample lifecycle from registration to dispatch with full gate enforcement and audit trail'},
    {title:'Testing Execution',          color:'0891B2',  desc:'Parameter entry, evidence upload, OOS/OOT auto-detection, monitoring forms, sign-off workflow'},
    {title:'Equipment Calibration',      color:C.labMgr,  desc:'Schedule calibration, calibration logs, RTS (Return to Service), breakdown & repair tracking'},
    {title:'Checkpoint Monitoring',      color:'059669',  desc:'Environmental/process parameter monitoring with process log, e-signature, and gate enforcement'},
    {title:'Reporting & Analytics',      color:'6D28D9',  desc:'Real-time dashboard KPIs, SPC control charts, TAT breach logs, compliance metrics, multi-site view'},
    {title:'Stability Studies',          color:'0E7490',  desc:'Protocol management, pull planning, stability pull tracking, trend analysis, short-pull deviations'},
    {title:'Administrative Control',     color:C.dark,    desc:'User & role management, permissions, audit logs, workflow configuration, lab setup & settings'},
    {title:'Traceability & Compliance',  color:C.qa,      desc:'Full chain of custody, OOS investigation lifecycle, 21 CFR Part 11 e-signatures, retain samples'},
  ];

  const cols=[0.35,5.1];
  const rowY=[0.65,1.71,2.77,3.83];
  const cw=4.6, ch=0.88;

  modules.forEach((m,i)=>{
    const cx=cols[i%2];
    const cy=rowY[Math.floor(i/2)];
    sl.addShape(pres.shapes.RECTANGLE,{x:cx,y:cy,w:cw,h:ch,fill:{color:C.white},line:{color:C.lightGray,width:0.75},shadow:mkSh()});
    sl.addShape(pres.shapes.RECTANGLE,{x:cx,y:cy,w:0.08,h:ch,fill:{color:m.color},line:{color:m.color}});
    sl.addText(m.title,{x:cx+0.18,y:cy+0.1,w:cw-0.28,h:0.3,fontSize:11,bold:true,color:C.dark,fontFace:FF,margin:0});
    sl.addText(m.desc,{x:cx+0.18,y:cy+0.42,w:cw-0.28,h:0.4,fontSize:8.5,color:C.gray,fontFace:FF,margin:0});
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — End-to-End Workflow (2 rows of 6)
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'WORKFLOW','End-to-End Workflow — All 12 Steps');

  const bw=1.27, bh=0.75, gap=0.22, sx=0.35;
  const xs=Array.from({length:6},(_,i)=>sx+i*(bw+gap));
  const r1y=0.7, r2y=2.62;
  const r1mid=r1y+bh/2, r2mid=r2y+bh/2;

  const row1=[
    {t:'Register\nSample',     role:'Analyst'},
    {t:'Sign SRF',             role:'Analyst', esign:true, gate:true},
    {t:'Assign\nSpec Template',role:'LabManager',gate:true},
    {t:'Checkpoint\nAssignment',role:'LabManager'},
    {t:'Start Test\nExecution', role:'Analyst'},
    {t:'Enter Results\n& Evidence',role:'Analyst'},
  ];
  const row2=[
    {t:'OOS/OOT\nAuto-Check',  role:'System'},
    {t:'Investigate\nOOS',     role:'QA', gate:true},
    {t:'Review &\nSign Logbook',role:'Analyst',esign:true,gate:true},
    {t:'Generate\nCoA',        role:'System'},
    {t:'QA Review\n& Release', role:'QA', esign:true, gate:true},
    {t:'Dispatch\nConfirm ✓',  role:'QA', done:true},
  ];

  row1.forEach((s,i)=>{
    step(sl,xs[i],r1y,bw,bh,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<5) arrow(sl,xs[i]+bw+0.02,r1mid,xs[i+1]-0.02);
  });
  row2.forEach((s,i)=>{
    step(sl,xs[i],r2y,bw,bh,i+7,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<5) arrow(sl,xs[i]+bw+0.02,r2mid,xs[i+1]-0.02);
  });

  // U-connector right side: row1 last → row2 first
  const rx=xs[5]+bw+0.08;
  sl.addShape(pres.shapes.LINE,{x:xs[5]+bw,y:r1mid,w:0.12,h:0,line:{color:C.teal,width:1.1}});
  sl.addShape(pres.shapes.LINE,{x:rx,y:r1mid,w:0,h:r2mid-r1mid,line:{color:C.teal,width:1.1}});
  sl.addShape(pres.shapes.LINE,{x:sx-0.12,y:r2mid,w:rx-sx+0.12,h:0,line:{color:C.teal,width:1.1}});
  sl.addText('▶',{x:sx-0.12,y:r2mid-0.09,w:0.14,h:0.18,fontSize:7,color:C.teal,align:'center',valign:'middle',margin:0,fontFace:FF});

  // Row labels
  sl.addText('Phase A–F: Registration → Testing',{x:0.35,y:r1y+bh+0.04,w:4,h:0.18,fontSize:7.5,color:C.teal,bold:true,fontFace:FF,margin:0});
  sl.addText('Phase G–L: OOS → Review → CoA → Release → Dispatch',{x:0.35,y:r2y+bh+0.04,w:6,h:0.18,fontSize:7.5,color:C.teal,bold:true,fontFace:FF,margin:0});

  // Legend
  const leg=[{c:C.teal,l:'Process Step'},{c:C.gate,l:'Gate Condition'},{c:C.esign,l:'E-Signature'},{c:C.pass,l:'Completion'}];
  leg.forEach((lx,i)=>{
    const lxp=0.35+i*2.15;
    sl.addShape(pres.shapes.RECTANGLE,{x:lxp,y:4.1,w:0.22,h:0.16,fill:{color:lx.c},line:{color:lx.c}});
    sl.addText(lx.l,{x:lxp+0.27,y:4.1,w:1.6,h:0.16,fontSize:8,color:C.gray,fontFace:FF,margin:0});
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Sample Registration + Checkpoint Monitoring
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'PHASE 1–2','Sample Registration + Checkpoint Monitoring');

  // — Sample Registration (top) —
  sectionBar(sl,0.35,0.62,9.3,'SAMPLE REGISTRATION',C.teal);
  const reg=calcXs(5,0.35,9.65);
  const regSteps=[
    {t:'Register\nSample',      role:'Analyst'},
    {t:'Print\nBarcode Label',  role:'Analyst'},
    {t:'Sign SRF',              role:'Analyst',esign:true,gate:true},
    {t:'Assign Spec\nTemplate', role:'LabManager',gate:true},
    {t:'Pending\nTesting ✓',   role:'System',done:true},
  ];
  const rh=0.78, ry=0.95, rm=ry+rh/2;
  regSteps.forEach((s,i)=>{
    step(sl,reg[i].x,ry,reg[i].w,rh,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<4) arrow(sl,reg[i].x+reg[i].w+0.02,rm,reg[i+1].x-0.02);
  });
  // detail notes
  const regNotes=['Lot No., MFG/EXP\ndates, material, lab','Unique barcode +\naudit print log','21 CFR §11.50\ne-sig mandatory','Auto-matched or\nmanual override','Tests auto-created\nfrom spec template'];
  regNotes.forEach((n,i)=>{
    sl.addText(n,{x:reg[i].x,y:ry+rh+0.06,w:reg[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  // — Checkpoint Monitoring (bottom) —
  sectionBar(sl,0.35,2.65,9.3,'CHECKPOINT MONITORING','059669');
  const chk=calcXs(5,0.35,9.65);
  const chkSteps=[
    {t:'Configure\nCheckpoints',    role:'LabManager'},
    {t:'Auto-Trigger\nLog Entry',   role:'System'},
    {t:'Record\nParameters',        role:'Analyst'},
    {t:'E-Sign Process\nLog Row',   role:'Analyst',esign:true,gate:true},
    {t:'All Rows\nSigned ✓',        role:'Analyst',done:true},
  ];
  const cy2=2.98, ch2=0.78, cm2=cy2+ch2/2;
  chkSteps.forEach((s,i)=>{
    step(sl,chk[i].x,cy2,chk[i].w,ch2,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<4) arrow(sl,chk[i].x+chk[i].w+0.02,cm2,chk[i+1].x-0.02);
  });
  const chkNotes=['Linked to sample type\ntime-based triggers','Log row created\nautomatically','Temperature, pH,\npressure, humidity','Gate: CheckpointsSigned\nbefore sign-off','Process log locked,\naudit trail complete'];
  chkNotes.forEach((n,i)=>{
    sl.addText(n,{x:chk[i].x,y:cy2+ch2+0.06,w:chk[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  // Gate note
  sl.addShape(pres.shapes.RECTANGLE,{x:0.35,y:4.55,w:9.3,h:0.34,fill:{color:'FFFBEB'},line:{color:C.gate,width:0.75}});
  sl.addText('🔒  Gates enforced: SRFSigned — SRF must be e-signed before spec assignment  |  SpecAssigned — spec must be assigned before testing begins  |  CheckpointsSigned — all log rows signed before sign-off',
    {x:0.5,y:4.57,w:9.1,h:0.3,fontSize:8,color:'92400E',fontFace:FF,margin:0});
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Testing Execution + OOS Investigation
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'PHASE 3–4','Testing Execution + OOS Investigation');

  // — Testing Execution (top) —
  sectionBar(sl,0.35,0.62,9.3,'TESTING EXECUTION','0891B2');
  const te=calcXs(5,0.35,9.65);
  const teSteps=[
    {t:'Pick from\nWork Queue',     role:'Analyst'},
    {t:'Start Test\nExecution',     role:'Analyst',gate:true},
    {t:'Enter Results\n& Evidence', role:'Analyst'},
    {t:'OOS/OOT\nAuto-Check',       role:'System'},
    {t:'Submit &\nSign Off',        role:'Analyst',esign:true,gate:true},
  ];
  const ty=0.95, th=0.78, tm=ty+th/2;
  teSteps.forEach((s,i)=>{
    step(sl,te[i].x,ty,te[i].w,th,i+1,s.t,s.role,{gate:s.gate,esign:s.esign});
    if(i<4) arrow(sl,te[i].x+te[i].w+0.02,tm,te[i+1].x-0.02);
  });
  const teNotes=['Priority scoring,\nbarcode scan assign','Gate: AllTestsComplete\ntimer starts','20+ parameters,\nevidence attachments','Flags vs spec limits,\nauto-opens investigation','Gates: LogbookSigned\nFormTemplateFilled'];
  teNotes.forEach((n,i)=>{
    sl.addText(n,{x:te[i].x,y:ty+th+0.06,w:te[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  // — OOS Investigation (bottom) —
  sectionBar(sl,0.35,2.65,9.3,'OOS / OOT INVESTIGATION',C.red);
  const oos=calcXs(5,0.35,9.65);
  const oosSteps=[
    {t:'OOS Flagged\n(Auto)',         role:'System'},
    {t:'Phase 1\nInvestigation',      role:'QA'},
    {t:'AI Root Cause\nSuggestions',  role:'QA'},
    {t:'CAPA\nReference',             role:'QA'},
    {t:'Close\nInvestigation ✓',      role:'QA',esign:true,done:true},
  ];
  const oy=2.98, oh=0.78, om=oy+oh/2;
  oosSteps.forEach((s,i)=>{
    step(sl,oos[i].x,oy,oos[i].w,oh,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<4) arrow(sl,oos[i].x+oos[i].w+0.02,om,oos[i+1].x-0.02);
  });
  const oosNotes=['Result outside spec\nlimits triggers flag','FDA OOS Guidance\nPhase 1 procedure','Groq AI auto-loads\nsuggestions on open','Corrective action\nreference recorded','E-sign locks investigation,\nGate: NoOpenOOS clears'];
  oosNotes.forEach((n,i)=>{
    sl.addText(n,{x:oos[i].x,y:oy+oh+0.06,w:oos[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  // Note
  sl.addShape(pres.shapes.RECTANGLE,{x:0.35,y:4.55,w:9.3,h:0.34,fill:{color:'F5F3FF'},line:{color:C.esign,width:0.75}});
  sl.addText('✍  Monitoring Form (if assigned) must be submitted before sign-off — AI suggestions auto-load when the form opens  |  🔒 Gate: NoOpenOOS must pass before logbook can be signed',
    {x:0.5,y:4.57,w:9.1,h:0.3,fontSize:8,color:'4C1D95',fontFace:FF,margin:0});
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Results Review + CoA Generation
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'PHASE 5–6','Results Review + CoA Generation');

  // — Results Review (top) —
  sectionBar(sl,0.35,0.62,9.3,'RESULTS REVIEW & DIGITAL LOGBOOK','6D28D9');
  const rr=calcXs(5,0.35,9.65);
  const rrSteps=[
    {t:'Analyst\nSubmits Results',  role:'Analyst'},
    {t:'QC Lead\nVerification',     role:'QA',esign:true},
    {t:'Sign Digital\nLogbook',     role:'Analyst',esign:true,gate:true},
    {t:'Results\nApproved ✓',       role:'QA',done:true},
    {t:'Trigger CoA\nGeneration',   role:'System',done:true},
  ];
  const rry=0.95, rrh=0.78, rrm=rry+rrh/2;
  rrSteps.forEach((s,i)=>{
    step(sl,rr[i].x,rry,rr[i].w,rrh,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<4) arrow(sl,rr[i].x+rr[i].w+0.02,rrm,rr[i+1].x-0.02);
  });
  const rrNotes=['Gate: NoOpenOOS\nAll params captured','Reviews accuracy &\ncalibration status','Gate: LogbookSigned\nProcess log complete','Status → ReviewComplete\naudit trail locked','Auto-triggers CoA\ngeneration in system'];
  rrNotes.forEach((n,i)=>{
    sl.addText(n,{x:rr[i].x,y:rry+rrh+0.06,w:rr[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  // — CoA Generation (bottom) —
  sectionBar(sl,0.35,2.65,9.3,'CoA GENERATION (CERTIFICATE OF ANALYSIS)','0E7490');
  const coa=calcXs(5,0.35,9.65);
  const coaSteps=[
    {t:'Auto-Generate\nCoA',         role:'System'},
    {t:'Review CoA\nLines & Results',role:'QA'},
    {t:'10-Item QA\nChecklist',      role:'QA',gate:true},
    {t:'Lock PDF &\nE-Sign',         role:'QA',esign:true},
    {t:'CoA Released ✓',             role:'QA',done:true},
  ];
  const cy=2.98, coh=0.78, cm=cy+coh/2;
  coaSteps.forEach((s,i)=>{
    step(sl,coa[i].x,cy,coa[i].w,coh,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<4) arrow(sl,coa[i].x+coa[i].w+0.02,cm,coa[i+1].x-0.02);
  });
  const coaNotes=['Pulls all passed test\nparameters + analyst names','CoA number assigned,\npending QA review','21 CFR 211.192\nchecklist auto-evaluated','PDF locked atomically\nserver-side on e-sig','Distributable, triggers\nbatch release workflow'];
  coaNotes.forEach((n,i)=>{
    sl.addText(n,{x:coa[i].x,y:cy+coh+0.06,w:coa[i].w,h:0.36,fontSize:7.5,color:C.gray,align:'center',fontFace:FF,margin:0});
  });

  sl.addShape(pres.shapes.RECTANGLE,{x:0.35,y:4.55,w:9.3,h:0.34,fill:{color:'F0FDF4'},line:{color:C.pass,width:0.75}});
  sl.addText('✓  10-item QA checklist: all tests complete, no open OOS, logbook signed, analyst e-sigs, spec version, evidence, instrument calibration valid, process log, QC verified  |  Gate: CoAApproved',
    {x:0.5,y:4.57,w:9.1,h:0.3,fontSize:8,color:'14532D',fontFace:FF,margin:0});
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Batch Release + Dispatch + Traceability (3 cols)
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'PHASE 7–9','Batch Release + Dispatch + Traceability');

  const cols=[{x:0.35,w:2.92,color:C.qa,label:'BATCH RELEASE'},{x:3.52,w:2.92,color:C.teal,label:'DISPATCH QC'},{x:6.69,w:2.92,color:'0E7490',label:'TRACEABILITY'}];
  cols.forEach(col=>{
    sectionBar(sl,col.x,0.62,col.w,col.label,col.color);
  });

  // Batch Release steps (vertical, 4 steps)
  const br=[
    {t:'Open CoA\nReview',      role:'QA'},
    {t:'QA Checklist\n+ Risk Score',role:'QA',gate:true},
    {t:'Make Decision\n(Approve/Reject)',role:'QA',esign:true},
    {t:'Batch Released ✓',      role:'LabManager',done:true},
  ];
  const bh2=0.72, by=0.97, bgap=0.12;
  br.forEach((s,i)=>{
    const sy=by+i*(bh2+bgap);
    step(sl,cols[0].x,sy,cols[0].w,bh2,i+1,s.t,s.role,{gate:s.gate,esign:s.esign,done:s.done});
    if(i<3){
      const mid=sy+bh2+bgap/2;
      sl.addShape(pres.shapes.LINE,{x:cols[0].x+cols[0].w/2,y:sy+bh2,w:0,h:bgap,line:{color:C.teal,width:1.0}});
      sl.addText('▼',{x:cols[0].x+cols[0].w/2-0.07,y:sy+bh2,w:0.14,h:bgap,fontSize:7,color:C.teal,align:'center',valign:'middle',margin:0,fontFace:FF});
    }
  });
  // Decision outcomes
  [{c:C.pass,l:'Approved'},{c:C.gate,l:'Conditional'},{c:C.red,l:'Rejected'}].forEach((d,i)=>{
    const dy=4.0+i*0.22;
    sl.addShape(pres.shapes.RECTANGLE,{x:cols[0].x,y:dy,w:0.85,h:0.18,fill:{color:d.c},line:{color:d.c}});
    sl.addText(d.l,{x:cols[0].x,y:dy,w:0.85,h:0.18,fontSize:6.5,bold:true,color:C.white,align:'center',valign:'middle',margin:0,fontFace:FF});
  });

  // Dispatch QC steps (vertical, 4 steps)
  const dq=[
    {t:'Create\nDispatch Task',  role:'LabManager'},
    {t:'Physical\nInspection',   role:'Analyst'},
    {t:'Confirm\nDispatch',      role:'QA',esign:true},
    {t:'Dispatched ✓',          role:'System',done:true},
  ];
  dq.forEach((s,i)=>{
    const sy=by+i*(bh2+bgap);
    step(sl,cols[1].x,sy,cols[1].w,bh2,i+1,s.t,s.role,{esign:s.esign,done:s.done});
    if(i<3){
      sl.addShape(pres.shapes.LINE,{x:cols[1].x+cols[1].w/2,y:sy+bh2,w:0,h:bgap,line:{color:C.teal,width:1.0}});
      sl.addText('▼',{x:cols[1].x+cols[1].w/2-0.07,y:sy+bh2,w:0.14,h:bgap,fontSize:7,color:C.teal,align:'center',valign:'middle',margin:0,fontFace:FF});
    }
  });

  // Traceability (bullet points)
  const traceItems=[
    'Sample → Test Execution → Results → OOS Investigation',
    'Results → CoA Lines → Certificate of Analysis → QA Approval',
    'CoA → Batch Release → Dispatch Task → Delivery Order',
    'Every action: User | Timestamp | E-Signature | IP | Role',
    'Retain Samples — physical samples kept for re-test',
    'Site Transfer — inter-lab sample handoff with COC',
    'Quality Events — deviation & complaint management',
    '21 CFR Part 11 — full electronic record compliance',
  ];
  sl.addShape(pres.shapes.RECTANGLE,{x:cols[2].x,y:0.97,w:cols[2].w,h:4.35,fill:{color:C.white},line:{color:C.lightGray,width:0.75},shadow:mkSh()});
  const tItems=traceItems.map((t,i)=>({text:'→  '+t,options:{breakLine:i<traceItems.length-1,fontSize:8.5,color:C.gray}}));
  sl.addText(tItems,{x:cols[2].x+0.1,y:1.05,w:cols[2].w-0.2,h:4.2,fontFace:FF,margin:0});
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Instruments + Stability + Reporting + Admin (2×2 cards)
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl,'SUPPORT','Instruments · Stability · Reporting · Administration');

  const cw=4.55, ch=2.12;
  moduleCard(sl,0.35,0.62,cw,ch,'Equipment & Instruments',C.labMgr,[
    'Instrument register with status tracking (Active/In Calibration/Breakdown)',
    'Calibration schedule & logs — due-date alerts, calibration records',
    'Return to Service (RTS) workflow with e-signature sign-off',
    'Breakdown & repair tracking — open/close breakdown with impact log',
    'Instrument–Test Method mapping for work queue auto-assignment',
    'Utilisation summary — uptime %, open breakdowns dashboard',
  ]);
  moduleCard(sl,5.1,0.62,cw,ch,'Stability Studies & Retention','0E7490',[
    'Stability protocol management — intervals, pull planning calendar',
    'Pull schedule generation from protocol definition',
    'Stability pull execution & result recording',
    'Short-pull deviation logging with justification',
    'Trend analysis charts — parameter stability over time',
    'Retain Samples — physical retain log per sample + location',
  ]);
  moduleCard(sl,0.35,2.88,cw,ch,'Reporting & Analytics','6D28D9',[
    'Real-time dashboard — TAT, OOS rate, pending tests, compliance %',
    'SPC control charts — UCL/LCL with OOS/OOT flagging (n ≥ 5)',
    'Multi-site dashboard — cross-lab KPI comparison',
    'Compliance panel — validation review logs, audit readiness',
    'Report Builder — custom report templates with export',
    'Quality Events — track deviations, complaints, CAPAs',
  ]);
  moduleCard(sl,5.1,2.88,cw,ch,'Administration & Configuration',C.dark,[
    'User management — create, edit, role assignment, lab assignment',
    'Role-based permissions — 4 roles: Admin, QA, LabManager, Analyst',
    'Workflow configuration — custom multi-step workflows per material',
    'Gate conditions — 8 enforced gates across the full workflow',
    'Master data — materials, sample types, test methods, spec limits',
    'Session & audit management — login logs, idle lock (21 CFR §11.10)',
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Closing
// ═══════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  sl.background = {color:C.dark};
  sl.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:0.12,h:5.625,fill:{color:C.seafoam},line:{color:C.seafoam}});
  sl.addShape(pres.shapes.RECTANGLE,{x:0,y:4.3,w:10,h:1.325,fill:{color:C.teal2},line:{color:C.teal2}});
  sl.addText('End-to-End.  Gate-Controlled.  21 CFR Part 11 Compliant.',{x:0.45,y:0.65,w:9,h:0.45,fontSize:15,color:C.seafoam,fontFace:FF,margin:0,italic:true});
  sl.addText('Pharma-LIMS',{x:0.45,y:1.22,w:9,h:0.85,fontSize:50,bold:true,color:C.white,fontFace:FF,margin:0});
  sl.addText('All Modules Covered',{x:0.45,y:2.12,w:9,h:0.38,fontSize:20,color:C.seafoam,fontFace:FF,margin:0});

  const stats=[{v:'8',l:'System\nModules'},{v:'12',l:'Workflow\nSteps'},{v:'8',l:'Gate\nConditions'},{v:'15+',l:'E-Signature\nPoints'},{v:'100%',l:'Audit\nLogged'}];
  stats.forEach((s,i)=>{
    const sx=0.45+i*1.87;
    sl.addShape(pres.shapes.RECTANGLE,{x:sx,y:2.65,w:1.65,h:1.45,fill:{color:C.teal},line:{color:C.teal},shadow:mkSh()});
    sl.addText(s.v,{x:sx,y:2.72,w:1.65,h:0.65,fontSize:30,bold:true,color:C.mint,align:'center',fontFace:FF,margin:0});
    sl.addText(s.l,{x:sx,y:3.42,w:1.65,h:0.5,fontSize:8,color:'A0C8CC',align:'center',fontFace:FF,margin:0});
  });

  sl.addText('WebSynergies (S) Pte Ltd  ·  Pharma-LIMS v1.0  ·  2026  ·  Confidential',{x:0.45,y:4.44,w:9.1,h:0.26,fontSize:9.5,color:C.seafoam,fontFace:FF,margin:0});
  sl.addText('Built with: React + TypeScript  |  .NET 8 C#  |  PostgreSQL  |  JWT Auth  |  AI-powered OOS & Risk Analysis',{x:0.45,y:4.78,w:9.1,h:0.22,fontSize:8.5,color:'4A7A85',fontFace:FF,margin:0});
}

// ── Generate ───────────────────────────────────────────────────────────────
pres.writeFile({fileName:'d:/Pharma-LIMS/Pharma-LIMS-Compact.pptx'})
  .then(()=>console.log('✅  Pharma-LIMS-Compact.pptx saved — 9 slides'))
  .catch(e=>{console.error('❌',e.message);process.exit(1);});
