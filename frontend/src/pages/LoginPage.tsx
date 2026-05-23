import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26: Login page — all four elements mandatory:
//   username · password · forgot-password · remember-me
// Forgot-password: admin-initiated reset (no SMTP in system — admin resets via /api/v1/auth/reset-password)

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function IconPerson() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconEyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconFlask() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Flask body */}
      <path
        d="M24 4 L24 26 L10 50 C8.5 52.5 10 56 13 56 L51 56 C54 56 55.5 52.5 54 50 L40 26 L40 4 Z"
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Flask neck bar */}
      <line x1="20" y1="10" x2="44" y2="10" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
      {/* Liquid inside flask */}
      <path
        d="M16 44 C16 44 18 38 32 38 C46 38 48 44 48 44 L54 56 C54 56 52.5 58 51 58 L13 58 C11.5 58 10 56 10 56 Z"
        fill="rgba(56,189,248,0.3)"
        stroke="none"
      />
      {/* Bubbles */}
      <circle cx="28" cy="47" r="2" fill="rgba(56,189,248,0.6)" />
      <circle cx="36" cy="43" r="1.5" fill="rgba(56,189,248,0.5)" />
      <circle cx="32" cy="50" r="1.2" fill="rgba(56,189,248,0.4)" />
      {/* Molecule dots */}
      <circle cx="50" cy="12" r="3" fill="rgba(56,189,248,0.7)" />
      <circle cx="56" cy="20" r="2" fill="rgba(56,189,248,0.5)" />
      <line x1="50" y1="12" x2="56" y2="20" stroke="rgba(56,189,248,0.5)" strokeWidth="1.5" />
    </svg>
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
  const [isMobile,     setIsMobile]     = useState(false)

  // Track viewport width for responsive behaviour
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: '#f8fafc',
  }

  const leftPanelStyle: React.CSSProperties = {
    display: isMobile ? 'none' : 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '45%',
    minWidth: 420,
    background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f2942 100%)',
    padding: '48px 52px',
    position: 'relative',
    overflow: 'hidden',
  }

  const leftDecorStyle: React.CSSProperties = {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(37, 99, 235, 0.08)',
    pointerEvents: 'none',
  }

  const leftDecorStyle2: React.CSSProperties = {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: '50%',
    background: 'rgba(56, 189, 248, 0.06)',
    pointerEvents: 'none',
  }

  const rightPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '40px 24px' : '48px 64px',
    background: '#ffffff',
  }

  const formCardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 400,
  }

  const inputWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  }

  const inputIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 14,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px 11px 40px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
    background: '#f8fafc',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#475569',
    marginBottom: 6,
  }

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    background: loading ? '#334155' : '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    letterSpacing: '0.01em',
    transition: 'background 0.15s, transform 0.1s',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  }

  return (
    <div style={pageStyle}>
      {/* ── Left branding panel ───────────────────────────────────────────────── */}
      <div style={leftPanelStyle}>
        {/* Decorative circles */}
        <div style={leftDecorStyle} />
        <div style={leftDecorStyle2} />

        {/* Top: logo mark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(37, 99, 235, 0.25)',
              border: '1px solid rgba(37, 99, 235, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              </svg>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              WebSynergies
            </span>
          </div>
        </div>

        {/* Centre: hero content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ marginBottom: 32 }}>
            <IconFlask />
          </div>

          <h1 style={{
            margin: '0 0 12px',
            fontSize: 36,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}>
            Pharma LIMS
          </h1>

          <p style={{
            margin: '0 0 36px',
            fontSize: 15,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            maxWidth: 320,
          }}>
            End-to-end laboratory information management — 21 CFR Part 11 compliant
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'GxP-ready audit trail',
              'E-signature (§11.50)',
              'Neon PostgreSQL 16',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'rgba(56,189,248,0.12)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <IconCheck />
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: compliance badges */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {['ISO/IEC 27001', 'EU Annex 11', '21 CFR §11'].map(badge => (
              <span key={badge} style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 20,
              }}>
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div style={rightPanelStyle}>
        <div style={formCardStyle}>
          {/* Mobile-only logo */}
          {isMobile && (
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 52, height: 52, borderRadius: 14,
                background: '#0f172a',
                marginBottom: 12,
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Pharma LIMS</div>
            </div>
          )}

          {/* Heading */}
          <h2 style={{
            margin: '0 0 6px',
            fontSize: 26,
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}>
            Welcome back
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Sign in to your laboratory account
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Username field */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle} htmlFor="lims-username">Username</label>
              <div style={inputWrapperStyle}>
                <span style={inputIconStyle}><IconPerson /></span>
                <input
                  id="lims-username"
                  style={inputStyle}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.currentTarget.style.background = '#ffffff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f8fafc' }}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle} htmlFor="lims-password">Password</label>
              <div style={inputWrapperStyle}>
                <span style={inputIconStyle}><IconLock /></span>
                <input
                  id="lims-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.currentTarget.style.background = '#ffffff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f8fafc' }}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 12,
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: '#94a3b8',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 14 }}>
              {/* Element 4: Remember me */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: '#475569', cursor: 'pointer', userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#0f172a', cursor: 'pointer' }}
                />
                Remember me
              </label>

              {/* Element 3: Forgot password */}
              <button
                type="button"
                style={{
                  background: 'none', border: 'none', fontSize: 13,
                  color: '#2563eb', cursor: 'pointer', padding: 0,
                  fontWeight: 500,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
                onClick={() => setShowForgot(true)}
              >
                Forgot password?
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '10px 12px', marginBottom: 16,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Sign In button */}
            <button
              type="submit"
              style={btnStyle}
              disabled={loading}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1e293b' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0f172a' }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <p style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
            Pharma LIMS &mdash; 21 CFR Part 11 Compliant Platform<br />
            <span style={{ color: '#cbd5e1' }}>Protected under ISO/IEC 27001 &amp; EU Annex 11</span>
          </p>
        </div>
      </div>

      {/* ── Forgot-password modal — admin-initiated reset workflow ────────────── */}
      {showForgot && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}
        >
          <div style={{
            background: '#ffffff', borderRadius: 16,
            padding: 32, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Password Reset
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Administrator-authorised workflow</p>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                style={{
                  background: '#f1f5f9', border: 'none',
                  width: 32, height: 32, borderRadius: 8,
                  fontSize: 18, cursor: 'pointer', color: '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, flexShrink: 0,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Info banner */}
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                <strong>BCrypt authentication (21 CFR §11.300)</strong><br />
                Password resets require administrator authorisation to maintain audit integrity.
              </p>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { step: '1', text: 'Contact your System Administrator or QA Manager' },
                { step: '2', text: 'They will use Admin panel → Users → Reset Password' },
                { step: '3', text: 'A temporary password will be assigned and audit-logged' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: '#0f172a', color: '#ffffff',
                    fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, paddingTop: 2 }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowForgot(false)}
              style={{
                width: '100%', padding: '11px',
                background: '#0f172a', color: '#ffffff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0f172a' }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Spinner keyframe — injected once as a style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
