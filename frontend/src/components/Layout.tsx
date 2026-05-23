import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'

// ── Nav definitions with SVG icons ───────────────────────────────────────
const topItems = [
  {
    label: 'Dashboard', path: '/dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    label: 'Compliance', path: '/compliance',
    icon: <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
]

const masterDataItems = [
  { label: 'Laboratories',         path: '/master-data/laboratories',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Instruments',          path: '/master-data/instruments',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { label: 'Materials',            path: '/master-data/materials',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8L6 7h12l-2-4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Test Methods',         path: '/master-data/test-methods',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Parameters',           path: '/master-data/parameters',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { label: 'Spec Limits',          path: '/master-data/spec-limits',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Form Templates',       path: '/master-data/form-templates',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { label: 'Users',                path: '/master-data/users',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Sample Types',         path: '/master-data/sample-types',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Storage Locations',    path: '/master-data/storage-locations',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Reagents & Standards', path: '/master-data/reagents',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Training Records',     path: '/master-data/training-records',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
]

const operationsItems = [
  { label: 'Sample Registration', path: '/samples',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { label: 'Checkpoints',         path: '/checkpoints',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Work Queue',          path: '/work-queue',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { label: 'OOS Investigations',  path: '/oos-investigations',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Digital Logbook',     path: '/digital-logbook',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Results Review',      path: '/results-review',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'CoA Review',          path: '/coa-review',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Dispatch QC',         path: '/dispatch-qc',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
]

const inventoryItems = [
  { label: 'Traceability',         path: '/traceability',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Stability Pulls',      path: '/stability-pulls',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Retain Samples',       path: '/retain-samples',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { label: 'Condition Excursions', path: '/condition-excursions',
    icon: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.95L13.75 4a2 2 0 00-3.5 0L3.25 16.05A2 2 0 005.07 19z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
]

// ── Icon rail items (key shortcuts for each section) ─────────────────────
type RailItem = { path: string; prefix: string; title: string; icon: React.ReactNode } | null

const railItems: RailItem[] = [
  {
    path: '/dashboard', prefix: '/dashboard', title: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    path: '/compliance', prefix: '/compliance', title: 'Compliance',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
  null,
  {
    path: '/master-data/laboratories', prefix: '/master-data', title: 'Master Data',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    path: '/master-data/instruments', prefix: '/master-data/instruments', title: 'Instruments',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    path: '/master-data/users', prefix: '/master-data/users', title: 'Users',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  null,
  {
    path: '/samples', prefix: '/samples', title: 'Sample Registration',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    path: '/work-queue', prefix: '/work-queue', title: 'Work Queue',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    path: '/results-review', prefix: '/results-review', title: 'Results Review',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    path: '/oos-investigations', prefix: '/oos-investigations', title: 'OOS Investigations',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  null,
  {
    path: '/stability-pulls', prefix: '/stability-pulls', title: 'Stability Pulls',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    path: '/retain-samples', prefix: '/retain-samples', title: 'Retain Samples',
    icon: <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

// ── Colour tokens ─────────────────────────────────────────────────────────
const RAIL = {
  bg:           '#f0fdfa',
  border:       '#d1fae5',
  iconDefault:  '#94a3b8',
  iconHoverBg:  '#e0fdf4',
  iconHover:    '#0d9488',
  iconActiveBg: '#0d9488',
  iconActive:   '#ffffff',
  sep:          '#d1fae5',
}
const TEXT = {
  bg:             '#ffffff',
  outerBorder:    '#e5e7eb',
  sectionFirst:   '#0f172a',
  sectionLabel:   '#c8d5df',
  item:           '#111827',
  itemHoverBg:    '#f1f5f9',
  itemHover:      '#0f172a',
  itemActiveBg:   '#f0fdfa',
  itemActive:     '#0f766e',
  divider:        '#f1f5f9',
}
const SIDEBAR_W = 234

// ── Nav link style (text panel) ───────────────────────────────────────────
function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6.5px 14px',
    fontSize: 12.5, fontWeight: isActive ? 700 : 500,
    color: isActive ? TEXT.itemActive : TEXT.item,
    textDecoration: 'none',
    background: isActive ? TEXT.itemActiveBg : 'transparent',
    borderRadius: 6,
    margin: '0 6px 1px',
    transition: 'background 0.12s, color 0.12s',
    letterSpacing: '0.01em',
  }
}

// ── Section header (text panel) ───────────────────────────────────────────
function SectionHead({ label, first = false }: { label: string; first?: boolean }) {
  if (first) {
    return (
      <div style={{
        padding: '14px 16px 12px',
        fontSize: 14, fontWeight: 800,
        color: TEXT.sectionFirst,
        borderBottom: `1px solid ${TEXT.divider}`,
        letterSpacing: '-0.01em',
      }}>
        {label}
      </div>
    )
  }
  return (
    <div style={{
      padding: '14px 16px 4px',
      fontSize: 11, fontWeight: 800,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: '#111827',
    }}>
      {label}
    </div>
  )
}

// ── Divider (text panel) ──────────────────────────────────────────────────
function SubDivider() {
  return <div style={{ margin: '4px 16px', height: 1, background: TEXT.divider }} />
}

export default function Layout() {
  const dispatch  = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
  const location  = useLocation()
  const fullName  = useSelector((s: RootState) => s.auth.fullName)
  const initials  = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_W, minWidth: SIDEBAR_W,
        display: 'flex',
        position: 'sticky', top: 0, height: '100vh',
        borderRight: `1px solid ${TEXT.outerBorder}`,
      }}>

        {/* ── Icon Rail (left 52 px) ─────────────────────────── */}
        <div style={{
          width: 52, flexShrink: 0,
          background: RAIL.bg,
          borderRight: `1px solid ${RAIL.border}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 2,
          overflowY: 'auto',
        }}>

          {/* Logo mark */}
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(13,148,136,0.3)',
            marginBottom: 10,
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
              <path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Rail nav icons */}
          {railItems.map((item, i) => {
            if (!item) {
              // Separator
              return (
                <div key={`sep-${i}`} style={{
                  width: 24, height: 1,
                  background: RAIL.sep,
                  margin: '5px 0',
                  flexShrink: 0,
                }} />
              )
            }
            const isActive = location.pathname.startsWith(item.prefix)
            return (
              <div
                key={item.path}
                title={item.title}
                onClick={() => navigate(item.path)}
                style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  background: isActive ? RAIL.iconActiveBg : 'transparent',
                  color: isActive ? RAIL.iconActive : RAIL.iconDefault,
                  boxShadow: isActive ? '0 2px 8px rgba(13,148,136,0.35)' : 'none',
                  position: 'relative',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {item.icon}
                {/* Active right-edge indicator */}
                {isActive && (
                  <div style={{
                    position: 'absolute', right: -1, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3, height: 20,
                    background: '#0d9488',
                    borderRadius: '2px 0 0 2px',
                  }} />
                )}
              </div>
            )
          })}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* User avatar shortcut */}
          <div
            title={fullName || 'User'}
            style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
              cursor: 'pointer',
            }}
          >
            {initials}
          </div>
        </div>

        {/* ── Text Panel (right ~182 px) ─────────────────────── */}
        <div style={{
          flex: 1,
          background: TEXT.bg,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <nav style={{ flex: 1, paddingBottom: 8 }}>

            <SectionHead label="Overview" first />
            {topItems.map(n => (
              <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
                <span style={{ flexShrink: 0, color: 'inherit', opacity: 0.75 }}>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}

            <SubDivider />
            <SectionHead label="Master Data" />
            {masterDataItems.map(n => (
              <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
                <span style={{ flexShrink: 0, color: 'inherit', opacity: 0.75 }}>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}

            <SubDivider />
            <SectionHead label="Operations" />
            {operationsItems.map(n => (
              <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
                <span style={{ flexShrink: 0, color: 'inherit', opacity: 0.75 }}>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}

            <SubDivider />
            <SectionHead label="Inventory & Traceability" />
            {inventoryItems.map(n => (
              <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
                <span style={{ flexShrink: 0, color: 'inherit', opacity: 0.75 }}>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* User footer */}
          <div style={{
            borderTop: `1px solid ${TEXT.divider}`,
            padding: '11px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullName || 'User'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Administrator</div>
            </div>
            <button onClick={handleLogout} title="Sign out" style={{
              background: 'none', border: `1px solid ${TEXT.divider}`,
              borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
              color: '#94a3b8', fontSize: 10.5, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'border-color 0.1s',
            }}>
              Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: '#ffffff', borderBottom: '1px solid #e5e7eb',
          padding: '0 28px', height: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          flexShrink: 0, gap: 16,
        }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fullName}</span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px 28px', background: '#f9fafb', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
