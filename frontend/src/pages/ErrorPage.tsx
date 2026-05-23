// ─────────────────────────────────────────────────────────────────────────────
// ErrorPage.tsx
// Full-page fallback shown when the entire app crashes (root-level boundary).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  error?:   Error | null
  onReset?: () => void
}

export default function ErrorPage({ error, onReset }: Props) {
  const isDev = import.meta.env.DEV

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f4f8',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>

        {/* Logo mark */}
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #0d9488, #0f766e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(13,148,136,0.25)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
            <path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3"
              stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Error icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 9v4m0 4h.01" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111111', margin: '0 0 10px' }}>
          Application Error
        </h1>
        <p style={{ fontSize: 15, color: '#5f6368', margin: '0 0 8px', lineHeight: 1.6 }}>
          Pharma LIMS encountered an unexpected error and could not continue.
        </p>
        <p style={{ fontSize: 13, color: '#80868b', margin: '0 0 32px' }}>
          Your data is safe. No records were lost.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          {onReset && (
            <button onClick={onReset}
              style={{
                padding: '11px 28px', background: '#0d6e6e', color: '#fff',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(13,110,110,0.25)',
              }}>
              ↺ Try Again
            </button>
          )}
          <button onClick={() => window.location.href = '/dashboard'}
            style={{
              padding: '11px 28px', background: '#fff', color: '#111111',
              border: '1px solid #dadce0', borderRadius: 10, cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}>
            Go to Dashboard
          </button>
          <button onClick={() => window.location.reload()}
            style={{
              padding: '11px 28px', background: '#fff', color: '#111111',
              border: '1px solid #dadce0', borderRadius: 10, cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}>
            Reload App
          </button>
        </div>

        {/* Support info */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e0e0e0', textAlign: 'left', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What to do
          </p>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: '#374151', lineHeight: 2 }}>
            <li>Click <strong>Try Again</strong> or <strong>Reload App</strong> first</li>
            <li>If it keeps happening, contact your system administrator</li>
            <li>Note the time and what you were doing when this occurred</li>
            <li>Your data was not lost — all saved records are intact</li>
          </ul>
        </div>

        {/* Timestamp */}
        <p style={{ fontSize: 11, color: '#9ca3af' }}>
          {new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })} UTC
        </p>

        {/* Dev-only stack trace */}
        {isDev && error && (
          <details style={{ marginTop: 16, textAlign: 'left' }}>
            <summary style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
              Error details (dev only)
            </summary>
            <pre style={{
              marginTop: 8, padding: 14,
              background: '#1e293b', color: '#f8fafc',
              borderRadius: 8, fontSize: 11, overflowX: 'auto',
              maxHeight: 240, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {error.message}{'\n\n'}{error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
