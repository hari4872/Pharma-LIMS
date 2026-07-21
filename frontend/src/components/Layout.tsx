import { useState, useEffect, useRef, Suspense } from 'react'
import { useTranslation } from '@/i18n/TranslationContext'
import type { StringKey } from '@/i18n/strings'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'
import { loadNavVisibility, isNavEnabled } from '@/store/navVisibilitySlice'
import { fetchPermissions } from '@/store/authSlice'
import { ToastContainer, toast } from '@/components/Toast'
import CommandPalette from '@/components/CommandPalette'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import OfflineSyncButton from '@/components/OfflineSyncButton'
import ErrorBoundary from '@/components/ErrorBoundary'
import ChatbotWidget from '@/components/ChatbotWidget'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useNotifications } from '@/hooks/useNotifications'
import { useIdleLock } from '@/hooks/useIdleLock'
import IdleLockOverlay from '@/components/IdleLockOverlay'

// ── Lazy-page loading spinner ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 220 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Nav item type ─────────────────────────────────────────────────────────
type NavItem = {
  label: string
  path: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
  badge?: number
  visKey?: string   // Module Visibility key e.g. "nav.multi-site"
  roles?: string[]   // If set, only these roles see this item. Undefined = all roles.
  permKey?: string   // If set, also checked against user's permOverrides (e.g. "sampleRegistration")
}

type NavSection = {
  sectionKey: string
  label: string
  first?: boolean
  items: NavItem[]
  roles?: string[]  // If set, entire section hidden for roles not in this list.
}

// ── Role constants ────────────────────────────────────────────────────────
const LAB_ROLES  = ['Admin', 'Analyst', 'QA', 'QCLead', 'LabManager', 'Supervisor']
const QA_ROLES   = ['Admin', 'QA', 'QCLead', 'LabManager']
const MGMT_ROLES = ['SuperAdmin', 'Admin', 'LabManager']

// ── Nav definitions ───────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    sectionKey: 'sec.overview', label: 'Overview', first: true,
    items: [
      { label: 'Dashboard',  path: '/dashboard',            visKey: 'nav.dashboard',   iconBg: '#dbeafe', iconColor: '#2563eb', icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
      { label: 'Compliance', path: '/compliance',           visKey: 'nav.compliance',  iconBg: '#dcfce7', iconColor: '#16a34a', roles: [...QA_ROLES, 'Supervisor'], permKey: 'compliance', icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
      { label: 'Multi-site', path: '/multi-site-dashboard', visKey: 'nav.multi-site',  iconBg: '#dbeafe', iconColor: '#1d4ed8', roles: MGMT_ROLES, icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.lab-ops', label: 'Lab Operations',
    items: [
      { label: 'Sample Registration', path: '/samples',          visKey: 'nav.samples',          iconBg: '#e0f2fe', iconColor: '#0284c7', permKey: 'sampleRegistration', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
      { label: 'Work Queue',          path: '/work-queue',       visKey: 'nav.work-queue',       iconBg: '#f1f5f9', iconColor: '#64748b', roles: LAB_ROLES, permKey: 'workQueue', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
      { label: 'Capacity Booking',    path: '/capacity-booking', visKey: 'nav.capacity-booking', iconBg: '#e0f2fe', iconColor: '#0284c7', roles: ['Admin', 'Analyst', 'LabManager', 'Supervisor'], icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
      { label: 'Checkpoints',         path: '/checkpoint-tasks', visKey: 'nav.checkpoint-tasks', iconBg: '#fce7f3', iconColor: '#be185d', roles: LAB_ROLES, icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg> },
      { label: 'Digital Logbook',     path: '/digital-logbook',  visKey: 'nav.digital-logbook',  iconBg: '#fef3c7', iconColor: '#d97706', roles: LAB_ROLES, icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.quality', label: 'Quality Assurance',
    roles: QA_ROLES,
    items: [
      { label: 'Quality Assurance', path: '/quality-assurance', visKey: 'nav.quality-assurance', iconBg: '#dbeafe', iconColor: '#2563eb', permKey: 'resultsReview', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.release', label: 'Release & Dispatch',
    roles: [...MGMT_ROLES, 'QA'],
    items: [
      { label: 'Release & Dispatch', path: '/release-dispatch', visKey: 'nav.release-dispatch', iconBg: '#f0fdf4', iconColor: '#15803d', permKey: 'batchRelease', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.stability', label: 'Stability & Retention',
    roles: LAB_ROLES,
    items: [
      { label: 'Stability & Retention', path: '/stability-retention', visKey: 'nav.stability-retention', iconBg: '#e0f2fe', iconColor: '#0369a1', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.analytics', label: 'Analytics & Reports',
    roles: [...QA_ROLES, 'Supervisor'],
    items: [
      { label: 'Reports & Exports', path: '/reports',        visKey: 'nav.reports',        iconBg: '#f0fdf4', iconColor: '#15803d', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 17v-2m3 2v-4m3 4v-6M5 21h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v15a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
      { label: 'Report Builder',    path: '/report-builder', visKey: 'nav.report-builder', iconBg: '#fef9c3', iconColor: '#a16207', roles: MGMT_ROLES, icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
  {
    sectionKey: 'sec.traceability', label: 'Traceability & Transfers',
    roles: [...MGMT_ROLES, 'QA', 'Supervisor'],
    items: [
      { label: 'Traceability',   path: '/traceability',   visKey: 'nav.traceability',   iconBg: '#e0f2fe', iconColor: '#0284c7', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
      { label: 'Site Transfers', path: '/site-transfers', visKey: 'nav.site-transfers', iconBg: '#dbeafe', iconColor: '#1d4ed8', icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    ],
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
  '/master-data/form-templates':             { section: 'Master Data', label: 'Monitoring & Log Forms' },
  '/master-data/specification-templates':    { section: 'Master Data', label: 'Product Test Plans' },
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
  '/checkpoint-tasks':                 { section: 'Operations', label: 'Checkpoint Execution' },
  '/work-queue':                       { section: 'Operations', label: 'Work Queue' },
  '/capacity-booking':                 { section: 'Operations', label: 'Capacity Booking' },
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
  '/reports':                          { section: 'Analytics & Reports', label: 'Reports & Exports' },
  '/report-builder':                   { section: 'Analytics & Reports', label: 'Report Builder' },
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
function SectionHead({ label, sectionKey, first = false, dm, collapsed, tFn }: { label: string; sectionKey?: string; first?: boolean; dm: boolean; collapsed: boolean; tFn: (k: StringKey) => string }) {
  const displayLabel = sectionKey && NAV_SECTION_KEYS[sectionKey] ? tFn(NAV_SECTION_KEYS[sectionKey]) : label
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
      {displayLabel}
    </div>
  )
}

// ── Nav group ─────────────────────────────────────────────────────────────
function NavGroup({ items, dm, collapsed, onNavigate, getLabel }: { items: NavItem[]; dm: boolean; collapsed: boolean; onNavigate?: () => void; getLabel: (n: NavItem) => string }) {
  return (
    <>
      {items.map(n => {
        const label = getLabel(n)
        return (
        <NavLink key={n.path} to={n.path}
          title={collapsed ? label : undefined}
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
          {!collapsed && label}
          {!collapsed && n.badge != null && n.badge > 0 && (
            <span style={{
              marginLeft: 'auto', minWidth: 18, height: 18,
              background: '#ef4444', color: '#fff',
              borderRadius: 9, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
            }}>{n.badge}</span>
          )}
        </NavLink>
        )
      })}
    </>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────
// ── Nav translation maps ──────────────────────────────────────────────────
const NAV_PATH_KEYS: Record<string, StringKey> = {
  '/dashboard':            'nav.dashboard',
  '/compliance':           'nav.compliance',
  '/multi-site-dashboard': 'nav.multiSite',
  '/samples':              'nav.sampleRegistration',
  '/work-queue':           'nav.workQueue',
  '/capacity-booking':     'nav.capacityBooking',
  '/checkpoint-tasks':     'nav.checkpoints',
  '/digital-logbook':      'nav.digitalLogbook',
  '/quality-assurance':    'nav.qualityAssurance',
  '/release-dispatch':     'nav.releaseDispatch',
  '/stability-retention':  'nav.stabilityRetention',
  '/reports':              'nav.reports',
  '/report-builder':       'nav.reportBuilder',
  '/traceability':         'nav.traceability',
  '/site-transfers':       'nav.siteTransfers',
  '/settings':             'nav.masterData',
}

const NAV_SECTION_KEYS: Record<string, StringKey> = {
  'sec.overview':      'nav.overview',
  'sec.lab-ops':       'nav.labOperations',
  'sec.quality':       'nav.quality',
  'sec.release':       'nav.releaseDispatch',
  'sec.stability':     'nav.stabilityRetention',
  'sec.analytics':     'nav.analytics',
  'sec.traceability':  'nav.traceabilitySection',
}

export default function Layout() {
  const { t } = useTranslation()
  const dispatch   = useDispatch<AppDispatch>()
  const navigate   = useNavigate()
  const location   = useLocation()
  const fullName      = useSelector((s: RootState) => s.auth.fullName)
  const role          = useSelector((s: RootState) => s.auth.role) ?? ''
  const userId        = useSelector((s: RootState) => s.auth.userId)
  const permOverrides = useSelector((s: RootState) => s.auth.permOverrides)
  const token         = useSelector((s: RootState) => s.auth.token)
  const initials   = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  // Extract username from JWT for idle lock re-auth
  const username = (() => {
    if (!token) return ''
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload['unique_name'] ?? payload['sub'] ?? ''
    } catch { return '' }
  })()

  const { isLocked, unlock } = useIdleLock(15, !!token)

  const visMap    = useSelector((s: RootState) => s.navVisibility.map)

  // Load module visibility once after login
  useEffect(() => { dispatch(loadNavVisibility()) }, [dispatch])

  // Load this user's per-user permission overrides — re-fetch when token changes (new login)
  useEffect(() => { if (userId && token) dispatch(fetchPermissions(userId)) }, [dispatch, userId, token])

  const [collapsed,    setCollapsed]    = useState(false)
  const [paletteOpen,  setPaletteOpen]  = useState(false)
  const darkMode = false
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
          {NAV_SECTIONS.map(sec => {
            if (role === 'SuperAdmin') return null  // platform-only role — only SuperAdmin panel shown
            if (!isNavEnabled(visMap, sec.sectionKey)) return null
            if (sec.roles && !sec.roles.includes(role)) return null
            const visibleItems = sec.items.filter(n =>
              (!n.visKey   || isNavEnabled(visMap, n.visKey)) &&
              (!n.roles    || n.roles.includes(role)) &&
              (!n.permKey  || permOverrides[n.permKey] !== false)
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={sec.sectionKey}>
                <SectionHead label={sec.label} sectionKey={sec.sectionKey} first={sec.first} dm={dm} collapsed={collapsed} tFn={t} />
                <NavGroup items={visibleItems} dm={dm} collapsed={collapsed} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} getLabel={n => NAV_PATH_KEYS[n.path] ? t(NAV_PATH_KEYS[n.path]) : n.label} />
              </div>
            )
          })}

          {/* ── SuperAdmin — platform-level control, WebSynergies only ── */}
          {role === 'SuperAdmin' && (
            <div style={{ padding: collapsed ? '4px 4px 0' : '4px 8px 0' }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  color: dm ? '#475569' : '#94a3b8',
                  padding: '6px 4px 2px',
                  textTransform: 'uppercase',
                }}>SuperAdmin</div>
              )}
              <NavLink to="/superadmin"
                title={collapsed ? 'SuperAdmin Panel' : undefined}
                onClick={isMobile ? () => setMobileOpen(false) : undefined}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 8,
                  padding: collapsed ? '8px' : '9px 12px',
                  borderRadius: 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  textDecoration: 'none',
                  border: `1.5px solid ${isActive ? '#93c5fd' : (dm ? '#1e3a5f' : '#bfdbfe')}`,
                  background: isActive ? '#1e3a5f' : (dm ? '#0f1f36' : '#eff6ff'),
                  color: isActive ? '#fff' : (dm ? '#93c5fd' : '#1e40af'),
                  fontWeight: 700, fontSize: 13,
                  transition: 'background 0.12s',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                  marginBottom: 4,
                })}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: '#1e3a5f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M12 1l3 6h6l-5 4 2 6-6-4-6 4 2-6L3 7h6z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                </div>
                {!collapsed && (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    SuperAdmin Panel
                  </span>
                )}
              </NavLink>
            </div>
          )}

          {/* ── Master Data / Settings — Admin and LabManager only ── */}
          {MGMT_ROLES.includes(role) && <div style={{ padding: collapsed ? '4px 4px 0' : '4px 8px 0' }}>
            {!collapsed && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: dm ? '#475569' : '#94a3b8',
                padding: '6px 4px 2px',
                textTransform: 'uppercase',
              }}>{t('nav.masterData')}</div>
            )}
            <NavLink to="/settings"
              title={collapsed ? t('nav.masterData') : undefined}
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
                  {t('nav.masterData')}
                </span>
              )}
            </NavLink>
          </div>}
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

            {/* Language switcher */}
            <LanguageSwitcher />

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
                      No notifications yet — system events such as OOS results, overdue samples, and calibration alerts will appear here
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
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Global overlays ──────────────────────────────────────────── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastContainer />
      <ChatbotWidget />
      {isLocked && (
        <IdleLockOverlay
          fullName={fullName ?? 'User'}
          initials={initials}
          username={username}
          onUnlock={unlock}
          onSignOut={handleLogout}
        />
      )}
    </div>
  )
}
