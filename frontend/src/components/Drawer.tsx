import { type ReactNode, useEffect, useRef, useState } from 'react'

// Right-side slide-in Drawer — replaces centered modals for all form/edit/settings flows.
// 21 CFR Part 11 e-signature actions must stay as centered blocking <Modal>.
//
// Spec compliance:
//   - 280ms cubic-bezier slide-in animation
//   - Non-blocking backdrop (main page stays interactive)
//   - ESC key closes drawer
//   - role="dialog" + aria-modal ARIA attributes
//   - Focus trap within panel (Tab cycles internally)
//   - Focus returns to trigger element on close

const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  width = 480,
  blocking = false,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
  /** If true, backdrop blocks interaction with the page behind (use for e-signatures) */
  blocking?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Trigger slide-in after first paint
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

  // Focus trap + return focus to trigger on close
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (!panel) return

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => !el.hasAttribute('disabled')
      )

    // Focus first element in drawer
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

    panel.addEventListener('keydown', trap)
    return () => {
      panel.removeEventListener('keydown', trap)
      trigger?.focus() // return focus to originating element
    }
  }, [])

  // Responsive width: respects pixel cap but scales down on smaller viewports
  const panelWidth = `min(${width}px, 100vw)`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: blocking ? 'all' : 'none',
      }}
    >
      {/* Backdrop — blocking for e-sig, visual-only otherwise */}
      <div
        onClick={blocking ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: blocking ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 280ms ease',
          pointerEvents: blocking ? 'all' : 'none',
          cursor: blocking ? 'default' : undefined,
        }} />

      {/* Drawer panel — interactive */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: panelWidth,
          height: '100%',
          background: '#fff',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          pointerEvents: 'all', // panel itself is fully interactive
          transform: mounted ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Sticky header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            {subtitle && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              color: '#374151',
              fontSize: 20,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function DrawerFooter({
  saving,
  onCancel,
  label,
  disabled,
}: {
  saving: boolean
  onCancel: () => void
  label?: string
  disabled?: boolean
}) {
  const isDisabled = saving || disabled
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 24,
      paddingTop: 16,
      borderTop: '1px solid #e5e7eb',
    }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '9px 20px',
          border: '1px solid #d1d5db',
          borderRadius: 7,
          cursor: 'pointer',
          background: '#fff',
          color: '#374151',
          fontFamily: 'inherit',
          fontSize: 13,
        }}
      >Cancel</button>
      <button
        type="submit"
        disabled={isDisabled}
        style={{
          padding: '9px 22px',
          background: isDisabled ? '#9ca3af' : '#1e3a5f',
          color: '#fff',
          border: 'none',
          borderRadius: 7,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
        }}
      >{saving ? 'Saving…' : (label ?? 'Save')}</button>
    </div>
  )
}
