import { useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { isNavEnabled } from '@/store/navVisibilitySlice'
import NavVisibilityPanel from './master-data/NavVisibilityPanel'
import ESignConfigPanel   from './master-data/ESignConfigPanel'
import LaboratoriesPage       from './master-data/LaboratoriesPage'
import InstrumentsPage        from './master-data/InstrumentsPage'
import InstrumentMappingPage  from './master-data/InstrumentMappingPage'
import StorageLocationsPage   from './master-data/StorageLocationsPage'
import MaterialsPage          from './master-data/MaterialsPage'
import SampleTypesPage        from './master-data/SampleTypesPage'
import ReagentsPage           from './master-data/ReagentsPage'
import TestMethodsPage        from './master-data/TestMethodsPage'
import ParametersPage         from './master-data/ParametersPage'
import SpecLimitsPage         from './master-data/SpecLimitsPage'
import FormTemplatesPage      from './master-data/FormTemplatesPage'
import SpecificationTemplatesPage from './master-data/SpecificationTemplatesPage'
import SamplingPlansPage      from './master-data/SamplingPlansPage'
import StabilityProtocolsPage from './master-data/StabilityProtocolsPage'
import UsersPage              from './master-data/UsersPage'
import UserTrainingRecordsPage from './UserTrainingRecordsPage'
import WorkflowConfigPage     from './WorkflowConfigPage'
import CheckpointsPage        from './CheckpointsPage'

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = 'lab-setup' | 'materials' | 'methods-specs' | 'users-training' | 'workflow' | 'nav-visibility'

interface SubTab {
  id: string
  label: string
  icon: string
  component: React.ComponentType
}

interface TabGroup {
  id: TabId
  label: string
  icon: string
  color: string
  bg: string
  subtabs: SubTab[]
  adminOnly?: boolean
  visKey?: string   // Module Visibility key for the tab group itself
}

const TAB_GROUPS: TabGroup[] = [
  {
    id: 'lab-setup', label: 'Lab Setup', icon: '🏛', color: '#0d9488', bg: '#f0fdfa',
    subtabs: [
      { id: 'laboratories',       label: 'Laboratories',       icon: '🏛', component: LaboratoriesPage },
      { id: 'instruments',        label: 'Instruments',        icon: '⏱', component: InstrumentsPage },
      { id: 'instrument-mapping', label: 'Instrument Mapping', icon: '🔗', component: InstrumentMappingPage },
      { id: 'storage-locations',  label: 'Storage Locations',  icon: '🏠', component: StorageLocationsPage },
    ],
  },
  {
    id: 'materials', label: 'Materials', icon: '📦', color: '#d97706', bg: '#fef3c7',
    subtabs: [
      { id: 'materials',   label: 'Materials',          icon: '📦', component: MaterialsPage },
      { id: 'sample-types', label: 'Sample Types',      icon: '🧪', component: SampleTypesPage },
      { id: 'reagents',     label: 'Reagents & Standards', icon: '🔬', component: ReagentsPage },
    ],
  },
  {
    id: 'methods-specs', label: 'Methods & Specs', icon: '📋', color: '#7c3aed', bg: '#f3e8ff',
    subtabs: [
      { id: 'test-methods',           label: 'Test Methods',      icon: '📋', component: TestMethodsPage },
      { id: 'parameters',             label: 'Parameters',        icon: '⚙',  component: ParametersPage },
      { id: 'checkpoints',            label: 'Checkpoints',       icon: '🔔', component: CheckpointsPage },
      { id: 'spec-limits',            label: 'Spec Limits',       icon: '📊', component: SpecLimitsPage },
      { id: 'form-templates',         label: 'Monitoring & Log Forms',  icon: '📄', component: FormTemplatesPage },
      { id: 'spec-templates',         label: 'Product Test Plans',      icon: '📝', component: SpecificationTemplatesPage },
      { id: 'sampling-plans',         label: 'Sampling Plans',    icon: '📅', component: SamplingPlansPage },
      { id: 'stability-protocols',    label: 'Stability Protocols', icon: '🧬', component: StabilityProtocolsPage },
    ],
  },
  {
    id: 'users-training', label: 'Users & Training', icon: '👥', color: '#2563eb', bg: '#dbeafe',
    subtabs: [
      { id: 'users',            label: 'Users',            icon: '👥', component: UsersPage },
      { id: 'training-records', label: 'Training Records', icon: '🎓', component: UserTrainingRecordsPage },
    ],
  },
  {
    id: 'workflow', label: 'Workflow Engine', icon: '⚙', color: '#0d6e6e', bg: '#f0fdfa',
    subtabs: [
      { id: 'workflow-config', label: 'Workflow Templates', icon: '⚙', component: WorkflowConfigPage },
    ],
  },
  {
    id: 'nav-visibility', label: 'Module Visibility', icon: '👁', color: '#7c3aed', bg: '#f3e8ff',
    subtabs: [
      { id: 'nav-visibility', label: 'Module Visibility', icon: '👁', component: NavVisibilityPanel },
      { id: 'esign-config',   label: 'E-Sign Config',    icon: '✍', component: ESignConfigPanel   },
    ],
    adminOnly: true,
  },
]

export default function SettingsPage() {
  const role    = useSelector((s: RootState) => s.auth.role) ?? ''
  const visMap  = useSelector((s: RootState) => s.navVisibility.map)
  const isAdmin = role === 'Admin'

  const [activeGroup,  setActiveGroup]  = useState<TabId>('lab-setup')
  const [activeSub,    setActiveSub]    = useState<string>('laboratories')

  // Filter tab groups: hide adminOnly tabs for non-admin, hide tabs turned off via Module Visibility
  const visibleGroups = TAB_GROUPS
    .filter(g => (!g.adminOnly || isAdmin) && isNavEnabled(visMap, `md.${g.id}`))
    .map(g =>
      g.id === 'users-training'
        ? { ...g, subtabs: g.subtabs.filter(s => s.id !== 'users' || isAdmin) }
        : g
    )
    .map(g => ({
      ...g,
      subtabs: g.subtabs.filter(s => isNavEnabled(visMap, `md.${s.id}`)),
    }))
    .filter(g => g.subtabs.length > 0)

  const group    = visibleGroups.find(g => g.id === activeGroup)!
  const subtab   = group.subtabs.find(s => s.id === activeSub) ?? group.subtabs[0]
  const PageComp = subtab.component

  function selectGroup(gid: TabId) {
    const g = visibleGroups.find(x => x.id === gid)!
    setActiveGroup(gid)
    setActiveSub(g.subtabs[0].id)
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          ⚙️ Master Data / Settings
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Configure laboratories, instruments, materials, test methods, spec limits, users and more
        </p>
      </div>

      {/* ── Group tabs (top row) ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 0, flexWrap: 'wrap' }}>
        {visibleGroups.map(g => (
          <button
            key={g.id}
            onClick={() => selectGroup(g.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: `1.5px solid ${activeGroup === g.id ? g.color : '#e2e8f0'}`,
              borderBottom: activeGroup === g.id ? `1.5px solid ${g.bg}` : '1.5px solid #e2e8f0',
              background: activeGroup === g.id ? g.bg : '#fff',
              color: activeGroup === g.id ? g.color : '#6b7280',
              fontWeight: activeGroup === g.id ? 800 : 600,
              fontSize: 15, cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              marginBottom: activeGroup === g.id ? -1 : 0,
              zIndex: activeGroup === g.id ? 2 : 1,
              position: 'relative',
            }}>
            <span style={{ fontSize: 15 }}>{g.icon}</span>
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Content panel ── */}
      <div style={{
        background: '#fff',
        border: `1.5px solid ${group.color}`,
        borderRadius: '0 10px 10px 10px',
        overflow: 'hidden',
      }}>

        {/* Sub-tab strip */}
        <div style={{
          display: 'flex', gap: 2, flexWrap: 'wrap',
          padding: '10px 14px 0',
          background: group.bg,
          borderBottom: '1px solid #e2e8f0',
        }}>
          {group.subtabs.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSub(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 16px',
                borderRadius: '7px 7px 0 0',
                border: `1px solid ${activeSub === s.id ? '#e2e8f0' : 'transparent'}`,
                borderBottom: activeSub === s.id ? '1px solid #fff' : '1px solid transparent',
                background: activeSub === s.id ? '#fff' : 'transparent',
                color: activeSub === s.id ? group.color : '#6b7280',
                fontWeight: activeSub === s.id ? 700 : 600,
                fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
                marginBottom: activeSub === s.id ? -1 : 0,
                position: 'relative',
                zIndex: activeSub === s.id ? 2 : 1,
              }}>
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Page content */}
        <div style={{ padding: '20px 24px' }}>
          <PageComp />
        </div>
      </div>
    </div>
  )
}
