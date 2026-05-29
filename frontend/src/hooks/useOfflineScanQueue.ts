/**
 * useOfflineScanQueue — EU GMP Annex 11 §4.3 offline scan support
 *
 * When the browser is offline, checkpoint trigger calls are queued in
 * localStorage. On reconnect the queue is flushed atomically, each item
 * posted with isOfflineSync=true so the audit trail marks it correctly.
 *
 * Zero backend changes required — IsOfflineSync field already exists in
 * checkpoint_trigger_log (migrated in Phase2_SamplesCheckpoints).
 */

import { useState, useEffect, useCallback } from 'react'
import api from '@/api/client'
import { toast } from '@/components/Toast'

const QUEUE_KEY = 'lims_offline_scan_queue'

interface QueuedScan {
  checkpointId: number
  queuedAt: string   // ISO-8601 UTC — preserves ALCOA+ "when" for audit
}

function readQueue(): QueuedScan[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') }
  catch { return [] }
}

function writeQueue(q: QueuedScan[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function useOfflineScanQueue() {
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(() => readQueue().length)

  // ── Flush: POST each queued scan, keep failures for next attempt ──────────
  const flush = useCallback(async () => {
    const queue = readQueue()
    if (queue.length === 0) return

    const remaining: QueuedScan[] = []
    for (const item of queue) {
      try {
        await api.post(`/checkpoints/${item.checkpointId}/trigger`, {
          isOfflineSync: true
        })
      } catch {
        remaining.push(item)   // network still not ready — retry next time
      }
    }

    writeQueue(remaining)
    setPendingCount(remaining.length)

    const synced = queue.length - remaining.length
    if (synced > 0) {
      toast(`✅ Offline sync complete — ${synced} queued scan${synced > 1 ? 's' : ''} sent to server.`, 'success')
    }
  }, [])

  // ── Online / Offline listeners ────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  flush() }
    const onOffline = () =>   setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Attempt flush immediately on mount (page may have loaded after reconnect)
    if (navigator.onLine) flush()

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flush])

  // ── Public trigger — queues when offline, fires immediately when online ───
  function triggerCheckpoint(checkpointId: number) {
    if (!isOnline) {
      const queue = readQueue()
      queue.push({ checkpointId, queuedAt: new Date().toISOString() })
      writeQueue(queue)
      setPendingCount(queue.length)
      alert('You are offline — scan queued. It will sync automatically when you reconnect.')
      return
    }

    api.post(`/checkpoints/${checkpointId}/trigger`, {})
      .then(() => toast('✅ Checkpoint triggered — entry logged in process log', 'success'))
      .catch((err: any) => toast(err.response?.data?.message ?? 'Trigger failed', 'error'))
  }

  return { triggerCheckpoint, pendingCount, isOnline }
}
