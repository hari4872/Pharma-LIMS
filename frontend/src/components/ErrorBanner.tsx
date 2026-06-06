// ─── Consistent inline error display ────────────────────────────────────────
// Usage: {error && <ErrorBanner message={error} />}
// Replaces the scattered <p style="color:#ef4444"> / <p style="color:#dc2626"> patterns.

interface Props {
  message:  string
  onDismiss?: () => void
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px', borderRadius: 7,
      background: '#fef2f2', border: '1px solid #fecaca',
      fontSize: 13, color: '#dc2626', lineHeight: 1.4,
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700 }}>⚠</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>
          ×
        </button>
      )}
    </div>
  )
}
