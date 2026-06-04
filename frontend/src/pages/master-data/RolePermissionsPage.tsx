import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'

const ROLES = ['Admin', 'LabManager', 'QCLead', 'Analyst', 'QA', 'Viewer'] as const
type Role = typeof ROLES[number]

const PERMISSION_LIST = [
  'Register Sample',
  'Sign SRF',
  'Assign Work Queue',
  'Enter Test Results',
  'Sign Off Logbook',
  'Peer Review',
  'QC Lead Verify',
  'OOS Investigation',
  'Generate COA',
  'Approve / Reject COA',
  'Initiate Batch Release',
  'Batch Release Decision',
  'Checkpoints Config',
  'Sign Process Log',
  'CAPA / Quality Events',
  'Dispatch QC',
  'Compliance / Audit',
  'Master Data',
  'Instruments',
  'Dashboard',
]

/** Default matrix — used when no LabConfig override exists */
const DEFAULTS: Record<string, Partial<Record<Role, boolean>>> = {
  'Register Sample':        { Admin: true, Analyst: true },
  'Sign SRF':               { Admin: true, Analyst: true, QA: true },
  'Assign Work Queue':      { Admin: true, LabManager: true, QA: true },
  'Enter Test Results':     { Admin: true, QCLead: true, Analyst: true },
  'Sign Off Logbook':       { Admin: true, QCLead: true, Analyst: true },
  'Peer Review':            { Admin: true, QCLead: true, Analyst: true, QA: true },
  'QC Lead Verify':         { Admin: true, QCLead: true, QA: true },
  'OOS Investigation':      { Admin: true, QCLead: true, QA: true },
  'Generate COA':           { Admin: true, QCLead: true, QA: true },
  'Approve / Reject COA':   { Admin: true, QA: true },
  'Initiate Batch Release': { Admin: true, LabManager: true, QA: true },
  'Batch Release Decision': { Admin: true, QA: true },
  'Checkpoints Config':     { Admin: true, QA: true },
  'Sign Process Log':       { Admin: true, Analyst: true, QA: true },
  'CAPA / Quality Events':  { Admin: true, LabManager: true, QCLead: true, QA: true },
  'Dispatch QC':            { Admin: true, QA: true },
  'Compliance / Audit':     { Admin: true, QA: true },
  'Master Data':            { Admin: true, QA: true },
  'Instruments':            { Admin: true, LabManager: true, Analyst: true, QA: true },
  'Dashboard':              { Admin: true, QA: true },
}

type Matrix = Record<string, Partial<Record<Role, boolean>>>

const CONFIG_KEY = 'role_permissions'

export default function RolePermissionsPage() {
  const labId  = useSelector((s: RootState) => s.auth.labId)
  const isAdmin = useSelector((s: RootState) => s.auth.role) === 'Admin'

  const [matrix,   setMatrix]   = useState<Matrix>(DEFAULTS)
  const [draft,    setDraft]    = useState<Matrix>(DEFAULTS)
  const [editMode, setEditMode] = useState(false)
  const [saving,   setSaving]   = useState(false)

  /* Load saved config from LabConfig (fall back to defaults) */
  useEffect(() => {
    if (!labId) return
    api.get(`/lab-config?labId=${labId}`).then(res => {
      const entry = (res.data as { configKey: string; configValue: string }[])
        .find(c => c.configKey === CONFIG_KEY)
      if (entry) {
        try {
          const saved: Matrix = JSON.parse(entry.configValue)
          setMatrix(saved)
          setDraft(saved)
        } catch { /* ignore malformed, keep defaults */ }
      }
    }).catch(() => { /* offline / no config — defaults are fine */ })
  }, [labId])

  function enterEdit() { setDraft(JSON.parse(JSON.stringify(matrix))); setEditMode(true) }
  function cancelEdit() { setDraft(matrix); setEditMode(false) }

  function toggle(perm: string, role: Role) {
    setDraft(prev => ({
      ...prev,
      [perm]: { ...prev[perm], [role]: !prev[perm]?.[role] },
    }))
  }

  async function save() {
    if (!labId) { toast('No lab assigned to your account', 'error'); return }
    setSaving(true)
    try {
      await api.put('/lab-config', { labId, configKey: CONFIG_KEY, configValue: JSON.stringify(draft) })
      setMatrix(draft)
      setEditMode(false)
      toast('Role permissions saved', 'success')
    } catch { toast('Failed to save permissions', 'error') }
    finally { setSaving(false) }
  }

  const active = editMode ? draft : matrix

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>
            Role Permissions Summary
          </h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Default permission matrix per role. Admins can grant custom per-user overrides via the Users tab → Edit Permissions.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {editMode ? (
              <>
                <button onClick={cancelEdit}
                  style={{ padding: '6px 14px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving}
                  style={{ padding: '6px 16px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={enterEdit}
                style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✏️ Edit
              </button>
            )}
          </div>
        )}
      </div>

      {editMode && (
        <div style={{ padding: '8px 14px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, marginBottom: 14, fontSize: 12, color: '#854d0e' }}>
          ✏️ <strong>Edit Mode</strong> — click any cell to toggle. Press <strong>Save Changes</strong> when done.
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#334155' }}>
              <th style={{ ...thBase, textAlign: 'left', paddingLeft: 20, width: 200 }}>Permission</th>
              {ROLES.map(r => (
                <th key={r} style={{ ...thBase, textAlign: 'center' }}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_LIST.map((perm, i) => (
              <tr key={perm} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: i < PERMISSION_LIST.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                <td style={{ padding: '10px 20px', fontWeight: 600, color: '#1e293b', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {perm}
                </td>
                {ROLES.map(role => {
                  const has = !!active[perm]?.[role]
                  return (
                    <td key={role} style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {editMode ? (
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={() => toggle(perm, role)}
                          style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                      ) : (
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{has ? '✅' : '❌'}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ width: 3, minHeight: 34, background: '#f59e0b', borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12, color: '#b45309', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>
          Note: Set email addresses for each user to enable notification workflows. Changes here update the default role matrix for your lab.
        </p>
      </div>
    </div>
  )
}

const thBase: React.CSSProperties = {
  padding: '11px 10px',
  color: '#f1f5f9',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
}
