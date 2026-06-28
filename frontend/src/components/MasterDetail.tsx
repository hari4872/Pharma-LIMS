import { type ReactNode, useEffect, useRef } from 'react'

// MasterDetail — splits the page into a list column (left) and a detail panel (right).
//
// When detail is open:
//   - List narrows to 58%, detail takes 42% (sticky to viewport, independent scroll)
//   - Both sides remain interactive — no backdrop
//   - Smooth 280ms flex transition
//   - ESC closes detail, focus returns to originating element
//
// On mobile (<768px): list hides when detail is open; DetailPane shows a back arrow.
//
// Usage:
//   <MasterDetail
//     detail={selected ? <DetailPane title="..." onClose={() => setSelected(null)}>...</DetailPane> : null}
//     onCloseDetail={() => setSelected(null)}
//   >
//     <DataTable onRowClick={row => setSelected(row)} ... />
//   </MasterDetail>

const HEADER_HEIGHT = 64 // px — space to leave above the sticky detail column

interface MasterDetailProps {
  children: ReactNode        // Left: list / table content
  detail: ReactNode | null   // Right: detail panel — null means collapsed
  onCloseDetail: () => void  // Called by ESC key; also call from DetailPane's onClose
  detailTitle?: string       // Accessible label for the detail region
}

export function MasterDetail({
  children,
  detail,
  onCloseDetail,
  detailTitle = 'Detail',
}: MasterDetailProps) {
  const isOpen = detail !== null
  const prevFocusRef = useRef<HTMLElement | null>(null)

  // ESC closes detail
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseDetail() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onCloseDetail])

  // Restore focus to the element that triggered the detail
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement
    } else {
      prevFocusRef.current?.focus()
      prevFocusRef.current = null
    }
  }, [isOpen])

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start', // columns size to their content, not each other
        gap: 0,
      }}>
        {/* ── List column ─────────────────────────────────────────────── */}
        <div
          aria-label="List"
          style={{
            flex: isOpen ? '0 0 58%' : '1 1 100%',
            minWidth: 0,
            transition: 'flex 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          // Mobile: hide list when detail is open
          className={isOpen ? 'md-list md-list--detail-open' : 'md-list'}
        >
          {children}
        </div>

        {/* ── Vertical divider ────────────────────────────────────────── */}
        <div style={{
          width: isOpen ? 1 : 0,
          flexShrink: 0,
          alignSelf: 'stretch',
          background: '#e2e8f0',
          transition: 'width 280ms ease',
        }} />

        {/* ── Detail column — sticky to viewport, independent scroll ─── */}
        <div
          role="region"
          aria-label={detailTitle}
          style={{
            flex: isOpen ? '1 1 42%' : '0 0 0px',
            minWidth: 0,
            maxHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'sticky',
            top: 0,
            background: '#fff',
            transform: isOpen ? 'translateX(0)' : 'translateX(8px)',
            opacity: isOpen ? 1 : 0,
            visibility: isOpen ? 'visible' : 'hidden',
            transition: [
              'flex 280ms cubic-bezier(0.4, 0, 0.2, 1)',
              'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
              'opacity 200ms ease',
            ].join(', '),
          }}
        >
          {detail}
        </div>
      </div>

      {/* Scoped responsive styles */}
      <style>{`
        @media (max-width: 767px) {
          .md-list--detail-open { display: none !important; }
          .md-back-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}

// ── DetailPane ────────────────────────────────────────────────────────────────
// Standard header + scrollable body for MasterDetail's right column.
// Provides title, subtitle, × close button, optional action buttons, and a
// mobile "← Back" button that appears when the list is hidden.

export function DetailPane({
  title,
  subtitle,
  onClose,
  children,
  actions,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode  // Buttons shown in the header (e.g. Approve / Reject)
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f8fafc',
      }}>
        {/* Mobile: back button */}
        <button
          onClick={onClose}
          aria-label="Back to list"
          className="md-back-btn"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: 18,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{
              margin: '1px 0 0', fontSize: 11, color: '#6b7280',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {actions}
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close detail"
          style={{
            background: '#e2e8f0',
            border: 'none',
            borderRadius: 6,
            color: '#374151',
            fontSize: 15,
            width: 24,
            height: 24,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}
