// Pharma-LIMS End-to-End Workflow Presentation
const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'WebSynergies (S) Pte Ltd';
pres.title = 'Pharma-LIMS End-to-End Workflow';

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  dark:      '071E2B',
  darkTeal:  '0A3040',
  teal:      '028090',
  teal2:     '005F6B',
  seafoam:   '00A896',
  mint:      '02C39A',
  white:     'FFFFFF',
  lightBg:   'F0FDFE',
  subtleBg:  'E6F7F8',
  gray:      '64748B',
  lightGray: 'E2E8F0',
  analyst:   '1D4ED8',
  qa:        '7C3AED',
  labMgr:    'D97706',
  admin:     'DC2626',
  system:    '475569',
  gate:      'D97706',
  esign:     '7C3AED',
  pass:      '059669',
};
const FF = 'Calibri';
const mkSh = () => ({ type: 'outer', color: '000000', blur: 7, offset: 2, angle: 135, opacity: 0.10 });
const ROLE_C = { Analyst: C.analyst, QA: C.qa, LabManager: C.labMgr, Admin: C.admin, System: C.system, Any: C.teal };

// ── Helpers ────────────────────────────────────────────────────────────────
function addHeader(sl, phase, title) {
  sl.background = { color: C.lightBg };
  sl.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 0.2, w: 1.1, h: 0.34, fill: { color: C.teal }, line: { color: C.teal } });
  sl.addText(phase, { x: 0.35, y: 0.2, w: 1.1, h: 0.34, fontSize: 9.5, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
  sl.addText(title, { x: 1.57, y: 0.2, w: 8.1, h: 0.35, fontSize: 21, bold: true, color: C.dark, fontFace: FF, margin: 0 });
  sl.addShape(pres.shapes.LINE, { x: 0.35, y: 0.63, w: 9.3, h: 0, line: { color: C.lightGray, width: 0.8 } });
}

function drawStep(sl, x, y, w, h, num, title, role, flags) {
  flags = flags || {};
  const bgColor  = flags.done  ? 'F0FDF4' : flags.gate  ? 'FFFBEB' : flags.esign ? 'F5F3FF' : 'FFFFFF';
  const bdColor  = flags.done  ? C.pass   : flags.gate  ? C.gate   : flags.esign ? C.esign  : C.teal;
  const txtColor = flags.done  ? '14532D' : flags.gate  ? '92400E' : flags.esign ? '4C1D95' : '0F172A';
  sl.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: bgColor }, line: { color: bdColor, width: 1.5 }, shadow: mkSh() });
  // Step number badge
  sl.addShape(pres.shapes.OVAL, { x: x+0.08, y: y+0.08, w: 0.27, h: 0.27, fill: { color: bdColor }, line: { color: bdColor } });
  sl.addText(String(num), { x: x+0.08, y: y+0.08, w: 0.27, h: 0.27, fontSize: 7.5, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
  // Title
  sl.addText(title, { x: x+0.05, y: y+0.05, w: w-0.1, h: h-0.3, fontSize: 9, bold: true, color: txtColor, align: 'center', valign: 'middle', fontFace: FF, margin: 0 });
  // Flag text
  if (flags.gate || flags.esign) {
    const ft = (flags.gate ? '🔒 Gate' : '') + (flags.gate && flags.esign ? '  ' : '') + (flags.esign ? '✍ E-Sign' : '');
    sl.addText(ft, { x: x+0.05, y: y+h-0.22, w: w*0.52, h: 0.18, fontSize: 6.5, color: bdColor, fontFace: FF, margin: 0 });
  }
  // Role badge
  if (role) {
    const rc = ROLE_C[role] || C.teal;
    sl.addShape(pres.shapes.RECTANGLE, { x: x+w-0.78, y: y+h-0.22, w: 0.73, h: 0.17, fill: { color: rc }, line: { color: rc } });
    sl.addText(role, { x: x+w-0.78, y: y+h-0.22, w: 0.73, h: 0.17, fontSize: 6, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
  }
}

function drawArrow(sl, x1, ymid, x2) {
  sl.addShape(pres.shapes.LINE, { x: x1, y: ymid, w: x2-x1, h: 0, line: { color: C.teal, width: 1.5 } });
  sl.addText('▶', { x: x2-0.14, y: ymid-0.12, w: 0.2, h: 0.24, fontSize: 10, color: C.teal, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
}

function drawDownArrow(sl, x, y1, y2) {
  sl.addShape(pres.shapes.LINE, { x, y: y1, w: 0, h: y2-y1, line: { color: C.teal, width: 1.5 } });
  sl.addText('▼', { x: x-0.1, y: y2-0.15, w: 0.2, h: 0.2, fontSize: 9, color: C.teal, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
}

function addLegend(sl, y) {
  const items = [
    { color: C.teal,  label: 'Process Step' },
    { color: C.gate,  label: 'Gate Condition' },
    { color: C.esign, label: 'E-Signature Required' },
    { color: C.pass,  label: 'Completion / Output' },
  ];
  let lx = 0.35;
  items.forEach(item => {
    sl.addShape(pres.shapes.RECTANGLE, { x: lx, y, w: 0.25, h: 0.18, fill: { color: item.color }, line: { color: item.color } });
    sl.addText(item.label, { x: lx+0.3, y, w: 1.3, h: 0.18, fontSize: 8, color: C.gray, fontFace: FF, margin: 0 });
    lx += 1.7;
  });
  const roles = [
    { color: C.analyst, label: 'Analyst' },
    { color: C.qa,      label: 'QA' },
    { color: C.labMgr,  label: 'LabManager' },
    { color: C.system,  label: 'System' },
  ];
  lx = 0.35;
  roles.forEach(r => {
    sl.addShape(pres.shapes.RECTANGLE, { x: lx, y: y+0.25, w: 0.25, h: 0.18, fill: { color: r.color }, line: { color: r.color } });
    sl.addText(r.label, { x: lx+0.3, y: y+0.25, w: 1.3, h: 0.18, fontSize: 8, color: C.gray, fontFace: FF, margin: 0 });
    lx += 1.7;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  sl.background = { color: C.dark };

  // Left accent
  sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.14, h: 5.625, fill: { color: C.seafoam }, line: { color: C.seafoam } });

  // Decorative teal block top-right
  sl.addShape(pres.shapes.RECTANGLE, { x: 7.5, y: 0, w: 2.5, h: 1.4, fill: { color: C.teal2 }, line: { color: C.teal2 } });
  sl.addShape(pres.shapes.RECTANGLE, { x: 8.2, y: 0, w: 1.8, h: 2.2, fill: { color: C.teal, transparency: 40 }, line: { color: C.teal } });

  // Company
  sl.addText('WebSynergies (S) Pte Ltd', {
    x: 0.45, y: 0.35, w: 6.5, h: 0.3,
    fontSize: 11, color: C.seafoam, fontFace: FF, margin: 0, charSpacing: 2
  });

  // Main title
  sl.addText('Pharma-LIMS', {
    x: 0.45, y: 0.85, w: 8.5, h: 1.0,
    fontSize: 52, bold: true, color: C.white, fontFace: FF, margin: 0
  });

  // Subtitle
  sl.addText('End-to-End Workflow Guide', {
    x: 0.45, y: 1.95, w: 7.5, h: 0.55,
    fontSize: 26, color: C.seafoam, fontFace: FF, margin: 0
  });

  // Phase breadcrumb
  const phases = ['Sample Registration', 'Testing', 'Results Review', 'CoA Generation', 'QA Release', 'Dispatch'];
  let px = 0.45;
  phases.forEach((p, i) => {
    sl.addText(p, { x: px, y: 2.85, w: 1.52, h: 0.28, fontSize: 8.5, color: 'A0C8CC', fontFace: FF, margin: 0 });
    if (i < phases.length - 1) {
      sl.addText('→', { x: px+1.52, y: 2.85, w: 0.2, h: 0.28, fontSize: 8.5, color: C.seafoam, align: 'center', margin: 0, fontFace: FF });
      px += 1.72;
    }
  });

  // Divider
  sl.addShape(pres.shapes.LINE, { x: 0.45, y: 3.3, w: 7.0, h: 0, line: { color: C.teal, width: 0.5 } });

  // Key stats
  const stats = [
    { val: '6', label: 'Workflow Phases' },
    { val: '8', label: 'Gate Conditions' },
    { val: '4', label: 'User Roles' },
    { val: '21 CFR', label: 'Part 11 Compliant' },
  ];
  stats.forEach((s, i) => {
    const sx = 0.45 + i * 2.15;
    sl.addText(s.val, { x: sx, y: 3.6, w: 1.9, h: 0.55, fontSize: 28, bold: true, color: C.mint, fontFace: FF, margin: 0, align: 'left' });
    sl.addText(s.label, { x: sx, y: 4.2, w: 1.9, h: 0.28, fontSize: 9, color: '7AABB5', fontFace: FF, margin: 0 });
  });

  // Footer
  sl.addText('Confidential  |  For Internal Presentation Use Only  |  2026', {
    x: 0.45, y: 5.18, w: 9, h: 0.25,
    fontSize: 8.5, color: '3A5F6A', fontFace: FF, margin: 0
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — System Overview
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  sl.background = { color: C.lightBg };

  sl.addText('SYSTEM OVERVIEW', { x: 0.35, y: 0.2, w: 9.3, h: 0.38, fontSize: 22, bold: true, color: C.dark, fontFace: FF, margin: 0 });
  sl.addShape(pres.shapes.LINE, { x: 0.35, y: 0.65, w: 9.3, h: 0, line: { color: C.lightGray, width: 0.8 } });

  const phases = [
    { num: '01', name: 'Sample Registration', desc: 'Receive, barcode, SRF e-sign, spec & checkpoint assignment', color: C.teal },
    { num: '02', name: 'Testing Execution',   desc: 'Work queue, parameter entry, OOS/OOT auto-detection, logbook', color: C.seafoam },
    { num: '03', name: 'Results Review',       desc: 'QC verification, digital logbook sign-off, analyst approval', color: '0891B2' },
    { num: '04', name: 'CoA Generation',       desc: 'Auto-generate Certificate of Analysis, lock PDF with e-sign', color: '0E7490' },
    { num: '05', name: 'QA Review & Release',  desc: 'Checklist, risk score, e-sign decision, batch release', color: '6D28D9' },
    { num: '06', name: 'Dispatch QC',          desc: 'Final physical inspection, dispatch confirmation, traceability', color: '059669' },
  ];

  // 2 rows × 3 cols
  const cols = [0.35, 3.52, 6.69];
  const rows = [0.82, 2.9];
  const cw = 2.9, ch = 1.78;

  phases.forEach((p, i) => {
    const cx = cols[i % 3];
    const cy = rows[Math.floor(i / 3)];
    sl.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: ch, fill: { color: 'FFFFFF' }, line: { color: C.lightGray, width: 0.75 }, shadow: mkSh() });
    // Top color bar
    sl.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: 0.32, fill: { color: p.color }, line: { color: p.color } });
    // Phase number
    sl.addText(p.num, { x: cx+0.1, y: cy+0.04, w: 0.45, h: 0.24, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FF, margin: 0 });
    // Phase name
    sl.addText(p.name, { x: cx+0.12, y: cy+0.38, w: cw-0.2, h: 0.38, fontSize: 13, bold: true, color: C.dark, fontFace: FF, margin: 0 });
    // Description
    sl.addText(p.desc, { x: cx+0.12, y: cy+0.78, w: cw-0.22, h: 0.9, fontSize: 9.5, color: C.gray, fontFace: FF, margin: 0 });
  });

  // Arrow connectors between cards
  const arrowY = 0.82 + ch / 2;
  drawArrow(sl, cols[0]+cw+0.02, arrowY, cols[1]-0.02);
  drawArrow(sl, cols[1]+cw+0.02, arrowY, cols[2]-0.02);
  const arrowY2 = rows[1] + ch / 2;
  drawArrow(sl, cols[0]+cw+0.02, arrowY2, cols[1]-0.02);
  drawArrow(sl, cols[1]+cw+0.02, arrowY2, cols[2]-0.02);
  // Down arrow col2 row1 → row2
  drawDownArrow(sl, cols[2]+cw/2, rows[0]+ch+0.04, rows[1]-0.04);
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Phase 1: Sample Registration
// bw=1.3, gap=0.285, start=0.38 → 6 steps
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 1', 'Sample Registration');

  const bw=1.3, bh=1.15, gap=0.285, startX=0.38, rowY=1.05;
  const xs = Array.from({length:6}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Receive\nSample', role: 'Analyst' },
    { title: 'Print\nBarcode Label', role: 'Analyst' },
    { title: 'Sign SRF', role: 'Analyst', esign: true, gate: true },
    { title: 'Assign Spec\nTemplate', role: 'LabManager', gate: true },
    { title: 'Assign\nCheckpoints', role: 'LabManager' },
    { title: 'Pending\nTesting ✓', role: 'System', done: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign, done: s.done });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  // Notes row
  const notes = [
    { x: xs[0], t: 'Lot No., MFG/EXP\ndates, lab, sample type' },
    { x: xs[1], t: 'Auto-generated\nbarcode + audit log' },
    { x: xs[2], t: 'FDA 21 CFR §11.50\ne-signature required' },
    { x: xs[3], t: 'Auto-matched or\nmanual override' },
    { x: xs[4], t: 'Linked to sample type\nfor monitoring' },
    { x: xs[5], t: 'Ready for test\nassignment' },
  ];
  notes.forEach(n => {
    sl.addText(n.t, { x: n.x, y: rowY+bh+0.12, w: bw, h: 0.4, fontSize: 7.5, color: C.gray, align: 'center', fontFace: FF, margin: 0 });
  });

  // Gate notes
  sl.addShape(pres.shapes.RECTANGLE, { x: xs[2]-0.02, y: rowY+bh+0.58, w: bw+0.04, h: 0.26, fill: { color: 'FFFBEB' }, line: { color: C.gate, width: 0.75 } });
  sl.addText('🔒 Gate: SRFSigned — must sign before spec can be assigned', { x: xs[2], y: rowY+bh+0.6, w: bw*2+gap+0.04, h: 0.22, fontSize: 7, color: '92400E', fontFace: FF, margin: 0 });

  sl.addShape(pres.shapes.RECTANGLE, { x: xs[3]-0.02, y: rowY+bh+0.9, w: bw+0.04, h: 0.26, fill: { color: 'FFFBEB' }, line: { color: C.gate, width: 0.75 } });
  sl.addText('🔒 Gate: SpecAssigned — spec must be assigned before testing begins', { x: xs[3], y: rowY+bh+0.92, w: bw*3+gap*2+0.04, h: 0.22, fontSize: 7, color: '92400E', fontFace: FF, margin: 0 });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Phase 2: Testing Execution
// bw=1.55, gap=0.35, start=0.42 → 5 steps
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 2', 'Testing Execution');

  const bw=1.58, bh=1.2, gap=0.35, startX=0.42, rowY=1.05;
  const xs = Array.from({length:5}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Pick from\nWork Queue', role: 'Analyst' },
    { title: 'Start Test\nExecution', role: 'Analyst', gate: true },
    { title: 'Enter Results\n& Evidence', role: 'Analyst' },
    { title: 'OOS/OOT\nAuto-Check', role: 'System' },
    { title: 'Submit &\nSign Off', role: 'Analyst', esign: true, gate: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  // Detail boxes below steps
  const details = [
    { x: xs[0], lines: ['Priority scoring', 'Barcode scan assign', 'Instrument assignment'] },
    { x: xs[1], lines: ['Gate: AllTestsComplete', 'Timer started', 'Analyst locked in'] },
    { x: xs[2], lines: ['20+ parameters', 'Numeric/pass-fail', 'Evidence attachments'] },
    { x: xs[3], lines: ['Compare vs spec limits', 'Flag OOS/OOT', 'Auto-open investigation'] },
    { x: xs[4], lines: ['Gate: LogbookSigned', 'Gate: FormTemplateFilled', 'E-signature finalises'] },
  ];
  details.forEach(d => {
    sl.addText([
      ...d.lines.map((l, i) => ({ text: '• ' + l, options: { breakLine: i < d.lines.length-1, fontSize: 8, color: C.gray } }))
    ], { x: d.x, y: rowY+bh+0.1, w: bw, h: 0.65, fontFace: FF, margin: 0 });
  });

  // Monitoring form note
  sl.addShape(pres.shapes.RECTANGLE, { x: 0.38, y: 4.3, w: 9.3, h: 0.42, fill: { color: 'F5F3FF' }, line: { color: C.esign, width: 0.75 } });
  sl.addText('✍  If a Monitoring Form is assigned, it must be submitted (Gate: FormTemplateFilled) before sign-off is permitted.  Suggestions from AI are auto-loaded when the form opens.', {
    x: 0.5, y: 4.32, w: 9.1, h: 0.38, fontSize: 8.5, color: '4C1D95', fontFace: FF, margin: 0
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Phase 3: Results Review
// bw=1.95, gap=0.5, start=0.48 → 4 steps
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 3', 'Results Review');

  const bw=2.0, bh=1.2, gap=0.47, startX=0.46, rowY=1.05;
  const xs = Array.from({length:4}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Analyst Submits\nResults', role: 'Analyst' },
    { title: 'QC Lead\nVerification', role: 'QA', esign: true },
    { title: 'Sign Digital\nLogbook', role: 'Analyst', gate: true, esign: true },
    { title: 'Results\nApproved ✓', role: 'QA', done: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign, done: s.done });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  const details = [
    { x: xs[0], lines: ['OOS investigation opened if flagged', 'Gate: NoOpenOOS must pass', 'All parameters captured'] },
    { x: xs[1], lines: ['Reviews result accuracy', 'Checks instrument calibration', 'QCLeadVerify command records signature'] },
    { x: xs[2], lines: ['Gate: LogbookSigned', 'Process log rows must be signed', 'Audit trail locked in DB'] },
    { x: xs[3], lines: ['Status → ReviewComplete', 'Triggers CoA generation', 'Full traceability chain intact'] },
  ];
  details.forEach(d => {
    sl.addText([
      ...d.lines.map((l, i) => ({ text: '• ' + l, options: { breakLine: i < d.lines.length-1, fontSize: 8, color: C.gray } }))
    ], { x: d.x, y: rowY+bh+0.1, w: bw, h: 0.65, fontFace: FF, margin: 0 });
  });

  // OOS note
  sl.addShape(pres.shapes.RECTANGLE, { x: 0.46, y: 3.7, w: xs[0]+bw-0.46, h: 0.75, fill: { color: 'FEF2F2' }, line: { color: 'FCA5A5', width: 0.75 } });
  sl.addText('⛔  If OOS/OOT is flagged', { x: 0.58, y: 3.74, w: 2.5, h: 0.22, fontSize: 8.5, bold: true, color: 'DC2626', fontFace: FF, margin: 0 });
  sl.addText([
    { text: 'An OOS Investigation is auto-opened.  ', options: { breakLine: true, fontSize: 8, color: C.gray } },
    { text: 'Gate: NoOpenOOS must pass before sign-off is permitted.', options: { fontSize: 8, color: C.gray } },
  ], { x: 0.58, y: 4.0, w: 2.4, h: 0.38, fontFace: FF, margin: 0 });

  // CheckpointsSigned note
  sl.addShape(pres.shapes.RECTANGLE, { x: xs[2]-0.02, y: 3.7, w: bw+0.04, h: 0.75, fill: { color: 'FFFBEB' }, line: { color: C.gate, width: 0.75 } });
  sl.addText('🔒 Gate: CheckpointsSigned', { x: xs[2]+0.08, y: 3.74, w: bw, h: 0.22, fontSize: 8.5, bold: true, color: '92400E', fontFace: FF, margin: 0 });
  sl.addText('All process log rows (checkpoint slots) must have an\nelectronic signature before the logbook can be closed.', { x: xs[2]+0.08, y: 3.98, w: bw-0.1, h: 0.42, fontSize: 8, color: C.gray, fontFace: FF, margin: 0 });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Phase 4: CoA Generation
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 4', 'CoA Generation');

  const bw=2.0, bh=1.2, gap=0.47, startX=0.46, rowY=1.05;
  const xs = Array.from({length:4}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Auto-Generate\nCoA', role: 'System' },
    { title: 'Review CoA\nLines & Results', role: 'QA' },
    { title: 'Lock PDF &\nSign Off', role: 'QA', esign: true, gate: true },
    { title: 'CoA Issued ✓', role: 'QA', done: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign, done: s.done });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  const details = [
    { x: xs[0], lines: ['Triggered on ReviewComplete', 'Pulls all passed test parameters', 'CoA number auto-assigned'] },
    { x: xs[1], lines: ['10-item QA checklist', 'Passed items auto-collapsed', 'Failed items highlighted in red'] },
    { x: xs[2], lines: ['Gate: CoAApproved', 'PDF locked server-side atomically', '21 CFR 211.194 compliant'] },
    { x: xs[3], lines: ['CoA status: Released', 'Triggers batch release workflow', 'Distributable to customers'] },
  ];
  details.forEach(d => {
    sl.addText([
      ...d.lines.map((l, i) => ({ text: '• ' + l, options: { breakLine: i < d.lines.length-1, fontSize: 8, color: C.gray } }))
    ], { x: d.x, y: rowY+bh+0.1, w: bw, h: 0.65, fontFace: FF, margin: 0 });
  });

  // CoA checklist note
  sl.addShape(pres.shapes.RECTANGLE, { x: 0.46, y: 3.7, w: 9.12, h: 1.0, fill: { color: 'FAFAFA' }, line: { color: C.lightGray, width: 0.75 } });
  sl.addText('10-Item QA Checklist (21 CFR 211.192)', { x: 0.6, y: 3.76, w: 4.5, h: 0.28, fontSize: 11, bold: true, color: C.dark, fontFace: FF, margin: 0 });

  const checkItems = [
    'All test executions complete', 'No open OOS investigations', 'Logbook fully signed', 'Analyst signatures present',
    'Spec version current', 'Evidence uploaded', 'OOS waiver (if any)', 'Instrument calibration valid',
    'Process log complete', 'QC lead verified'
  ];
  checkItems.forEach((item, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const cx = 0.6 + col * 4.5;
    const cy = 4.1 + row * 0.115;
    sl.addText('✓  ' + item, { x: cx, y: cy, w: 4.2, h: 0.12, fontSize: 7.5, color: C.pass, fontFace: FF, margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Phase 5: QA Review & Batch Release
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 5', 'QA Review & Batch Release');

  const bw=1.58, bh=1.2, gap=0.35, startX=0.42, rowY=1.05;
  const xs = Array.from({length:5}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Open CoA\nReview', role: 'QA' },
    { title: 'Run QA\nChecklist', role: 'QA', gate: true },
    { title: 'Review\nRisk Score', role: 'System' },
    { title: 'Make\nDecision', role: 'QA', esign: true },
    { title: 'Batch\nReleased ✓', role: 'LabManager', done: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign, done: s.done });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  const details = [
    { x: xs[0], lines: ['CoA list filtered by status', 'Click to open review modal', 'Checklist auto-evaluated'] },
    { x: xs[1], lines: ['10 system checks', 'Passed items collapsed by default', 'Failures shown immediately'] },
    { x: xs[2], lines: ['AI-calculated risk score', 'Factors: OOS, TAT, complexity', 'Collapsed by default; expand for detail'] },
    { x: xs[3], lines: ['Approve / Conditional / Reject', 'Justification mandatory if conditional', 'E-signature locks decision'] },
    { x: xs[4], lines: ['Status: Released', 'Triggers Dispatch QC task', 'Audit trail complete'] },
  ];
  details.forEach(d => {
    sl.addText([
      ...d.lines.map((l, i) => ({ text: '• ' + l, options: { breakLine: i < d.lines.length-1, fontSize: 8, color: C.gray } }))
    ], { x: d.x, y: rowY+bh+0.1, w: bw, h: 0.65, fontFace: FF, margin: 0 });
  });

  // Decision matrix
  const decisions = [
    { label: 'Approved',           color: C.pass,  desc: 'All checks passed — batch released immediately' },
    { label: 'Conditional Release', color: C.gate,  desc: 'Minor failures — QA justification required, batch released with notes' },
    { label: 'Rejected',           color: C.admin,  desc: 'Critical failures — batch held, investigation triggered' },
  ];
  sl.addText('Decision Outcomes', { x: 0.42, y: 3.76, w: 3.5, h: 0.28, fontSize: 10, bold: true, color: C.dark, fontFace: FF, margin: 0 });
  decisions.forEach((d, i) => {
    const dy = 4.05 + i * 0.36;
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.42, y: dy, w: 1.3, h: 0.28, fill: { color: d.color }, line: { color: d.color } });
    sl.addText(d.label, { x: 0.42, y: dy, w: 1.3, h: 0.28, fontSize: 7.5, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
    sl.addText(d.desc, { x: 1.82, y: dy+0.02, w: 6.5, h: 0.24, fontSize: 8, color: C.gray, fontFace: FF, margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Phase 6: Dispatch QC
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'PHASE 6', 'Dispatch QC');

  const bw=2.0, bh=1.2, gap=0.47, startX=0.46, rowY=1.05;
  const xs = Array.from({length:4}, (_,i) => startX + i*(bw+gap));
  const midY = rowY + bh/2;

  const steps = [
    { title: 'Create\nDispatch Task', role: 'LabManager' },
    { title: 'Physical\nInspection', role: 'Analyst' },
    { title: 'Confirm\nDispatch', role: 'QA', esign: true },
    { title: 'Dispatched ✓', role: 'System', done: true },
  ];

  steps.forEach((s, i) => {
    drawStep(sl, xs[i], rowY, bw, bh, i+1, s.title, s.role, { gate: s.gate, esign: s.esign, done: s.done });
    if (i < steps.length - 1) drawArrow(sl, xs[i]+bw+0.02, midY, xs[i+1]-0.02);
  });

  const details = [
    { x: xs[0], lines: ['Auto-triggered on batch release', 'Delivery order linked', 'Assigned to LabManager'] },
    { x: xs[1], lines: ['Container condition check', 'Seal integrity verified', 'Label cross-check vs CoA'] },
    { x: xs[2], lines: ['E-signature locks dispatch', 'Time-stamped audit record', 'Distribution log created'] },
    { x: xs[3], lines: ['Full chain of custody logged', 'Customer delivery record', 'Sample available for traceability'] },
  ];
  details.forEach(d => {
    sl.addText([
      ...d.lines.map((l, i) => ({ text: '• ' + l, options: { breakLine: i < d.lines.length-1, fontSize: 8, color: C.gray } }))
    ], { x: d.x, y: rowY+bh+0.1, w: bw, h: 0.65, fontFace: FF, margin: 0 });
  });

  // Traceability note
  sl.addShape(pres.shapes.RECTANGLE, { x: 0.46, y: 3.75, w: 9.12, h: 1.1, fill: { color: 'F0FDF4' }, line: { color: C.pass, width: 0.75 } });
  sl.addText('Full Traceability Chain — Every Step is Linked', { x: 0.6, y: 3.82, w: 5, h: 0.28, fontSize: 11, bold: true, color: '14532D', fontFace: FF, margin: 0 });
  const traceItems = [
    'Sample → Test Execution → Results → OOS Investigation (if any)',
    'Results → CoA Lines → Certificate of Analysis → QA Approval',
    'CoA → Batch Release Decision → Dispatch QC Task → Delivery Order',
    'Every action stamped with: User  |  Timestamp  |  E-Signature  |  IP Address  |  Role',
  ];
  traceItems.forEach((t, i) => {
    sl.addText('→  ' + t, { x: 0.6, y: 4.17 + i*0.165, w: 8.8, h: 0.15, fontSize: 8, color: C.gray, fontFace: FF, margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Gate Conditions
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'GATES', 'Gate Conditions — Workflow Enforcement');

  const gates = [
    { name: 'AllTestsComplete',   icon: '✓', desc: 'All assigned test executions must reach Completed status before sign-off proceeds.' },
    { name: 'NoOpenOOS',          icon: '🔬', desc: 'Any open OOS/OOT investigation must be closed before sign-off is permitted.' },
    { name: 'LogbookSigned',      icon: '📋', desc: 'All digital logbook entries must carry an electronic signature.' },
    { name: 'CoAApproved',        icon: '📄', desc: 'A Certificate of Analysis with status Released must exist before batch release.' },
    { name: 'FormTemplateFilled', icon: '📝', desc: 'If a monitoring form is assigned, it must be submitted via the Form tab in Test Execution.' },
    { name: 'CheckpointsSigned',  icon: '🔒', desc: 'All process log rows (checkpoint monitoring slots) must be electronically signed.' },
    { name: 'SRFSigned',          icon: '✍', desc: 'The Sample Request Form must carry an e-signature before testing can begin.' },
    { name: 'SpecAssigned',       icon: '📐', desc: 'A Specification Template must be assigned before test parameters are created.' },
  ];

  const gw=4.45, gh=0.88;
  const cols = [0.35, 5.05];
  const rowStart = 0.78;
  const rowGap = 0.95;

  gates.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = cols[col];
    const gy = rowStart + row * rowGap;
    sl.addShape(pres.shapes.RECTANGLE, { x: gx, y: gy, w: gw, h: gh, fill: { color: 'FFFFFF' }, line: { color: C.lightGray, width: 0.75 }, shadow: mkSh() });
    sl.addShape(pres.shapes.RECTANGLE, { x: gx, y: gy, w: 0.62, h: gh, fill: { color: C.gate }, line: { color: C.gate } });
    sl.addText(g.icon, { x: gx+0.02, y: gy+0.18, w: 0.58, h: 0.5, fontSize: 18, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
    sl.addText(g.name, { x: gx+0.72, y: gy+0.06, w: gw-0.82, h: 0.3, fontSize: 10.5, bold: true, color: C.dark, fontFace: FF, margin: 0 });
    sl.addText(g.desc, { x: gx+0.72, y: gy+0.36, w: gw-0.82, h: 0.46, fontSize: 8.5, color: C.gray, fontFace: FF, margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Role & Permissions Matrix
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  addHeader(sl, 'ROLES', 'Role & Permissions Matrix');

  const roles = ['Analyst', 'QA', 'LabManager', 'Admin'];
  const roleColors = [C.analyst, C.qa, C.labMgr, C.admin];
  const perms = [
    { area: 'Sample Registration',   vals: [true, false, true, true] },
    { area: 'Work Queue / Testing',   vals: [true, false, true, true] },
    { area: 'OOS Investigations',     vals: [true, true, true, true] },
    { area: 'Results Review',         vals: [true, true, false, true] },
    { area: 'CoA Review & Approval',  vals: [false, true, false, true] },
    { area: 'Batch Release',          vals: [false, true, true, true] },
    { area: 'Dispatch QC',            vals: [false, true, true, true] },
    { area: 'Compliance Panel',       vals: [false, true, true, true] },
    { area: 'Master Data / Settings', vals: [false, false, false, true] },
  ];

  const tableX=0.35, tableY=0.82;
  const colW=[3.4, 1.45, 1.45, 1.45, 1.45];
  const rowH=0.46;

  // Header row
  sl.addShape(pres.shapes.RECTANGLE, { x: tableX, y: tableY, w: colW[0], h: rowH, fill: { color: C.dark }, line: { color: C.dark } });
  sl.addText('Permission Area', { x: tableX+0.1, y: tableY, w: colW[0]-0.1, h: rowH, fontSize: 10, bold: true, color: C.white, valign: 'middle', fontFace: FF, margin: 0 });

  roles.forEach((r, i) => {
    const cx = tableX + colW[0] + i*colW[1];
    sl.addShape(pres.shapes.RECTANGLE, { x: cx, y: tableY, w: colW[i+1], h: rowH, fill: { color: roleColors[i] }, line: { color: roleColors[i] } });
    sl.addText(r, { x: cx, y: tableY, w: colW[i+1], h: rowH, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0, fontFace: FF });
  });

  // Data rows
  perms.forEach((p, ri) => {
    const ry = tableY + rowH + ri*rowH;
    const bgColor = ri % 2 === 0 ? 'FFFFFF' : 'F8FEFF';
    sl.addShape(pres.shapes.RECTANGLE, { x: tableX, y: ry, w: colW[0], h: rowH, fill: { color: bgColor }, line: { color: C.lightGray, width: 0.5 } });
    sl.addText(p.area, { x: tableX+0.1, y: ry, w: colW[0]-0.1, h: rowH, fontSize: 9.5, color: C.dark, valign: 'middle', fontFace: FF, margin: 0 });
    p.vals.forEach((v, ci) => {
      const cx = tableX + colW[0] + ci*colW[ci+1];
      sl.addShape(pres.shapes.RECTANGLE, { x: cx, y: ry, w: colW[ci+1], h: rowH, fill: { color: bgColor }, line: { color: C.lightGray, width: 0.5 } });
      sl.addText(v ? '✓' : '—', { x: cx, y: ry, w: colW[ci+1], h: rowH, fontSize: 13, bold: v, color: v ? C.pass : 'CBD5E1', align: 'center', valign: 'middle', margin: 0, fontFace: FF });
    });
  });

  // Note
  sl.addText('* Admin has full access to all areas.  All roles require an active session with JWT authentication (21 CFR Part 11).', {
    x: tableX, y: 5.25, w: 9.3, h: 0.2, fontSize: 8, color: C.gray, fontFace: FF, margin: 0
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Closing
// ════════════════════════════════════════════════════════════════════════════
{
  const sl = pres.addSlide();
  sl.background = { color: C.dark };

  // Left accent
  sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.14, h: 5.625, fill: { color: C.seafoam }, line: { color: C.seafoam } });

  // Bottom accent
  sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.4, w: 10, h: 1.225, fill: { color: C.teal2 }, line: { color: C.teal2 } });

  sl.addText('End-to-End.  Gate-Controlled.  21 CFR Part 11 Compliant.', {
    x: 0.45, y: 0.7, w: 9, h: 0.5,
    fontSize: 16, color: C.seafoam, fontFace: FF, margin: 0, italic: true
  });
  sl.addText('Pharma-LIMS', {
    x: 0.45, y: 1.35, w: 9, h: 0.85,
    fontSize: 50, bold: true, color: C.white, fontFace: FF, margin: 0
  });

  // Summary stats
  const stats = [
    { val: '6',   label: 'Workflow Phases' },
    { val: '8',   label: 'Gate Conditions' },
    { val: '15+', label: 'E-Signature Points' },
    { val: '4',   label: 'User Roles' },
    { val: '100%', label: 'Audit Logged' },
  ];
  stats.forEach((s, i) => {
    const sx = 0.45 + i * 1.87;
    sl.addShape(pres.shapes.RECTANGLE, { x: sx, y: 2.55, w: 1.65, h: 1.35, fill: { color: C.teal }, line: { color: C.teal }, shadow: mkSh() });
    sl.addText(s.val, { x: sx, y: 2.65, w: 1.65, h: 0.65, fontSize: 30, bold: true, color: C.mint, align: 'center', fontFace: FF, margin: 0 });
    sl.addText(s.label, { x: sx, y: 3.3, w: 1.65, h: 0.45, fontSize: 8.5, color: 'A0C8CC', align: 'center', fontFace: FF, margin: 0 });
  });

  sl.addText('WebSynergies (S) Pte Ltd  ·  Pharma-LIMS v1.0  ·  2026  ·  Confidential', {
    x: 0.45, y: 4.55, w: 9.1, h: 0.28,
    fontSize: 9.5, color: C.seafoam, fontFace: FF, margin: 0
  });
  sl.addText('Built with: React + TypeScript  |  .NET 8 C#  |  PostgreSQL  |  JWT Auth  |  AI-powered OOS Analysis', {
    x: 0.45, y: 4.9, w: 9.1, h: 0.22,
    fontSize: 8.5, color: '4A7A85', fontFace: FF, margin: 0
  });
}

// ── Write ──────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "d:/Pharma-LIMS/Pharma-LIMS-Workflow.pptx" })
  .then(() => console.log("✅  Pharma-LIMS-Workflow.pptx saved"))
  .catch(e => { console.error("❌  Error:", e.message); process.exit(1); });
