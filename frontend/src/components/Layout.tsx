import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'
import { ToastContainer, toast } from '@/components/Toast'
import CommandPalette from '@/components/CommandPalette'
import OfflineSyncButton from '@/components/OfflineSyncButton'
import ErrorBoundary from '@/components/ErrorBoundary'
import ChatbotWidget from '@/components/ChatbotWidget'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useNotifications } from '@/hooks/useNotifications'

// ── Nav item type ─────────────────────────────────────────────────────────
type NavItem = {
  label: string
  path: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}

// ── Nav definitions ───────────────────────────────────────────────────────
const topItems: NavItem[] = [
  {
    label: 'Dashboard', path: '/dashboard',
    iconBg: '#dbeafe', iconColor: '#2563eb',
    icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    label: 'Compliance', path: '/compliance',
    iconBg: '#dcfce7', iconColor: '#16a34a',
    icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'Multi-site', path: '/multi-site-dashboard',
    iconBg: '#dbeafe', iconColor: '#1d4ed8',
    icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
]

// ── Lab Operations — Analyst daily workflow ───────────────────────────────
const labOpsItems: NavItem[] = [
  {
    label: 'Sample Registration', path: '/samples',
    iconBg: '#e0f2fe', iconColor: '#0284c7',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Work Queue', path: '/work-queue',
    iconBg: '#f1f5f9', iconColor: '#64748b',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Checkpoints', path: '/checkpoints',
    iconBg: '#fce7f3', iconColor: '#be185d',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    label: 'Digital Logbook', path: '/digital-logbook',
    iconBg: '#fef3c7', iconColor: '#d97706',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// ── Quality Assurance — QA Manager focus ──────────────────────────────────
const qualityItems: NavItem[] = [
  {
    label: 'Quality Assurance', path: '/quality-assurance',
    iconBg: '#dbeafe', iconColor: '#2563eb',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// ── Release & Dispatch — QA + Dispatch team ───────────────────────────────
const releaseItems: NavItem[] = [
  {
    label: 'Release & Dispatch', path: '/release-dispatch',
    iconBg: '#f0fdf4', iconColor: '#15803d',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// ── Stability & Retention — ICH Q1A / 21 CFR 211.170 ─────────────────────
const stabilityItems: NavItem[] = [
  {
    label: 'Stability & Retention', path: '/stability-retention',
    iconBg: '#e0f2fe', iconColor: '#0369a1',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// ── Traceability & Transfers ──────────────────────────────────────────────
const traceabilityItems: NavItem[] = [
  {
    label: 'Traceability', path: '/traceability',
    iconBg: '#e0f2fe', iconColor: '#0284c7',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'Site Transfers', path: '/site-transfers',
    iconBg: '#dbeafe', iconColor: '#1d4ed8',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
]

// ── Breadcrumb map ────────────────────────────────────────────────────────
const BREADCRUMB_MAP: Record<string, { section?: string; label: string }> = {
  '/settings':                          { label: 'Master Data / Settings' },
  '/dashboard':                        { label: 'Dashboard' },
  '/compliance':                       { label: 'Compliance Panel' },
  '/master-data/laboratories':         { section: 'Master Data', label: 'Laboratories' },
  '/master-data/instruments':          { section: 'Master Data', label: 'Instruments' },
  '/master-data/materials':            { section: 'Master Data', label: 'Materials' },
  '/master-data/test-methods':         { section: 'Master Data', label: 'Test Methods' },
  '/master-data/parameters':           { section: 'Master Data', label: 'Parameters' },
  '/master-data/spec-limits':          { section: 'Master Data', label: 'Spec Limits' },
  '/master-data/form-templates':             { section: 'Master Data', label: 'Form Templates' },
  '/master-data/specification-templates':    { section: 'Master Data', label: 'Spec Templates' },
  '/master-data/users':                { section: 'Master Data', label: 'Users' },
  '/master-data/sample-types':         { section: 'Master Data', label: 'Sample Types' },
  '/master-data/storage-locations':    { section: 'Master Data', label: 'Storage Locations' },
  '/master-data/reagents':             { section: 'Master Data', label: 'Reagents & Standards' },
  '/master-data/training-records':     { section: 'Master Data', label: 'Training Records' },
  '/master-data/sampling-plans':       { section: 'Master Data', label: 'Sampling Plans' },
  '/master-data/stability-protocols':  { section: 'Master Data', label: 'Stability Protocols' },
  '/master-data/instrument-mapping':   { section: 'Master Data', label: 'Instrument Mapping' },
  '/samples':                          { section: 'Operations', label: 'Sample Registration' },
  '/checkpoints':                      { section: 'Operations', label: 'Checkpoints' },
  '/work-queue':                       { section: 'Operations', label: 'Work Queue' },
  '/oos-investigations':               { section: 'Operations', label: 'OOS Investigations' },
  '/quality-events':                   { section: 'Operations', label: 'CAPA / Quality Events' },
  '/spc':                              { section: 'Operations', label: 'SPC / Trending' },
  '/batch-release':                    { section: 'Operations', label: 'Batch Release' },
  '/digital-logbook':                  { section: 'Operations', label: 'Digital Logbook' },
  '/results-review':                   { section: 'Operations', label: 'Results Review' },
  '/coa-review':                       { section: 'Operations', label: 'CoA Review' },
  '/dispatch-qc':                      { section: 'Operations', label: 'Dispatch QC' },
  '/stability-study':                  { section: 'Operations',  label: 'Stability Study' },
  '/workflow-config':                  { section: 'Settings',    label: 'Workflow Config' },
  '/multi-site-dashboard':             { section: 'Multi-site',  label: 'Multi-site Dashboard' },
  '/site-transfers':                   { section: 'Multi-site',  label: 'Site Transfers' },
  '/reports':                          { section: 'Operations', label: 'Reports & Exports' },
  '/traceability':                     { section: 'Inventory', label: 'Traceability' },
  '/stability-pulls':                  { section: 'Inventory', label: 'Stability Pulls' },
  '/retain-samples':                   { section: 'Inventory', label: 'Retain Samples' },
  '/condition-excursions':             { section: 'Inventory', label: 'Condition Excursions' },
  '/quality-assurance':                { section: 'Quality Assurance', label: 'Quality Assurance' },
  '/release-dispatch':                 { section: 'Release & Dispatch', label: 'Release & Dispatch' },
  '/stability-retention':              { section: 'Stability & Retention', label: 'Stability & Retention' },
}


// ── Layout constants ──────────────────────────────────────────────────────
const SIDEBAR_W = 252
const SIDEBAR_COLLAPSED_W = 64

// ── Nav item style ────────────────────────────────────────────────────────
function navItemStyle(isActive: boolean, dm: boolean, collapsed: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center',
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '7px' : '7px 10px',
    margin: collapsed ? '0 8px 3px' : '0 10px 3px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: 13, fontWeight: isActive ? 700 : 600,
    color: isActive ? '#0d6e6e' : (dm ? '#cbd5e1' : '#111827'),
    textDecoration: 'none',
    background: isActive ? (dm ? '#134e4a' : '#f0fdfa') : (dm ? '#1e293b' : '#ffffff'),
    border: `1px solid ${isActive ? '#99f6e4' : (dm ? '#334155' : '#f1f3f4')}`,
    borderRadius: 10,
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    boxShadow: isActive ? '0 1px 4px rgba(13,148,136,0.08)' : 'none',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }
}

// ── Section heading ───────────────────────────────────────────────────────
function SectionHead({ label, first = false, dm, collapsed }: { label: string; first?: boolean; dm: boolean; collapsed: boolean }) {
  if (collapsed) {
    return <div style={{ height: first ? 0 : 6, margin: first ? '8px 12px' : '2px 0', background: first ? (dm ? '#1e293b' : '#f1f3f4') : 'transparent', borderRadius: 1 }} />
  }
  return (
    <div style={{
      padding: first ? '16px 18px 8px' : '14px 18px 6px',
      fontSize: 11, fontWeight: 800,
      color: dm ? '#94a3b8' : '#111827',
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      borderBottom: first ? `1px solid ${dm ? '#1e293b' : '#f1f3f4'}` : 'none',
      marginBottom: first ? 4 : 0,
    }}>
      {label}
    </div>
  )
}

// ── Nav group ─────────────────────────────────────────────────────────────
function NavGroup({ items, dm, collapsed, onNavigate }: { items: NavItem[]; dm: boolean; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <>
      {items.map(n => (
        <NavLink key={n.path} to={n.path}
          title={collapsed ? n.label : undefined}
          onClick={onNavigate}
          style={({ isActive }) => navItemStyle(isActive, dm, collapsed)}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: n.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: n.iconColor,
          }}>
            {n.icon}
          </div>
          {!collapsed && n.label}
        </NavLink>
      ))}
    </>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────
export default function Layout() {
  const dispatch   = useDispatch<AppDispatch>()
  const navigate   = useNavigate()
  const location   = useLocation()
  const fullName   = useSelector((s: RootState) => s.auth.fullName)
  const initials   = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const [collapsed,    setCollapsed]    = useState(false)
  const [paletteOpen,  setPaletteOpen]  = useState(false)
  const [darkMode,     setDarkMode]     = useState(false)
  const [profileOpen,  setProfileOpen]  = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const offlineSync = useOfflineSync()
  const { notifs, unreadCount: liveUnread, connected: hubConnected, markAllRead, markRead } = useNotifications()

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef   = useRef<HTMLDivElement>(null)

  // ── Mobile resize detection ───────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Global offline-queue toast ────────────────────────────────────────
  useEffect(() => {
    function onQueued() {
      toast('📥 Saved to offline queue — will sync when back online', 'success')
    }
    window.addEventListener('lims:offline:queued', onQueued)
    return () => window.removeEventListener('lims:offline:queued', onQueued)
  }, [])

  // ── Global component / JS error toast ────────────────────────────────
  // Receives events from ErrorBoundary.componentDidCatch AND
  // window.onerror / window.onunhandledrejection (set in main.tsx).
  useEffect(() => {
    function onComponentError(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string } | undefined
      const msg = detail?.message ?? 'An unexpected error occurred.'
      // Avoid spamming: only show toast, the boundary renders its own card
      toast(`⚠ ${msg.length > 80 ? msg.slice(0, 80) + '…' : msg}`, 'error')
    }
    window.addEventListener('lims:component:error', onComponentError)
    return () => window.removeEventListener('lims:component:error', onComponentError)
  }, [])

  // ── Ctrl+K for command palette ────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
      }
      if (e.key === 'Escape') { setProfileOpen(false); setNotifOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Close dropdowns on outside click ─────────────────────────────────
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (notifRef.current  && !notifRef.current.contains(e.target as Node))   setNotifOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────
  const crumb       = BREADCRUMB_MAP[location.pathname]
  const unreadCount = liveUnread
  const dm          = darkMode

  function handleLogout() { dispatch(logout()); navigate('/login') }

  // ── Icon button style helper ──────────────────────────────────────────
  const iconBtn = (active = false): React.CSSProperties => ({
    width: 32, height: 32,
    border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
    borderRadius: 7,
    background: active ? (dm ? '#134e4a' : '#f0fdfa') : (dm ? '#1e293b' : '#fff'),
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: active ? '#0d6e6e' : (dm ? '#94a3b8' : '#5f6368'),
    position: 'relative' as const,
    flexShrink: 0,
    transition: 'background 0.1s',
  })

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Mobile backdrop ─────────────────────────────────────────── */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 199,
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: isMobile ? SIDEBAR_W : (collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W),
        minWidth: isMobile ? SIDEBAR_W : (collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W),
        background: dm ? '#0f172a' : '#ffffff',
        borderRight: `1px solid ${dm ? '#1e293b' : '#e0e0e0'}`,
        display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0, left: 0,
        height: '100vh',
        zIndex: isMobile ? 200 : undefined,
        overflowY: 'auto', overflowX: 'hidden',
        transition: isMobile
          ? 'transform 0.25s ease'
          : 'width 0.2s ease, min-width 0.2s ease',
        transform: isMobile
          ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
          : undefined,
        flexShrink: 0,
      }}>

        {/* Brand */}
        <div style={{
          padding: collapsed ? '14px 0' : '16px 18px 14px',
          borderBottom: `1px solid ${dm ? '#1e293b' : '#f1f3f4'}`,
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
              <path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && (
            <>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: dm ? '#f1f5f9' : '#0f172a', lineHeight: 1.2 }}>LIMS</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', letterSpacing: '0.04em' }}>LIVE</span>
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingBottom: 10 }}>
          <SectionHead label="Overview" first dm={dm} collapsed={collapsed} />
          <NavGroup items={topItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          <SectionHead label="Lab Operations" dm={dm} collapsed={collapsed} />
          <NavGroup items={labOpsItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          <SectionHead label="Quality Assurance" dm={dm} collapsed={collapsed} />
          <NavGroup items={qualityItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          <SectionHead label="Release & Dispatch" dm={dm} collapsed={collapsed} />
          <NavGroup items={releaseItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          <SectionHead label="Stability & Retention" dm={dm} collapsed={collapsed} />
          <NavGroup items={stabilityItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          <SectionHead label="Traceability & Transfers" dm={dm} collapsed={collapsed} />
          <NavGroup items={traceabilityItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />

          {/* ── Master Data / Settings — single consolidated entry ── */}
          <div style={{ padding: collapsed ? '4px 4px 0' : '4px 8px 0' }}>
            {!collapsed && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: dm ? '#475569' : '#94a3b8',
                padding: '6px 4px 2px',
                textTransform: 'uppercase',
              }}>Master Data</div>
            )}
            <NavLink to="/settings"
              title={collapsed ? 'Master Data / Settings' : undefined}
              onClick={isMobile ? () => setMobileOpen(false) : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 8,
                padding: collapsed ? '8px' : '9px 12px',
                borderRadius: 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                border: `1.5px solid ${isActive ? '#fde68a' : (dm ? '#334155' : '#fde68a')}`,
                background: isActive ? '#fef3c7' : (dm ? '#1e293b' : '#fffbeb'),
                color: '#92400e',
                fontWeight: 700, fontSize: 13,
                transition: 'background 0.12s',
                overflow: 'hidden', whiteSpace: 'nowrap',
              })}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: '#fef3c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15,
              }}>
                ⚙️
              </div>
              {!collapsed && (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Master Data / Settings
                </span>
              )}
            </NavLink>
          </div>
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: `1px solid ${dm ? '#1e293b' : '#f1f3f4'}`,
          padding: collapsed ? '10px 0' : '12px 14px',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 9,
          justifyContent: 'center',
          background: dm ? '#0f172a' : '#fafafa',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: dm ? '#f1f5f9' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fullName || 'User'}
                </div>
                <div style={{ fontSize: 10, color: '#80868b', marginTop: 1 }}>Administrator</div>
              </div>
              <button onClick={handleLogout} title="Sign out" style={{
                background: dm ? '#1e293b' : '#fff',
                border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
                borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
                color: dm ? '#94a3b8' : '#5f6368', fontSize: 11, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: dm ? '#1e293b' : '#ffffff',
          borderBottom: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
          padding: '0 20px 0 12px',
          height: 52,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>

          {/* Sidebar collapse toggle / hamburger */}
          <button
            onClick={isMobile ? () => setMobileOpen(o => !o) : () => setCollapsed(c => !c)}
            title={isMobile ? 'Open menu' : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            style={iconBtn()}>
            {isMobile
              ? <span style={{ fontSize: 16, lineHeight: 1 }}>☰</span>
              : (
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  {collapsed
                    ? <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    : <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  }
                </svg>
              )
            }
          </button>

          {/* Breadcrumb */}
          {crumb ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, overflow: 'hidden' }}>
              {crumb.section && (
                <>
                  <span style={{ fontSize: 12, color: dm ? '#64748b' : '#5f6368', whiteSpace: 'nowrap' }}>{crumb.section}</span>
                  <svg viewBox="0 0 24 24" fill="none" width="11" height="11" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" stroke={dm ? '#475569' : '#d1d5db'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: dm ? '#e2e8f0' : '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {crumb.label}
              </span>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* Right side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

            {/* Offline sync indicator + button */}
            <OfflineSyncButton sync={offlineSync} dm={dm} />

            {/* Date — hidden on mobile */}
            <span style={{ fontSize: 12, color: dm ? '#64748b' : '#5f6368', whiteSpace: 'nowrap', marginRight: 2, display: isMobile ? 'none' : undefined }}>
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>

            <div style={{ width: 1, height: 20, background: dm ? '#334155' : '#e0e0e0', display: isMobile ? 'none' : undefined }} />

            {/* Search / Command palette — hidden on mobile */}
            <button onClick={() => setPaletteOpen(true)} title="Search (Ctrl+K)"
              style={{
                height: 32, padding: '0 10px',
                display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
                borderRadius: 7, background: dm ? '#0f172a' : '#f8f9fa',
                cursor: 'pointer',
                color: dm ? '#94a3b8' : '#80868b',
                fontSize: 12, fontFamily: 'inherit',
              }}>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span>Search</span>
              <kbd style={{
                fontSize: 9, background: dm ? '#1e293b' : '#e0e0e0',
                border: `1px solid ${dm ? '#334155' : '#dadce0'}`,
                borderRadius: 3, padding: '1px 4px',
                color: dm ? '#64748b' : '#80868b',
                fontFamily: 'inherit',
              }}>⌘K</kbd>
            </button>

            {/* Notification bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => { setNotifOpen(o => !o); setProfileOpen(false) }}
                title="Notifications"
                style={iconBtn(notifOpen)}>
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#ef4444',
                    border: `1.5px solid ${dm ? '#1e293b' : '#fff'}`,
                  }} />
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 300, background: dm ? '#1e293b' : '#fff',
                  borderRadius: 12,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
                  zIndex: 100, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${dm ? '#334155' : '#f1f3f4'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: dm ? '#f1f5f9' : '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Notifications
                      {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, borderRadius: 10, padding: '1px 6px' }}>{unreadCount}</span>}
                      {/* SignalR connection dot */}
                      <span title={hubConnected ? 'Real-time connected' : 'Connecting…'} style={{ width: 7, height: 7, borderRadius: '50%', background: hubConnected ? '#22c55e' : '#f59e0b', display: 'inline-block', marginLeft: 2 }} />
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifs.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: dm ? '#64748b' : '#9ca3af', fontSize: 12 }}>
                      No notifications yet — real-time alerts will appear here
                    </div>
                  )}
                  {notifs.map(n => (
                    <div key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
                        background: n.read ? 'transparent' : (dm ? '#0f172a' : '#f0fdfa'),
                        borderBottom: `1px solid ${dm ? '#1e293b' : '#f8f9fa'}`,
                        cursor: 'default',
                      }}>
                      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: dm ? '#cbd5e1' : '#111111', lineHeight: 1.4 }}>{n.text}</div>
                        <div style={{ fontSize: 11, color: '#80868b', marginTop: 3 }}>{n.time}</div>
                      </div>
                      {!n.read && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', flexShrink: 0, marginTop: 5 }} />
                      )}
                    </div>
                  ))}
                  {notifs.length > 0 && (
                    <div style={{ padding: '8px 16px', textAlign: 'center', borderTop: `1px solid ${dm ? '#334155' : '#f1f3f4'}` }}>
                      <span style={{ fontSize: 12, color: dm ? '#64748b' : '#80868b' }}>Showing last {notifs.length} alert{notifs.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dark mode toggle */}
            <button onClick={() => setDarkMode(d => !d)}
              title={dm ? 'Switch to light mode' : 'Switch to dark mode'}
              style={iconBtn(dm)}>
              {dm
                ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06L6.166 6.166z"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
              }
            </button>

            {/* Profile dropdown */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button onClick={() => { setProfileOpen(o => !o); setNotifOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  height: 32, padding: '0 8px 0 4px',
                  border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
                  borderRadius: 7, background: profileOpen ? (dm ? '#134e4a' : '#f0fdfa') : (dm ? '#1e293b' : '#fff'),
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.1s',
                }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                }}>
                  {initials}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: dm ? '#e2e8f0' : '#111111', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fullName}
                </span>
                <svg viewBox="0 0 24 24" fill="none" width="11" height="11">
                  <path d="M6 9l6 6 6-6" stroke={dm ? '#64748b' : '#80868b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {profileOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 220, background: dm ? '#1e293b' : '#fff',
                  borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  border: `1px solid ${dm ? '#334155' : '#e0e0e0'}`,
                  zIndex: 100, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '14px 16px',
                    borderBottom: `1px solid ${dm ? '#334155' : '#f1f3f4'}`,
                    display: 'flex', gap: 10, alignItems: 'center',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: dm ? '#f1f5f9' : '#111111' }}>{fullName}</div>
                      <div style={{ fontSize: 11, color: '#80868b', marginTop: 1 }}>Administrator</div>
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <button
                      onClick={() => { setDarkMode(d => !d); setProfileOpen(false) }}
                      style={{ width: '100%', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 13, color: dm ? '#cbd5e1' : '#111111', fontFamily: 'inherit', textAlign: 'left' }}>
                      {dm ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </button>
                    <div style={{ height: 1, background: dm ? '#334155' : '#f1f3f4', margin: '4px 0' }} />
                    <button
                      onClick={handleLogout}
                      style={{ width: '100%', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }}>
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px 28px', background: dm ? '#0f172a' : '#f0f4f8', overflow: 'auto' }}>
          {/* Page-level boundary: catches crashes in individual pages without
              taking down the sidebar / topbar navigation */}
          <ErrorBoundary label="Page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Global overlays ──────────────────────────────────────────── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastContainer />
      <ChatbotWidget />
    </div>
  )
}
