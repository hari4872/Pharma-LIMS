import { useState } from 'react'
import api from '@/api/client'

interface Props {
  fullName: string
  initials: string
  username: string
  onUnlock: () => void
  onSignOut: () => void
}

export default function IdleLockOverlay({ fullName, initials, username, onUnlock, onSignOut }: Props) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setLoading(true); setError('')
    try {
      await api.post('/auth/login', { username, password })
      onUnlock()
    } catch {
      setError('Incorrect password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 40px',
        width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        border: '1px solid #e5e7eb',
      }}>
        {/* Avatar + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Session Locked</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {fullName} — enter your password to continue
          </div>
          <div style={{
            marginTop: 10, fontSize: 11, color: '#92400e',
            background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: 6, padding: '4px 12px', display: 'inline-block',
          }}>
            21 CFR Part 11 — Idle screen lock
          </div>
        </div>

        {/* Password form */}
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', fontSize: 14,
              border: `1.5px solid ${error ? '#ef4444' : '#d1d5db'}`,
              borderRadius: 8, outline: 'none', boxSizing: 'border-box',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', marginTop: 14, padding: '11px',
              background: loading || !password ? '#99f6e4' : '#0d9488',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700,
              cursor: loading || !password ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Verifying…' : 'Unlock'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onSignOut}
            style={{
              background: 'none', border: 'none', color: '#6b7280',
              fontSize: 13, cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}
