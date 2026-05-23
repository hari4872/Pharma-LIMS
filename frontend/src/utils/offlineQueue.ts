// ─────────────────────────────────────────────────────────────────────────────
// offlineQueue.ts
// IndexedDB-backed sync queue for offline writes.
//
// Compliance:
//   • clientEnteredAt  — device UTC ISO timestamp captured at the moment the
//                        analyst pressed Save. Sent to server as
//                        X-Client-Entered-At header on sync.
//                        Server audit log stores BOTH this value (in new_values
//                        JSONB) AND server UTC changed_at (sync time).
//                        Satisfies ALCOA+ Contemporaneous — two timestamps with
//                        clear meaning: "entered at" vs "received at server".
//   • INSERT-only intent — queued items are never edited; failures get a
//                        new status field only. Original request body immutable.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'lims_offline_v1'
const STORE_NAME = 'sync_queue'
const DB_VERSION = 1

export interface QueueItem {
  queueId:          string               // uuid4
  method:           'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url:              string               // relative, e.g. /laboratories
  body:             unknown              // original request body
  authToken:        string               // JWT at time of entry — sent on sync
  clientEnteredAt:  string               // ISO UTC — device clock (ALCOA+)
  description:      string               // human-readable e.g. "Save Laboratory: Apex Lab"
  status:           'pending' | 'failed'
  errorMessage?:    string
  retryCount:       number
  createdAt:        string               // same as clientEnteredAt initially
}

// ── DB open ───────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'queueId' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess  = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db) }
    req.onerror    = ()  => reject(new Error('Failed to open offline queue DB'))
  })
}

function txStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then(db => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add a new write action to the queue. Returns the queueId. */
export async function enqueue(
  item: Pick<QueueItem, 'method' | 'url' | 'body' | 'description'> & { authToken: string }
): Promise<string> {
  const store = await txStore('readwrite')
  const queueId = crypto.randomUUID()
  const now     = new Date().toISOString()
  const entry: QueueItem = {
    queueId,
    method:          item.method,
    url:             item.url,
    body:            item.body,
    authToken:       item.authToken,
    clientEnteredAt: now,
    description:     item.description,
    status:          'pending',
    retryCount:      0,
    createdAt:       now,
  }
  await promisify(store.add(entry))
  return queueId
}

/** Get all items in creation order. */
export async function getAll(): Promise<QueueItem[]> {
  const store = await txStore('readonly')
  const items = await promisify<QueueItem[]>(store.getAll())
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Get only pending items (excludes failed). */
export async function getPending(): Promise<QueueItem[]> {
  const items = await getAll()
  return items.filter(i => i.status === 'pending')
}

/** Count of all items (pending + failed). */
export async function getTotalCount(): Promise<number> {
  const store = await txStore('readonly')
  return promisify(store.count())
}

/** Mark an item as failed with an error message. Increments retryCount. */
export async function markFailed(queueId: string, errorMessage: string): Promise<void> {
  const store = await txStore('readwrite')
  const item  = await promisify<QueueItem>(store.get(queueId))
  if (!item) return
  item.status       = 'failed'
  item.errorMessage = errorMessage
  item.retryCount   = (item.retryCount ?? 0) + 1
  await promisify(store.put(item))
}

/** Reset a failed item back to pending (for retry). */
export async function resetToPending(queueId: string): Promise<void> {
  const store = await txStore('readwrite')
  const item  = await promisify<QueueItem>(store.get(queueId))
  if (!item) return
  item.status       = 'pending'
  item.errorMessage = undefined
  await promisify(store.put(item))
}

/** Permanently remove an item from the queue (after successful sync). */
export async function remove(queueId: string): Promise<void> {
  const store = await txStore('readwrite')
  await promisify(store.delete(queueId))
}

/** Clear ALL items (use only after confirmed full sync). */
export async function clearAll(): Promise<void> {
  const store = await txStore('readwrite')
  await promisify(store.clear())
}
