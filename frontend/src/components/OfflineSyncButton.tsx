// ─────────────────────────────────────────────────────────────────────────────
// OfflineSyncButton.tsx
// Topbar component: offline indicator + queue count badge + Sync Now button.
// Opens a review modal so the analyst can see exactly what will be sent before
// confirming — satisfies pharma requirement for informed submission.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import type { OfflineSyncState } from '@/hooks/useOfflineSync'
import type { QueueItem } from '@/utils/offlineQueue'
import * as queue from '@/utils/offlineQueue'

interface Props {
  sync: OfflineSyncState
  dm:   boolean
}

export default function OfflineSyncButton({ sync, dm }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [results,   setResults]   = useState<Array<{ queueId: string; description: string; ok: boolean; error?: string }>>([])
  const [done,      setDone]      = useState(false)

  // Refresh queue count whenever offline write happens
  useEffect(() => {
    function onQueued() { sync.refreshQueue() }
    window.addEventListener('lims:offline:queued', onQueued)
    return () => window.removeEventListener('lims:offline:queued', onQueued)
  }, [sync])

  const hasItems = sync.queueCount > 0

  // ── Nothing to show if online AND no queued items ─────────────────────────
  if (sync.isOnline && !hasItems) return null

  async function handleSync() {
    setSyncing(true)
    setDone(false)
    const res = await sync.syncAll()
    setResults(res.items)
    setDone(true)
    setSyncing(false)
    if (res.failed === 0) setTimeout(() => setModalOpen(false), 1800)
  }

  async function handleRetry() {
    await sync.retryFailed()
    setResults([])
    setDone(false)
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  return (
    <>
      {/* ── Topbar pill ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Online / Offline dot */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          border: `1px solid ${sync.isOnline ? (dm ? '#166534' : '#bbf7d0') : (dm ? '#7f1d1d' : '#fecaca')}`,
          borderRadius: 20,
          background: sync.isOnline ? (dm ? '#052e16' : '#f0fdf4') : (dm ? '#450a0a' : '#fef2f2'),
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: sync.isOnline ? '#22c55e' : '#ef4444',
            boxShadow: sync.isOnline ? '0 0 5px #22c55e' : '0 0 5px #ef4444',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: sync.isOnline ? (dm ? '#86efac' : '#15803d') : (dm ? '#fca5a5' : '#dc2626'),
          }}>
            {sync.isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Sync button — shown when there are queued items */}
        {hasItems && (
          <button
            onClick={() => { setModalOpen(true); setDone(false); setResults([]) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              border: `1px solid ${sync.failedCount > 0 ? '#fecaca' : '#fed7aa'}`,
              borderRadius: 20,
              background: sync.failedCount > 0 ? '#fef2f2' : '#fff7ed',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = sync.failedCount > 0 ? '#fee2e2' : '#ffedd5')}
            onMouseLeave={e => (e.currentTarget.style.background = sync.failedCount > 0 ? '#fef2f2' : '#fff7ed')}
          >
            {/* Upload icon */}
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                stroke={sync.failedCount > 0 ? '#dc2626' : '#ea580c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: sync.failedCount > 0 ? '#dc2626' : '#ea580c' }}>
              Sync Now
            </span>
            {/* Badge */}
            <span style={{
              background: sync.failedCount > 0 ? '#dc2626' : '#ea580c',
              color: '#fff', fontSize: 10, fontWeight: 700,
              borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
            }}>
              {sync.queueCount}
            </span>
          </button>
        )}
      </div>

      {/* ── Review & Sync Modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111111' }}>
                  Offline Sync Queue
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#5f6368' }}>
                  {sync.pendingCount} pending · {sync.failedCount} failed · Review before syncing
                </p>
              </div>
              <button onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
            </div>

            {/* Compliance notice */}
            <div style={{ padding: '10px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                <strong>21 CFR Part 11 — Offline Entry:</strong> Each record below was captured on your device with a timestamp. When synced, the server records <em>both</em> the original entry time and the sync time in the audit trail.
              </p>
            </div>

            {/* Queue items list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sync.queueItems.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Queue is empty</div>
              ) : sync.queueItems.map(item => (
                <QueueRow key={item.queueId} item={item}
                  result={results.find(r => r.queueId === item.queueId)}
                  fmtTime={fmtTime}
                />
              ))}
            </div>

            {/* Last sync info */}
            {sync.lastSyncAt && (
              <div style={{ padding: '8px 24px', borderTop: '1px solid #f1f3f4', fontSize: 11, color: '#9ca3af' }}>
                Last synced: {fmtTime(sync.lastSyncAt)}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderRadius: '0 0 14px 14px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {sync.failedCount > 0 && !syncing && (
                  <button onClick={handleRetry}
                    style={{ padding: '8px 16px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontFamily: 'inherit', fontWeight: 600 }}>
                    ↺ Retry Failed ({sync.failedCount})
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {done && results.length > 0 && (
                  <span style={{ fontSize: 12, color: results.every(r => r.ok) ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {results.filter(r => r.ok).length} synced · {results.filter(r => !r.ok).length} failed
                  </span>
                )}
                <button onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 18px', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#111111', fontFamily: 'inherit' }}>
                  Close
                </button>
                {sync.pendingCount > 0 && (
                  <button onClick={handleSync} disabled={syncing || !navigator.onLine}
                    style={{
                      padding: '8px 22px', background: syncing ? '#6b7280' : '#0d6e6e', color: '#fff',
                      border: 'none', borderRadius: 6, cursor: (syncing || !navigator.onLine) ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 8,
                      opacity: !navigator.onLine ? 0.6 : 1,
                    }}>
                    {syncing ? (
                      <>
                        <SpinnerIcon />
                        Syncing…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                            stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Sync {sync.pendingCount} Record{sync.pendingCount > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({
  item, result, fmtTime
}: {
  item: QueueItem
  result?: { ok: boolean; error?: string }
  fmtTime: (iso: string) => string
}) {
  const METHOD_COLOR: Record<string, { bg: string; color: string }> = {
    POST:   { bg: '#dcfce7', color: '#15803d' },
    PUT:    { bg: '#dbeafe', color: '#1d4ed8' },
    PATCH:  { bg: '#e0f2fe', color: '#0369a1' },
    DELETE: { bg: '#fee2e2', color: '#dc2626' },
  }
  const mc = METHOD_COLOR[item.method] ?? { bg: '#f1f5f9', color: '#475569' }

  const rowBg = result
    ? (result.ok ? '#f0fdf4' : '#fef2f2')
    : item.status === 'failed' ? '#fff7f7' : '#fff'

  return (
    <div style={{
      padding: '12px 24px',
      borderBottom: '1px solid #f1f3f4',
      background: rowBg,
      transition: 'background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Method badge */}
        <span style={{ ...mc, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {item.method}
        </span>

        {/* Description */}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111111', flex: 1 }}>
          {item.description}
        </span>

        {/* Status */}
        {result ? (
          result.ok
            ? <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Synced</span>
            : <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>✗ Failed</span>
        ) : item.status === 'failed' ? (
          <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            Failed {item.retryCount > 0 ? `(${item.retryCount}×)` : ''}
          </span>
        ) : (
          <span style={{ fontSize: 11, background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            Pending
          </span>
        )}
      </div>

      {/* Timestamps + compliance info */}
      <div style={{ marginTop: 5, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          📋 Entered: <strong>{fmtTime(item.clientEnteredAt)}</strong>
        </span>
        {item.retryCount > 0 && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Retried {item.retryCount} time{item.retryCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error message */}
      {(item.errorMessage || result?.error) && (
        <div style={{ marginTop: 5, fontSize: 11, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '4px 8px' }}>
          {result?.error ?? item.errorMessage}
        </div>
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 3a9 9 0 019 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
