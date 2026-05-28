import { useState } from 'react'
import api from '@/api/client'
import { inp } from './master-data/LaboratoriesPage'

interface TraceNode {
  nodeType: string; nodeId: number; label: string; detail: string | null
}
interface TraceGraph {
  centralSample: TraceNode
  upstreamNodes: TraceNode[]
  downstreamNodes: TraceNode[]
  logbookNodes: TraceNode[]
}

const NODE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  MaterialLot:          { bg: '#eff6ff', border: '#3b82f6', color: '#1e40af' },
  SamplingEvent:        { bg: '#f0fdf4', border: '#22c55e', color: '#166534' },
  Analyst:              { bg: '#fdf4ff', border: '#a855f7', color: '#6b21a8' },
  Instrument:           { bg: '#fff7ed', border: '#f97316', color: '#9a3412' },
  TestExecution:        { bg: '#f8fafc', border: '#94a3b8', color: '#334155' },
  Sample:               { bg: '#fef9c3', border: '#eab308', color: '#713f12' },
  LogbookEntry:         { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
  CoA:                  { bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
  ComplaintsDeviation:  { bg: '#fff1f2', border: '#f43f5e', color: '#9f1239' },
  default:              { bg: '#f9fafb', border: '#d1d5db', color: '#374151' },
}

function NodeCard({ node }: { node: TraceNode }) {
  const c = NODE_COLORS[node.nodeType] ?? NODE_COLORS.default
  return (
    <div style={{ border: `1.5px solid ${c.border}`, borderRadius: 8, padding: '8px 12px', background: c.bg, marginBottom: 6, maxWidth: 280 }}>
      <div style={{ fontSize: 10, color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{node.nodeType}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.color, marginTop: 2 }}>{node.label}</div>
      {node.detail && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{node.detail}</div>}
    </div>
  )
}

export default function TraceabilityPage() {
  const [sampleId, setSampleId]   = useState('')
  const [graph, setGraph]         = useState<TraceGraph | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [recallLot, setRecallLot] = useState('')
  const [recallResult, setRecallResult] = useState<{ lotNumber: string; affectedSampleIds: number[]; count: number } | null>(null)
  const [recallLoading, setRecallLoading] = useState(false)

  async function loadGraph() {
    if (!sampleId) return
    setLoading(true); setError(''); setGraph(null)
    try {
      const r = await api.get(`/traceability/samples/${sampleId}/graph`)
      setGraph(r.data)
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed to load traceability graph') }
    finally { setLoading(false) }
  }

  async function loadRecall() {
    if (!recallLot) return
    setRecallLoading(true); setRecallResult(null)
    try {
      const r = await api.get(`/traceability/recall?lotNumber=${encodeURIComponent(recallLot)}`)
      setRecallResult(r.data)
    } catch { }
    finally { setRecallLoading(false) }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Traceability</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Bidirectional graph: upstream (lot, sampling event, analyst, instrument) ↔ central sample ↔ downstream (CoA, complaints/deviations).
        Every query logged INSERT-only (21 CFR Part 11).
      </p>

      {/* Sample Graph Search */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Sample Traceability Graph</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Sample ID</label>
            <input style={{ ...inp, width: 120 }} type="number" value={sampleId}
              onChange={e => setSampleId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadGraph()}
              placeholder="Enter sample ID" />
          </div>
          <button onClick={loadGraph} disabled={loading || !sampleId}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {loading ? 'Loading…' : 'Load Graph'}
          </button>
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {graph && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Traceability Graph</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* Upstream */}
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                ← Upstream ({graph.upstreamNodes.length})
              </h3>
              {graph.upstreamNodes.map((n, i) => <NodeCard key={i} node={n} />)}
            </div>
            {/* Central + Logbook */}
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Central Sample
              </h3>
              <NodeCard node={graph.centralSample} />
              {graph.logbookNodes.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>
                    Logbook Rows ({graph.logbookNodes.length})
                  </h3>
                  {graph.logbookNodes.map((n, i) => <NodeCard key={i} node={n} />)}
                </>
              )}
            </div>
            {/* Downstream */}
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Downstream → ({graph.downstreamNodes.length})
              </h3>
              {graph.downstreamNodes.length === 0
                ? <p style={{ fontSize: 13, color: '#9ca3af' }}>No downstream nodes yet.</p>
                : graph.downstreamNodes.map((n, i) => <NodeCard key={i} node={n} />)
              }
            </div>
          </div>
        </div>
      )}

      {/* Recall Scope Query */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Recall Scope Query (QA / Admin)</h2>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          From a lot number, determine all affected downstream sample IDs — result in seconds for regulatory inspection (FR-12).
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Lot Number</label>
            <input style={{ ...inp, width: 200 }} value={recallLot} onChange={e => setRecallLot(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadRecall()} placeholder="e.g. LOT-2026-001" />
          </div>
          <button onClick={loadRecall} disabled={recallLoading || !recallLot}
            style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: recallLoading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {recallLoading ? 'Querying…' : 'Recall Scope'}
          </button>
        </div>
        {recallResult && (
          <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
              Recall scope for Lot "{recallResult.lotNumber}": <strong>{recallResult.count} affected sample(s)</strong>
            </p>
            {recallResult.count > 0 && (
              <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>
                Sample IDs: {recallResult.affectedSampleIds.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
