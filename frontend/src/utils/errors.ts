// ─────────────────────────────────────────────────────────────────────────────
// errors.ts — typed helpers for handling caught errors without `any`.
//
// Caught values are `unknown` (TS only allows `any`/`unknown` on a catch binding).
// `api/client.ts` attaches a `friendlyMessage` to every rejected axios error and
// the server returns `{ message }` or `{ error }` bodies, so these helpers narrow
// an unknown caught value to that shape and extract a display string.
// ─────────────────────────────────────────────────────────────────────────────

/** The error shape produced by axios + our response interceptor + the API. */
export interface ApiError {
  friendlyMessage?: string
  message?: string
  code?: string
  response?: {
    status?: number
    data?: {
      message?: string
      error?: string
      errors?: unknown
    }
  }
}

/** Narrow an unknown caught value to {@link ApiError}. Never throws. */
export function asApiError(err: unknown): ApiError {
  return (typeof err === 'object' && err !== null ? err : {}) as ApiError
}

/**
 * Extract a human-readable message from a caught value, mirroring the chain the
 * codebase used inline: friendlyMessage → server `message` → server `error` →
 * the supplied fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = asApiError(err)
  return e.friendlyMessage ?? e.response?.data?.message ?? e.response?.data?.error ?? fallback
}
