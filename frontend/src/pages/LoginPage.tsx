import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26: Login page — all four elements mandatory:
//   username · password · forgot-password · remember-me
// Forgot-password: admin-initiated reset (no SMTP in system — admin resets via /api/v1/auth/reset-password)

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
  const { token, loading, error } = useSelector((s: RootState) => s.auth)

  const [username,    setUsername]    = useState('')
  const [password,    setPassword]    = useState('')
  const [rememberMe,  setRememberMe]  = useState(false)
  const [showForgot,  setShowForgot]  = useState(false)

  useEffect(() => {
    if (token) navigate('/', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    api.get('/auth/setup-required').then(r => {
      if (r.data.setupRequired) navigate('/setup', { replace: true })
    })
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    dispatch(login({ username, password }))
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.12)', width: 380 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#111827' }}>Pharma LIMS</h1>
        <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>Sign in to continue</p>

        <form onSubmit={handleSubmit}>
          {/* Element 1: Username */}
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} autoFocus required />

          {/* Element 2: Password */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            {/* Element 4: Remember me */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              Remember me
            </label>
            {/* Element 3: Forgot password */}
            <button type="button" style={{ background: 'none', border: 'none', fontSize: 13, color: '#2563eb', cursor: 'pointer', padding: 0 }}
              onClick={() => setShowForgot(true)}>
              Forgot password?
            </button>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button style={{ ...btnStyle, marginTop: 24 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Forgot-password modal — admin-initiated reset workflow */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 32, width: 420, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>Password Reset</h3>
              <button onClick={() => setShowForgot(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
                <strong>Pharma LIMS uses BCrypt-based authentication (21 CFR §11.300).</strong><br />
                Password resets require administrator authorisation to maintain audit integrity.
              </p>
            </div>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 20px', lineHeight: 1.6 }}>
              To reset your password:<br />
              <span style={{ display: 'inline-block', marginTop: 6 }}>1. Contact your <strong>System Administrator</strong> or <strong>QA Manager</strong></span><br />
              <span>2. They will use the Admin panel → Users → Reset Password</span><br />
              <span>3. A new temporary password will be assigned and audit-logged</span>
            </p>
            <button onClick={() => setShowForgot(false)}
              style={{ width: '100%', padding: '9px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: 'pointer' }
