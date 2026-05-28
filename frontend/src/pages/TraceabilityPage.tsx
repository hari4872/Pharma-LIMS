import { useState, useEffect } from 'react'
import api from '@/api/client'

interface TraceNode {
  nodeType: string; nodeId: number; label: string; detail: string | null
}
interface TraceGraph {
  centralSample: TraceNode
  upstreamNodes: TraceNode[]
  downstreamNodes: TraceNode[]
  logbookNodes: TraceNode[]
}
interface CdRecord {
  cdId: number; sampleId: number; cdType: string; cdReference: string
  description?: string; linkedOosId?: number; status: string; createdAt: string
}

// ── colour tokens ────────────────────────────────────────────────────────────
const NODE_META: Record<string, { icon: string; bg: string; border: string; color: string }> = {
  MaterialLot:         { icon: '📦', bg: '#eff6ff', border: '#3b82f6', color: '#1e40af' },
  SamplingEvent:       { icon: '🧪', bg: '#f0fdf4', border: '#22c55e', color: '#166534' },
  Analyst:             { icon: '👤', bg: '#fdf4ff', border: '#a855f7', color: '#6b21a8' },
  Instrument:          { icon: '⚙️', bg: '#fff7ed', border: '#f97316', color: '#9a3412' },
  TestExecution:       { icon: '🔬', bg: '#f8fafc', border: '#94a3b8', color: '#334155' },
  Sample:              { icon: '🏷️', bg: '#fef9c3', border: '#eab308', color: '#713f12' },
  LogbookEntry:        { icon: '📝', bg: '#f0fdf4', border: '#86efac', color: '#166534' },
  CoA:                 { icon: '📄', bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
  ComplaintsDeviation: { icon: '⚠️', bg: '#fff1f2', border: '#f43f5e', color: '#9f1239' },
  default:             { icon: '•',  bg: '#f9fafb', border: '#d1d5db', color: '#374151' },
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Open:   { bg: '#fef3c7', color: '#92400e' },
  Closed: { bg: '#dcfce7', color: '#166534' },
}

function Badge({ text }: { text: string }) {
  const s = STATUS_BADGE[text] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:12, fontSize:11,
      fontWeight:700, background:s.bg, color:s.color, letterSpacing:0.3 }}>
      {text}
    </span>
  )
}

// ── Node chip (used in flow diagram) ─────────────────────────────────────────
function NodeChip({ node }: { node: TraceNode }) {
  const m = NODE_META[node.nodeType] ?? NODE_META.default
  return (
    <div style={{ border:`1.5px solid ${m.border}`, borderRadius:8, padding:'8px 12px',
      background:m.bg, minWidth:160, maxWidth:220 }}>
      <div style={{ fontSize:10, color:m.color, fontWeight:700, textTransform:'uppercase',
        letterSpacing:0.5, marginBottom:2 }}>{m.icon} {node.nodeType}</div>
      <div style={{ fontSize:13, fontWeight:600, color:m.color }}>{node.label}</div>
      {node.detail && <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{node.detail}</div>}
    </div>
  )
}

// ── Arrow connector ───────────────────────────────────────────────────────────
function Arrow({ label }: { label: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 6px' }}>
      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginBottom:2 }}>{label}</div>
      <div style={{ width:40, height:2, background:'#d1d5db', position:'relative' }}>
        <div style={{ position:'absolute', right:-1, top:-4, width:0, height:0,
          borderTop:'5px solid transparent', borderBottom:'5px solid transparent',
          borderLeft:'8px solid #d1d5db' }} />
      </div>
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({ title, subtitle, children, accent }:
  { title: string; subtitle?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
      overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6',
        borderLeft:`4px solid ${accent ?? '#2563eb'}`, background:'#fafafa' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding:'18px 20px' }}>{children}</div>
    </div>
  )
}

// ── Input / select shared style ───────────────────────────────────────────────
const inp: React.CSSProperties = {
  padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13,
  outline:'none', background:'#fff', color:'#111827', boxSizing:'border-box'
}
const lbl: React.CSSProperties = { fontSize:12, color:'#374151', display:'block', marginBottom:4, fontWeight:600 }
const req = <span style={{ color:'#ef4444' }}> *</span>

// ── Primary button ────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, color='#2563eb', children }:
  { onClick:()=>void; disabled?:boolean; color?:string; children:React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:'8px 18px', background: disabled ? '#9ca3af' : color,
        color:'#fff', border:'none', borderRadius:6, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TraceabilityPage() {
  const [tab, setTab] = useState<'graph'|'recall'|'cd'>('graph')

  // Graph tab
  const [sampleId, setSampleId]   = useState('')
  const [graph, setGraph]         = useState<TraceGraph | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError]     = useState('')

  // Recall tab
  const [recallLot, setRecallLot]       = useState('')
  const [recallResult, setRecallResult] = useState<{ lotNumber:string; affectedSampleIds:number[]; count:number }|null>(null)
  const [recallLoading, setRecallLoading] = useState(false)

  // C&D tab
  const [cdList, setCdList]     = useState<CdRecord[]>([])
  const [cdListLoading, setCdListLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [cdForm, setCdForm]     = useState({ sampleId:'', cdType:'', cdReference:'', description:'', linkedOosId:'' })
  const [cdSaving, setCdSaving] = useState(false)
  const [cdError, setCdError]   = useState('')
  const [cdToast, setCdToast]   = useState('')
  const [closingId, setClosingId] = useState<number|null>(null)

  // Load C&D list when tab opens
  useEffect(() => {
    if (tab === 'cd') loadCdList()
  }, [tab])

  async function loadGraph() {
    if (!sampleId) return
    setGraphLoading(true); setGraphError(''); setGraph(null)
    try {
      const r = await api.get(`/traceability/samples/${sampleId}/graph`)
      setGraph(r.data)
    } catch (err: any) {
      setGraphError(err.response?.data?.message ?? 'Failed to load traceability graph.')
    } finally { setGraphLoading(false) }
  }

  async function loadRecall() {
    if (!recallLot) return
    setRecallLoading(true); setRecallResult(null)
    try {
      const r = await api.get(`/traceability/recall?lotNumber=${encodeURIComponent(recallLot)}`)
      setRecallResult(r.data)
    } catch {}
    finally { setRecallLoading(false) }
  }

  async function loadCdList() {
    setCdListLoading(true)
    try {
      const r = await api.get('/traceability/complaints-deviations')
      setCdList(r.data ?? [])
    } catch { setCdList([]) }
    finally { setCdListLoading(false) }
  }

  async function submitCd() {
    if (!cdForm.sampleId || !cdForm.cdType || !cdForm.cdReference) {
      setCdError('Sample ID, CD Type and Reference are required.')
      return
    }
    setCdSaving(true); setCdError('')
    try {
      const body: Record<string,unknown> = {
        sampleId: Number(cdForm.sampleId),
        cdType: cdForm.cdType,
        cdReference: cdForm.cdReference,
      }
      if (cdForm.description.trim()) body.description = cdForm.description.trim()
      if (cdForm.linkedOosId.trim()) body.linkedOosId = Number(cdForm.linkedOosId)
      await api.post('/traceability/complaints-deviations', body)
      setCdForm({ sampleId:'', cdType:'', cdReference:'', description:'', linkedOosId:'' })
      setShowForm(false)
      showToast('Record logged successfully.')
      loadCdList()
    } catch (err: any) {
      setCdError(err.response?.data?.message ?? 'Failed to log record.')
    } finally { setCdSaving(false) }
  }

  async function closeCd(id: number) {
    setClosingId(id)
    try {
      await api.put(`/traceability/complaints-deviations/${id}/close`)
      showToast('Record closed successfully.')
      loadCdList()
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Failed to close record.')
    } finally { setClosingId(null) }
  }

  function showToast(msg: string) {
    setCdToast(msg); setTimeout(() => setCdToast(''), 3500)
  }

  const TABS = [
    { key:'graph',  label:'🔗 Sample Trace' },
    { key:'recall', label:'🚨 Recall Scope' },
    { key:'cd',     label:'📋 Complaints & Deviations' },
  ] as const

  return (
    <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#111827', marginBottom:4 }}>Traceability</h1>
        <p style={{ fontSize:13, color:'#6b7280' }}>
          Bidirectional graph: upstream (lot, sampling event, analyst, instrument) ↔ central sample ↔ downstream (CoA, complaints/deviations).
          Every query is INSERT-only (21 CFR Part 11).
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, borderBottom:'2px solid #e5e7eb', marginBottom:24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'9px 20px', fontSize:13, fontWeight:600, border:'none', cursor:'pointer',
              background:'transparent', borderBottom: tab===t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab===t.key ? '#2563eb' : '#6b7280', marginBottom:-2, borderRadius:'4px 4px 0 0',
              transition:'color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {cdToast && (
        <div style={{ marginBottom:16, background:'#f0fdf4', border:'1px solid #86efac',
          borderRadius:8, padding:'10px 16px', fontSize:13, color:'#166534', fontWeight:600,
          display:'flex', alignItems:'center', gap:8 }}>
          ✓ {cdToast}
        </div>
      )}

      {/* ── TAB: Sample Trace ─────────────────────────────────────────────── */}
      {tab === 'graph' && (
        <>
          <Card title="Sample Traceability Lookup"
            subtitle="Enter a Sample ID to load its full bidirectional traceability graph.">
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:'0 0 160px' }}>
                <label style={lbl}>Sample ID{req}</label>
                <input style={{ ...inp, width:'100%' }} type="number" value={sampleId}
                  onChange={e => setSampleId(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && loadGraph()}
                  placeholder="e.g. 42" />
              </div>
              <Btn onClick={loadGraph} disabled={graphLoading || !sampleId}>
                {graphLoading ? '⏳ Loading…' : '🔍 Load Graph'}
              </Btn>
              {graph && (
                <button onClick={() => { setGraph(null); setSampleId('') }}
                  style={{ padding:'8px 14px', background:'transparent', color:'#6b7280',
                    border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                  Clear
                </button>
              )}
            </div>
            {graphError && <p style={{ color:'#ef4444', fontSize:13, marginTop:10 }}>{graphError}</p>}
          </Card>

          {graph && (
            <Card title={`Traceability Graph — Sample #${graph.centralSample.nodeId}`}
              subtitle={`${graph.upstreamNodes.length} upstream · ${graph.downstreamNodes.length} downstream · ${graph.logbookNodes.length} logbook rows`}>

              {/* Visual flow: upstream → central → downstream */}
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:0, minWidth:680, paddingBottom:8 }}>

                  {/* Upstream column */}
                  <div style={{ flex:'0 0 220px' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase',
                      letterSpacing:0.6, marginBottom:10, paddingLeft:4 }}>
                      ← Upstream ({graph.upstreamNodes.length})
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {graph.upstreamNodes.length === 0
                        ? <span style={{ fontSize:12, color:'#9ca3af' }}>—</span>
                        : graph.upstreamNodes.map((n,i) => <NodeChip key={i} node={n} />)}
                    </div>
                  </div>

                  <Arrow label="feeds" />

                  {/* Central */}
                  <div style={{ flex:'0 0 220px' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase',
                      letterSpacing:0.6, marginBottom:10, paddingLeft:4 }}>
                      Central Sample
                    </div>
                    <div style={{ border:'2px solid #eab308', borderRadius:10, padding:'10px 14px',
                      background:'#fefce8', boxShadow:'0 2px 8px #eab30840' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#713f12', textTransform:'uppercase', letterSpacing:0.5 }}>
                        🏷️ Sample
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#713f12', marginTop:3 }}>
                        {graph.centralSample.label}
                      </div>
                      {graph.centralSample.detail && (
                        <div style={{ fontSize:11, color:'#92400e', marginTop:3 }}>{graph.centralSample.detail}</div>
                      )}
                    </div>

                    {graph.logbookNodes.length > 0 && (
                      <>
                        <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase',
                          letterSpacing:0.6, margin:'16px 0 8px', paddingLeft:4 }}>
                          Logbook ({graph.logbookNodes.length})
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {graph.logbookNodes.map((n,i) => <NodeChip key={i} node={n} />)}
                        </div>
                      </>
                    )}
                  </div>

                  <Arrow label="produces" />

                  {/* Downstream column */}
                  <div style={{ flex:'0 0 220px' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase',
                      letterSpacing:0.6, marginBottom:10, paddingLeft:4 }}>
                      Downstream → ({graph.downstreamNodes.length})
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {graph.downstreamNodes.length === 0
                        ? <span style={{ fontSize:12, color:'#9ca3af' }}>None yet.</span>
                        : graph.downstreamNodes.map((n,i) => <NodeChip key={i} node={n} />)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary strip */}
              <div style={{ marginTop:20, display:'flex', gap:12, flexWrap:'wrap' }}>
                {Object.entries(
                  [...graph.upstreamNodes, ...graph.downstreamNodes, ...graph.logbookNodes]
                    .reduce((acc, n) => { acc[n.nodeType]=(acc[n.nodeType]??0)+1; return acc }, {} as Record<string,number>)
                ).map(([type, count]) => {
                  const m = NODE_META[type] ?? NODE_META.default
                  return (
                    <div key={type} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                      background:m.bg, border:`1px solid ${m.border}`, borderRadius:20 }}>
                      <span style={{ fontSize:12 }}>{m.icon}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:m.color }}>{type}</span>
                      <span style={{ fontSize:12, color:m.color, background:'rgba(0,0,0,0.08)',
                        borderRadius:10, padding:'0 6px' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── TAB: Recall Scope ─────────────────────────────────────────────── */}
      {tab === 'recall' && (
        <Card title="Recall Scope Query"
          subtitle="From a lot number, instantly determine all affected downstream sample IDs — results in seconds for regulatory inspection (FR-12)."
          accent="#dc2626">
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:16 }}>
            <div style={{ flex:'0 0 260px' }}>
              <label style={lbl}>Lot Number{req}</label>
              <input style={{ ...inp, width:'100%' }} value={recallLot}
                onChange={e => setRecallLot(e.target.value)}
                onKeyDown={e => e.key==='Enter' && loadRecall()}
                placeholder="e.g. LOT-2026-001" />
            </div>
            <Btn onClick={loadRecall} disabled={recallLoading || !recallLot} color="#dc2626">
              {recallLoading ? '⏳ Querying…' : '🚨 Query Recall Scope'}
            </Btn>
            {recallResult && (
              <button onClick={() => { setRecallResult(null); setRecallLot('') }}
                style={{ padding:'8px 14px', background:'transparent', color:'#6b7280',
                  border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                Clear
              </button>
            )}
          </div>

          {recallResult && (
            <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #fca5a5' }}>
              {/* Header */}
              <div style={{ background:'#fef2f2', padding:'12px 16px', borderBottom:'1px solid #fca5a5',
                display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:18 }}>🚨</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#991b1b' }}>
                    Recall scope for Lot <strong>"{recallResult.lotNumber}"</strong>
                  </div>
                  <div style={{ fontSize:12, color:'#7f1d1d', marginTop:2 }}>
                    {recallResult.count} affected sample{recallResult.count !== 1 ? 's' : ''} identified
                  </div>
                </div>
              </div>
              {/* Table */}
              {recallResult.count > 0 ? (
                <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff' }}>
                  <thead>
                    <tr style={{ background:'#fef2f2' }}>
                      <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:'#991b1b', textTransform:'uppercase', letterSpacing:0.5 }}>#</th>
                      <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:'#991b1b', textTransform:'uppercase', letterSpacing:0.5 }}>Sample ID</th>
                      <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:'#991b1b', textTransform:'uppercase', letterSpacing:0.5 }}>Action Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recallResult.affectedSampleIds.map((id, i) => (
                      <tr key={id} style={{ borderTop:'1px solid #fee2e2' }}>
                        <td style={{ padding:'8px 16px', fontSize:13, color:'#991b1b' }}>{i+1}</td>
                        <td style={{ padding:'8px 16px', fontSize:13, fontWeight:600, color:'#111827' }}>#{id}</td>
                        <td style={{ padding:'8px 16px', fontSize:12, color:'#dc2626' }}>🔴 Quarantine / Investigate</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding:16, fontSize:13, color:'#166534', background:'#f0fdf4' }}>
                  ✓ No downstream samples affected by this lot.
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: Complaints & Deviations ──────────────────────────────────── */}
      {tab === 'cd' && (
        <>
          {/* Toolbar */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#6b7280' }}>
              All entries are INSERT-only audit records (21 CFR Part 11) — records cannot be edited or deleted.
            </div>
            <Btn onClick={() => { setShowForm(v => !v); setCdError('') }} color={showForm ? '#6b7280' : '#2563eb'}>
              {showForm ? '✕ Cancel' : '+ Log New Record'}
            </Btn>
          </div>

          {/* Log form (collapsible) */}
          {showForm && (
            <Card title="Log Complaint / Deviation" accent="#7c3aed"
              subtitle="Submit a new complaint or process deviation linked to a sample.">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Sample ID{req}</label>
                  <input style={{ ...inp, width:'100%' }} type="number" placeholder="Enter sample ID"
                    value={cdForm.sampleId} onChange={e => setCdForm(f=>({...f, sampleId:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>CD Type{req}</label>
                  <select style={{ ...inp, width:'100%' }} value={cdForm.cdType}
                    onChange={e => setCdForm(f=>({...f, cdType:e.target.value}))}>
                    <option value="">— Select type —</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Deviation">Deviation</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Reference{req}</label>
                  <input style={{ ...inp, width:'100%' }} placeholder="e.g. CD-2026-001"
                    value={cdForm.cdReference} onChange={e => setCdForm(f=>({...f, cdReference:e.target.value}))} />
                </div>
                <div>
                  <label style={lbl}>Linked OOS ID <span style={{ fontSize:11, color:'#9ca3af', fontWeight:400 }}>(optional)</span></label>
                  <input style={{ ...inp, width:'100%' }} type="number" placeholder="Enter OOS investigation ID"
                    value={cdForm.linkedOosId} onChange={e => setCdForm(f=>({...f, linkedOosId:e.target.value}))} />
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Description <span style={{ fontSize:11, color:'#9ca3af', fontWeight:400 }}>(optional)</span></label>
                <textarea style={{ ...inp, width:'100%', minHeight:80, resize:'vertical' }}
                  placeholder="Describe the complaint or deviation in detail…"
                  value={cdForm.description} onChange={e => setCdForm(f=>({...f, description:e.target.value}))} />
              </div>
              {cdError && (
                <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:6,
                  padding:'8px 12px', fontSize:13, color:'#dc2626', marginBottom:12 }}>
                  ⚠ {cdError}
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <Btn onClick={submitCd} disabled={cdSaving} color="#7c3aed">
                  {cdSaving ? '⏳ Saving…' : '✓ Submit Record'}
                </Btn>
                <button onClick={() => { setShowForm(false); setCdError('') }}
                  style={{ padding:'8px 16px', background:'transparent', color:'#6b7280',
                    border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer', fontSize:13 }}>
                  Cancel
                </button>
              </div>
            </Card>
          )}

          {/* Records table */}
          <Card title="Complaints & Deviations Register"
            subtitle="All logged complaints and process deviations linked to samples.">
            {cdListLoading ? (
              <div style={{ textAlign:'center', padding:32, color:'#9ca3af', fontSize:13 }}>Loading records…</div>
            ) : cdList.length === 0 ? (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>No records yet</div>
                <div style={{ fontSize:13, color:'#9ca3af' }}>Click "+ Log New Record" to create the first entry.</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                      {['CD ID','Sample ID','Type','Reference','Linked OOS','Status','Created','Actions'].map(h => (
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                          color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cdList.map((cd, i) => (
                      <tr key={cd.cdId}
                        style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0 ? '#fff' : '#fafafa',
                          transition:'background 0.1s' }}>
                        <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700, color:'#2563eb' }}>#{cd.cdId}</td>
                        <td style={{ padding:'9px 14px', fontSize:13, color:'#374151' }}>#{cd.sampleId}</td>
                        <td style={{ padding:'9px 14px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700,
                            background: cd.cdType==='Complaint' ? '#fff7ed' : '#eff6ff',
                            color: cd.cdType==='Complaint' ? '#c2410c' : '#1d4ed8' }}>
                            {cd.cdType}
                          </span>
                        </td>
                        <td style={{ padding:'9px 14px', fontSize:13, color:'#374151', fontFamily:'monospace' }}>
                          {cd.cdReference}
                        </td>
                        <td style={{ padding:'9px 14px', fontSize:13, color:'#6b7280' }}>
                          {cd.linkedOosId ? `#${cd.linkedOosId}` : '—'}
                        </td>
                        <td style={{ padding:'9px 14px' }}><Badge text={cd.status} /></td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>
                          {new Date(cd.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding:'9px 14px' }}>
                          {cd.status === 'Open' && (
                            <button onClick={() => closeCd(cd.cdId)} disabled={closingId===cd.cdId}
                              style={{ padding:'5px 12px', background: closingId===cd.cdId ? '#9ca3af' : '#16a34a',
                                color:'#fff', border:'none', borderRadius:5, cursor: closingId===cd.cdId ? 'not-allowed' : 'pointer',
                                fontSize:12, fontWeight:600 }}>
                              {closingId===cd.cdId ? 'Closing…' : 'Close'}
                            </button>
                          )}
                          {cd.status !== 'Open' && <span style={{ fontSize:12, color:'#9ca3af' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
