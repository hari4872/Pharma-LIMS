import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { logout } from '@/store/authSlice'

const masterDataItems = [
  { label: 'Laboratories', path: '/master-data/laboratories' },
  { label: 'Instruments', path: '/master-data/instruments' },
  { label: 'Materials', path: '/master-data/materials' },
  { label: 'Test Methods', path: '/master-data/test-methods' },
  { label: 'Parameters', path: '/master-data/parameters' },
  { label: 'Spec Limits', path: '/master-data/spec-limits' },
  { label: 'Form Templates', path: '/master-data/form-templates' },
  { label: 'Users', path: '/master-data/users' },
  { label: 'Sample Types', path: '/master-data/sample-types' },
]

const operationsItems = [
  { label: 'Sample Registration', path: '/samples' },
  { label: 'Checkpoints', path: '/checkpoints' },
  { label: 'Work Queue', path: '/work-queue' },
  { label: 'OOS Investigations', path: '/oos-investigations' },
  { label: 'Digital Logbook', path: '/digital-logbook' },
  { label: 'Results Review', path: '/results-review' },
  { label: 'CoA Review', path: '/coa-review' },
  { label: 'Dispatch QC', path: '/dispatch-qc' },
]

export default function Layout() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const fullName = useSelector((s: RootState) => s.auth.fullName)

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 220, background: '#1a2942', color: '#fff', padding: '16px 0' }}>
        <div style={{ padding: '12px 20px 24px', fontWeight: 700, fontSize: 18, borderBottom: '1px solid #2d4a6a' }}>
          Pharma LIMS
        </div>
        <div style={{ padding: '8px 20px', fontSize: 11, color: '#8aa0be', textTransform: 'uppercase', letterSpacing: 1 }}>
          Master Data
        </div>
        {masterDataItems.map(n => (
          <NavLink
            key={n.path}
            to={n.path}
            style={({ isActive }) => ({
              display: 'block', padding: '10px 20px', color: isActive ? '#5b9cf6' : '#c8d8eb',
              textDecoration: 'none', background: isActive ? '#0f1c2e' : 'transparent',
              borderLeft: isActive ? '3px solid #5b9cf6' : '3px solid transparent',
              fontSize: 14
            })}
          >
            {n.label}
          </NavLink>
        ))}
        <div style={{ padding: '16px 20px 8px', fontSize: 11, color: '#8aa0be', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #2d4a6a', marginTop: 8 }}>
          Operations
        </div>
        {operationsItems.map(n => (
          <NavLink
            key={n.path}
            to={n.path}
            style={({ isActive }) => ({
              display: 'block', padding: '10px 20px', color: isActive ? '#5b9cf6' : '#c8d8eb',
              textDecoration: 'none', background: isActive ? '#0f1c2e' : 'transparent',
              borderLeft: isActive ? '3px solid #5b9cf6' : '3px solid transparent',
              fontSize: 14
            })}
          >
            {n.label}
          </NavLink>
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
