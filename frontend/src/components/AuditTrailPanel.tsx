/**
 * Slide-out audit trail panel — 21 CFR Part 11 §11.10(e)
 * Shows who created / modified / approved a record and when.
 * Usage: <AuditTrailPanel entity="Laboratory" entityId={3} entityLabel="Main QC Lab" onClose={fn} />
 */
import { useEffect, useState } from 'react'
import api from '@/api/client'

interface AuditEvent {
  eventId:    number
  eventType:  string
  changedBy:  string
  changedAt:  string
  fieldName?: string
  oldValue?:  string
  newValue?:  string
  reason?:    string
  ipAddress?: string
}

interface Props {
  entity:      string
  entityId:    number
  entityLabel: string
  onClose:     () => void
}

const EVENT_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  Created:   { bg: '#d1fae5', color: '#065f46', icon: '✦' },
  Updated:   { bg: '#dbeafe', color: '#1e40af', icon: '✎' },
  Approved:  { bg: '#f0fdfa', color: '#0d6e6e', icon: '✓' },
  Rejected:  { bg: '#fee2e2', color: '#991b1b', icon: '✗' },
  Signed:    { bg: '#f3e8ff', color: '#6d28d9', icon: '✍' },
  Deleted:   { bg: '#fee2e2', color: '#991b1b', icon: '🗑' },
  Activated: { bg: '#d1fae5', color: '#065f46', icon: '▶' },
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditTrailPanel({ entity, entityId, entityLabel, onClose }: Props) {
  const [events,  setEvents]  = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true); setError('')
      api.get(`/audit/${entity}/${entityId}`)
        .then(r => setEvents(r.data))
        .catch(() => setError('Audit trail not available for this record.'))
        .finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(t)
  }, [entity, entityId])

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 200, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.14)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#0d6e6e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Audit Trail</h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{entity}</span> · {entityLabel}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>21 CFR Part 11 — immutable record</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                    <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '60%' }} />
                    <div style={{ height: 10, borderRadius: 4, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <svg viewBox="0 0 64 64" fill="none" width="56" height="56" style={{ margin: '0 auto 12px', display: 'block' }}>
                <circle cx="32" cy="32" r="26" stroke="#e2e8f0" strokeWidth="2.5"/>
                <path d="M32 22v12M32 40h.01" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{error}</p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Audit logging may not be configured for this entity type.</p>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <svg viewBox="0 0 64 64" fill="none" width="56" height="56" style={{ margin: '0 auto 12px', display: 'block' }}>
                <rect x="14" y="10" width="36" height="44" rx="5" stroke="#e2e8f0" strokeWidth="2.5"/>
                <path d="M22 24h20M22 32h20M22 40h12" stroke="#e9ecef" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"/>
              </svg>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No audit events recorded yet.</p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 1.5, background: '#f1f5f9' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {events.map((ev, i) => {
                  const style = EVENT_STYLE[ev.eventType] ?? { bg: '#f3f4f6', color: '#374151', icon: '●' }
                  return (
                    <div key={ev.eventId} style={{ display: 'flex', gap: 12, paddingBottom: i < events.length - 1 ? 20 : 0, position: 'relative' }}>
                      {/* Icon badge */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: style.bg, color: style.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, position: 'relative', zIndex: 1,
                        border: '2px solid #fff',
                      }}>
                        {style.icon}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, paddingTop: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{ev.eventType}</span>
                            {ev.fieldName && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>· {ev.fieldName}</span>}
                          </div>
                          <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginTop: 1 }}>{timeAgo(ev.changedAt)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>by <strong>{ev.changedBy}</strong></div>
                        {(ev.oldValue || ev.newValue) && (
                          <div style={{ marginTop: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                            {ev.oldValue && <div style={{ fontSize: 11, color: '#9ca3af' }}>Before: <span style={{ color: '#6b7280', textDecoration: 'line-through' }}>{ev.oldValue}</span></div>}
                            {ev.newValue && <div style={{ fontSize: 11, color: '#374151', marginTop: ev.oldValue ? 2 : 0 }}>After: <strong style={{ color: '#0d6e6e' }}>{ev.newValue}</strong></div>}
                          </div>
                        )}
                        {ev.reason && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>"{ev.reason}"</div>
                        )}
                        {ev.ipAddress && (
                          <div style={{ marginTop: 3, fontSize: 10, color: '#9ca3af' }}>IP: {ev.ipAddress}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {!loading && !error && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{events.length} event{events.length !== 1 ? 's' : ''} recorded</span>
            )}
            <button onClick={onClose} style={{ marginLeft: 'auto', padding: '6px 16px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151', fontFamily: 'inherit' }}>
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </>
  )
}
