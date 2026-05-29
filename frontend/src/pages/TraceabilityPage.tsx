import { useState, useEffect, useRef, useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, MarkerType,
  useNodesState, useEdgesState,
  Handle, Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface TraceNode {
  nodeType: string; nodeId: number; label: string; detail: string | null
}
interface TraceGraph {
  centralSample: TraceNode
  upstreamNodes: TraceNode[]
  downstreamNodes: TraceNode[]
  logbookNodes: TraceNode[]
}
interface SampleListItem {
  sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; status: string; createdAt: string; sampleTypeName?: string
}
interface SampleLookup {
  sampleId: number; sampleNumber: string; lotNumber: string
  materialName: string; sampleTypeName: string; status: string; createdAt: string
}
interface AffectedSample {
  sampleId: number; sampleNumber: string; materialName: string
  lotNumber: string; status: string; createdAt: string; isRush: boolean
}
interface RecallResult {
  lotNumber: string; affectedSamples: AffectedSample[]; count: number
}
interface CdRecord {
  cdId: number; sampleId: number; cdType: string; cdReference: string
  description?: string; linkedOosId?: number; status: string; createdAt: string
}

// ── Colour + icon metadata ───────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#ede9fe', color: '#6d28d9' },
  PendingQAReview: { bg: '#fce7f3', color: '#9d174d' },
  Released:        { bg: '#dcfce7', color: '#166534' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
  Open:            { bg: '#fef3c7', color: '#92400e' },
  Closed:          { bg: '#dcfce7', color: '#166534' },
}

const CD_COLORS: Record<string, { bg: string; color: string }> = {
  Complaint: { bg: '#fff7ed', color: '#c2410c' },
  Deviation: { bg: '#eff6ff', color: '#1d4ed8' },
  Capa:      { bg: '#fdf4ff', color: '#6b21a8' },
}

const STATUS_DOT: Record<string, string> = {
  Registered:      '#3b82f6',
  PendingTesting:  '#f59e0b',
  InTesting:       '#8b5cf6',
  PendingQAReview: '#ec4899',
  Released:        '#10b981',
  Rejected:        '#ef4444',
}

// ── React Flow custom node ───────────────────────────────────────────────────

function TraceNodeCard({ data }: { data: { node: TraceNode; isCentral?: boolean } }) {
  const { node, isCentral } = data
  const m = NODE_META[node.nodeType] ?? NODE_META.default
  return (
    <div style={{
      border: `${isCentral ? 2.5 : 1.5}px solid ${isCentral ? '#eab308' : m.border}`,
      borderRadius: 10, padding: '10px 14px',
      background: isCentral ? '#fefce8' : m.bg,
      minWidth: 160, maxWidth: 220,
      boxShadow: isCentral ? '0 4px 14px #eab30830' : '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: m.border, width: 8, height: 8 }} />
      <div style={{ fontSize: 10, color: m.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
        {m.icon} {node.nodeType}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isCentral ? '#713f12' : m.color, lineHeight: 1.3 }}>
        {node.label}
      </div>
      {node.detail && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{node.detail}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: m.border, width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { traceNode: TraceNodeCard }

// ── Build React Flow layout ──────────────────────────────────────────────────

function buildFlow(graph: TraceGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const ROW_H = 100

  nodes.push({
    id: 'central', type: 'traceNode',
    position: { x: 420, y: 0 },
    data: { node: graph.centralSample, isCentral: true }, draggable: true,
  })

  const upY0 = -(graph.upstreamNodes.length - 1) * ROW_H / 2
  graph.upstreamNodes.forEach((n, i) => {
    const id = `up-${i}`
    nodes.push({ id, type: 'traceNode', position: { x: 80, y: upY0 + i * ROW_H }, data: { node: n }, draggable: true })
    edges.push({
      id: `e-up-${i}`, source: id, target: 'central', animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      label: 'feeds', labelStyle: { fontSize: 10, fill: '#9ca3af' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
    })
  })

  const dnY0 = -(graph.downstreamNodes.length - 1) * ROW_H / 2
  graph.downstreamNodes.forEach((n, i) => {
    const id = `dn-${i}`
    nodes.push({ id, type: 'traceNode', position: { x: 760, y: dnY0 + i * ROW_H }, data: { node: n }, draggable: true })
    edges.push({
      id: `e-dn-${i}`, source: 'central', target: id, animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
      style: { stroke: '#10b981', strokeWidth: 1.5 },
      label: 'produces', labelStyle: { fontSize: 10, fill: '#9ca3af' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
    })
  })

  const totalH = Math.max(graph.upstreamNodes.length, graph.downstreamNodes.length, 1) * ROW_H
  graph.logbookNodes.forEach((n, i) => {
    const id = `lb-${i}`
    nodes.push({ id, type: 'traceNode', position: { x: 420, y: totalH / 2 + 60 + i * ROW_H }, data: { node: n }, draggable: true })
    edges.push({
      id: `e-lb-${i}`, source: 'central', target: id, animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#86efac' },
      style: { stroke: '#86efac', strokeWidth: 1.5, strokeDasharray: '5 3' },
      label: 'logged', labelStyle: { fontSize: 10, fill: '#9ca3af' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
    })
  })

  return { nodes, edges }
}

// ── Graph panel ──────────────────────────────────────────────────────────────

function TraceGraphPanel({ graph }: { graph: TraceGraph }) {
  const { nodes: initNodes, edges: initEdges } = buildFlow(graph)
  const [nodes, , onNodesChange] = useNodesState(initNodes)
  const [edges, , onEdgesChange] = useEdgesState(initEdges)
  const total = 1 + graph.upstreamNodes.length + graph.downstreamNodes.length + graph.logbookNodes.length

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Nodes', val: total, color: '#374151' },
          { label: 'Upstream',    val: graph.upstreamNodes.length, color: '#2563eb' },
          { label: 'Downstream',  val: graph.downstreamNodes.length, color: '#10b981' },
          { label: 'Logbook',     val: graph.logbookNodes.length, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: '8px 16px', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
          Drag nodes · Scroll to zoom
        </div>
      </div>
      <div style={{ height: 440, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#f8fafc' }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.3} maxZoom={2}>
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap nodeColor={n => NODE_META[(n.data as any)?.node?.nodeType]?.border ?? '#d1d5db'}
            style={{ background: '#fff', border: '1px solid #e5e7eb' }} />
        </ReactFlow>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(NODE_META).filter(([k]) => k !== 'default').map(([type, m]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 9px', background: m.bg, border: `1px solid ${m.border}`,
            borderRadius: 20, fontSize: 11, color: m.color, fontWeight: 600 }}>
            {m.icon} {type}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chain of Custody timeline ────────────────────────────────────────────────

function ChainOfCustody({ graph }: { graph: TraceGraph }) {
  type CocRow = { phase: 'Upstream' | 'Sample' | 'Logbook' | 'Downstream'; node: TraceNode; relation: string }

  const rows: CocRow[] = [
    ...graph.upstreamNodes.map(n => ({ phase: 'Upstream' as const, node: n, relation: '→ feeds into sample' })),
    { phase: 'Sample', node: graph.centralSample, relation: '● Central sample' },
    ...graph.logbookNodes.map(n  => ({ phase: 'Logbook' as const,    node: n, relation: '→ logbook entry' })),
    ...graph.downstreamNodes.map(n => ({ phase: 'Downstream' as const, node: n, relation: '→ produced from sample' })),
  ]

  const phaseStyle: Record<string, { dot: string; border: string }> = {
    Upstream:   { dot: '#3b82f6', border: '#bfdbfe' },
    Sample:     { dot: '#eab308', border: '#fde68a' },
    Logbook:    { dot: '#22c55e', border: '#bbf7d0' },
    Downstream: { dot: '#10b981', border: '#a7f3d0' },
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: '#e5e7eb', zIndex: 0 }} />

      {rows.map((r, i) => {
        const m  = NODE_META[r.node.nodeType] ?? NODE_META.default
        const ps = phaseStyle[r.phase]
        const isCentral = r.phase === 'Sample'
        return (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, position: 'relative', zIndex: 1 }}>
            {/* Dot */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: isCentral ? '#fefce8' : m.bg,
              border: `2px solid ${isCentral ? '#eab308' : ps.dot}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, boxShadow: isCentral ? '0 0 0 3px #fef9c3' : 'none',
            }}>
              {m.icon}
            </div>
            {/* Content */}
            <div style={{
              flex: 1, padding: '8px 14px', borderRadius: 8,
              background: isCentral ? '#fefce8' : '#fafafa',
              border: `1px solid ${isCentral ? '#fde68a' : ps.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.6, color: m.color, background: m.bg,
                  padding: '1px 7px', borderRadius: 10, border: `1px solid ${m.border}` }}>
                  {m.icon} {r.node.nodeType}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{r.relation}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: isCentral ? 800 : 600, color: '#111827', marginTop: 4 }}>
                {r.node.label}
              </div>
              {r.node.detail && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.node.detail}</div>
              )}
            </div>
          </div>
        )
      })}

      {rows.length === 1 && (
        <div style={{ marginLeft: 46, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
          No upstream or downstream nodes found — sample has not been tested yet.
        </div>
      )}
    </div>
  )
}

// ── Shared UI helpers ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
  overflow: 'hidden', marginBottom: 16,
}
const cardHeaderBase: React.CSSProperties = {
  padding: '13px 20px', borderBottom: '1px solid #f3f4f6', background: '#fafafa',
}
const inp: React.CSSProperties = {
  padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13,
  outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const lbl: React.CSSProperties = {
  fontSize: 12, color: '#374151', display: 'block', marginBottom: 4, fontWeight: 600,
}

function SectionCard({ title, subtitle, accent = '#2563eb', children }:
  { title: string; subtitle?: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={{ ...cardHeaderBase, borderLeft: `4px solid ${accent}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  )
}

function PrimaryBtn({ onClick, disabled, color = '#2563eb', children }:
  { onClick?: () => void; disabled?: boolean; color?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button"
      style={{ padding: '8px 20px', background: disabled ? '#9ca3af' : color,
        color: '#fff', border: 'none', borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

// ── Left-panel sample list ───────────────────────────────────────────────────

function SampleListPanel({
  samples, loading, selectedId, searchQ, onSearchChange, onSelect,
}: {
  samples: SampleListItem[]
  loading: boolean
  selectedId: number | null
  searchQ: string
  onSearchChange: (v: string) => void
  onSelect: (s: SampleListItem) => void
}) {
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase()
    if (!q) return samples
    return samples.filter(s =>
      s.sampleNumber.toLowerCase().includes(q) ||
      s.materialName.toLowerCase().includes(q) ||
      s.lotNumber.toLowerCase().includes(q)
    )
  }, [samples, searchQ])

  return (
    <div style={{
      width: 300, minWidth: 280, flexShrink: 0,
      background: '#fff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 188px)',
    }}>
      {/* Panel header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Samples
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>
            {filtered.length} of {samples.length}
          </span>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>🔍</span>
          <input
            style={{ ...inp, width: '100%', paddingLeft: 28, fontSize: 12, padding: '6px 10px 6px 28px' }}
            placeholder="Sample number, material, lot…"
            value={searchQ} onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading samples…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No samples found</div>
        ) : (
          filtered.map(s => {
            const isSelected = s.sampleId === selectedId
            const dot = STATUS_DOT[s.status] ?? '#9ca3af'
            return (
              <div
                key={s.sampleId}
                onClick={() => onSelect(s)}
                style={{
                  padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                  background: isSelected ? '#eff6ff' : '#fff',
                  borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
              >
                {/* Sample number row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                    color: isSelected ? '#1d4ed8' : '#1e40af',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170,
                  }}>
                    {s.sampleNumber}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280', flexShrink: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block' }} />
                    {s.status}
                  </span>
                </div>
                {/* Material */}
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2, fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.materialName}
                </div>
                {/* Lot */}
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, fontFamily: 'monospace' }}>
                  {s.lotNumber}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Right panel empty state ───────────────────────────────────────────────────

function RightPanelEmpty() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 48, background: '#fafafa' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>🔗</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
        Select a sample to view its complete trace
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>
        Choose any sample from the list on the left
      </div>
      {/* What you'll see cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 520, width: '100%' }}>
        {[
          { icon: '📋', title: 'Summary',          desc: 'Status, material, lot number, sample type' },
          { icon: '🕓', title: 'Chain of Custody', desc: 'Upstream → sample → downstream timeline' },
          { icon: '🔗', title: 'Visual Graph',     desc: 'Interactive ReactFlow lineage diagram' },
          { icon: '⚠️', title: 'C&D / Recall',     desc: 'Complaints, deviations, recall scope' },
        ].map(c => (
          <div key={c.title} style={{ background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  const canRecall  = ['Admin', 'QA'].includes(role)
  const canLogCd   = ['Admin', 'QA', 'QCLead'].includes(role)
  const canCloseCd = ['Admin', 'QA'].includes(role)

  const [tab, setTab] = useState<'graph' | 'recall' | 'cd'>('graph')

  // ── Left panel sample list ──────────────────────────────────────────────
  const [sampleList, setSampleList]     = useState<SampleListItem[]>([])
  const [listLoading, setListLoading]   = useState(false)
  const [listSearch, setListSearch]     = useState('')
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null)

  // ── Sample Trace / right panel state ───────────────────────────────────
  const [resolved, setResolved]         = useState<SampleLookup | null>(null)
  const [graph, setGraph]               = useState<TraceGraph | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError]     = useState('')
  const [activeView, setActiveView]     = useState<'coc' | 'graph'>('coc')
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Recall state ────────────────────────────────────────────────────────
  const [recallLot, setRecallLot]         = useState('')
  const [recallResult, setRecallResult]   = useState<RecallResult | null>(null)
  const [recallLoading, setRecallLoading] = useState(false)
  const [recallError, setRecallError]     = useState('')

  // ── C&D state ───────────────────────────────────────────────────────────
  const [cdList, setCdList]               = useState<CdRecord[]>([])
  const [cdLoading, setCdLoading]         = useState(false)
  const [showCdForm, setShowCdForm]       = useState(false)
  const [cdForm, setCdForm]               = useState({ sampleId: '', cdType: '', cdReference: '', description: '', linkedOosId: '' })
  const [cdSaving, setCdSaving]           = useState(false)
  const [cdError, setCdError]             = useState('')
  const [cdToast, setCdToast]             = useState('')
  const [closingId, setClosingId]         = useState<number | null>(null)

  // Load sample list on mount
  useEffect(() => {
    setListLoading(true)
    api.get('/samples')
      .then(r => setSampleList(r.data ?? []))
      .catch(() => setSampleList([]))
      .finally(() => setListLoading(false))
  }, [])

  useEffect(() => { if (tab === 'cd') loadCdList() }, [tab])

  // ── Load trace when a sample is selected from left panel ────────────────
  async function loadTrace(item: SampleListItem) {
    setSelectedSampleId(item.sampleId)
    setGraphLoading(true); setGraphError(''); setGraph(null)
    // Build resolved from list item (avoids extra lookup roundtrip)
    setResolved({
      sampleId:       item.sampleId,
      sampleNumber:   item.sampleNumber,
      lotNumber:      item.lotNumber,
      materialName:   item.materialName,
      sampleTypeName: item.sampleTypeName ?? '—',
      status:         item.status,
      createdAt:      item.createdAt,
    })
    try {
      const graphRes = await api.get(`/traceability/samples/${item.sampleId}/graph`)
      setGraph(graphRes.data)
    } catch (err: any) {
      setGraphError(err.friendlyMessage ?? err.response?.data?.message ?? 'Failed to load trace.')
    } finally { setGraphLoading(false) }
  }

  // ── Recall ──────────────────────────────────────────────────────────────
  async function handleRecall() {
    if (!recallLot.trim()) return
    setRecallLoading(true); setRecallResult(null); setRecallError('')
    try {
      const r = await api.get(`/traceability/recall?lotNumber=${encodeURIComponent(recallLot.trim())}`)
      setRecallResult(r.data)
    } catch (err: any) {
      setRecallError(err.friendlyMessage ?? 'Recall query failed.')
    } finally { setRecallLoading(false) }
  }

  // ── C&D ─────────────────────────────────────────────────────────────────
  async function loadCdList() {
    setCdLoading(true)
    try { const r = await api.get('/traceability/complaints-deviations'); setCdList(r.data ?? []) }
    catch { setCdList([]) }
    finally { setCdLoading(false) }
  }

  async function submitCd() {
    if (!cdForm.sampleId || !cdForm.cdType || !cdForm.cdReference) {
      setCdError('Sample ID, Type and Reference are required.'); return
    }
    setCdSaving(true); setCdError('')
    try {
      const body: Record<string, unknown> = {
        sampleId: Number(cdForm.sampleId), cdType: cdForm.cdType, cdReference: cdForm.cdReference,
      }
      if (cdForm.description.trim())  body.description = cdForm.description.trim()
      if (cdForm.linkedOosId.trim())  body.linkedOosId = Number(cdForm.linkedOosId)
      await api.post('/traceability/complaints-deviations', body)
      setCdForm({ sampleId: '', cdType: '', cdReference: '', description: '', linkedOosId: '' })
      setShowCdForm(false)
      showCdToast('Record logged successfully.')
      loadCdList()
    } catch (err: any) { setCdError(err.friendlyMessage ?? err.response?.data?.message ?? 'Failed to log record.') }
    finally { setCdSaving(false) }
  }

  async function closeCd(id: number) {
    setClosingId(id)
    try {
      await api.put(`/traceability/complaints-deviations/${id}/close`)
      showCdToast('Record closed successfully.')
      loadCdList()
    } catch (err: any) { showCdToast(err.friendlyMessage ?? 'Failed to close record.') }
    finally { setClosingId(null) }
  }

  function showCdToast(msg: string) { setCdToast(msg); setTimeout(() => setCdToast(''), 3500) }

  // Navigate from Recall/CD tables to Sample Trace
  function jumpToSample(sampleId: number) {
    const item = sampleList.find(s => s.sampleId === sampleId)
    if (item) { setTab('graph'); loadTrace(item) }
  }

  const TABS = [
    { key: 'graph',  label: '🔗 Sample Trace' },
    { key: 'recall', label: '🚨 Recall Scope' },
    { key: 'cd',     label: '📋 Complaints & Deviations' },
  ] as const

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Traceability</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          Bidirectional sample lineage · Recall scope · Complaints &amp; Deviations — 21 CFR Part 11 INSERT-only audit chain.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e5e7eb', marginBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, border: 'none',
              cursor: 'pointer', background: 'transparent',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t.key ? '#2563eb' : '#6b7280',
              marginBottom: -2, borderRadius: '4px 4px 0 0', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — Sample Trace (split-panel layout)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'graph' && (
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden', background: '#fff' }}>

          {/* LEFT PANEL — sample browser */}
          <SampleListPanel
            samples={sampleList}
            loading={listLoading}
            selectedId={selectedSampleId}
            searchQ={listSearch}
            onSearchChange={setListSearch}
            onSelect={loadTrace}
          />

          {/* RIGHT PANEL — trace detail */}
          <div style={{ flex: 1, overflowY: 'auto', height: 'calc(100vh - 188px)', background: '#fafafa' }}>
            {!resolved && !graphLoading && !graphError && <RightPanelEmpty />}

            {graphLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
                ⏳ Loading trace…
              </div>
            )}

            {graphError && !graphLoading && (
              <div style={{ margin: 24, background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#dc2626' }}>
                ⚠ {graphError}
              </div>
            )}

            {resolved && !graphLoading && (
              <div style={{ padding: '20px 24px' }}>

                {/* Sample context header */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: '4px solid #eab308',
                  borderRadius: 10, padding: '14px 20px', marginBottom: 16,
                  display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sample Number</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>{resolved.sampleNumber}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Material</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{resolved.materialName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lot Number</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{resolved.lotNumber}</div>
                  </div>
                  {resolved.sampleTypeName && resolved.sampleTypeName !== '—' && (
                    <div>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sample Type</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{resolved.sampleTypeName}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
                    <div style={{ marginTop: 2 }}><StatusBadge status={resolved.status} /></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Registered</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{new Date(resolved.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>

                {/* Lineage panel with view toggle */}
                {graph && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ ...cardHeaderBase, borderLeft: '4px solid #2563eb',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                          Sample Lineage — {resolved.sampleNumber}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          Upstream (lot · analyst · instrument) → sample → downstream (CoA · C&amp;D)
                        </div>
                      </div>
                      {/* View toggle */}
                      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 7, padding: 3, gap: 2 }}>
                        {(['coc', 'graph'] as const).map(v => (
                          <button key={v} onClick={() => setActiveView(v)}
                            style={{ padding: '5px 14px', borderRadius: 5, border: 'none',
                              cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                              background: activeView === v ? '#fff' : 'transparent',
                              color: activeView === v ? '#2563eb' : '#6b7280',
                              boxShadow: activeView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                            {v === 'coc' ? '📋 Chain of Custody' : '🔗 Visual Graph'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ padding: '18px 20px' }}>
                      {activeView === 'coc' ? <ChainOfCustody graph={graph} /> : <TraceGraphPanel graph={graph} />}
                    </div>
                  </div>
                )}

                {/* No graph yet (lookup resolved but graph not loaded) */}
                {!graph && !graphError && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                    padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                    <div style={{ fontSize: 13 }}>Graph data unavailable for this sample.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — Recall Scope
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'recall' && !canRecall && (
        <div style={{ textAlign: 'center', padding: '52px 24px', background: '#fff',
          border: '1px solid #fca5a5', borderRadius: '0 0 10px 10px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>Access Restricted</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Recall scope queries are restricted to <strong>Admin</strong> and <strong>QA</strong> roles.
          </div>
        </div>
      )}

      {tab === 'recall' && canRecall && (
        <div style={{ padding: '20px 0' }}>
          <SectionCard title="Recall Scope Query" accent="#dc2626"
            subtitle="From a lot number, instantly determine all affected downstream samples — for regulatory inspection (21 CFR 211.192).">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 280px' }}>
                <label style={lbl}>Lot Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input style={{ ...inp, width: '100%' }} value={recallLot}
                  onChange={e => setRecallLot(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRecall()}
                  placeholder="e.g. LOT-2026-001" />
              </div>
              <PrimaryBtn onClick={handleRecall} disabled={recallLoading || !recallLot.trim()} color="#dc2626">
                {recallLoading ? '⏳ Querying…' : '🚨 Query Recall Scope'}
              </PrimaryBtn>
              {recallResult && (
                <button onClick={() => { setRecallResult(null); setRecallLot('') }}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#6b7280',
                    border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  ✕ Clear
                </button>
              )}
            </div>
            {recallError && (
              <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#dc2626' }}>
                ⚠ {recallError}
              </div>
            )}
          </SectionCard>

          {recallResult && (
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #fca5a5',
                background: recallResult.count > 0 ? '#fef2f2' : '#f0fdf4',
                display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 24 }}>{recallResult.count > 0 ? '🚨' : '✅'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700,
                    color: recallResult.count > 0 ? '#991b1b' : '#166534' }}>
                    Recall scope for lot <span style={{ fontFamily: 'monospace' }}>"{recallResult.lotNumber}"</span>
                  </div>
                  <div style={{ fontSize: 12, color: recallResult.count > 0 ? '#7f1d1d' : '#14532d', marginTop: 2 }}>
                    {recallResult.count > 0
                      ? `${recallResult.count} affected sample${recallResult.count !== 1 ? 's' : ''} — quarantine and investigate`
                      : 'No downstream samples affected by this lot'}
                  </div>
                </div>
              </div>

              {recallResult.count > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                        {['#', 'Sample Number', 'Material', 'Lot Number', 'Status', 'Registered', 'Action'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11,
                            fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recallResult.affectedSamples.map((s, i) => (
                        <tr key={s.sampleId} style={{ borderBottom: '1px solid #fee2e2',
                          background: i % 2 === 0 ? '#fff' : '#fff5f5' }}>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#991b1b', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <button onClick={() => jumpToSample(s.sampleId)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}>
                              {s.sampleNumber}
                            </button>
                            {s.isRush && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>RUSH</span>}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{s.materialName}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{s.lotNumber}</td>
                          <td style={{ padding: '9px 14px' }}><StatusBadge status={s.status} /></td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {new Date(s.createdAt).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>🔴 Quarantine</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — Complaints & Deviations
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'cd' && (
        <div style={{ padding: '20px 0' }}>
          {cdToast && (
            <div style={{ marginBottom: 14, background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#166534', fontWeight: 600 }}>
              ✓ {cdToast}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              INSERT-only records (21 CFR Part 11) — cannot be edited or deleted after submission.
            </div>
            {canLogCd ? (
              <PrimaryBtn onClick={() => { setShowCdForm(v => !v); setCdError('') }}
                color={showCdForm ? '#6b7280' : '#2563eb'}>
                {showCdForm ? '✕ Cancel' : '+ Log New Record'}
              </PrimaryBtn>
            ) : (
              <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>🔒 Admin / QA / QCLead only</span>
            )}
          </div>

          {showCdForm && (
            <SectionCard title="Log Complaint / Deviation / CAPA" accent="#7c3aed"
              subtitle="Submit a new record linked to a sample. All fields are permanently audit-logged.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Sample ID <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inp, width: '100%' }} type="number" placeholder="Numeric sample ID"
                    value={cdForm.sampleId} onChange={e => setCdForm(f => ({ ...f, sampleId: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Type <span style={{ color: '#ef4444' }}>*</span></label>
                  <select style={{ ...inp, width: '100%' }} value={cdForm.cdType}
                    onChange={e => setCdForm(f => ({ ...f, cdType: e.target.value }))}>
                    <option value="">— Select type —</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Deviation">Deviation</option>
                    <option value="Capa">CAPA</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Reference <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inp, width: '100%' }} placeholder="e.g. CD-2026-001"
                    value={cdForm.cdReference} onChange={e => setCdForm(f => ({ ...f, cdReference: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Linked OOS ID <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                  <input style={{ ...inp, width: '100%' }} type="number" placeholder="OOS investigation ID"
                    value={cdForm.linkedOosId} onChange={e => setCdForm(f => ({ ...f, linkedOosId: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Description <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...inp, width: '100%', minHeight: 76, resize: 'vertical' }}
                  placeholder="Describe the complaint, deviation, or CAPA action in detail…"
                  value={cdForm.description} onChange={e => setCdForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {cdError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7,
                  padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
                  ⚠ {cdError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryBtn onClick={submitCd} disabled={cdSaving} color="#7c3aed">
                  {cdSaving ? '⏳ Saving…' : '✓ Submit Record'}
                </PrimaryBtn>
                <button onClick={() => { setShowCdForm(false); setCdError('') }}
                  style={{ padding: '8px 16px', background: 'transparent', color: '#6b7280',
                    border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Complaints, Deviations & CAPA Register"
            subtitle="All logged quality events linked to samples. INSERT-only — 21 CFR Part 11 compliant.">
            {cdLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>Loading records…</div>
            ) : cdList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No records yet</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Click "+ Log New Record" to create the first entry.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      {['CD ID', 'Sample ID', 'Type', 'Reference', 'Description', 'Linked OOS', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11,
                          fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                          letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cdList.map((cd, i) => {
                      const tc = CD_COLORS[cd.cdType] ?? { bg: '#f1f5f9', color: '#475569' }
                      return (
                        <tr key={cd.cdId}
                          style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#2563eb' }}>#{cd.cdId}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <button onClick={() => jumpToSample(cd.sampleId)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}>
                              #{cd.sampleId}
                            </button>
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: tc.bg, color: tc.color }}>
                              {cd.cdType === 'Capa' ? 'CAPA' : cd.cdType}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
                            {cd.cdReference}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b7280', maxWidth: 200 }}>
                            {cd.description
                              ? <span title={cd.description}>{cd.description.length > 60 ? cd.description.slice(0, 60) + '…' : cd.description}</span>
                              : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 13, color: '#6b7280' }}>
                            {cd.linkedOosId ? `#${cd.linkedOosId}` : '—'}
                          </td>
                          <td style={{ padding: '9px 14px' }}><StatusBadge status={cd.status} /></td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {new Date(cd.createdAt).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            {cd.status === 'Open' && canCloseCd ? (
                              <button onClick={() => closeCd(cd.cdId)} disabled={closingId === cd.cdId}
                                style={{ padding: '4px 12px',
                                  background: closingId === cd.cdId ? '#9ca3af' : '#16a34a',
                                  color: '#fff', border: 'none', borderRadius: 5,
                                  cursor: closingId === cd.cdId ? 'not-allowed' : 'pointer',
                                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                                {closingId === cd.cdId ? 'Closing…' : '✓ Close'}
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                {cd.status === 'Open' ? '🔒' : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
