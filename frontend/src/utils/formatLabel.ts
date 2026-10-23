// Converts enum/camelCase DB values to human-readable display labels.
// Import fmtLabel wherever a raw status/enum value is shown in the UI.

const LABEL_MAP: Record<string, string> = {
  // Sample statuses
  Registered:       'Registered',
  PendingTesting:   'Pending Testing',
  InTesting:        'In Testing',
  PendingQAReview:  'Pending QA Review',
  Released:         'Released',
  Rejected:         'Rejected',
  // Batch release / CoA
  PendingReview:    'Pending Review',
  InReview:         'In Review',
  OnHold:           'On Hold',
  Superseded:       'Superseded',
  Draft:            'Draft',
  Approved:         'Approved',
  // OOS / OOT
  OOSOpen:          'OOS Open',
  OOSClosed:        'OOS Closed',
  OOTPending:       'OOT Pending',
  // Work queue / tasks
  Completed:        'Completed',
  Assigned:         'Assigned',
  InProgress:       'In Progress',
  QCVerified:       'QC Verified',
  Overdue:          'Overdue',
  // OOS phases
  Phase1:           'Phase 1',
  Phase2:           'Phase 2',
  // Checkpoint trigger modes
  TimeBased:        'Time-Based',
  OperatorScan:     'Operator Scan',
  ProcessLog:       'Process Log',
  DispatchEvent:    'Dispatch Event',
  // Booking
  Booked:           'Booked',
  InUse:            'In Use',
  Cancelled:        'Cancelled',
  Available:        'Available',
  // Generic
  Active:           'Active',
  Inactive:         'Inactive',
  Locked:           'Locked',
  Open:             'Open',
  Closed:           'Closed',
}

/**
 * Format a calculated/numeric result.
 * Uses toPrecision(10) first to eliminate floating-point noise
 * (e.g. 0.7999999999999998 → 0.8), then rounds to 2 dp only when needed.
 */
export function fmtCalc(v: number | null | undefined): string {
  if (v == null) return '—'
  const clean = parseFloat(v.toPrecision(10))
  const str = String(clean)
  const dot = str.indexOf('.')
  if (dot === -1 || str.length - dot - 1 <= 2) return str
  return Number(clean.toFixed(2)).toString()
}

/** Convert enum/camelCase status values to readable labels. */
export function fmtLabel(value: string | null | undefined): string {
  if (!value) return '—'
  if (LABEL_MAP[value]) return LABEL_MAP[value]
  // Fallback: insert a space before each uppercase letter run
  return value.replace(/([A-Z]+)/g, ' $1').trim()
}
