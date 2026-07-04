import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { persistNavVisibility } from '@/store/navVisibilitySlice'
import type { VisibilityMap } from '@/api/navVisibility'

// Full registry — matches Layout.tsx keys and SettingsPage.tsx sub-tab ids
const REGISTRY = [
  {
    group: 'Sidebar Sections & Pages',
    color: '#0d9488',
    bg: '#f0fdfa',
    sections: [
      {
        sectionKey: 'sec.overview', label: 'Overview', protected: false,
        items: [
          { key: 'nav.dashboard',  label: 'Dashboard', protected: true },
          { key: 'nav.compliance', label: 'Compliance' },
          { key: 'nav.multi-site', label: 'Multi-site' },
        ],
      },
      {
        sectionKey: 'sec.lab-ops', label: 'Lab Operations', protected: false,
        items: [
          { key: 'nav.samples',          label: 'Sample Registration' },
          { key: 'nav.work-queue',       label: 'Work Queue' },
          { key: 'nav.capacity-booking', label: 'Capacity Booking' },
          { key: 'nav.checkpoint-tasks', label: 'Checkpoints' },
          { key: 'nav.digital-logbook',  label: 'Digital Logbook' },
        ],
      },
      {
        sectionKey: 'sec.quality', label: 'Quality Assurance', protected: false,
        items: [{ key: 'nav.quality-assurance', label: 'Quality Assurance' }],
      },
      {
        sectionKey: 'sec.release', label: 'Release & Dispatch', protected: false,
        items: [{ key: 'nav.release-dispatch', label: 'Release & Dispatch' }],
      },
      {
        sectionKey: 'sec.stability', label: 'Stability & Retention', protected: false,
        items: [{ key: 'nav.stability-retention', label: 'Stability & Retention' }],
      },
      {
        sectionKey: 'sec.analytics', label: 'Analytics & Reports', protected: false,
        items: [
          { key: 'nav.reports',        label: 'Reports & Exports' },
          { key: 'nav.report-builder', label: 'Report Builder' },
        ],
      },
      {
        sectionKey: 'sec.traceability', label: 'Traceability & Transfers', protected: false,
        items: [
          { key: 'nav.traceability',  label: 'Traceability' },
          { key: 'nav.site-transfers', label: 'Site Transfers' },
        ],
      },
      {
        sectionKey: 'sec.master-data', label: 'Master Data / Settings', protected: true,
        items: [],
      },
    ],
  },
  {
    group: 'Master Data Pages',
    color: '#7c3aed',
    bg: '#f3e8ff',
    sections: [
      {
        sectionKey: 'md.lab-setup', label: 'Lab Setup', protected: false,
        items: [
          { key: 'md.laboratories',      label: 'Laboratories' },
          { key: 'md.instruments',       label: 'Instruments' },
          { key: 'md.instrument-mapping', label: 'Instrument Mapping' },
          { key: 'md.storage-locations', label: 'Storage Locations' },
        ],
      },
      {
        sectionKey: 'md.materials', label: 'Materials', protected: false,
        items: [
          { key: 'md.materials',    label: 'Materials' },
          { key: 'md.sample-types', label: 'Sample Types' },
          { key: 'md.reagents',     label: 'Reagents & Standards' },
        ],
      },
      {
        sectionKey: 'md.methods-specs', label: 'Methods & Specs', protected: false,
        items: [
          { key: 'md.test-methods',         label: 'Test Methods' },
          { key: 'md.parameters',           label: 'Parameters' },
          { key: 'md.checkpoints',          label: 'Checkpoints' },
          { key: 'md.spec-limits',          label: 'Spec Limits' },
          { key: 'md.form-templates',       label: 'Monitoring & Log Forms' },
          { key: 'md.spec-templates',       label: 'Product Test Plans' },
          { key: 'md.sampling-plans',       label: 'Sampling Plans' },
          { key: 'md.stability-protocols',  label: 'Stability Protocols' },
        ],
      },
      {
        sectionKey: 'md.users-training', label: 'Users & Training', protected: false,
        items: [
          { key: 'md.users',            label: 'Users' },
          { key: 'md.training-records', label: 'Training Records' },
        ],
      },
      {
        sectionKey: 'md.workflow', label: 'Workflow Engine', protected: false,
        items: [{ key: 'md.workflow-config', label: 'Workflow Templates' }],
      },
      {
        sectionKey: 'md.nav-visibility', label: 'Module Visibility', protected: true,
        items: [],
      },
    ],
  },
]

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      title={disabled ? 'This setting is protected and cannot be turned off' : (on ? 'Click to hide' : 'Click to show')}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: disabled ? '#d1d5db' : on ? '#0d9488' : '#e2e8f0',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        outline: 'none',
      }}>
      <span style={{
        position: 'absolute', top: 3,
        left: on && !disabled ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

export default function NavVisibilityPanel() {
  const dispatch = useDispatch<AppDispatch>()
  const savedMap = useSelector((s: RootState) => s.navVisibility.map)
  const saving   = useSelector((s: RootState) => s.navVisibility.saving)

  const [local, setLocal]     = useState<VisibilityMap>({})
  const [saved, setSaved]     = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => { setLocal(savedMap) }, [savedMap])

  function isOn(key: string, isProtected: boolean) {
    if (isProtected) return true
    return local[key] !== false
  }

  function toggle(key: string) {
    setLocal(prev => ({ ...prev, [key]: prev[key] !== false ? false : true }))
    setSaved(false)
    setSaveErr('')
  }

  async function handleSave() {
    setSaveErr('')
    // Build a complete map: every key in the registry with its current on/off state
    // This ensures we always send a non-empty payload even if nothing was toggled
    const allKeys: string[] = []
    REGISTRY.forEach(grp =>
      grp.sections.forEach(sec => {
        if (!sec.protected) allKeys.push(sec.sectionKey)
        sec.items.forEach(item => { if (!(item as any).protected) allKeys.push(item.key) })
      })
    )
    const fullMap: VisibilityMap = {}
    allKeys.forEach(k => { fullMap[k] = local[k] !== false })

    const result = await dispatch(persistNavVisibility(fullMap))
    if (persistNavVisibility.fulfilled.match(result)) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      const msg = (result as any).error?.message ?? ''
      setSaveErr(msg.includes('403') || msg.toLowerCase().includes('forbidden')
        ? 'Access denied — only Admins can save visibility settings.'
        : 'Save failed. Please try again.')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Module Visibility</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
            Turn sections and pages ON or OFF. Changes take effect immediately for all users.
            <br />
            <span style={{ color: '#d97706', fontWeight: 600 }}>🔒 Protected items cannot be turned off.</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 22px', borderRadius: 8,
              background: saved ? '#16a34a' : saveErr ? '#dc2626' : '#0d9488',
              color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
          {saveErr && (
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500, maxWidth: 280, textAlign: 'right' }}>
              {saveErr}
            </span>
          )}
        </div>
      </div>

      {REGISTRY.map(grp => (
        <div key={grp.group} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: grp.color,
            padding: '6px 12px', background: grp.bg,
            borderRadius: '8px 8px 0 0', borderBottom: `2px solid ${grp.color}`,
          }}>
            {grp.group}
          </div>

          {grp.sections.map(sec => (
            <div key={sec.sectionKey} style={{
              border: '1px solid #e2e8f0', borderTop: 'none',
              background: '#fff',
            }}>
              {/* Section row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                background: '#f8fafc',
                borderBottom: sec.items.length > 0 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {sec.label}
                  </span>
                  {sec.protected && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#92400e',
                      background: '#fef3c7', border: '1px solid #fde68a',
                      borderRadius: 4, padding: '1px 6px',
                    }}>PROTECTED</span>
                  )}
                </div>
                <Toggle
                  on={isOn(sec.sectionKey, sec.protected)}
                  onChange={() => toggle(sec.sectionKey)}
                  disabled={sec.protected}
                />
              </div>

              {/* Item rows */}
              {sec.items.map((item, idx) => {
                const sectionOff = !isOn(sec.sectionKey, sec.protected)
                const itemProtected = (item as any).protected === true
                const isDisabled = sectionOff || itemProtected
                return (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px 8px 36px',
                    borderBottom: idx < sec.items.length - 1 ? '1px solid #f8fafc' : 'none',
                    opacity: sectionOff ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
                      {item.label}
                      {itemProtected && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px' }}>PROTECTED</span>
                      )}
                    </span>
                    <Toggle
                      on={isOn(item.key, itemProtected)}
                      onChange={() => toggle(item.key)}
                      disabled={isDisabled}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
