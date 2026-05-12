import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'

const topItems = [
  { label: '📊 Dashboard',   path: '/dashboard' },
  { label: '🛡️ Compliance',  path: '/compliance' },
]

const masterDataItems = [
  { label: 'Laboratories',      path: '/master-data/laboratories' },
  { label: 'Instruments',       path: '/master-data/instruments' },
  { label: 'Materials',         path: '/master-data/materials' },
  { label: 'Test Methods',      path: '/master-data/test-methods' },
  { label: 'Parameters',        path: '/master-data/parameters' },
  { label: 'Spec Limits',       path: '/master-data/spec-limits' },
  { label: 'Form Templates',    path: '/master-data/form-templates' },
  { label: 'Users',             path: '/master-data/users' },
  { label: 'Sample Types',      path: '/master-data/sample-types' },
  { label: 'Storage Locations', path: '/master-data/storage-locations' },
]

const operationsItems = [
  { label: 'Sample Registration',    path: '/samples' },
  { label: 'Checkpoints',            path: '/checkpoints' },
  { label: 'Work Queue',             path: '/work-queue' },
  { label: 'OOS Investigations',     path: '/oos-investigations' },
  { label: 'Digital Logbook',        path: '/digital-logbook' },
  { label: 'Results Review',         path: '/results-review' },
  { label: 'CoA Review',             path: '/coa-review' },
  { label: 'Dispatch QC',            path: '/dispatch-qc' },
]

const inventoryItems = [
  { label: 'Traceability',           path: '/traceability' },
  { label: 'Stability Pulls',        path: '/stability-pulls' },
  { label: 'Retain Samples',         path: '/retain-samples' },
  { label: 'Condition Excursions',   path: '/condition-excursions' },
]

const navLink = (isActive: boolean): React.CSSProperties => ({
  display: 'block', padding: '9px 20px', color: isActive ? '#5b9cf6' : '#c8d8eb',
  textDecoration: 'none', background: isActive ? '#0f1c2e' : 'transparent',
  borderLeft: isActive ? '3px solid #5b9cf6' : '3px solid transparent',
  fontSize: 13
})

const sectionHead = (top = false): React.CSSProperties => ({
  padding: top ? '12px 20px 8px' : '16px 20px 8px',
  fontSize: 10, color: '#8aa0be', textTransform: 'uppercase', letterSpacing: 1,
  borderTop: top ? 'none' : '1px solid #2d4a6a',
  marginTop: top ? 0 : 4
})

export default function Layout() {
  const dispatch  = useDispatch<AppDispatch>()
  const navigate  = useNavigate()
  const fullName  = useSelector((s: RootState) => s.auth.fullName)

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 230, background: '#1a2942', color: '#fff', padding: '16px 0', overflowY: 'auto' }}>
        <div style={{ padding: '12px 20px 20px', fontWeight: 700, fontSize: 17, borderBottom: '1px solid #2d4a6a' }}>
          Pharma LIMS
        </div>

        {/* Top-level: Dashboard + Compliance */}
        <div style={sectionHead(true)}>Overview</div>
        {topItems.map(n => (
          <NavLink key={n.path} to={n.path} style={({ isActive }) => navLink(isActive)}>{n.label}</NavLink>
        ))}

        {/* Master Data */}
        <div style={sectionHead()}>Master Data</div>
        {masterDataItems.map(n => (
          <NavLink key={n.path} to={n.path} style={({ isActive }) => navLink(isActive)}>{n.label}</NavLink>
        ))}

        {/* Operations */}
        <div style={sectionHead()}>Operations</div>
        {operationsItems.map(n => (
          <NavLink key={n.path} to={n.path} style={({ isActive }) => navLink(isActive)}>{n.label}</NavLink>
        ))}

        {/* Inventory & Traceability */}
        <div style={sectionHead()}>Inventory &amp; Traceability</div>
        {inventoryItems.map(n => (
          <NavLink key={n.path} to={n.path} style={({ isActive }) => navLink(isActive)}>{n.label}</NavLink>
        ))}
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>Pharma LIMS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>{fullName}</span>
            <button onClick={handleLogout} style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              Logout
            </button>
          </div>
        </header>
        <main style={{ flex: 1, padding: 24, background: '#f9fafb', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
