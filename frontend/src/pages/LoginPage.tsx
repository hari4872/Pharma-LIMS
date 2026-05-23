import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26 — username · password · forgot-password · remember-me

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

  const inputCls: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #d1d5db', borderRadius: 8,
    paddingTop: 10, paddingBottom: 10, paddingLeft: 38, paddingRight: 12,
    fontSize: 14, color: '#111827', background: '#ffffff',
    outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    placeholder: '#9ca3af',
  }

  const features = [
    { icon: 'shield', title: 'Audit-Ready by Design',       desc: 'Immutable e-signatures, full traceability, ALCOA+ aligned.' },
    { icon: 'flask',  title: 'Complete Sample Lifecycle',    desc: 'Registration through testing, QA review, and CoA release.' },
    { icon: 'check',  title: 'Quality & Compliance',         desc: 'OOS handling, stability tracking, and 21 CFR §11 e-signature.' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif', background: '#ffffff' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────────── */}
      <aside style={{
        display: 'none',
        position: 'relative',
        overflow: 'hidden',
        color: '#ffffff',
        padding: '48px 52px',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
        className="left-panel"
      >
        {/* Gradient background */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)', zIndex: 0 }} />
        {/* Blur blobs */}
        <div style={{ position: 'absolute', top: -128, left: -128, width: 384, height: 384, borderRadius: '50%', background: 'rgba(103,232,249,0.2)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -128, right: -96, width: 448, height: 448, borderRadius: '50%', background: 'rgba(94,234,212,0.15)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 40, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.025em', color: '#ffffff' }}>
            Laboratory<br />Information<br />
            <span style={{ color: '#99f6e4' }}>Built for Pharma.</span>
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.75 }}>
            End-to-end sample management, electronic batch records, and quality release —
            engineered for regulated pharma environments and audit-ready operations.
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 420 }}>
          {features.map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.icon === 'shield' && (
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="#99f6e4" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                )}
                {f.icon === 'flask' && (
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="#99f6e4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {f.icon === 'check' && (
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#99f6e4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            borderRadius: 999, background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 12px', fontSize: 12, fontWeight: 500,
            color: 'rgba(255,255,255,0.9)', marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            GMP Compliant · 21 CFR Part 11 Ready
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <span>ISO 17025</span>
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)', alignSelf: 'center' }} />
              <span>GxP Compliant</span>
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)', alignSelf: 'center' }} />
              <span>EU GMP Annex 11</span>
            </div>
            <div>© {new Date().getFullYear()} Web Synergies</div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Real WebSynergies logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <img src="/Logo.png" alt="Web Synergies" style={{ height: 80, width: 'auto', objectFit: 'contain' }} />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              Sign in to your workspace
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#374151' }}>
              Laboratory Information Management Suite
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 13.5, color: '#991b1b', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: '#374151', marginBottom: 6 }} htmlFor="lims-username">
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#9ca3af', pointerEvents: 'none' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input id="lims-username" type="text" style={inputCls}
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoFocus required autoComplete="username" placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15,118,110,0.12)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }} htmlFor="lims-password">Password</label>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background: 'none', border: 'none', fontSize: 12.5, fontWeight: 500, color: '#0f766e', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#9ca3af', pointerEvents: 'none' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zM16 10V7a4 4 0 10-8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input id="lims-password" type={showPassword ? 'text' : 'password'}
                  style={{ ...inputCls, paddingRight: 40 }}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15,118,110,0.12)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
                  aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                      <path d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 4.24A9.13 9.13 0 0112 4c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-3.06 4.36M6.61 6.61A11.74 11.74 0 001 11.5C2.73 15.89 7 19 12 19c1.61 0 3.14-.32 4.54-.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#0f766e', cursor: 'pointer', borderRadius: 4 }} />
              Keep me signed in on this device
            </label>

            {/* Sign In button */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px 16px',
                background: loading ? '#6b7280' : '#1d4ed8',
                color: '#ffffff', border: 'none', borderRadius: 8,
                fontSize: 14.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
                boxShadow: loading ? 'none' : '0 1px 3px rgba(0,0,0,0.12)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1e40af' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8' }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Mobile copyright */}
          <div style={{ marginTop: 36, textAlign: 'center', fontSize: 11.5, color: '#d1d5db' }}>
            © {new Date().getFullYear()} Web Synergies · GMP · 21 CFR Part 11
          </div>
        </div>
      </main>

      {/* ── Forgot-password modal ─────────────────────────────────────────────── */}
      {showForgot && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}
        >
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#111827' }}>Password Reset</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280' }}>Administrator-authorised workflow — 21 CFR §11.300</p>
              </div>
              <button onClick={() => setShowForgot(false)}
                style={{ background: '#f3f4f6', border: 'none', width: 30, height: 30, borderRadius: 7, fontSize: 18, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>×</button>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.65 }}>
                BCrypt password hashes cannot be reversed. A temporary password must be assigned by your System Administrator.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
              {[
                { n: '1', t: 'Contact your System Administrator or QA Manager' },
                { n: '2', t: 'Admin panel → Users → Reset Password' },
                { n: '3', t: 'Temporary password issued and audit-logged automatically' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: '#0f766e', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, paddingTop: 2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForgot(false)}
              style={{ width: '100%', padding: '10px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#115e59' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0f766e' }}>
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .left-panel { display: flex !important; width: 52%; }
        }
      `}</style>
    </div>
  )
}
