import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26: Login page — all four elements mandatory:
//   username · password · forgot-password · remember-me

// ─── Icons ───────────────────────────────────────────────────────────────────

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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e36b1e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── WebSynergies Logo ────────────────────────────────────────────────────────
// Inline SVG approximation of the WebSynergies brand mark

function WebSynergiesLogoLight() {
  // Light version for dark panel background
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* W mark — two columns of stacked rectangles */}
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        {/* Left column */}
        <rect x="2"  y="2"  width="8" height="14" rx="1" fill="rgba(255,255,255,0.95)" />
        <rect x="2"  y="20" width="8" height="14" rx="1" fill="rgba(255,255,255,0.95)" />
        {/* Right column */}
        <rect x="14" y="2"  width="8" height="14" rx="1" fill="rgba(255,255,255,0.95)" />
        <rect x="14" y="20" width="8" height="14" rx="1" fill="rgba(255,255,255,0.95)" />
        {/* Orange diagonal band */}
        <path d="M0 22 L36 10 L36 22 L0 34 Z" fill="#e36b1e" opacity="0.9" />
        {/* Circular rings */}
        <circle cx="26" cy="16" r="8"  stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        <circle cx="26" cy="16" r="5"  stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        <circle cx="26" cy="16" r="2.5" fill="rgba(255,255,255,0.35)" />
      </svg>
      {/* Text */}
      <div style={{ lineHeight: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>
            Web
          </span>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#e36b1e', letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif' }}>
            Synergies
          </span>
          <sup style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 1, lineHeight: 1 }}>®</sup>
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
          Bettering your Expectations
        </div>
      </div>
    </div>
  )
}

function WebSynergiesLogoDark() {
  // Dark version for white panel background
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
        <rect x="2"  y="2"  width="8" height="14" rx="1" fill="#231f20" />
        <rect x="2"  y="20" width="8" height="14" rx="1" fill="#231f20" />
        <rect x="14" y="2"  width="8" height="14" rx="1" fill="#231f20" />
        <rect x="14" y="20" width="8" height="14" rx="1" fill="#231f20" />
        <path d="M0 22 L36 10 L36 22 L0 34 Z" fill="#e36b1e" opacity="0.95" />
        <circle cx="26" cy="16" r="8"  stroke="#9ca3af" strokeWidth="1" fill="none" />
        <circle cx="26" cy="16" r="5"  stroke="#9ca3af" strokeWidth="1" fill="none" />
        <circle cx="26" cy="16" r="2.5" fill="#9ca3af" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#231f20', fontFamily: 'Inter, sans-serif' }}>Web</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e36b1e', fontFamily: 'Inter, sans-serif' }}>Synergies</span>
          <sup style={{ fontSize: 8, color: '#9ca3af', marginLeft: 1 }}>®</sup>
        </div>
        <div style={{ fontSize: 8.5, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
          Bettering your Expectations
        </div>
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
  const [isMobile,     setIsMobile]     = useState(false)

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

  // ─── Styles ──────────────────────────────────────────────────────────────────

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
    background: 'linear-gradient(160deg, #0f172a 0%, #1a2744 55%, #0f2035 100%)',
    padding: '48px 52px',
    position: 'relative',
    overflow: 'hidden',
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
    fontSize: 13.5,
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
    transition: 'background 0.15s',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  }

  const features = [
    { label: 'End-to-End Sample Lifecycle Management' },
    { label: 'GxP-Ready Electronic Audit Trail' },
    { label: '21 CFR §11.50 E-Signature Compliance' },
    { label: 'EU GMP Annex 11 Validated Platform' },
  ]

  return (
    <div style={pageStyle}>

      {/* ── Left branding panel ───────────────────────────────────────────────── */}
      <div style={leftPanelStyle}>
        {/* Subtle decorative circles */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%', background: 'rgba(227,107,30,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(37,99,235,0.05)', pointerEvents: 'none' }} />

        {/* Top: WebSynergies logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <WebSynergiesLogoLight />
        </div>

        {/* Centre: LIMS hero */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 48, paddingBottom: 48 }}>

          {/* Divider accent */}
          <div style={{ width: 48, height: 3, background: '#e36b1e', borderRadius: 2, marginBottom: 28 }} />

          <h1 style={{ margin: '0 0 8px', fontSize: 38, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Pharma LIMS
          </h1>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 600, color: '#e36b1e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Laboratory Information Management System
          </p>
          <p style={{ margin: '0 0 40px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 310 }}>
            A fully integrated, regulation-grade platform managing the complete pharmaceutical sample lifecycle — from registration to CoA release.
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {features.map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: 'rgba(227,107,30,0.15)',
                  border: '1px solid rgba(227,107,30,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <IconCheck />
                </div>
                <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', fontWeight: 500 }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: regulatory line */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 18 }} />
          <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', lineHeight: 1.7 }}>
            Compliant with 21 CFR Part 11 · 21 CFR Part 211 · EU GMP Annex 11<br />
            ICH Q1A · ISO 17025 · ALCOA+ · GAMP 5
          </p>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '48px 64px',
        background: '#ffffff',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          {isMobile && (
            <div style={{ marginBottom: 32 }}>
              <WebSynergiesLogoDark />
            </div>
          )}

          {/* Right-panel logo (desktop) */}
          {!isMobile && (
            <div style={{ marginBottom: 40 }}>
              <WebSynergiesLogoDark />
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f5f9', marginBottom: 32 }} />

          {/* Heading */}
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            LIMS Sign In
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
            Access your laboratory management account
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="lims-username">Username</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 14, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1 }}>
                  <IconPerson />
                </span>
                <input
                  id="lims-username"
                  style={inputStyle}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor = '#e36b1e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227,107,30,0.1)'; e.currentTarget.style.background = '#ffffff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f8fafc' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle} htmlFor="lims-password">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 14, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1 }}>
                  <IconLock />
                </span>
                <input
                  id="lims-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor = '#e36b1e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(227,107,30,0.1)'; e.currentTarget.style.background = '#ffffff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f8fafc' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#e36b1e', cursor: 'pointer' }}
                />
                Remember me
              </label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 13, color: '#e36b1e', cursor: 'pointer', padding: 0, fontWeight: 500, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
                onClick={() => setShowForgot(true)}
              >
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
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
          <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
              Pharma LIMS &mdash; A WebSynergies Product<br />
              <span style={{ color: '#cbd5e1' }}>21 CFR Part 11 &nbsp;·&nbsp; EU GMP Annex 11 &nbsp;·&nbsp; ISO 17025</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Forgot-password modal ────────────────────────────────────────────── */}
      {showForgot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}
        >
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Password Reset</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Administrator-authorised workflow</p>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 8, fontSize: 18, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
                aria-label="Close"
              >×</button>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                <strong>BCrypt authentication (21 CFR §11.300)</strong><br />
                Password resets require administrator authorisation to maintain audit integrity.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { step: '1', text: 'Contact your System Administrator or QA Manager' },
                { step: '2', text: 'They will use Admin panel → Users → Reset Password' },
                { step: '3', text: 'A temporary password will be assigned and audit-logged' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0f172a', color: '#ffffff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {step}
                  </div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, paddingTop: 2 }}>{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowForgot(false)}
              style={{ width: '100%', padding: '11px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e293b' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0f172a' }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
