import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26 — username · password · forgot-password · remember-me

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconPerson() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconEyeOpen() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── WebSynergies text logo ───────────────────────────────────────────────────

function WebSynergiesBrand({ theme }: { theme: 'light' | 'dark' }) {
  const webColor  = theme === 'light' ? '#ffffff'  : '#111827'
  const subColor  = theme === 'light' ? 'rgba(255,255,255,0.38)' : '#9ca3af'
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, lineHeight: 1 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: webColor,  fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Web</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#e36b1e', fontFamily: 'Inter, sans-serif', letterSpacing: '0.005em' }}>Synergies</span>
        <sup style={{ fontSize: 9, color: subColor, marginLeft: 1, fontWeight: 400 }}>®</sup>
      </div>
      <div style={{ fontSize: 9, color: subColor, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
        Bettering your Expectations
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
  const { token, loading, error } = useSelector((s: RootState) => s.auth)

  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [rememberMe,   setRememberMe]   = useState(false)
  const [showForgot,   setShowForgot]   = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => { if (token) navigate('/', { replace: true }) }, [token, navigate])
  useEffect(() => {
    api.get('/auth/setup-required').then(r => {
      if (r.data.setupRequired) navigate('/setup', { replace: true })
    })
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    dispatch(login({ username, password }))
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px 10px 38px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    background: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(145deg, #0b1426 0%, #111f3a 50%, #0e1a2e 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Subtle background grid ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(227,107,30,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-5%',  width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)',  pointerEvents: 'none' }} />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <WebSynergiesBrand theme="light" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>System Online</span>
        </div>
      </div>

      {/* ── Centred login card ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{
          width: '100%', maxWidth: 440,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>

          {/* Card header stripe */}
          <div style={{
            background: 'linear-gradient(135deg, #0b1426 0%, #1a2e50 100%)',
            padding: '28px 36px 24px',
            borderBottom: '3px solid #e36b1e',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              WebSynergies · Pharma Division
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Pharma LIMS
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
              Laboratory Information Management System
            </p>
          </div>

          {/* Form body */}
          <div style={{ padding: '32px 36px 28px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.015em' }}>
              Sign in to your account
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 13.5, color: '#6b7280' }}>
              Enter your LIMS credentials to continue
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Username */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }} htmlFor="lims-username">
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                    <IconPerson />
                  </span>
                  <input
                    id="lims-username"
                    style={inputBase}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus required autoComplete="username"
                    placeholder="Enter your username"
                    onFocus={e => { e.currentTarget.style.borderColor = '#e36b1e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227,107,30,0.12)' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }} htmlFor="lims-password">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                    <IconLock />
                  </span>
                  <input
                    id="lims-password"
                    style={{ ...inputBase, paddingRight: 42 }}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password"
                    placeholder="Enter your password"
                    onFocus={e => { e.currentTarget.style.borderColor = '#e36b1e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227,107,30,0.12)' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEyeOpen />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: '#e36b1e', cursor: 'pointer' }} />
                  Remember me
                </label>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background: 'none', border: 'none', fontSize: 13, color: '#e36b1e', cursor: 'pointer', padding: 0, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                  Forgot password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              {/* Sign In */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '11px',
                  background: loading ? '#6b7280' : 'linear-gradient(135deg, #e36b1e 0%, #c9530a 100%)',
                  color: '#ffffff', border: 'none', borderRadius: 8,
                  fontSize: 14.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(227,107,30,0.35)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #c9530a 0%, #b84500 100%)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(227,107,30,0.45)' } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #e36b1e 0%, #c9530a 100%)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(227,107,30,0.35)' } }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Authenticating…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Card footer */}
          <div style={{
            padding: '16px 36px',
            background: '#f9fafb',
            borderTop: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11.5, color: '#9ca3af' }}>21 CFR Part 11 · EU GMP Annex 11</span>
            <span style={{ fontSize: 11.5, color: '#9ca3af' }}>ISO 17025 · ALCOA+</span>
          </div>
        </div>

        {/* Below-card caption */}
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>
            Pharma LIMS &mdash; A WebSynergies Product &nbsp;·&nbsp; Validated per GAMP 5 &amp; 21 CFR §11
          </p>
        </div>
      </div>

      {/* ── Forgot-password modal ─────────────────────────────────────────────── */}
      {showForgot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}
        >
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#111827' }}>Password Reset</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280' }}>Administrator-authorised workflow — 21 CFR §11.300</p>
              </div>
              <button onClick={() => setShowForgot(false)}
                style={{ background: '#f3f4f6', border: 'none', width: 30, height: 30, borderRadius: 7, fontSize: 17, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
                ×
              </button>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                BCrypt password hashes cannot be reversed. A temporary password must be assigned by the System Administrator.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { n: '1', t: 'Contact your System Administrator or QA Manager' },
                { n: '2', t: 'Admin panel → Users → Reset Password' },
                { n: '3', t: 'Temporary password issued and audit-logged automatically' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: '#0b1426', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, paddingTop: 2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForgot(false)}
              style={{ width: '100%', padding: '10px', background: '#0b1426', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1a2e50' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0b1426' }}>
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
