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
  Overdue:          'Overdue',
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

/** Convert enum/camelCase status values to readable labels. */
export function fmtLabel(value: string | null | undefined): string {
  if (!value) return '—'
  if (LABEL_MAP[value]) return LABEL_MAP[value]
  // Fallback: insert a space before each uppercase letter run
  return value.replace(/([A-Z]+)/g, ' $1').trim()
}
