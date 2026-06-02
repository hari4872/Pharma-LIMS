import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'

// Module-level cache — survives re-renders, cleared on page refresh
const _cache = new Map<number, SampleDetail>()

interface SampleDetail {
  sampleId: number; sampleNumber: string; lotNumber: string
  materialId: number; materialName: string; sampleTypeName: string
  status: string; isRush: boolean; barcodePrinted: boolean
  createdAt: string; dueDate: string | null
  sampleCondition: string | null; externalBatchId: string | null
  specTemplateName: string | null; specTemplateId: number | null
  testExecutions: {
    executionId: number; status: string; analystName: string
    instrumentCode: string; priorityScore: number | null
    startedAt: string | null; completedAt: string | null; dueDate: string | null
  }[]
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
  Assigned:        { bg: '#dbeafe', color: '#1e40af' },
  InProgress:      { bg: '#fef9c3', color: '#854d0e' },
  Completed:       { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:         { bg: '#fee2e2', color: '#991b1b' },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

interface Props {
  sampleId: number
  onClose: () => void
  onStartTask?: (executionId: number) => void
}

export default function SampleDetailSheet({ sampleId, onClose, onStartTask }: Props) {
  const [detail, setDetail]   = useState<SampleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      // Serve from cache instantly if available
      if (_cache.has(sampleId)) {
        setDetail(_cache.get(sampleId)!)
        setLoading(false)
        return
      }
      setLoading(true)
      api.get(`/samples/${sampleId}`)
        .then(r => { _cache.set(sampleId, r.data); setDetail(r.data) })
        .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to load sample details.')))
        .finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(t)
  }, [sampleId])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
              {detail?.sampleNumber ?? 'Loading…'}
            </h3>
            {detail && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{detail.materialName}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background: '#f1f5f9', borderRadius: 7, padding: '10px 14px', animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <div style={{ height: 10, width: '40%', background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 14, width: '70%', background: '#e2e8f0', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
              <div style={{ height: 13, width: '30%', background: '#e2e8f0', borderRadius: 4, marginBottom: 10 }} />
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ height: 12, width: '60%', background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 11, width: '80%', background: '#f1f5f9', borderRadius: 4 }} />
              </div>
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.55} }`}</style>
            </div>
          )}
          {error && <p style={{ color: '#ef4444' }}>{error}</p>}

          {detail && (
            <>
              {/* Sample info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  ['Material',     detail.materialName],
                  ['Sample Type',  detail.sampleTypeName],
                  ['Lot / Batch',  detail.lotNumber || '—'],
                  ['Status',       null],
                  ['Registered',   new Date(detail.createdAt).toLocaleDateString()],
                  ['Due Date',     detail.dueDate ? new Date(detail.dueDate).toLocaleDateString() : '—'],
                  ['Spec Template',detail.specTemplateName ?? '⚠ None assigned'],
                  ['Condition',    detail.sampleCondition ?? 'OK'],
                  ...(detail.externalBatchId ? [['External Batch', detail.externalBatchId]] : []),
                ].map(([k, v]) => (
                  <div key={k as string} style={{ background: '#f8fafc', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k}</div>
                    {k === 'Status'
                      ? <Badge status={detail.status} />
                      : <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{v as string}</div>
                    }
                  </div>
                ))}
                {detail.isRush && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>🚨 RUSH SAMPLE</div>
                    <div style={{ fontSize: 11, color: '#92400e' }}>Priority processing required</div>
                  </div>
                )}
              </div>

              {/* Test Executions */}
              {detail.testExecutions.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Test Executions ({detail.testExecutions.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.testExecutions.map(e => (
                      <div key={e.executionId} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', background: '#fff'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>#{e.executionId}</span>
                            <Badge status={e.status} />
                            {e.priorityScore !== null && (
                              <span style={{ fontSize: 11, fontWeight: 700, background: e.priorityScore === 1 ? '#fee2e2' : '#f3f4f6', color: e.priorityScore === 1 ? '#991b1b' : '#374151', padding: '1px 6px', borderRadius: 4 }}>
                                P{e.priorityScore}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                            👤 {e.analystName} · 🔬 {e.instrumentCode}
                            {e.startedAt && <span> · Started: {new Date(e.startedAt).toLocaleTimeString()}</span>}
                            {e.completedAt && <span> · Completed: {new Date(e.completedAt).toLocaleTimeString()}</span>}
                          </div>
                        </div>
                        {onStartTask && e.status === 'Assigned' && (
                          <button onClick={() => { onClose(); onStartTask(e.executionId) }}
                            style={{ padding: '5px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ▶ Start
                          </button>
                        )}
                        {e.status === 'InProgress' && (
                          <a href={`/test-execution/${e.executionId}`}
                            style={{ padding: '5px 14px', background: '#7c3aed', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            📋 Enter Results
                          </a>
                        )}
                        {(e.status === 'Completed' || e.status === 'OOSOpen') && (
                          <a href={`/test-execution/${e.executionId}`}
                            style={{ padding: '5px 14px', background: '#f0fdf4', color: '#065f46', border: '1px solid #86efac', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            🔍 View Results
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.testExecutions.length === 0 && (
                <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                  ⚠ No test executions assigned yet. Assign from Work Queue → Assign Task.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
