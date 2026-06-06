import { useState } from 'react'
import api from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type DataSource = 'samples' | 'results' | 'quality-events' | 'oos' | 'stability' | 'audit-trail'

interface ColumnDef {
  key: string
  label: string
  default: boolean
}

interface SourceDef {
  id: DataSource
  label: string
  icon: string
  color: string
  bg: string
  columns: ColumnDef[]
  filterStatus?: string[]
  filterHasSite?: boolean
  filterHasTestMethod?: boolean
}

interface SavedTemplate {
  name: string
  sourceId: DataSource
  columns: string[]
  from: string
  to: string
  status: string
  site: string
  testMethod: string
}

// ─── Source definitions ───────────────────────────────────────────────────────
const SOURCES: SourceDef[] = [
  {
    id: 'samples', label: 'Sample Register', icon: '🧪', color: '#0284c7', bg: '#e0f2fe',
    columns: [
      { key: 'sampleId',     label: 'Sample ID',     default: true },
      { key: 'material',     label: 'Material',      default: true },
      { key: 'lotNumber',    label: 'Lot Number',    default: true },
      { key: 'sampleType',   label: 'Sample Type',   default: false },
      { key: 'status',       label: 'Status',        default: true },
      { key: 'registeredBy', label: 'Registered By', default: false },
      { key: 'receivedDate', label: 'Received Date', default: true },
      { key: 'tat',          label: 'TAT (days)',    default: false },
      { key: 'site',         label: 'Site',          default: false },
    ],
    filterStatus: ['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected'],
    filterHasSite: true,
  },
  {
    id: 'results', label: 'Test Results', icon: '📊', color: '#7c3aed', bg: '#f3e8ff',
    columns: [
      { key: 'sampleId',      label: 'Sample ID',      default: true },
      { key: 'testMethod',    label: 'Test Method',     default: true },
      { key: 'parameter',     label: 'Parameter',       default: true },
      { key: 'resultValue',   label: 'Result Value',    default: true },
      { key: 'unit',          label: 'Unit',            default: false },
      { key: 'resultStatus',  label: 'Pass/Fail/OOS',   default: true },
      { key: 'analyst',       label: 'Analyst',         default: false },
      { key: 'completedDate', label: 'Completed Date',  default: true },
      { key: 'instrument',    label: 'Instrument',      default: false },
    ],
    filterStatus: ['Pass', 'Fail', 'OOS', 'OOT', 'Pending'],
    filterHasSite: true,
    filterHasTestMethod: true,
  },
  {
    id: 'quality-events', label: 'Quality Events', icon: '⚠️', color: '#dc2626', bg: '#fee2e2',
    columns: [
      { key: 'eventId',     label: 'Event ID',    default: true },
      { key: 'type',        label: 'Type',        default: true },
      { key: 'status',      label: 'Status',      default: true },
      { key: 'priority',    label: 'Priority',    default: true },
      { key: 'assignedTo',  label: 'Assigned To', default: false },
      { key: 'createdDate', label: 'Created Date',default: true },
      { key: 'dueDate',     label: 'Due Date',    default: false },
      { key: 'rootCause',   label: 'Root Cause',  default: false },
    ],
    filterStatus: ['Open', 'InProgress', 'Resolved', 'Closed'],
  },
  {
    id: 'oos', label: 'OOS Investigations', icon: '🔎', color: '#b45309', bg: '#fef3c7',
    columns: [
      { key: 'investigationId', label: 'Investigation ID', default: true },
      { key: 'sampleId',        label: 'Sample ID',        default: true },
      { key: 'testMethod',      label: 'Test Method',      default: true },
      { key: 'parameter',       label: 'Parameter',        default: false },
      { key: 'result',          label: 'Result',           default: true },
      { key: 'specification',   label: 'Specification',    default: false },
      { key: 'analyst',         label: 'Analyst',          default: false },
      { key: 'status',          label: 'Status',           default: true },
      { key: 'openedDate',      label: 'Opened Date',      default: true },
    ],
    filterStatus: ['Open', 'Phase1', 'Phase2', 'Closed', 'InvalidOOS'],
    filterHasTestMethod: true,
  },
  {
    id: 'stability', label: 'Stability Studies', icon: '📈', color: '#0369a1', bg: '#e0f2fe',
    columns: [
      { key: 'studyId',          label: 'Study ID',          default: true },
      { key: 'product',          label: 'Product',           default: true },
      { key: 'protocol',         label: 'Protocol',          default: true },
      { key: 'storageCondition', label: 'Storage Condition', default: true },
      { key: 'pullDate',         label: 'Pull Date',         default: false },
      { key: 'status',           label: 'Status',            default: true },
      { key: 'testsCompleted',   label: 'Tests Completed',   default: false },
    ],
    filterStatus: ['Active', 'Completed', 'Discontinued'],
    filterHasSite: true,
  },
  {
    id: 'audit-trail', label: 'Audit Trail', icon: '🔍', color: '#475569', bg: '#f1f5f9',
    columns: [
      { key: 'timestamp',  label: 'Timestamp',       default: true },
      { key: 'user',       label: 'User',            default: true },
      { key: 'action',     label: 'Action',          default: true },
      { key: 'entityType', label: 'Entity Type',     default: true },
      { key: 'entityId',   label: 'Entity ID',       default: false },
      { key: 'changes',    label: 'Changes Summary', default: false },
    ],
    filterStatus: ['Create', 'Update', 'Approve', 'Reject', 'Delete'],
  },
]

const SITES        = ['Site A — Mumbai', 'Site B — Pune', 'Site C — Hyderabad']
const TEST_METHODS = ['HPLC Assay', 'Dissolution', 'Water Content', 'Microbial Limit', 'Sterility', 'pH', 'Viscosity']
const PREVIEW_COUNT = 8

// ─── Mock row generator ───────────────────────────────────────────────────────
function mockRows(sourceId: DataSource, cols: string[]): Record<string, string>[] {
  return Array.from({ length: PREVIEW_COUNT }, (_, i) => {
    const row: Record<string, string> = {}
    for (const col of cols) {
      switch (col) {
        case 'sampleId':        row[col] = `S-${String(10000 + i * 3).padStart(5, '0')}`; break
        case 'material':        row[col] = ['Amoxicillin 500mg', 'Paracetamol 650mg', 'Ibuprofen 400mg', 'Metformin 500mg'][i % 4]; break
        case 'lotNumber':       row[col] = `LOT-2025-${String(100 + i).padStart(4, '0')}`; break
        case 'sampleType':      row[col] = ['Finished Product', 'Raw Material', 'In-Process'][i % 3]; break
        case 'status':          row[col] = sourceId === 'quality-events'
                                  ? ['Open', 'InProgress', 'Resolved', 'Closed'][i % 4]
                                  : sourceId === 'oos'
                                  ? ['Open', 'Phase1', 'Phase2', 'Closed', 'InvalidOOS'][i % 5]
                                  : sourceId === 'stability'
                                  ? ['Active', 'Completed', 'Discontinued'][i % 3]
                                  : ['Released', 'InTesting', 'PendingQAReview', 'Registered', 'Rejected'][i % 5]; break
        case 'registeredBy':    row[col] = ['Dr. Priya Shah', 'Analyst K. Rao', 'Dr. Mehta'][i % 3]; break
        case 'receivedDate':    row[col] = `2025-0${(i % 9) + 1}-${String(10 + i).padStart(2, '0')}`; break
        case 'tat':             row[col] = String(2 + i); break
        case 'site':            row[col] = ['Site A', 'Site B', 'Site C'][i % 3]; break
        case 'testMethod':      row[col] = ['HPLC Assay', 'Dissolution', 'Water Content'][i % 3]; break
        case 'parameter':       row[col] = ['Assay %', 'Q-value %', 'LOD %'][i % 3]; break
        case 'resultValue':     row[col] = String((98.5 + i * 0.3).toFixed(2)); break
        case 'unit':            row[col] = ['%', 'mg', 'cfu/mL'][i % 3]; break
        case 'resultStatus':    row[col] = i === 3 ? 'OOS' : i === 5 ? 'Fail' : 'Pass'; break
        case 'analyst':         row[col] = ['Dr. Priya Shah', 'Analyst K. Rao'][i % 2]; break
        case 'completedDate':   row[col] = `2025-0${(i % 9) + 1}-${String(15 + i % 14).padStart(2, '0')}`; break
        case 'instrument':      row[col] = ['HPLC-01', 'HPLC-02', 'UV-VIS-01'][i % 3]; break
        case 'eventId':         row[col] = `QE-${String(1000 + i).padStart(4, '0')}`; break
        case 'type':            row[col] = ['CAPA', 'Deviation', 'Complaint'][i % 3]; break
        case 'priority':        row[col] = ['High', 'Medium', 'Low'][i % 3]; break
        case 'assignedTo':      row[col] = ['QA Manager', 'Dr. Mehta', 'Analyst'][i % 3]; break
        case 'createdDate':     row[col] = `2025-0${(i % 9) + 1}-${String(5 + i).padStart(2, '0')}`; break
        case 'dueDate':         row[col] = `2025-0${(i % 9) + 1}-${String(20 + i % 9).padStart(2, '0')}`; break
        case 'rootCause':       row[col] = ['Equipment calibration', 'Operator error', 'Method deviation'][i % 3]; break
        case 'investigationId': row[col] = `OOS-${String(500 + i).padStart(4, '0')}`; break
        case 'result':          row[col] = String((85 + i * 2).toFixed(1)); break
        case 'specification':   row[col] = '98.0 – 102.0%'; break
        case 'openedDate':      row[col] = `2025-0${(i % 9) + 1}-${String(8 + i).padStart(2, '0')}`; break
        case 'studyId':         row[col] = `STB-${String(200 + i).padStart(4, '0')}`; break
        case 'product':         row[col] = ['Amoxicillin Cap', 'Paracetamol Tab', 'Ibuprofen Syrup'][i % 3]; break
        case 'protocol':        row[col] = ['STP-001', 'STP-002', 'STP-003'][i % 3]; break
        case 'storageCondition':row[col] = ['25°C/60%RH', '40°C/75%RH', '-20°C'][i % 3]; break
        case 'pullDate':        row[col] = `2025-0${(i % 9) + 1}-${String(15 + i % 10).padStart(2, '0')}`; break
        case 'testsCompleted':  row[col] = `${3 + i % 5}/8`; break
        case 'timestamp':       row[col] = `2025-0${(i % 9) + 1}-${String(10 + i).padStart(2, '0')} ${String(8 + i % 12).padStart(2, '0')}:${String(i * 7 % 60).padStart(2, '0')}`; break
        case 'user':            row[col] = ['admin', 'qa.manager', 'analyst.shah'][i % 3]; break
        case 'action':          row[col] = ['Create', 'Update', 'Approve', 'Reject'][i % 4]; break
        case 'entityType':      row[col] = ['Sample', 'User', 'Instrument', 'TestMethod'][i % 4]; break
        case 'entityId':        row[col] = String(1000 + i * 7); break
        case 'changes':         row[col] = ['Status: Pending → Released', 'Analyst assigned', 'Spec updated'][i % 3]; break
        default:                row[col] = '—'
      }
    }
    return row
  })
}

// ─── Style constants ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px',
}
const cardHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.07em',
  textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8,
}
const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
}
const microBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '2px 8px',
  border: '1px solid #e2e8f0', borderRadius: 5,
  background: '#f8fafc', color: '#64748b',
  cursor: 'pointer', fontFamily: 'inherit',
}
const actionBtn = (bg: string, color: string, disabled = false): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
  background: bg, color, border: 'none',
  opacity: disabled ? 0.5 : 1,
  transition: 'opacity 0.1s',
})

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Released:        { bg: '#dcfce7', color: '#15803d' },
  Pass:            { bg: '#dcfce7', color: '#15803d' },
  Active:          { bg: '#dcfce7', color: '#15803d' },
  Completed:       { bg: '#dcfce7', color: '#15803d' },
  Resolved:        { bg: '#dcfce7', color: '#15803d' },
  OOS:             { bg: '#fee2e2', color: '#dc2626' },
  Fail:            { bg: '#fee2e2', color: '#dc2626' },
  Rejected:        { bg: '#fee2e2', color: '#dc2626' },
  Discontinued:    { bg: '#fee2e2', color: '#dc2626' },
  OOT:             { bg: '#fef3c7', color: '#92400e' },
  InTesting:       { bg: '#e0f2fe', color: '#0284c7' },
  InProgress:      { bg: '#e0f2fe', color: '#0284c7' },
  Phase1:          { bg: '#e0f2fe', color: '#0284c7' },
  Phase2:          { bg: '#dbeafe', color: '#1d4ed8' },
  PendingQAReview: { bg: '#f3e8ff', color: '#7c3aed' },
  Open:            { bg: '#fef3c7', color: '#92400e' },
  Closed:          { bg: '#f1f5f9', color: '#475569' },
  Registered:      { bg: '#f1f5f9', color: '#475569' },
  InvalidOOS:      { bg: '#f1f5f9', color: '#475569' },
}

function StatusBadge({ val }: { val: string }) {
  const s = STATUS_COLORS[val] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
      {val}
    </span>
  )
}

const STATUS_KEYS = new Set(['status', 'resultStatus'])

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportBuilderPage() {
  const [sourceId,     setSourceId]     = useState<DataSource>('samples')
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    () => new Set(SOURCES[0].columns.filter(c => c.default).map(c => c.key))
  )
  const [from,         setFrom]         = useState('')
  const [to,           setTo]           = useState('')
  const [status,       setStatus]       = useState('')
  const [site,         setSite]         = useState('')
  const [testMethod,   setTestMethod]   = useState('')
  const [running,      setRunning]      = useState(false)
  const [rows,         setRows]         = useState<Record<string, string>[] | null>(null)
  const [exporting,    setExporting]    = useState<'csv' | 'excel' | null>(null)
  const [saveOpen,     setSaveOpen]     = useState(false)
  const [saveName,     setSaveName]     = useState('')
  const [templates,    setTemplates]    = useState<SavedTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('lims_report_templates') ?? '[]') } catch { return [] }
  })

  const source = SOURCES.find(s => s.id === sourceId)!

  function changeSource(id: DataSource) {
    const src = SOURCES.find(s => s.id === id)!
    setSourceId(id)
    setSelectedCols(new Set(src.columns.filter(c => c.default).map(c => c.key)))
    setStatus(''); setSite(''); setTestMethod(''); setRows(null)
  }

  function toggleCol(key: string) {
    setSelectedCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    setRows(null)
  }

  function runReport() {
    setRunning(true); setRows(null)
    const cols = source.columns.filter(c => selectedCols.has(c.key)).map(c => c.key)
    setTimeout(() => { setRows(mockRows(sourceId, cols)); setRunning(false) }, 500)
  }

  async function exportReport(format: 'csv' | 'excel') {
    if (!rows) return
    setExporting(format)
    try {
      const cols = source.columns.filter(c => selectedCols.has(c.key))
      const params = new URLSearchParams({ columns: cols.map(c => c.key).join(','), format })
      if (from) params.set('from', from)
      if (to)   params.set('to', to)
      if (status) params.set('status', status)
      if (site)   params.set('site', site)
      if (testMethod) params.set('testMethod', testMethod)
      const resp = await api.get(`/reports/builder/${sourceId}?${params}`, { responseType: 'blob' })
      const cd   = resp.headers['content-disposition'] ?? ''
      const m    = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const ext  = format === 'csv' ? 'csv' : 'xlsx'
      const name = m?.[1]?.replace(/['"]/g, '') ?? `LIMS_${sourceId}_${new Date().toISOString().slice(0, 10)}.${ext}`
      const url  = URL.createObjectURL(new Blob([resp.data]))
      Object.assign(document.createElement('a'), { href: url, download: name }).click()
      URL.revokeObjectURL(url)
    } catch {
      // Client-side CSV fallback
      const cols = source.columns.filter(c => selectedCols.has(c.key))
      const csv  = [cols.map(c => c.label).join(','), ...rows.map(r => cols.map(c => `"${r[c.key] ?? ''}"`).join(','))].join('\n')
      const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      Object.assign(document.createElement('a'), { href: url, download: `LIMS_${sourceId}_${new Date().toISOString().slice(0, 10)}.csv` }).click()
      URL.revokeObjectURL(url)
    } finally { setExporting(null) }
  }

  function saveTemplate() {
    if (!saveName.trim()) return
    const tpl: SavedTemplate = { name: saveName.trim(), sourceId, columns: [...selectedCols], from, to, status, site, testMethod }
    const updated = [...templates.filter(t => t.name !== tpl.name), tpl]
    setTemplates(updated)
    localStorage.setItem('lims_report_templates', JSON.stringify(updated))
    setSaveOpen(false); setSaveName('')
  }

  function loadTemplate(tpl: SavedTemplate) {
    changeSource(tpl.sourceId)
    setSelectedCols(new Set(tpl.columns))
    setFrom(tpl.from); setTo(tpl.to); setStatus(tpl.status); setSite(tpl.site); setTestMethod(tpl.testMethod)
  }

  function deleteTemplate(name: string) {
    const updated = templates.filter(t => t.name !== name)
    setTemplates(updated)
    localStorage.setItem('lims_report_templates', JSON.stringify(updated))
  }

  const orderedCols = source.columns.filter(c => selectedCols.has(c.key))
  const canExport   = !!rows && exporting === null

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Report Builder</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Build custom reports from any LIMS data source — choose columns, apply filters, and export
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setSaveOpen(true)} style={actionBtn('#f1f5f9', '#374151')}>
            💾 Save Template
          </button>
          <button onClick={() => exportReport('csv')}   disabled={!canExport} style={actionBtn('#f0fdf4', '#15803d', !canExport)}>
            {exporting === 'csv' ? '⏳' : '⬇'} CSV
          </button>
          <button onClick={() => exportReport('excel')} disabled={!canExport} style={actionBtn('#f0fdfa', '#0f766e', !canExport)}>
            {exporting === 'excel' ? '⏳' : '⬇'} Excel
          </button>
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Left column: source picker + templates */}
        <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={card}>
            <div style={cardHead}>Data Source</div>
            {SOURCES.map(s => (
              <div
                key={s.id}
                onClick={() => changeSource(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                  background: sourceId === s.id ? s.bg : 'transparent',
                  border: `1.5px solid ${sourceId === s.id ? s.color + '55' : 'transparent'}`,
                  marginBottom: 2, transition: 'all 0.1s',
                }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: sourceId === s.id ? 700 : 500, color: sourceId === s.id ? s.color : '#374151' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {templates.length > 0 && (
            <div style={card}>
              <div style={cardHead}>Saved Templates</div>
              {templates.map(t => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <button
                    onClick={() => loadTemplate(t)}
                    style={{ flex: 1, textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.name)}
                    style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: columns + filters + run + preview */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

            {/* Column picker */}
            <div style={{ ...card, flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={cardHead}>Columns</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setSelectedCols(new Set(source.columns.map(c => c.key)))} style={microBtn}>All</button>
                  <button onClick={() => setSelectedCols(new Set(source.columns.filter(c => c.default).map(c => c.key)))} style={microBtn}>Default</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {source.columns.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: '#374151' }}>
                    <input type="checkbox" checked={selectedCols.has(c.key)} onChange={() => toggleCol(c.key)}
                      style={{ accentColor: source.color, width: 14, height: 14 }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div style={{ ...card, width: 230, flexShrink: 0 }}>
              <div style={{ ...cardHead, marginBottom: 10 }}>Filters</div>
              <div style={{ marginBottom: 9 }}>
                <label style={labelSt}>From Date</label>
                <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div style={{ marginBottom: 9 }}>
                <label style={labelSt}>To Date</label>
                <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} />
              </div>
              {source.filterStatus && (
                <div style={{ marginBottom: 9 }}>
                  <label style={labelSt}>Status</label>
                  <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="">All</option>
                    {source.filterStatus.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {source.filterHasSite && (
                <div style={{ marginBottom: 9 }}>
                  <label style={labelSt}>Site</label>
                  <select style={inp} value={site} onChange={e => setSite(e.target.value)}>
                    <option value="">All Sites</option>
                    {SITES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {source.filterHasTestMethod && (
                <div>
                  <label style={labelSt}>Test Method</label>
                  <select style={inp} value={testMethod} onChange={e => setTestMethod(e.target.value)}>
                    <option value="">All Methods</option>
                    {TEST_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runReport}
            disabled={running || selectedCols.size === 0}
            style={{
              padding: '11px 0', borderRadius: 9, border: 'none',
              cursor: running || selectedCols.size === 0 ? 'not-allowed' : 'pointer',
              background: running || selectedCols.size === 0 ? '#9ca3af' : source.color,
              color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}>
            {running ? '⏳ Running Report…' : `▶  Run Report — ${source.label}`}
          </button>

          {/* Preview table */}
          {rows ? (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Preview <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>({rows.length} sample rows)</span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => exportReport('csv')}   disabled={!canExport} style={actionBtn('#f0fdf4', '#15803d', !canExport)}>
                    {exporting === 'csv' ? '⏳' : '⬇'} CSV
                  </button>
                  <button onClick={() => exportReport('excel')} disabled={!canExport} style={actionBtn('#f0fdfa', '#0f766e', !canExport)}>
                    {exporting === 'excel' ? '⏳' : '⬇'} Excel
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {orderedCols.map(c => (
                        <th key={c.key} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {orderedCols.map(c => (
                          <td key={c.key} style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {STATUS_KEYS.has(c.key) ? <StatusBadge val={row[c.key]} /> : row[c.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '7px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                Showing {PREVIEW_COUNT} preview rows — export for complete dataset
              </div>
            </div>
          ) : !running ? (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 24px', color: '#9ca3af' }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>🏗️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Configure and run your report</div>
              <div style={{ fontSize: 12 }}>Select columns and filters above, then click Run Report</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Save template modal */}
      {saveOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Save Report Template</div>
            <label style={labelSt}>Template Name</label>
            <input
              style={{ ...inp, marginBottom: 16 }}
              placeholder="e.g. Monthly Sample Register"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTemplate()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveTemplate}          style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              <button onClick={() => setSaveOpen(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
