// ─── Centralised date formatting ─────────────────────────────────────────────
// Always en-GB (06 Dec 2026) — unambiguous, GMP-friendly.
// All pages should import from here instead of calling toLocaleDateString() inline.

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
const DT_OPTS:   Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

function parse(d: string | Date | null | undefined): Date | null {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  return isNaN(dt.getTime()) ? null : dt
}

/** 06 Dec 2026 */
export function fmtDate(d: string | Date | null | undefined): string {
  const dt = parse(d)
  return dt ? dt.toLocaleDateString('en-GB', DATE_OPTS) : '—'
}

/** 06 Dec 2026, 14:22 */
export function fmtDateTime(d: string | Date | null | undefined): string {
  const dt = parse(d)
  return dt ? dt.toLocaleString('en-GB', DT_OPTS) : '—'
}

/** 14:22 */
export function fmtTime(d: string | Date | null | undefined): string {
  const dt = parse(d)
  return dt ? dt.toLocaleTimeString('en-GB', TIME_OPTS) : '—'
}

/** YYYY-MM-DD  (for input[type=date] value) */
export function fmtIso(d: string | Date | null | undefined): string {
  const dt = parse(d)
  return dt ? dt.toISOString().slice(0, 10) : ''
}
