import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'

const topItems = [
  { label: 'Dashboard',  path: '/dashboard',  icon: '▦' },
  { label: 'Compliance', path: '/compliance', icon: '🛡' },
]

const masterDataItems = [
  { label: 'Laboratories',         path: '/master-data/laboratories' },
  { label: 'Instruments',          path: '/master-data/instruments' },
  { label: 'Materials',            path: '/master-data/materials' },
  { label: 'Test Methods',         path: '/master-data/test-methods' },
  { label: 'Parameters',           path: '/master-data/parameters' },
  { label: 'Spec Limits',          path: '/master-data/spec-limits' },
  { label: 'Form Templates',       path: '/master-data/form-templates' },
  { label: 'Users',                path: '/master-data/users' },
  { label: 'Sample Types',         path: '/master-data/sample-types' },
  { label: 'Storage Locations',    path: '/master-data/storage-locations' },
  { label: 'Reagents & Standards', path: '/master-data/reagents' },
  { label: 'Training Records',     path: '/master-data/training-records' },
]

const operationsItems = [
  { label: 'Sample Registration', path: '/samples' },
  { label: 'Checkpoints',         path: '/checkpoints' },
  { label: 'Work Queue',          path: '/work-queue' },
  { label: 'OOS Investigations',  path: '/oos-investigations' },
  { label: 'Digital Logbook',     path: '/digital-logbook' },
  { label: 'Results Review',      path: '/results-review' },
  { label: 'CoA Review',          path: '/coa-review' },
  { label: 'Dispatch QC',         path: '/dispatch-qc' },
]

const inventoryItems = [
  { label: 'Traceability',        path: '/traceability' },
  { label: 'Stability Pulls',     path: '/stability-pulls' },
  { label: 'Retain Samples',      path: '/retain-samples' },
  { label: 'Condition Excursions',path: '/condition-excursions' },
]

const SIDEBAR_BG   = '#0f1d33'
const SIDEBAR_W    = 234

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: isActive ? 500 : 400,
    color: isActive ? '#93c5fd' : '#94a3b8',
    textDecoration: 'none',
    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
    borderLeft: `3px solid ${isActive ? '#3b82f6' : 'transparent'}`,
    transition: 'background 0.1s, color 0.1s',
    letterSpacing: '0.01em',
  }
}

function SectionHead({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div style={{
      padding: first ? '14px 18px 6px' : '18px 18px 6px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#4b6584',
      borderTop: first ? 'none' : '1px solid #1e3352',
    }}>
      {label}
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
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_W,
        minWidth: SIDEBAR_W,
        background: SIDEBAR_BG,
        color: '#e2e8f0',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>

        {/* Brand */}
        <div style={{
          padding: '18px 18px 16px',
          borderBottom: '1px solid #1e3352',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0,
          }}>
            L
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>Pharma LIMS</div>
            <div style={{ fontSize: 10, color: '#4b6584', letterSpacing: '0.05em', marginTop: 1 }}>21 CFR Part 11</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          <SectionHead label="Overview" first />
          {topItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ marginRight: 8, fontSize: 12, opacity: 0.7 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <SectionHead label="Master Data" />
          {masterDataItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>{n.label}</NavLink>
          ))}

          <SectionHead label="Operations" />
          {operationsItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>{n.label}</NavLink>
          ))}

          <SectionHead label="Inventory & Traceability" />
          {inventoryItems.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => navLinkStyle(isActive)}>{n.label}</NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: '1px solid #1e3352',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName || 'User'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: 'transparent', border: '1px solid #2d4a6a',
              borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
              color: '#94a3b8', fontSize: 11, fontWeight: 500,
              transition: 'background 0.1s',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 24px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
          gap: 16,
        }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fullName}</span>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '24px 28px',
          background: '#f9fafb',
          overflow: 'auto',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
