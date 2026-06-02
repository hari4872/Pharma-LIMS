/**
 * Lightweight global Toast system — no external deps.
 * Usage:  import { toast } from '@/components/Toast'
 *         toast('Sample saved!', 'success')
 *
 * Mount <ToastContainer /> once in App.tsx or Layout.tsx.
 */

import { useState, useEffect } from 'react'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

// ── Module-level pub/sub store ────────────────────────────────────────────
let _store: ToastItem[] = []
const _listeners = new Set<(toasts: ToastItem[]) => void>()

function _notify(next: ToastItem[]) {
  _store = next
  _listeners.forEach(fn => fn(next))
}

/** Call from anywhere — React or non-React code */
// eslint-disable-next-line react-refresh/only-export-components -- global toast() API intentionally co-located with its container; imported across the app
export function toast(message: string, type: ToastType = 'info', durationMs = 3500) {
  const id = Math.random().toString(36).slice(2, 9)
  _notify([..._store, { id, message, type }])
  setTimeout(() => _notify(_store.filter(t => t.id !== id)), durationMs)
}

// ── Colours ───────────────────────────────────────────────────────────────
const STYLES: Record<ToastType, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✓', color: '#15803d' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ', color: '#1d4ed8' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠', color: '#b45309' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '✕', color: '#dc2626' },
}

// ── Single toast card ─────────────────────────────────────────────────────
function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const s = STYLES[item.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // trigger slide-in on next tick
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      minWidth: 260, maxWidth: 360,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.28s cubic-bezier(.22,1,.36,1), opacity 0.28s ease',
    }}>
      {/* Icon */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: s.border, color: s.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>
        {s.icon}
      </div>
      {/* Message */}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0f172a', lineHeight: 1.4 }}>
        {item.message}
      </span>
      {/* Close */}
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#94a3b8', fontSize: 15, lineHeight: 1, padding: 0,
        flexShrink: 0, marginTop: 1,
      }}>×</button>
    </div>
  )
}

// ── Container — mount once in Layout.tsx ──────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const fn = (t: ToastItem[]) => setToasts([...t])
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20,
      zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(item => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard
            item={item}
            onClose={() => _notify(_store.filter(t => t.id !== item.id))}
          />
        </div>
      ))}
    </div>
  )
}
