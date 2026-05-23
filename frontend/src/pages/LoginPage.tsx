import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { login } from '@/store/authSlice'
import api from '@/api/client'

// Spec Contract 4 §26 — username · password · forgot-password · remember-me

// ── Colour tokens ─────────────────────────────────────────────────────────────
// MES = teal (#134e4a → #14b8a6).  LIMS = deep navy-indigo, totally distinct.
const C = {
  p900: '#040c24',   // darkest navy
  p800: '#081840',   // panel bg start
  p700: '#0e2a6b',   // panel bg mid
  p600: '#1a3d9e',   // panel bg end / accent
  p400: '#4d7fe8',   // icon / highlight
  p200: '#a8c4f8',   // hero accent text
  btn:  '#1a3d9e',   // sign-in button
  btnH: '#0e2a6b',   // hover
  focus:'#1a3d9e',   // input ring
}

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

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    padding: '10px 12px 10px 38px',
    fontSize: 14, color: '#0f172a', background: '#f8fafc',
    outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  }

  const features = [
    { icon: 'dna',    title: 'Full Sample Lifecycle',     desc: 'From registration through testing, QA review, and CoA release.' },
    { icon: 'shield', title: 'Audit-Ready by Design',     desc: 'Immutable e-signatures, 21 CFR §11.50, ALCOA+ aligned.' },
    { icon: 'chart',  title: 'OOS & Stability Tracking',  desc: 'ICH Q1A stability pulls, OOS investigations, deviation alerts.' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ═══════════════════════════ LEFT PANEL ════════════════════════════════ */}
      <aside className="lims-left" style={{
        display: 'none',
        width: '52%',
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 56px',
        color: '#ffffff',
      }}>
        {/* Deep navy-indigo gradient — completely unlike MES teal */}
        <div style={{ position:'absolute', inset:0, zIndex:0,
          background: `linear-gradient(150deg, ${C.p800} 0%, ${C.p700} 50%, ${C.p600} 100%)` }} />

        {/* Soft radial glows */}
        <div style={{ position:'absolute', top:'-10%', right:'-5%', width:520, height:520,
          borderRadius:'50%', background:'rgba(74,112,232,0.12)', filter:'blur(80px)', zIndex:0, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-15%', left:'-8%', width:440, height:440,
          borderRadius:'50%', background:'rgba(26,61,158,0.2)', filter:'blur(70px)', zIndex:0, pointerEvents:'none' }} />

        {/* Subtle grid */}
        <div style={{
          position:'absolute', inset:0, opacity:0.05, zIndex:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize:'44px 44px',
        }} />

        {/* Decorative hexagon-ring top-right */}
        <svg style={{ position:'absolute', top:32, right:32, opacity:0.07, zIndex:0, pointerEvents:'none' }}
          width="220" height="220" viewBox="0 0 220 220" fill="none">
          <circle cx="110" cy="110" r="100" stroke="white" strokeWidth="1"/>
          <circle cx="110" cy="110" r="75"  stroke="white" strokeWidth="1"/>
          <circle cx="110" cy="110" r="50"  stroke="white" strokeWidth="1"/>
          <circle cx="110" cy="110" r="25"  stroke="white" strokeWidth="1"/>
        </svg>

        {/* ── Hero text ── */}
        <div style={{ position:'relative', zIndex:1, maxWidth:400 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:28 }}>
            <div style={{ width:32, height:3, background: C.p400, borderRadius:2 }} />
            <span style={{ fontSize:11.5, fontWeight:600, color:`rgba(255,255,255,0.45)`,
              letterSpacing:'0.1em', textTransform:'uppercase' }}>
              WebSynergies · Pharma Division
            </span>
          </div>

          <h2 style={{ margin:'0 0 18px', fontSize:42, fontWeight:800,
            lineHeight:1.1, letterSpacing:'-0.03em', color:'#ffffff' }}>
            Laboratory<br/>Information<br/>
            <span style={{ color: C.p200 }}>Management System.</span>
          </h2>
          <p style={{ margin:0, fontSize:15, color:'rgba(255,255,255,0.65)', lineHeight:1.8, maxWidth:340 }}>
            Regulation-grade LIMS covering the complete pharmaceutical sample lifecycle
            — validated for 21 CFR Part 11 and EU GMP Annex 11.
          </p>
        </div>

        {/* ── Feature bullets ── */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:20, maxWidth:400 }}>
          {features.map(f => (
            <div key={f.title} style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{
                flexShrink:0, width:38, height:38, borderRadius:10,
                background:'rgba(255,255,255,0.07)',
                border:'1px solid rgba(255,255,255,0.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {f.icon === 'dna' && (
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                    <path d="M12 2C6 6 6 10 12 12s6 6 0 10M12 2c6 4 6 8 0 10s-6 6 0 10M6 4.5h12M6 19.5h12M5 7.5h14M5 16.5h14" stroke={C.p200} strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
                {f.icon === 'shield' && (
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke={C.p200} strokeWidth="1.7" strokeLinejoin="round"/>
                    <path d="M9 12l2 2 4-4" stroke={C.p200} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {f.icon === 'chart' && (
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                    <path d="M3 3v18h18M7 16l4-4 4 4 4-5" stroke={C.p200} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'#ffffff', marginBottom:3 }}>{f.title}</div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,0.55)', lineHeight:1.65 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ height:1, background:'rgba(255,255,255,0.08)', marginBottom:20 }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6,
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:999, padding:'4px 12px', fontSize:11.5, color:'rgba(255,255,255,0.8)', fontWeight:500 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block',
                boxShadow:'0 0 6px #4ade80' }} />
              21 CFR Part 11 · GMP Compliant
            </div>
            <span style={{ fontSize:11.5, color:'rgba(255,255,255,0.35)' }}>
              © {new Date().getFullYear()} Web Synergies
            </span>
          </div>
          <div style={{ marginTop:12, fontSize:11, color:'rgba(255,255,255,0.25)', letterSpacing:'0.03em', lineHeight:1.8 }}>
            ISO 17025 &nbsp;·&nbsp; EU GMP Annex 11 &nbsp;·&nbsp; ICH Q1A &nbsp;·&nbsp; ALCOA+ &nbsp;·&nbsp; GAMP 5
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════ RIGHT PANEL ═══════════════════════════════ */}
      <main style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'40px 24px',
        background:'#ffffff',
        borderLeft: `1px solid #f1f5f9`,
      }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* Logo */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
            <img src="/Logo.png" alt="Web Synergies" style={{ height:76, width:'auto', objectFit:'contain' }} />
          </div>

          {/* Thin rule */}
          <div style={{ height:1, background:'#f1f5f9', marginBottom:28 }} />

          {/* Heading */}
          <div style={{ marginBottom:28 }}>
            <h1 style={{ margin:'0 0 5px', fontSize:22, fontWeight:700, color:'#0f172a', letterSpacing:'-0.02em' }}>
              Sign in to your workspace
            </h1>
            <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#475569', letterSpacing:'0.01em' }}>
              LIMS — Laboratory Information Management Suite
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start',
              background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10,
              padding:'12px 14px', marginBottom:20 }}>
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ flexShrink:0, marginTop:1 }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize:13, color:'#991b1b', lineHeight:1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* Username */}
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}
                htmlFor="lims-username">Username</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', display:'flex', pointerEvents:'none', color:'#94a3b8' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <input id="lims-username" type="text" style={inputStyle}
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoFocus required autoComplete="username" placeholder="Enter your username"
                  onFocus={e => { e.currentTarget.style.borderColor=C.focus; e.currentTarget.style.boxShadow=`0 0 0 3px rgba(26,61,158,0.1)`; e.currentTarget.style.background='#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f8fafc' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151' }} htmlFor="lims-password">Password</label>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background:'none', border:'none', fontSize:12.5, fontWeight:500, color:C.btn, cursor:'pointer', padding:0, fontFamily:'Inter, sans-serif' }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', display:'flex', pointerEvents:'none', color:'#94a3b8' }}>
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zM16 10V7a4 4 0 10-8 0v3"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <input id="lims-password" type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight:40 }}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="Enter your password"
                  onFocus={e => { e.currentTarget.style.borderColor=C.focus; e.currentTarget.style.boxShadow=`0 0 0 3px rgba(26,61,158,0.1)`; e.currentTarget.style.background='#fff' }}
                  onBlur={e  => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f8fafc' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', padding:0, cursor:'pointer', color:'#94a3b8', display:'flex' }}
                  aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                      <path d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 4.24A9.13 9.13 0 0112 4c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-3.06 4.36M6.61 6.61A11.74 11.74 0 001 11.5C2.73 15.89 7 19 12 19c1.61 0 3.14-.32 4.54-.9"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, color:'#6b7280', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width:15, height:15, accentColor:C.btn, cursor:'pointer' }}/>
              Keep me signed in on this device
            </label>

            {/* Sign In */}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'12px 16px',
                background: loading ? '#94a3b8' : `linear-gradient(135deg, ${C.p600} 0%, ${C.p700} 100%)`,
                color:'#ffffff', border:'none', borderRadius:8,
                fontSize:14.5, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'Inter, sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(26,61,158,0.35)',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background=`linear-gradient(135deg, ${C.p700} 0%, ${C.p800} 100%)`; e.currentTarget.style.boxShadow='0 6px 18px rgba(26,61,158,0.45)' } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background=`linear-gradient(135deg, ${C.p600} 0%, ${C.p700} 100%)`; e.currentTarget.style.boxShadow='0 4px 14px rgba(26,61,158,0.35)' } }}
            >
              {loading ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Authenticating…
                </>
              ) : (
                <>
                  Sign in
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop:32, paddingTop:20, borderTop:'1px solid #f1f5f9', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:11.5, color:'#cbd5e1', lineHeight:1.8 }}>
              LIMS — A WebSynergies Product<br/>
              21 CFR Part 11 &nbsp;·&nbsp; EU GMP Annex 11 &nbsp;·&nbsp; ISO 17025
            </p>
          </div>
        </div>
      </main>

      {/* ── Forgot-password modal ─────────────────────────────────────────────── */}
      {showForgot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(4,12,36,0.65)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}>
          <div style={{ background:'#ffffff', borderRadius:14, padding:32, width:'100%', maxWidth:420, boxShadow:'0 32px 80px rgba(4,12,36,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <h3 style={{ margin:'0 0 4px', fontSize:17, fontWeight:700, color:'#0f172a' }}>Password Reset</h3>
                <p style={{ margin:0, fontSize:12.5, color:'#64748b' }}>Administrator-authorised — 21 CFR §11.300</p>
              </div>
              <button onClick={() => setShowForgot(false)}
                style={{ background:'#f1f5f9', border:'none', width:30, height:30, borderRadius:7, fontSize:17, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>×</button>
            </div>
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'11px 14px', marginBottom:20 }}>
              <p style={{ margin:0, fontSize:12.5, color:'#1e40af', lineHeight:1.65 }}>
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
                  <div style={{ width:22, height:22, borderRadius:5, background:C.btn, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</div>
                  <span style={{ fontSize:13, color:'#374151', lineHeight:1.6, paddingTop:2 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForgot(false)}
              style={{ width:'100%', padding:'10px', background:C.btn, color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', transition:'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.btnH }}
              onMouseLeave={e => { e.currentTarget.style.background = C.btn }}>
              Understood
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) { .lims-left { display: flex !important; } }
      `}</style>
    </div>
  )
}
