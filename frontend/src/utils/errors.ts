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
      errors?: Array<{ field?: string; message?: string }> | unknown
    }
  }
}

/** Narrow an unknown caught value to {@link ApiError}. Never throws. */
export function asApiError(err: unknown): ApiError {
  return (typeof err === 'object' && err !== null ? err : {}) as ApiError
}

/**
 * Extract a human-readable message from a caught value.
 * Priority: friendlyMessage → server message → validation errors array → server error code → fallback.
 * For VALIDATION_ERROR responses the individual field messages are joined so the user
 * sees exactly what failed (e.g. "Password must contain at least one uppercase letter.")
 * instead of the raw "VALIDATION_ERROR" code.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = asApiError(err)
  if (e.friendlyMessage) return e.friendlyMessage
  if (e.response?.data?.message) return e.response.data.message
  // Surface FluentValidation field messages when the server returns { error: "VALIDATION_ERROR", errors: [...] }
  const data = e.response?.data
  if (data?.error === 'VALIDATION_ERROR' && Array.isArray(data.errors) && data.errors.length > 0) {
    const msgs = (data.errors as Array<{ field?: string; message?: string }>)
      .map(ve => ve.message ?? ve.field ?? '')
      .filter(Boolean)
    if (msgs.length > 0) return msgs.join(' · ')
  }
  return data?.error ?? fallback
}
