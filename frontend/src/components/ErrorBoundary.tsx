// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary.tsx
// React class component — catches render/lifecycle errors in any child tree.
// Shows a clean recovery UI instead of a blank white screen.
// ─────────────────────────────────────────────────────────────────────────────

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children:  ReactNode
  /** Optional: custom fallback element. Defaults to the built-in card. */
  fallback?: ReactNode
  /** Label shown in the error card header (e.g. "Laboratories Page") */
  label?:    string
}

interface State {
  hasError:   boolean
  error:      Error | null
  errorInfo:  ErrorInfo | null
  showDetail: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, showDetail: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Chunk loading failures happen when a new deployment changes chunk hashes
    // but the browser has a stale index.html pointing to old URLs.
    // Auto-reload ONCE — the fresh page fetch gets the correct new chunks.
    if (isChunkError(error) && !sessionStorage.getItem('lims_chunk_reload')) {
      sessionStorage.setItem('lims_chunk_reload', '1')
      window.location.reload()
      return
    }

    // Emit to global handler so Layout.tsx can log / show toast if needed
    window.dispatchEvent(new CustomEvent('lims:component:error', {
      detail: { message: error.message, stack: error.stack, componentStack: errorInfo.componentStack }
    }))
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetail: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback)  return this.props.fallback

    const { error, errorInfo, showDetail } = this.state
    const isDev = import.meta.env.DEV

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 340, padding: 32,
      }}>
        <div style={{
          background: '#fff', border: '1px solid #fecaca',
          borderRadius: 14, padding: '32px 36px',
          maxWidth: 540, width: '100%',
          boxShadow: '0 4px 24px rgba(220,38,38,.08)',
        }}>
          {/* Icon + heading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#fef2f2', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 9v4m0 4h.01" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111111' }}>
                {this.props.label ? `${this.props.label} — ` : ''}Something went wrong
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5f6368' }}>
                This section failed to load. Your data is safe.
              </p>
            </div>
          </div>

          {/* Friendly message */}
          <div style={{
            background: '#fef2f2', borderRadius: 8, padding: '12px 16px',
            marginBottom: 20, fontSize: 13, color: '#7f1d1d', lineHeight: 1.6,
          }}>
            {friendlyMessage(error?.message ?? '')}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={this.reset}
              style={{
                padding: '9px 20px', background: '#0d6e6e', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}>
              ↺ Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 20px', background: '#fff', color: '#111111',
                border: '1px solid #dadce0', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}>
              Reload Page
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '9px 20px', background: '#fff', color: '#111111',
                border: '1px solid #dadce0', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}>
              Go to Dashboard
            </button>
          </div>

          {/* Dev-only stack trace toggle */}
          {isDev && error && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => this.setState(s => ({ showDetail: !s.showDetail }))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: '#9ca3af', fontFamily: 'inherit', padding: 0,
                }}>
                {showDetail ? '▲ Hide' : '▼ Show'} error details (dev only)
              </button>
              {showDetail && (
                <pre style={{
                  marginTop: 8, padding: 12,
                  background: '#1e293b', color: '#f8fafc',
                  borderRadius: 8, fontSize: 11, overflowX: 'auto',
                  maxHeight: 200, lineHeight: 1.5,
                }}>
                  {error.message}
                  {'\n\n'}
                  {errorInfo?.componentStack ?? error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

/** Returns true when the error is a failed lazy-chunk fetch (stale deployment). */
function isChunkError(error: Error | null): boolean {
  if (!error) return false
  const m = error.message?.toLowerCase() ?? ''
  return m.includes('dynamically imported module') || m.includes('failed to fetch') ||
    m.includes('loading chunk') || m.includes('loading css chunk')
}

/** Convert technical error messages into plain English. */
function friendlyMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred while rendering this section.'
  if (msg.toLowerCase().includes('cannot read prop'))
    return 'A data field was missing or in an unexpected format.'
  if (msg.toLowerCase().includes('is not a function'))
    return 'An internal function was called incorrectly. Try reloading.'
  if (msg.toLowerCase().includes('network'))
    return 'A network error interrupted the page. Check your connection and try again.'
  if (isChunkError({ message: msg } as Error))
    return 'A page module failed to load — the page is reloading automatically. If this persists, try a hard refresh (Ctrl+Shift+R).'
  if (msg.toLowerCase().includes('chunk') || msg.toLowerCase().includes('loading'))
    return 'A page resource failed to load. Try reloading the page.'
  return 'An unexpected error occurred. If this keeps happening, contact your administrator.'
}
