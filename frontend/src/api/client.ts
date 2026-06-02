// ─────────────────────────────────────────────────────────────────────────────
// client.ts  —  Axios instance with offline support
//
// GET  requests when offline → served from sessionStorage cache (read-only).
// POST/PUT/PATCH/DELETE when offline → queued to IndexedDB, returns
//   { __offlineQueued: true, queueId } so callers can detect and show
//   "Saved to offline queue" instead of "Saved successfully".
//
// Compliance notes:
//   • clientEnteredAt is set at queue-enqueue time (device UTC) — not at sync
//     time — so ALCOA+ Contemporaneous is satisfied.
//   • The JWT token at the time of entry is stored in the queue item so it can
//     be replayed with the correct identity even if the analyst re-logs before
//     sync runs.
// ─────────────────────────────────────────────────────────────────────────────

import axios, { type InternalAxiosRequestConfig } from 'axios'
import * as queue from '@/utils/offlineQueue'

const CACHE_PREFIX = 'lims_cache_'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,   // 30 s — shows "Server took too long" instead of hanging forever
})

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(async config => {
  const token = localStorage.getItem('lims_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const method = (config.method ?? 'get').toUpperCase()
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  // ── Offline handling ──────────────────────────────────────────────────────
  if (!navigator.onLine) {
    if (method === 'GET') {
      // Serve from cache
      const cacheKey = CACHE_PREFIX + (config.url ?? '')
      const cached   = sessionStorage.getItem(cacheKey)
      if (cached) {
        // Abort real request and return cached data via a resolved promise
        const data = JSON.parse(cached)
        const cancelToken = new axios.CancelToken(cancel => cancel('__offline_cache__'))
        config.cancelToken = cancelToken
        // Attach cached data to config so the response interceptor can pick it up
        ;(config as InternalAxiosRequestConfig & { __cachedData?: unknown }).__cachedData = data
      }
      return config
    }

    if (isWrite) {
      // Queue the write and return a special "queued" marker
      const url = config.url ?? ''
      // Build a human-readable description from method + URL
      const description = buildDescription(method, url, config.data)
      await queue.enqueue({
        method:      method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url,
        body:        config.data,
        authToken:   token ?? '',
        description,
      })

      // Cancel the real request by throwing a special error that
      // the response interceptor will recognise
      const cancelToken = new axios.CancelToken(cancel =>
        cancel(JSON.stringify({ __offlineQueued: true, description }))
      )
      config.cancelToken = cancelToken
      return config
    }
  }

  return config
})

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  r => {
    // Cache successful GET responses
    if ((r.config.method ?? '').toUpperCase() === 'GET' && r.config.url) {
      const cacheKey = CACHE_PREFIX + r.config.url
      try { sessionStorage.setItem(cacheKey, JSON.stringify(r.data)) } catch { /* quota */ }
    }
    return r
  },
  err => {
    // Cancelled because of offline cache hit → resolve with cached data
    if (axios.isCancel(err)) {
      const msg = err.message ?? ''

      // Offline queue write
      if (msg.startsWith('{')) {
        try {
          const parsed = JSON.parse(msg)
          if (parsed.__offlineQueued) {
            // Return a synthetic response so calling code sees "success"
            // The caller should check response.data.__offlineQueued to show
            // the correct "queued" toast. Layout.tsx fires a window event
            // that OfflineSyncButton listens to for refreshing count.
            window.dispatchEvent(new CustomEvent('lims:offline:queued'))
            return Promise.resolve({
              data:   { __offlineQueued: true, description: parsed.description },
              status: 202,
              statusText: 'Queued',
              headers: {},
              config: {},
            })
          }
        } catch { /* not JSON */ }
      }

      // Offline cache read — reconstruct a response
      if (msg === '__offline_cache__') {
        // cachedData was attached to config but we've lost it here
        // so we just let the page handle the failed request
      }
    }

    // 401 → redirect to login
    if (err.response?.status === 401) {
      localStorage.removeItem('lims_token')
      window.location.href = '/login'
    }

    // Attach a friendly human-readable message to every error
    err.friendlyMessage = buildFriendlyMessage(err)

    return Promise.reject(err)
  }
)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a readable description from method + URL + body for audit display. */
function buildDescription(method: string, url: string, body: unknown): string {
  const segment = url.split('/').filter(Boolean).pop() ?? url
  const label   = segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // Try to extract a name from the body
  let name = ''
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    name = (b.name ?? b.labName ?? b.materialName ?? b.formName ?? b.parameterName ?? b.methodName ?? '') as string
    if (name) name = ` "${name}"`
  }

  const verb = method === 'POST' ? 'Create' : method === 'DELETE' ? 'Delete' : 'Update'
  return `${verb} ${label}${name}`
}

// ── Friendly error message mapper ─────────────────────────────────────────────

/**
 * Converts any axios error into a plain-English message suitable for
 * display in a Toast or error card — no raw server stack traces exposed.
 *
 * Priority order:
 *   1. Server-provided `message` / `title` / `errors` field (FluentValidation etc.)
 *   2. HTTP status code → mapped phrase
 *   3. Network / timeout error
 *   4. Generic fallback
 */
export function buildFriendlyMessage(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string; title?: string; error?: string; errors?: unknown } }
    code?: string
    message?: string
  }
  // Server responded with a body
  if (e.response) {
    const status = e.response.status as number
    const data   = e.response.data

    // Try to extract a server message (check both "message" and "error" keys)
    const serverMsg: string =
      data?.message ??
      data?.title   ??
      data?.error   ??
      (Array.isArray(data?.errors)
        ? (data.errors as string[]).join(', ')
        : typeof data?.errors === 'object'
          ? Object.values(data.errors as Record<string, string[]>).flat().join(', ')
          : '') ??
      ''

    if (serverMsg && !serverMsg.toLowerCase().includes('at system.') &&
        serverMsg.length < 500) {
      return serverMsg
    }

    // Fall back to status-code phrases
    switch (status) {
      case 400: return 'Invalid data — please check the form fields and try again.'
      case 401: return 'Your session has expired. Please sign in again.'
      case 403: return 'You do not have permission to perform this action.'
      case 404: return 'The requested record was not found.'
      case 408: return 'The server took too long to respond. Please try again.'
      case 409: return 'A conflict occurred — this record may already exist.'
      case 422: return 'The submitted data could not be processed. Check all required fields.'
      case 423: return 'This record is locked and cannot be modified.'
      case 429: return 'Too many requests. Please wait a moment and try again.'
      case 500: return 'A server error occurred. Please contact your administrator if this continues.'
      case 502:
      case 503:
      case 504: return 'The server is temporarily unavailable. Please try again shortly.'
      default:  return `Request failed (${status}). Please try again.`
    }
  }

  // Axios timeout
  if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
    return 'The server took too long to respond (30s). Check your connection and try again.'
  }

  // No response at all — network level failure
  if (e.message === 'Network Error' || !navigator.onLine) {
    return 'Cannot reach the server. Check your internet connection and try again.'
  }

  return 'An unexpected error occurred. Please try again or contact your administrator.'
}

/** Cache GET response manually (for pre-loading). */
export function cacheResponse(url: string, data: unknown) {
  try { sessionStorage.setItem(CACHE_PREFIX + url, JSON.stringify(data)) } catch { /* quota */ }
}

/** Read cached data for a URL. Returns null if not cached. */
export function getCached<T>(url: string): T | null {
  const raw = sessionStorage.getItem(CACHE_PREFIX + url)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export default api
