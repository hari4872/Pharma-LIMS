import type { ReactNode } from 'react'

// Right-side slide-in drawer — use instead of centered Modal for all forms and detail views.
// 21 CFR Part 11 e-signature flows must keep using Modal (blocking / cannot be dismissed by clicking outside).

interface DrawerProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Drawer({ title, subtitle, onClose, children, width = 480 }: DrawerProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Click-outside backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />

      {/* Panel */}
      <div style={{
        position: 'relative',
        width,
        maxWidth: '92vw',
        height: '100%',
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
          background: '#fff', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
            {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: 8,
              color: '#374151', fontSize: 20, width: 32, height: 32,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
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
      display: 'flex', justifyContent: 'flex-end', gap: 10,
      marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb',
    }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '9px 20px', border: '1px solid #d1d5db', borderRadius: 7,
          cursor: 'pointer', background: '#fff', color: '#374151',
          fontFamily: 'inherit', fontSize: 13,
        }}
      >Cancel</button>
      <button
        type="submit"
        disabled={isDisabled}
        style={{
          padding: '9px 22px',
          background: isDisabled ? '#9ca3af' : '#1e3a5f',
          color: '#fff', border: 'none', borderRadius: 7,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
        }}
      >{saving ? 'Saving…' : (label ?? 'Save')}</button>
    </div>
  )
}
