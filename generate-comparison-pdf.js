const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'LIMS_Comparison_Yokogawa_vs_PharmaLIMS.pdf')
const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 }, autoFirstPage: true })
doc.pipe(fs.createWriteStream(OUT))

const PAGE_W  = 841
const PAGE_H  = 595
const L       = 40
const W       = PAGE_W - 80
const GREEN   = '#16a34a'
const RED     = '#dc2626'
const SLATE   = '#0f172a'
const GRAY    = '#6b7280'
const WHITE   = '#ffffff'
const TEAL    = '#0d9488'

// Column x and widths
const C = {
  cat:  { x: L,          w: 88  },
  feat: { x: L + 88,     w: 152 },
  yok:  { x: L + 240,    w: 46  },
  ours: { x: L + 286,    w: 46  },
  impl: { x: L + 332,    w: W - 332 },  // ~429
}

const ROW_H  = 20
const HDR_H  = 18
const TITLE_H = 55   // space for title block on first page

// ── Helpers ──────────────────────────────────────────────────────────────
function drawHeader(y) {
  doc.save().rect(L, y, W, HDR_H).fillColor(SLATE).fill().restore()
  doc.fontSize(8.5).fillColor(WHITE).font('Helvetica-Bold')
  const cols = [
    { label: 'Category',           x: C.cat.x,  w: C.cat.w  },
    { label: 'Yokogawa Feature',   x: C.feat.x, w: C.feat.w },
    { label: 'Yokogawa',           x: C.yok.x,  w: C.yok.w  },
    { label: 'Our LIMS',           x: C.ours.x, w: C.ours.w },
    { label: 'Our Implementation', x: C.impl.x, w: C.impl.w },
  ]
  cols.forEach(c => doc.text(c.label, c.x + 4, y + 5, { width: c.w - 4, lineBreak: false }))
  return y + HDR_H
}

function drawDividers(fromY, toY) {
  ;[C.feat.x, C.yok.x, C.ours.x, C.impl.x].forEach(x => {
    doc.save().moveTo(x, fromY).lineTo(x, toY).lineWidth(0.5).strokeColor('#e5e7eb').stroke().restore()
  })
  doc.save().rect(L, fromY, W, toY - fromY).lineWidth(0.8).strokeColor('#cbd5e1').stroke().restore()
}

function truncate(text, maxW, fontSize) {
  doc.fontSize(fontSize).font('Helvetica')
  if (doc.widthOfString(text) <= maxW) return text
  let t = text
  while (t.length > 0 && doc.widthOfString(t + '…') > maxW) t = t.slice(0, -1)
  return t + '…'
}

// ── Title (page 1 only) ───────────────────────────────────────────────────
doc.fontSize(16).fillColor(SLATE).font('Helvetica-Bold').text('LIMS Feature Comparison', L, 40)
doc.fontSize(9).fillColor(GRAY).font('Helvetica').text('Yokogawa LIMS  vs  Our Pharma-LIMS  |  31 May 2026', L, 60)
doc.moveTo(L, 74).lineTo(L + W, 74).lineWidth(1).strokeColor(TEAL).stroke()

// ── Rows data ─────────────────────────────────────────────────────────────
// [category, feature, ours YES/NO, implementation]
const rows = [
  ['Common',             'User definition screen (workflow)',      'YES', 'Role-based users: Admin, Analyst, QA Officer, Lab Manager — configured in Master Data > Users'],
  ['Common',             'Data search',                            'YES', 'Filter/search across Sample Registration, Work Queue, OOS Investigations, and all master data pages'],
  ['Test Related',       'Workflow function',                      'YES', 'Full lifecycle: Registration → SRF Sign → Spec Assignment → Testing → Results Review → QA → CoA → Dispatch'],
  ['Test Related',       'Test requests',                          'YES', 'Work Queue page lists pending tests per analyst; auto-assigned via Specification Engine on SRF signature'],
  ['Test Related',       'Issuing test instruction and forms',     'YES', 'Form Templates auto-selected on registration; Test Execution renders the active form per method'],
  ['Test Related',       'Manual input',                           'YES', 'Enter Results in Test Execution: numeric, text, pass/fail per parameter with OOS/OOT auto-detection'],
  ['Test Related',       'Automated data import from instrument',  'NO',  '—'],
  ['Test Related',       'Batch input',                            'NO',  '—'],
  ['Test Related',       'Image capture / file upload',            'YES', 'File/image upload in Test Execution with description, stored as evidence per logbook entry'],
  ['Test Related',       'Computing function (calc formula)',       'YES', 'CalcFormulaService evaluates parameter formulas server-side (DataTable.Compute); result shown with ⚡ badge'],
  ['Test Related',       'Data rounding',                          'YES', 'DecimalPlaces per parameter; ApplyRounding (MidpointRounding.AwayFromZero) applied server-side on result save'],
  ['Test Related',       'Automated specification judgment',       'YES', 'OOS/OOT detection runs server-side on every result save; auto-transitions to PendingQAReview when OOS closed'],
  ['Additional Test',    'Retest function',                        'YES', 'RetestSampleCommand links retest to original sample; Retest button on Released/Rejected samples with reason modal'],
  ['Additional Test',    'Additional test',                        'NO',  '—'],
  ['Additional Test',    'Routine test planning',                  'YES', 'Checkpoint module: Time-Based, OperatorScan, ProcessLog, DispatchEvent trigger modes with configurable intervals'],
  ['Additional Test',    'Stability test function',                'YES', 'ICH Q1A programme: protocol registration, pull schedule (T3M–T24M), excursion logging, trend data'],
  ['Additional Test',    'QC function (Trend / Control Charts)',   'NO',  '—'],
  ['Test Support',       'Reagent & inventory management',         'YES', 'Reagents & Standards master data with expiry tracking, lot management, near-expiry alerts on Dashboard'],
  ['Test Support',       'Analyzer calibration management',        'YES', 'Calibration schedule, execution recording (INSERT-only audit), follow-up workflow, e-signature approval'],
  ['Test Support',       'Connection with analytical instruments', 'NO',  '—'],
  ['Test Support',       'Shipment / Release / CoA issuance',      'YES', 'QA release → CoA PDF generation → Dispatch QC sign-off → Delivery Order; e-signature at every step'],
  ['Reporting',          'Flexible report formatting',             'NO',  '—'],
  ['System Management',  'Master data maintenance (via screen)',   'YES', 'Full CRUD: Labs, Instruments, Materials, Test Methods, Parameters, Spec Limits, Form Templates, Users, Reagents'],
  ['System Management',  'Master data load (bulk import)',         'NO',  '—'],
  ['System Management',  'Master data version management',         'YES', 'DB-trigger INSERT-only audit on all master data; every change logged with user, timestamp, before/after values'],
  ['System Management',  'Supporting tools for batch registration','NO',  '—'],
  ['Security & Audit',   'Password management',                    'YES', 'BCrypt hashing; §11.300 password re-entry verified independently before every electronic signature'],
  ['Security & Audit',   'Access privilege management',            'YES', 'JWT role claims; page & action-level access enforced server-side — Analyst cannot approve QA actions'],
  ['Security & Audit',   'Screen lock for idle timeout',           'YES', 'useIdleLock hook (15 min) + IdleLockOverlay with password re-entry; wired in Layout (21 CFR §11.10(d))'],
  ['Security & Audit',   'Saving revision history',                'YES', 'INSERT-only audit tables for e-sigs, calibration, checkpoint logs; DB triggers block UPDATE/DELETE on audit rows'],
  ['External Interface', 'Receive from other systems',             'NO',  '—'],
  ['External Interface', 'Send to other system',                   'NO',  '—'],
  ['Others',             'Multi language support',                 'NO',  '—'],
  ['Others',             'Tablet PC support',                      'NO',  '—'],
]

// ── Render rows with page-break handling ─────────────────────────────────
let ry = 80   // start after title on page 1
let headerY = ry
ry = drawHeader(ry)
let lastCat = ''
let tableStartY = headerY

rows.forEach((row, i) => {
  const [cat, feat, ours, impl] = row

  // Page break check
  if (ry + ROW_H > PAGE_H - 50) {
    drawDividers(tableStartY, ry)
    doc.addPage()
    tableStartY = 40
    ry = drawHeader(40)
    lastCat = ''
  }

  const bg = i % 2 === 0 ? WHITE : '#f8fafc'
  doc.save().rect(L, ry, W, ROW_H).fillColor(bg).fill().restore()

  // Category (only on change)
  if (cat !== lastCat) {
    doc.fontSize(7.5).fillColor(TEAL).font('Helvetica-Bold')
       .text(cat, C.cat.x + 4, ry + 6, { width: C.cat.w - 6, lineBreak: false })
    lastCat = cat
  }

  // Feature
  const featTxt = truncate(feat, C.feat.w - 8, 8.5)
  doc.fontSize(8.5).fillColor(SLATE).font('Helvetica-Bold')
     .text(featTxt, C.feat.x + 4, ry + 6, { width: C.feat.w - 6, lineBreak: false })

  // Yokogawa badge
  doc.save().roundedRect(C.yok.x + 4, ry + 4, 38, 12, 3).fillColor(GREEN).fill().restore()
  doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold')
     .text('YES', C.yok.x + 4, ry + 6, { width: 38, align: 'center', lineBreak: false })

  // Our LIMS badge
  doc.save().roundedRect(C.ours.x + 4, ry + 4, 38, 12, 3).fillColor(ours === 'YES' ? GREEN : RED).fill().restore()
  doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold')
     .text(ours, C.ours.x + 4, ry + 6, { width: 38, align: 'center', lineBreak: false })

  // Implementation — single line, truncated
  const implTxt = truncate(impl, C.impl.w - 8, 8)
  doc.fontSize(8).fillColor(ours === 'YES' ? SLATE : '#9ca3af').font('Helvetica')
     .text(implTxt, C.impl.x + 4, ry + 6, { width: C.impl.w - 6, lineBreak: false })

  // Row border
  doc.save().moveTo(L, ry + ROW_H).lineTo(L + W, ry + ROW_H)
     .lineWidth(0.3).strokeColor('#e5e7eb').stroke().restore()

  ry += ROW_H
})

// Close final table
drawDividers(tableStartY, ry)

// ── Legend ────────────────────────────────────────────────────────────────
const legY = ry + 12
doc.fontSize(8.5).fillColor(SLATE).font('Helvetica-Bold').text('Legend:', L, legY, { lineBreak: false })
let lx = L + 52
;[{ l: 'YES', c: GREEN, n: 'Implemented' }, { l: 'NO', c: RED, n: 'Not implemented' }].forEach(lg => {
  doc.save().roundedRect(lx, legY - 1, 36, 12, 3).fillColor(lg.c).fill().restore()
  doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold').text(lg.l, lx, legY + 1, { width: 36, align: 'center', lineBreak: false })
  doc.fontSize(8).fillColor(GRAY).font('Helvetica').text(`  ${lg.n}`, lx + 38, legY + 1, { lineBreak: false })
  lx += 36 + doc.widthOfString(`  ${lg.n}`, { fontSize: 8 }) + 18
})

// ── Footer on every page ──────────────────────────────────────────────────
const range = doc.bufferedPageRange()
for (let p = 0; p < range.count; p++) {
  doc.switchToPage(range.start + p)
  doc.moveTo(L, PAGE_H - 28).lineTo(L + W, PAGE_H - 28).lineWidth(0.4).strokeColor('#e2e8f0').stroke()
  doc.fontSize(7.5).fillColor('#9ca3af').font('Helvetica')
     .text(`Pharma-LIMS  |  Feature Comparison  |  31 May 2026  |  Confidential`, L, PAGE_H - 22, { width: W - 60, align: 'left', lineBreak: false })
     .text(`Page ${p + 1} of ${range.count}`, L, PAGE_H - 22, { width: W, align: 'right', lineBreak: false })
}

doc.end()
console.log('PDF generated:', OUT)
