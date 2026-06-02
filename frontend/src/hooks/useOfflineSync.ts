// ─────────────────────────────────────────────────────────────────────────────
// useOfflineSync.ts
// React hook — manages online/offline state and drives the sync process.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import * as queue from '@/utils/offlineQueue'
import type { QueueItem } from '@/utils/offlineQueue'
import { toast } from '@/components/Toast'
import { asApiError } from '@/utils/errors'

export interface SyncResult {
  success: number
  failed:  number
  items:   Array<{ queueId: string; description: string; ok: boolean; error?: string }>
}

export interface OfflineSyncState {
  isOnline:     boolean
  queueCount:   number       // total items (pending + failed)
  pendingCount: number       // pending only
  failedCount:  number       // failed only
  syncing:      boolean
  lastSyncAt:   string | null
  queueItems:   QueueItem[]
  syncAll:      () => Promise<SyncResult>
  retryFailed:  () => Promise<void>
  refreshQueue: () => Promise<void>
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)
  const [syncing,    setSyncing]    = useState(false)
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(
    sessionStorage.getItem('lims_last_sync') ?? null
  )
  const syncingRef = useRef(false)

  // ── Refresh queue from IndexedDB ──────────────────────────────────────────
  const refreshQueue = useCallback(async () => {
    const items = await queue.getAll()
    setQueueItems(items)
  }, [])

  // ── Online / offline event listeners ─────────────────────────────────────
  useEffect(() => {
    function handleOnline()  { setIsOnline(true);  refreshQueue() }
    function handleOffline() { setIsOnline(false); refreshQueue() }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    const t = setTimeout(refreshQueue, 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshQueue])

  // ── Sync all pending items ────────────────────────────────────────────────
  const syncAll = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current) return { success: 0, failed: 0, items: [] }
    syncingRef.current = true
    setSyncing(true)

    const pending = await queue.getPending()
    const result: SyncResult = { success: 0, failed: 0, items: [] }

    for (const item of pending) {
      try {
        await axios({
          method:  item.method,
          url:     `/api/v1${item.url}`,
          data:    item.body,
          headers: {
            Authorization:       `Bearer ${item.authToken}`,
            'Content-Type':      'application/json',
            // Compliance: tell server when this was originally entered offline
            'X-Client-Entered-At': item.clientEnteredAt,
            'X-Offline-Sync':      'true',
          },
        })
        await queue.remove(item.queueId)
        result.success++
        result.items.push({ queueId: item.queueId, description: item.description, ok: true })
      } catch (err) {
        const e = asApiError(err)
        const msg = e.friendlyMessage ?? e.response?.data?.message ?? e.message ?? 'Network error'
        await queue.markFailed(item.queueId, msg)
        result.failed++
        result.items.push({ queueId: item.queueId, description: item.description, ok: false, error: msg })
      }
    }

    const now = new Date().toISOString()
    sessionStorage.setItem('lims_last_sync', now)
    setLastSyncAt(now)
    await refreshQueue()
    syncingRef.current = false
    setSyncing(false)

    if (result.success > 0 && result.failed === 0) {
      toast(`✅ ${result.success} record${result.success > 1 ? 's' : ''} synced successfully`, 'success')
    } else if (result.success > 0 && result.failed > 0) {
      toast(`⚠️ ${result.success} synced, ${result.failed} failed — check sync panel`, 'error')
    } else if (result.failed > 0) {
      toast(`❌ ${result.failed} record${result.failed > 1 ? 's' : ''} failed to sync`, 'error')
    } else {
      toast('Nothing to sync', 'success')
    }

    return result
  }, [refreshQueue])

  // ── Reset all failed items to pending and re-sync ─────────────────────────
  const retryFailed = useCallback(async () => {
    const all = await queue.getAll()
    const failed = all.filter(i => i.status === 'failed')
    for (const item of failed) {
      await queue.resetToPending(item.queueId)
    }
    await refreshQueue()
  }, [refreshQueue])

  const pendingCount = queueItems.filter(i => i.status === 'pending').length
  const failedCount  = queueItems.filter(i => i.status === 'failed').length

  return {
    isOnline,
    queueCount:   queueItems.length,
    pendingCount,
    failedCount,
    syncing,
    lastSyncAt,
    queueItems,
    syncAll,
    retryFailed,
    refreshQueue,
  }
}
