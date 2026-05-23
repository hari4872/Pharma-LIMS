// ─────────────────────────────────────────────────────────────────────────────
// main.tsx — App entry point with global error handling
//
// Root-level ErrorBoundary catches any uncaught render errors in the tree.
// window.onerror + window.onunhandledrejection catch JS/Promise errors that
// escape React's boundary (e.g., errors in event handlers, async code).
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from '@/store'
import App from './App'
import ErrorBoundary from '@/components/ErrorBoundary'
import ErrorPage from '@/pages/ErrorPage'
import './index.css'

// ── Global JS error handler ───────────────────────────────────────────────────
// Catches synchronous errors that escape React's boundary (e.g. event handlers,
// setTimeout callbacks). Emits the same custom event so Layout can show a toast.
window.onerror = function (message, source, lineno, colno, error) {
  window.dispatchEvent(new CustomEvent('lims:component:error', {
    detail: {
      message: typeof message === 'string' ? message : String(message),
      stack:   error?.stack ?? `${source}:${lineno}:${colno}`,
      componentStack: null,
    }
  }))
  // Return false to let the default browser handler also run (useful in dev)
  return false
}

// ── Unhandled Promise rejection handler ───────────────────────────────────────
// Catches rejected promises that have no .catch() / await try-catch.
window.onunhandledrejection = function (event: PromiseRejectionEvent) {
  const reason = event.reason
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === 'string' ? reason : 'Unhandled promise rejection'

  window.dispatchEvent(new CustomEvent('lims:component:error', {
    detail: {
      message,
      stack:          reason instanceof Error ? reason.stack : null,
      componentStack: null,
    }
  }))
}

// ── Root render ───────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root')!

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        {/* Root-level boundary: catches any crash in the entire app tree */}
        <ErrorBoundary
          fallback={
            <ErrorPage
              onReset={() => {
                // Full page reload is the safest recovery at root level
                window.location.reload()
              }}
            />
          }
        >
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  </StrictMode>
)
