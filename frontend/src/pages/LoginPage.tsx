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

  const features = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#0d6e6e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      text: 'End-to-end sample lifecycle — registration, testing, QA review, and CoA release.',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#0d6e6e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      text: 'Immutable e-signature audit trail — 21 CFR §11.50, ALCOA+, GxP compliant.',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="#0d6e6e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      text: 'OOS detection, stability tracking, ICH Q1A pulls, and real-time SignalR alerts.',
    },
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e2e8f0', borderRadius: 10,
    padding: '11px 14px 11px 40px',
    fontSize: 14, color: '#0f172a', background: '#f8fafc',
    outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(135deg, #c8f0ea 0%, #8dd8d0 35%, #5bbfb5 65%, #2ea89c 100%)',
      padding: '40px 60px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative background circles */}
      <div style={{ position:'absolute', top:'-18%', right:'-6%', width:520, height:520, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-22%', left:'-8%', width:580, height:580, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

      {/* ══ Main layout ═══════════════════════════════════════════════════════ */}
      <div style={{
        width: '100%', maxWidth: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: 64,
      }}>

        {/* ══ LEFT — branding ═══════════════════════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Logo at top */}
          <div style={{ marginBottom: 32 }}>
            <img src="/Logo.png" alt="Web Synergies" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          </div>

          {/* LIMS heading */}
          <h1 style={{ margin: '0 0 12px', fontSize: 60, fontWeight: 900, color: '#0a2e2b', letterSpacing: '-0.04em', lineHeight: 1 }}>
            LIMS
          </h1>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#0d5c57', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Laboratory Information Management System
          </p>
          <p style={{ margin: '0 0 36px', fontSize: 15, color: '#0d4a46', lineHeight: 1.75, maxWidth: 420, opacity: 0.82 }}>
            A modern laboratory information management platform
            designed for regulated environments, rapid sample tracking,
            instrument visibility, and dependable quality workflows.
          </p>

          {/* Glassmorphism feature cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 9,
                  background: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(13,110,110,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.icon}
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: '#0a3330', lineHeight: 1.55 }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>

          {/* Compliance footer */}
          <div style={{ marginTop: 24, fontSize: 11.5, color: 'rgba(10,46,43,0.5)', letterSpacing: '0.03em' }}>
            21 CFR Part 11 &nbsp;·&nbsp; EU GMP Annex 11 &nbsp;·&nbsp; ISO 17025 &nbsp;·&nbsp; ICH Q1A &nbsp;·&nbsp; ALCOA+ &nbsp;·&nbsp; GAMP 5
          </div>
        </div>

        {/* ══ RIGHT — login card ════════════════════════════════════════════ */}
        <div style={{
          flexShrink: 0,
          width: 400,
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(10,46,43,0.18), 0 0 0 1px rgba(255,255,255,0.5)',
          padding: '36px 36px 28px',
        }}>

          {/* Card heading — no avatar, clean */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#0a2e2b', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Sign in to your lab workspace
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Trusted access for analysts, reviewers, and quality teams.
            </p>
          </div>

          {/* System status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f0fdf9', border: '1px solid #99f6e4',
            borderRadius: 8, padding: '9px 14px', marginBottom: 24,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0d6e6e' }}>
              System status: all laboratory services operational
            </span>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'11px 14px', marginBottom:18 }}>
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" style={{ flexShrink:0, marginTop:1 }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize:13, color:'#991b1b', lineHeight:1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }} htmlFor="lims-username">Username</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', display:'flex', pointerEvents:'none', color:'#94a3b8' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <input id="lims-username" type="text" style={inputStyle}
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoFocus required autoComplete="username" placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor='#0d6e6e'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(13,110,110,0.12)'; e.currentTarget.style.background='#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f8fafc' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151' }} htmlFor="lims-password">Password</label>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background:'none', border:'none', fontSize:12.5, fontWeight:600, color:'#0d6e6e', cursor:'pointer', padding:0, fontFamily:'Inter, sans-serif' }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', display:'flex', pointerEvents:'none', color:'#94a3b8' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zM16 10V7a4 4 0 10-8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <input id="lims-password" type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor='#0d6e6e'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(13,110,110,0.12)'; e.currentTarget.style.background='#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f8fafc' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', padding:0, cursor:'pointer', color:'#94a3b8', display:'flex' }}>
                  {showPassword
                    ? <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 4.24A9.13 9.13 0 0112 4c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-3.06 4.36M6.61 6.61A11.74 11.74 0 001 11.5C2.73 15.89 7 19 12 19c1.61 0 3.14-.32 4.54-.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, color:'#6b7280', cursor:'pointer', userSelect:'none', marginBottom:22 }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width:15, height:15, accentColor:'#0d6e6e', cursor:'pointer' }}/>
              Keep me signed in on this device
            </label>

            {/* Log In button */}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'12px 16px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0d6e6e 0%, #0a4f4f 100%)',
                color:'#ffffff', border:'none', borderRadius:10,
                fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'Inter, sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(13,110,110,0.35)',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { if(!loading){ e.currentTarget.style.background='linear-gradient(135deg, #0a5555 0%, #083838 100%)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(13,110,110,0.45)' }}}
              onMouseLeave={e => { if(!loading){ e.currentTarget.style.background='linear-gradient(135deg, #0d6e6e 0%, #0a4f4f 100%)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(13,110,110,0.35)' }}}
            >
              {loading ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Authenticating…
                </>
              ) : 'Log In'}
            </button>
          </form>

          {/* Card footer */}
          <div style={{ marginTop:24, paddingTop:18, borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'#94a3b8' }}>21 CFR Part 11</span>
            <span style={{ fontSize:11, color:'#94a3b8' }}>ISO-aligned workflow</span>
            <span style={{ fontSize:11, color:'#94a3b8' }}>© {new Date().getFullYear()} Web Synergies</span>
          </div>
        </div>
      </div>

      {/* ── Forgot-password modal ──────────────────────────────────────────── */}
      {showForgot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,46,43,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}>
          <div style={{ background:'#ffffff', borderRadius:16, padding:32, width:'100%', maxWidth:420, boxShadow:'0 32px 80px rgba(10,46,43,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <h3 style={{ margin:'0 0 4px', fontSize:17, fontWeight:700, color:'#0a2e2b' }}>Password Reset</h3>
                <p style={{ margin:0, fontSize:12.5, color:'#64748b' }}>Administrator-authorised — 21 CFR §11.300</p>
              </div>
              <button onClick={() => setShowForgot(false)}
                style={{ background:'#f1f5f9', border:'none', width:30, height:30, borderRadius:7, fontSize:17, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>×</button>
            </div>
            <div style={{ background:'#f0fdf9', border:'1px solid #99f6e4', borderRadius:8, padding:'11px 14px', marginBottom:20 }}>
              <p style={{ margin:0, fontSize:12.5, color:'#065f46', lineHeight:1.65 }}>
                BCrypt hashes cannot be reversed. A System Administrator must assign a temporary password.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:24 }}>
              {[
                { n:'1', t:'Contact your System Administrator or QA Manager' },
                { n:'2', t:'Admin panel → Users → Reset Password' },
                { n:'3', t:'Temporary password issued and audit-logged automatically' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
                  <div style={{ width:22, height:22, borderRadius:5, background:'#0d6e6e', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</div>
                  <span style={{ fontSize:13, color:'#374151', lineHeight:1.6, paddingTop:2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForgot(false)}
              style={{ width:'100%', padding:'10px', background:'linear-gradient(135deg, #0d6e6e 0%, #0a4f4f 100%)', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg, #0a5555 0%, #083838 100%)' }}
              onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg, #0d6e6e 0%, #0a4f4f 100%)' }}>
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
