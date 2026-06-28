import { type ReactNode, useEffect, useRef, useState } from 'react'

// Right-side Panel — for read-only detail views, contextual info, and previews.
// Use Drawer for forms with submit. Use Panel for viewing/inspecting records.
//
// Key differences from Drawer:
//   - No backdrop at all (main page fully visible and interactive)
//   - Lighter header style (no heavy border)
//   - No DrawerFooter — action buttons go inline inside content
//   - Same animation, ESC, ARIA, focus behaviour as Drawer

const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'

export function Panel({
  title,
  subtitle,
  onClose,
  children,
  width = 520,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Slide-in animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus management + return focus on close
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const panel = panelRef.current

    const getFocusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        el => !el.hasAttribute('disabled')
      )

    getFocusable()[0]?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = getFocusable()
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    panel?.addEventListener('keydown', trap)
    return () => {
      panel?.removeEventListener('keydown', trap)
      trigger?.focus()
    }
  }, [])

  return (
    <div
      role="complementary"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: 'none', // outer container non-blocking
      }}
    >
      {/* Panel itself — fully interactive */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: `min(${width}px, 100vw)`,
          height: '100%',
          background: '#fff',
          borderLeft: '2px solid #e2e8f0',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          pointerEvents: 'all',
          transform: mounted ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid #f3f4f6',
          background: '#f8fafc',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            {subtitle && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: 6,
              color: '#374151',
              fontSize: 18,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
