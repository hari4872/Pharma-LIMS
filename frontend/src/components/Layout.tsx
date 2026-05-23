import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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

// ── Sidebar colours — deep teal ──────────────────────────────────────────
const SB = {
  bg:         '#0a1f1f',   // very dark teal
  bgAlt:      '#0d2626',
  border:     '#153535',
  active:     'rgba(46,168,156,0.15)',
  activeBdr:  '#2ea89c',
  activeText: '#5bbfb5',
  text:       '#7fb3af',
  textDim:    '#3d7070',
  sectionLbl: '#2a6060',
}
const SIDEBAR_W = 234

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 16px 7px 18px',
    fontSize: 13, fontWeight: isActive ? 600 : 400,
    color: isActive ? SB.activeText : SB.text,
    textDecoration: 'none',
    background: isActive ? SB.active : 'transparent',
    borderLeft: `3px solid ${isActive ? SB.activeBdr : 'transparent'}`,
    transition: 'background 0.12s, color 0.12s',
    letterSpacing: '0.01em',
    borderRadius: '0 6px 6px 0',
    marginRight: 6,
  }
}

function SectionHead({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: first ? '16px 18px 5px' : '14px 18px 5px',
      marginTop: first ? 0 : 2,
    }}>
      {!first && <div style={{ flex: 1, height: 1, background: SB.border }} />}
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: SB.sectionLbl,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: SB.border }} />
    </div>
  )
}

export default function Layout() {
  const dispatch  = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
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
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_W, minWidth: SIDEBAR_W,
        background: SB.bg,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>

        {/* Brand */}
        <div style={{
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${SB.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'linear-gradient(135deg, #2ea89c 0%, #0d6e6e 100%)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M9 3h6M10 3v6L5 19a2 2 0 002 3h10a2 2 0 002-3l-5-10V3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2f0ef', lineHeight: 1.2 }}>LIMS</div>
            <div style={{ fontSize: 10, color: SB.sectionLbl, letterSpacing: '0.06em', marginTop: 1 }}>21 CFR Part 11</div>
          </div>
          {/* Live dot */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingBottom: 8 }}>
          <SectionHead label="Overview" first />
          {topItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ flexShrink: 0, opacity: 0.8 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <SectionHead label="Master Data" />
          {masterDataItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ flexShrink: 0, opacity: 0.75 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <SectionHead label="Operations" />
          {operationsItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ flexShrink: 0, opacity: 0.75 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <SectionHead label="Inventory & Traceability" />
          {inventoryItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ flexShrink: 0, opacity: 0.75 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: `1px solid ${SB.border}`,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 9,
          background: SB.bgAlt,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #2ea89c, #0d6e6e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#c8e6e4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName || 'User'}
            </div>
            <div style={{ fontSize: 10, color: SB.sectionLbl, marginTop: 1 }}>Authenticated</div>
          </div>
          <button onClick={handleLogout} title="Sign out" style={{
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${SB.border}`,
            borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
            color: SB.text, fontSize: 11, fontWeight: 500,
            fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
          }}>
            Sign out
          </button>
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
