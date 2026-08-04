import { Fragment, useState, useEffect, type CSSProperties } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeatureFlag { key: string; isEnabled: boolean; updatedBy: string; updatedAt: string }
interface ModuleVisEntry { isEnabled: boolean; isLockedBySuperAdmin: boolean }
type ModuleVisMap = Record<string, Record<string, ModuleVisEntry>>
interface AuditEntry { entityType: string; action: string; changedBy: string; changedAt: string; newValues: string }

// ── Nav registry (mirrors NavVisibilityPanel.tsx REGISTRY) ───────────────────
const NAV_REGISTRY = [
  {
    section: 'Overview',
    items: [
      { key: 'nav.dashboard',  label: 'Dashboard',   protected: true },
      { key: 'nav.compliance', label: 'Compliance' },
      { key: 'nav.multi-site', label: 'Multi-site' },
    ],
  },
  {
    section: 'Lab Operations',
    items: [
      { key: 'nav.samples',          label: 'Sample Registration' },
      { key: 'nav.work-queue',       label: 'Work Queue' },
      { key: 'nav.capacity-booking', label: 'Capacity Booking' },
      { key: 'nav.checkpoint-tasks', label: 'Checkpoints' },
      { key: 'nav.digital-logbook',  label: 'Digital Logbook' },
    ],
  },
  {
    section: 'Quality Assurance',
    items: [{ key: 'nav.quality-assurance', label: 'Quality Assurance' }],
  },
  {
    section: 'Release & Dispatch',
    items: [{ key: 'nav.release-dispatch', label: 'Release & Dispatch' }],
  },
  {
    section: 'Stability & Retention',
    items: [{ key: 'nav.stability-retention', label: 'Stability & Retention' }],
  },
  {
    section: 'Analytics',
    items: [
      { key: 'nav.reports',        label: 'Reports & Exports' },
      { key: 'nav.report-builder', label: 'Report Builder' },
    ],
  },
  {
    section: 'Master Data — Lab Setup',
    items: [
      { key: 'md.laboratories',       label: 'Laboratories' },
      { key: 'md.instruments',        label: 'Instruments' },
      { key: 'md.instrument-mapping', label: 'Instrument Mapping' },
      { key: 'md.storage-locations',  label: 'Storage Locations' },
    ],
  },
  {
    section: 'Master Data — Materials',
    items: [
      { key: 'md.materials',    label: 'Materials' },
      { key: 'md.sample-types', label: 'Sample Types' },
      { key: 'md.reagents',     label: 'Reagents & Standards' },
    ],
  },
  {
    section: 'Master Data — Methods & Specs',
    items: [
      { key: 'md.test-methods',        label: 'Test Methods' },
      { key: 'md.parameters',          label: 'Parameters' },
      { key: 'md.checkpoints',         label: 'Checkpoints' },
      { key: 'md.spec-limits',         label: 'Spec Limits' },
      { key: 'md.form-templates',      label: 'Monitoring & Log Forms' },
      { key: 'md.spec-templates',      label: 'Product Test Plans' },
      { key: 'md.sampling-plans',      label: 'Sampling Plans' },
      { key: 'md.stability-protocols', label: 'Stability Protocols' },
    ],
  },
  {
    section: 'Master Data — Users & Training',
    items: [
      { key: 'md.users',            label: 'Users' },
      { key: 'md.training-records', label: 'Training Records' },
    ],
  },
  {
    section: 'Master Data — Workflow',
    items: [
      { key: 'md.workflow-config', label: 'Workflow Templates' },
    ],
  },
]

const ALL_ROLES = ['Admin', 'QA', 'QCLead', 'Analyst', 'LabManager', 'Viewer']

const FLAG_META: Record<string, { label: string; desc: string; core: boolean }> = {
  'ff.srf':       { label: 'Sample Request Form (SRF)', desc: 'Requires SRF e-sign before testing begins', core: true },
  'ff.esign':     { label: 'E-signature enforcement',   desc: '21 CFR Part 11 e-sign on critical actions', core: true },
  'ff.coa':       { label: 'CoA auto-generation',       desc: 'Auto-build certificate of analysis on release', core: true },
  'ff.oos':       { label: 'OOS workflow',              desc: 'Out-of-spec auto-detection and investigation flow', core: true },
  'ff.stability': { label: 'Stability module',          desc: 'Long-term stability study tracking', core: false },
  'ff.multisite': { label: 'Multi-site network',        desc: 'Cross-lab sample sharing and routing', core: false },
  'ff.capacity':  { label: 'Capacity booking',          desc: 'Instrument time-slot reservation system', core: false },
  'ff.logbook':   { label: 'Digital logbook',           desc: 'Immutable instrument usage records (21 CFR 11.10(e))', core: false },
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#fff',
    border: '0.5px solid #e5e7eb',
    borderRadius: 8,
    padding: '13px 15px',
  } as CSSProperties,
  sectionHdr: {
    fontSize: 11, fontWeight: 700 as const, color: '#0d9488',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 6, marginTop: 14,
  },
  saveBtn: {
    background: '#0d9488', color: '#fff', border: 'none',
    padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500 as const,
    cursor: 'pointer', flexShrink: 0 as const,
  },
}

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label style={{ position: 'relative', width: 42, height: 24, flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 24,
        background: disabled ? '#e5e7eb' : checked ? '#0d9488' : '#d1d5db',
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', width: 18, height: 18,
          left: checked ? 21 : 3, top: 3,
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: disabled ? 'none' : '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </span>
    </label>
  )
}

// ── API helpers ───────────────────────────────────────────────────────────────
function useToken() { return useSelector((s: RootState) => s.auth.token) ?? '' }

async function apiFetch(token: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Feature Flags
// ══════════════════════════════════════════════════════════════════════════════
function FeatureFlagsTab() {
  const token = useToken()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    apiFetch(token, '/superadmin/feature-flags').then(setFlags).catch(console.error)
  }, [token])

  function toggle(key: string, val: boolean) {
    setFlags(f => f.map(ff => ff.key === key ? { ...ff, isEnabled: val } : ff))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await apiFetch(token, '/superadmin/feature-flags', 'PUT', flags.map(f => ({ key: f.key, isEnabled: f.isEnabled })))
      setFlags(updated); setDirty(false); setToast('Feature flags saved')
    } catch { setToast('Save failed') }
    finally { setSaving(false); setTimeout(() => setToast(''), 3000) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>Feature flags</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Global switches. When a feature is OFF here, no role can access it — not even Admin.</div>
        </div>
        <button style={{ ...S.saveBtn, opacity: dirty ? 1 : 0.5 }} disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: 7, fontSize: 11, color: '#92400e', marginBottom: 14 }}>
        ⚠️ Turning a flag OFF immediately hides that feature for all users with no warning.
      </div>

      {toast && <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '0.5px solid #a7f3d0', borderRadius: 7, fontSize: 12, color: '#065f46', marginBottom: 10 }}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {flags.map(flag => {
          const meta = FLAG_META[flag.key]
          if (!meta) return null
          return (
            <div key={flag.key} style={{
              ...S.card,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              borderLeft: meta.core ? '3px solid #0d9488' : '0.5px solid #e5e7eb',
              opacity: flag.isEnabled ? 1 : 0.75,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: flag.isEnabled ? '#ecfdf5' : '#fee2e2', color: flag.isEnabled ? '#065f46' : '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {flag.isEnabled ? '✓' : '✗'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', marginBottom: 2 }}>{meta.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{meta.desc}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: meta.core ? '#ecfdf5' : '#eff6ff', color: meta.core ? '#065f46' : '#1e40af' }}>
                  {meta.core ? 'Core' : 'Optional'}
                </span>
                <Toggle checked={flag.isEnabled} onChange={v => toggle(flag.key, v)} />
              </div>
            </div>
          )
        })}
        {flags.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 13 }}>
            Loading feature flags…
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Module Visibility
// ══════════════════════════════════════════════════════════════════════════════
function ModuleVisibilityTab() {
  const token = useToken()
  const [visMap, setVisMap] = useState<ModuleVisMap>({})
  const [selectedRole, setSelectedRole] = useState('Admin')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    apiFetch(token, '/superadmin/module-visibility').then(setVisMap).catch(console.error)
  }, [token])

  function getEntry(navKey: string): ModuleVisEntry {
    return visMap[selectedRole]?.[navKey] ?? { isEnabled: true, isLockedBySuperAdmin: false }
  }

  function toggle(navKey: string, field: 'isEnabled' | 'isLockedBySuperAdmin', val: boolean) {
    setVisMap(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [navKey]: { ...getEntry(navKey), [field]: val },
      },
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const items: { role: string; navKey: string; isEnabled: boolean; isLockedBySuperAdmin: boolean }[] = []
    for (const role of ALL_ROLES) {
      const roleMap = visMap[role] ?? {}
      for (const sec of NAV_REGISTRY) {
        for (const item of sec.items) {
          const entry = roleMap[item.key] ?? { isEnabled: true, isLockedBySuperAdmin: false }
          items.push({ role, navKey: item.key, isEnabled: entry.isEnabled, isLockedBySuperAdmin: entry.isLockedBySuperAdmin })
        }
      }
    }
    try {
      await apiFetch(token, '/superadmin/module-visibility', 'PUT', items)
      setDirty(false); setToast('Module visibility saved')
    } catch { setToast('Save failed') }
    finally { setSaving(false); setTimeout(() => setToast(''), 3000) }
  }

  const roleColors: Record<string, string> = {
    Admin: '#1e40af', QA: '#7c3aed', QCLead: '#0d9488', Analyst: '#0284c7', LabManager: '#d97706', Viewer: '#6b7280',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>Module visibility</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Control which pages each role can see. Lock a page OFF — Admin cannot re-enable it.</div>
        </div>
        <button style={{ ...S.saveBtn, opacity: dirty ? 1 : 0.5 }} disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 7, fontSize: 11, color: '#1e40af', marginBottom: 14 }}>
        🔒 Toggle <strong>Locked</strong> on any row to prevent Admin from re-enabling it.
      </div>

      {toast && <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '0.5px solid #a7f3d0', borderRadius: 7, fontSize: 12, color: '#065f46', marginBottom: 10 }}>{toast}</div>}

      {/* Role selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {ALL_ROLES.map(r => (
          <button key={r} onClick={() => setSelectedRole(r)} style={{
            padding: '5px 13px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
            border: '0.5px solid ' + (selectedRole === r ? roleColors[r] : '#d1d5db'),
            background: selectedRole === r ? roleColors[r] : '#fff',
            color: selectedRole === r ? '#fff' : '#374151',
            fontWeight: selectedRole === r ? 600 : 400,
          }}>{r}</button>
        ))}
      </div>

      {/* Nav key table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280', width: '45%' }}>Page</th>
            <th style={{ textAlign: 'center', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Visible</th>
            <th style={{ textAlign: 'center', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#1e40af' }}>Locked OFF</th>
          </tr>
        </thead>
        <tbody>
          {NAV_REGISTRY.map(sec => (
            <Fragment key={sec.section}>
              <tr>
                <td colSpan={3} style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                  {sec.section}
                </td>
              </tr>
              {sec.items.map(item => {
                const entry = getEntry(item.key)
                const isProtected = (item as any).protected
                return (
                  <tr key={item.key} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px 8px 20px' }}>
                      <span style={{ color: entry.isEnabled ? '#111827' : '#9ca3af' }}>{item.label}</span>
                      {isProtected && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>Protected</span>}
                      {entry.isLockedBySuperAdmin && !entry.isEnabled && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>Locked off</span>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                      <Toggle checked={entry.isEnabled} disabled={isProtected} onChange={v => toggle(item.key, 'isEnabled', v)} />
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                      <Toggle
                        checked={entry.isLockedBySuperAdmin}
                        disabled={isProtected || entry.isEnabled}
                        onChange={v => toggle(item.key, 'isLockedBySuperAdmin', v)}
                      />
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Lock only applies when Visible is OFF. Turn OFF first, then lock to prevent Admin from re-enabling.</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: E-Sign Config (read-only audit view — editable in Admin Settings)
// ══════════════════════════════════════════════════════════════════════════════
function ESignConfigTab() {
  const token = useToken()
  const [configs, setConfigs] = useState<{ actionKey: string; method: string; roles: string[] }[]>([])

  useEffect(() => {
    apiFetch(token, '/admin/esign-config').then(setConfigs).catch(console.error)
  }, [token])

  const methodLabel: Record<string, string> = {
    None: 'None', PasswordOnly: 'Password', SignatureOnly: 'Signature', PasswordAndSignature: 'Password + Signature',
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>E-sign configuration</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Which actions require an electronic signature. Editable in Admin → System Config.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#f5f3ff', border: '0.5px solid #ddd6fe', borderRadius: 7, fontSize: 11, color: '#6d28d9', marginBottom: 14 }}>
        ✍ E-sign settings are managed by Admin. SuperAdmin can audit the configuration below.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280', width: '40%' }}>Action</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Method required</th>
          </tr>
        </thead>
        <tbody>
          {configs.length === 0 && (
            <tr><td colSpan={2} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>Loading e-sign config…</td></tr>
          )}
          {configs.map(cfg => (
            <tr key={cfg.actionKey} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
              <td style={{ padding: '9px 10px', fontWeight: 500, color: '#111827' }}>{cfg.actionKey}</td>
              <td style={{ padding: '9px 10px' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                  background: cfg.method === 'None' ? '#f3f4f6' : '#f5f3ff',
                  color: cfg.method === 'None' ? '#6b7280' : '#6d28d9',
                }}>
                  {methodLabel[cfg.method] ?? cfg.method}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Users & Licenses
// ══════════════════════════════════════════════════════════════════════════════
function UsersLicensesTab() {
  const token = useToken()
  const [users, setUsers] = useState<{ userId: number; fullName: string; email: string; role: string; isActive: boolean }[]>([])

  useEffect(() => {
    apiFetch(token, '/users').then((data: any[]) => setUsers(data)).catch(console.error)
  }, [token])

  const admins = users.filter(u => u.role === 'Admin' || u.role === 'SuperAdmin')
  const total = users.length
  const active = users.filter(u => u.isActive).length

  const roleColor: Record<string, { bg: string; color: string }> = {
    SuperAdmin: { bg: '#1e3a5f', color: '#fff' },
    Admin:      { bg: '#eff6ff', color: '#1e40af' },
    QA:         { bg: '#f5f3ff', color: '#6d28d9' },
    Analyst:    { bg: '#f0f9ff', color: '#0369a1' },
    LabManager: { bg: '#fffbeb', color: '#92400e' },
    Viewer:     { bg: '#f3f4f6', color: '#374151' },
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>Users &amp; licenses</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>User seat overview for this tenant. Add or remove seats via the Admin panel.</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total users', val: total },
          { label: 'Active', val: active, color: '#0d9488' },
          { label: 'Inactive', val: total - active },
          { label: 'Admin accounts', val: admins.length },
        ].map(s => (
          <div key={s.label} style={{ ...S.card }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: s.color ?? '#111827', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionHdr}>Admin &amp; SuperAdmin accounts</div>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {admins.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>}
        {admins.map((u, i) => (
          <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < admins.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0369a1', flexShrink: 0 }}>
              {(u.fullName ?? '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{u.fullName}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{u.email}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, ...roleColor[u.role] ?? roleColor.Viewer }}>
              {u.role}
            </span>
            <span style={{ fontSize: 11, color: u.isActive ? '#059669' : '#9ca3af', marginLeft: 4 }}>
              {u.isActive ? '● Active' : '○ Inactive'}
            </span>
          </div>
        ))}
      </div>

      <div style={S.sectionHdr}>All roles breakdown</div>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {ALL_ROLES.concat(['SuperAdmin']).map((r, i, arr) => {
          const count = users.filter(u => u.role === r).length
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: i < arr.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
              <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{r}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Audit Log
// ══════════════════════════════════════════════════════════════════════════════
function AuditLogTab() {
  const token = useToken()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filter, setFilter] = useState<'All' | 'Config' | 'Feature' | 'User' | 'System'>('All')

  useEffect(() => {
    apiFetch(token, '/superadmin/audit-log?limit=50').then(setLogs).catch(console.error)
  }, [token])

  const dotColor: Record<string, string> = { Config: '#3b82f6', Feature: '#f59e0b', User: '#8b5cf6', System: '#10b981' }

  function classify(entry: AuditEntry): string {
    if (entry.action.includes('Feature')) return 'Feature'
    if (entry.action.includes('User')) return 'User'
    if (entry.action.includes('System')) return 'System'
    return 'Config'
  }

  const filtered = logs.filter(l => filter === 'All' || classify(l) === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>Audit log</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>All SuperAdmin config changes. Read-only — cannot be deleted (21 CFR 11.10(e)).</div>
        </div>
        <button style={{ padding: '7px 14px', fontSize: 12, border: '0.5px solid #d1d5db', borderRadius: 7, background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>
          ↓ Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['All', 'Config', 'Feature', 'User', 'System'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 11px', fontSize: 11, border: '0.5px solid ' + (filter === f ? '#0d9488' : '#d1d5db'),
            borderRadius: 6, cursor: 'pointer',
            color: filter === f ? '#0d9488' : '#6b7280',
            background: filter === f ? '#f0fdfa' : '#fff',
          }}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>No audit entries found.</div>
      )}
      {filtered.map((entry, i) => {
        const cat = classify(entry)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < filtered.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[cat] ?? '#6b7280', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#111827', marginBottom: 2 }}><strong>{entry.changedBy}</strong> — {entry.action}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{entry.entityType} · {new Date(entry.changedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: System Settings (read-only info panel for now)
// ══════════════════════════════════════════════════════════════════════════════
function SystemSettingsTab() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 3 }}>System settings</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Deployment info and platform configuration. Contact WebSynergies to change tenant settings.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          {
            title: '🏢 Tenant identity',
            rows: [
              ['Tenant ID', 'LIMSLITE-MCL-001'],
              ['Lab name', 'MediChem Labs Pte Ltd'],
              ['Region', 'AP-Southeast (SGT, UTC+8)'],
              ['License expires', '2026-12-31'],
            ],
          },
          {
            title: '🌐 Regional settings',
            rows: [
              ['Timezone', 'Asia/Singapore (UTC+8)'],
              ['Date format', 'YYYY-MM-DD'],
              ['Number format', '1,234.56 (period decimal)'],
            ],
          },
          {
            title: '🗄️ Data retention',
            rows: [
              ['Audit log', '7 years (21 CFR 11.10(e))'],
              ['Sample records', '10 years'],
              ['Backup', 'Daily at 02:00 SGT'],
            ],
          },
          {
            title: '⚙️ Deployment',
            rows: [
              ['Backend', 'LIMS.API v2.4.x'],
              ['Database', 'PostgreSQL @ 52.230.33.120:5432'],
              ['Status', '✅ All systems operational'],
            ],
          },
        ].map(card => (
          <div key={card.title} style={{ ...S.card }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{card.title}</div>
            {card.rows.map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f3f4f6', fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>{label}</span>
                <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main SuperAdminPage
// ══════════════════════════════════════════════════════════════════════════════
type TabId = 'flags' | 'modvis' | 'esign' | 'users' | 'audit' | 'system'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'flags',  label: 'Feature flags',      icon: '⊙' },
  { id: 'modvis', label: 'Module visibility',   icon: '👁' },
  { id: 'esign',  label: 'E-sign config',       icon: '✍' },
  { id: 'users',  label: 'Users & licenses',    icon: '👥' },
  { id: 'audit',  label: 'Audit log',           icon: '📋' },
  { id: 'system', label: 'System settings',     icon: '⚙' },
]

export default function SuperAdminPage() {
  const [tab, setTab] = useState<TabId>('flags')

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M12 1l3 6h6l-5 4 2 6-6-4-6 4 2-6L3 7h6z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>SuperAdmin Panel</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Platform-level control — WebSynergies only</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 5, background: '#fef3c7', color: '#92400e', border: '0.5px solid #fcd34d' }}>
          🔒 SUPERADMIN ONLY
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20, gap: 2, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 14px', fontSize: 12, cursor: 'pointer', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? '#0d9488' : 'transparent'}`,
            color: tab === t.id ? '#0d9488' : '#6b7280',
            background: 'transparent', fontWeight: tab === t.id ? 600 : 400,
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            transition: 'color 0.15s',
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'flags'  && <FeatureFlagsTab />}
        {tab === 'modvis' && <ModuleVisibilityTab />}
        {tab === 'esign'  && <ESignConfigTab />}
        {tab === 'users'  && <UsersLicensesTab />}
        {tab === 'audit'  && <AuditLogTab />}
        {tab === 'system' && <SystemSettingsTab />}
      </div>
    </div>
  )
}
