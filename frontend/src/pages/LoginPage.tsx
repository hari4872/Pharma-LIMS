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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconEyeOpen() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── WebSynergies Logo ────────────────────────────────────────────────────────
// Accurate SVG recreation from actual brand asset

function WebSynergiesLogo({ variant }: { variant: 'light' | 'dark' }) {
  const webColor = variant === 'light' ? '#ffffff' : '#1a1a1a'
  const tagColor = variant === 'light' ? 'rgba(255,255,255,0.45)' : '#6b7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Logo mark + wordmark row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* SVG mark — W columns + orange band + circular rings */}
        <svg width="52" height="40" viewBox="0 0 52 40" fill="none">
          {/* Circular rings (grey, behind everything) */}
          <circle cx="36" cy="20" r="18" stroke={variant === 'light' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} strokeWidth="1.5" fill="none"/>
          <circle cx="36" cy="20" r="12" stroke={variant === 'light' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} strokeWidth="1.5" fill="none"/>
          <circle cx="36" cy="20" r="6"  stroke={variant === 'light' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} strokeWidth="1.5" fill="none"/>
          <circle cx="36" cy="20" r="2"  fill={variant === 'light' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}/>

          {/* W mark — two columns of stacked blocks */}
          <rect x="1"  y="2"  width="9" height="15" rx="1.5" fill={webColor}/>
          <rect x="1"  y="20" width="9" height="15" rx="1.5" fill={webColor}/>
          <rect x="13" y="2"  width="9" height="15" rx="1.5" fill={webColor}/>
          <rect x="13" y="20" width="9" height="15" rx="1.5" fill={webColor}/>

          {/* Orange diagonal band */}
          <path d="M0 25 L52 12 L52 27 L0 40 Z" fill="#d95d0a"/>

          {/* "Synergies" text on orange band */}
          <text x="5" y="34" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Inter, Arial, sans-serif" letterSpacing="0.3">Synergies</text>
        </svg>

        {/* "Web" wordmark beside SVG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1 }}>
            <span style={{
              fontSize: 28, fontWeight: 900, color: webColor,
              fontFamily: 'Inter, Arial Black, sans-serif',
              letterSpacing: '-0.03em', lineHeight: 1,
            }}>Web</span>
            <sup style={{ fontSize: 10, color: tagColor, marginTop: 4, marginLeft: 1, fontWeight: 400 }}>™</sup>
          </div>
        </div>
      </div>

      {/* "A Yokogawa Company" tagline */}
      <div style={{
        fontSize: 10, fontWeight: 500, color: tagColor,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        fontFamily: 'Inter, sans-serif',
        paddingLeft: 2,
      }}>
        A Yokogawa Company
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
    const check = () => setIsMobile(window.innerWidth < 900)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px 11px 40px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14,
    color: '#111827', background: '#fafafa',
    outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  }

  const features = [
    'End-to-end sample lifecycle management',
    'GxP-ready electronic audit trail',
    '21 CFR §11.50 e-signature compliance',
    'EU GMP Annex 11 validated platform',
    'ICH Q1A stability & traceability',
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── LEFT PANEL — dark branding ─────────────────────────────────────── */}
      {!isMobile && (
        <div style={{
          width: '42%', minWidth: 400,
          background: 'linear-gradient(170deg, #0c1524 0%, #11203a 55%, #0e1b30 100%)',
          display: 'flex', flexDirection: 'column',
          padding: '52px 52px 44px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Subtle background rings */}
          <div style={{ position: 'absolute', bottom: -120, right: -120, width: 480, height: 480, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80,  right: -80,  width: 360, height: 360, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -60, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(227,107,30,0.04)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <WebSynergiesLogo variant="light" />
          </div>

          {/* Hero content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1, paddingTop: 60, paddingBottom: 40 }}>
            {/* Orange accent line */}
            <div style={{ width: 40, height: 3, background: '#d95d0a', borderRadius: 2, marginBottom: 24 }} />

            <h1 style={{ margin: '0 0 6px', fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              LIMS
            </h1>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#d95d0a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Laboratory Information Management System
            </p>
            <p style={{ margin: '0 0 40px', fontSize: 14, color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, maxWidth: 300 }}>
              Regulation-grade platform covering the complete pharmaceutical sample lifecycle.
            </p>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d95d0a', flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom compliance */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }} />
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.8, letterSpacing: '0.03em' }}>
              21 CFR Part 11 &nbsp;·&nbsp; 21 CFR Part 211 &nbsp;·&nbsp; EU GMP Annex 11<br />
              ICH Q1A &nbsp;·&nbsp; ISO 17025 &nbsp;·&nbsp; ALCOA+ &nbsp;·&nbsp; GAMP 5
            </p>
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL — white form ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '48px 24px' : '48px 64px',
        background: '#ffffff',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          {isMobile && (
            <div style={{ marginBottom: 36 }}>
              <WebSynergiesLogo variant="dark" />
            </div>
          )}

          {/* Heading */}
          <h2 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Sign in
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
            Access your LIMS account to continue
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 7 }} htmlFor="lims-username">
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                  <IconPerson />
                </span>
                <input
                  id="lims-username" style={inputStyle}
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoFocus required autoComplete="username"
                  placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor = '#d95d0a'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,93,10,0.12)'; e.currentTarget.style.background = '#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#fafafa' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 7 }} htmlFor="lims-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                  <IconLock />
                </span>
                <input
                  id="lims-password" style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor = '#d95d0a'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,93,10,0.12)'; e.currentTarget.style.background = '#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#fafafa' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                  aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <IconEyeOff /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 26 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#d95d0a', cursor: 'pointer' }} />
                Remember me
              </label>
              <button type="button" onClick={() => setShowForgot(true)}
                style={{ background: 'none', border: 'none', fontSize: 13.5, color: '#d95d0a', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                Forgot password?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '11px 14px', marginBottom: 18 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Sign In button */}
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#9ca3af' : '#d95d0a',
                color: '#ffffff', border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif',
                transition: 'background 0.15s, box-shadow 0.15s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(217,93,10,0.3)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#b84d07'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(217,93,10,0.4)' } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#d95d0a'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(217,93,10,0.3)' } }}
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

          {/* Footer */}
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#d1d5db', lineHeight: 1.8 }}>
              LIMS &mdash; A WebSynergies Product<br />
              <span>21 CFR Part 11 &nbsp;·&nbsp; EU GMP Annex 11 &nbsp;·&nbsp; ISO 17025</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Forgot-password modal ─────────────────────────────────────────────── */}
      {showForgot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}
        >
          <div style={{ background: '#ffffff', borderRadius: 14, padding: '32px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#111827' }}>Password Reset</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280' }}>Administrator-authorised workflow — 21 CFR §11.300</p>
              </div>
              <button onClick={() => setShowForgot(false)}
                style={{ background: '#f3f4f6', border: 'none', width: 30, height: 30, borderRadius: 7, fontSize: 17, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>×</button>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                BCrypt password hashes cannot be reversed. A temporary password must be assigned by the System Administrator.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
              {[
                { n: '1', t: 'Contact your System Administrator or QA Manager' },
                { n: '2', t: 'Admin panel → Users → Reset Password' },
                { n: '3', t: 'Temporary password issued and audit-logged automatically' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: '#0c1524', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, paddingTop: 2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForgot(false)}
              style={{ width: '100%', padding: '11px', background: '#0c1524', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1a2e50' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0c1524' }}>
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
