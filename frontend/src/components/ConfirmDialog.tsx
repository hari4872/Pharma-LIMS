/**
 * Reusable confirmation dialog for destructive actions (delete, etc.)
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Delete Laboratory"
 *     message="Are you sure you want to delete this record? This cannot be undone."
 *     confirmLabel="Delete"
 *     confirmDanger
 *     onConfirm={handleDelete}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */

interface Props {
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  confirmDanger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title = 'Are you sure?', message = 'This action cannot be undone.',
  confirmLabel = 'Confirm', confirmDanger = false, loading = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 22px', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: confirmDanger ? '#fee2e2' : '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {confirmDanger
              ? <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="12" cy="12" r="9" stroke="#b45309" strokeWidth="2"/><path d="M12 8v4m0 4h.01" stroke="#b45309" strokeWidth="2" strokeLinecap="round"/></svg>
            }
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        </div>

        {/* Message */}
        <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>{message}</p>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '8px 18px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              background: confirmDanger ? '#dc2626' : '#0d6e6e',
              color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
