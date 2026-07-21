import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'
import { fetchLabConfig, invalidateLabConfigCache } from '@/hooks/useLabConfig'

interface StepToggle {
  key: string
  label: string
  description: string
  default: boolean
}

const STEP_TOGGLES: StepToggle[] = [
  {
    key: 'skip_schedule_step',
    label: 'Schedule Step',
    description: 'When disabled, Step 4 (Schedule / Capacity Booking) is skipped during sample registration. Analyst assignment goes straight to barcode printing.',
    default: false,
  },
]

export default function WorkflowStepsPanel() {
  const labId = useSelector((s: RootState) => s.auth.labId)
  const [values, setValues] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!labId) return
    fetchLabConfig(labId).then(map => {
      const init: Record<string, boolean> = {}
      for (const t of STEP_TOGGLES) {
        init[t.key] = map[t.key] === 'true' ? true : map[t.key] === 'false' ? false : t.default
      }
      setValues(init)
      setLoaded(true)
    })
  }, [labId])

  async function save() {
    if (!labId) return
    setSaving(true)
    try {
      for (const t of STEP_TOGGLES) {
        await api.put('/lab-config', { labId, configKey: t.key, configValue: String(values[t.key] ?? t.default) })
      }
      invalidateLabConfigCache(labId)
      toast('Workflow step configuration saved', 'success')
    } catch {
      toast('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <div style={{ padding: 32, color: '#6b7280' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 640, padding: '24px 0' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>
        Sample Registration — Workflow Steps
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Toggle which steps appear in the post-registration wizard.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEP_TOGGLES.map(t => (
          <div key={t.key} style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
            padding: '16px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                {t.description}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: values[t.key] ? '#6b7280' : '#111827', fontWeight: 500 }}>
                {values[t.key] ? 'Skipped' : 'Enabled'}
              </span>
              <div
                onClick={() => setValues(v => ({ ...v, [t.key]: !v[t.key] }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
                  background: values[t.key] ? '#d1d5db' : '#1e3a5f',
                  position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, borderRadius: '50%', width: 20, height: 20, background: '#fff',
                  transition: 'left 0.2s',
                  left: values[t.key] ? 2 : 22,
                }} />
              </div>
            </label>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '9px 24px', background: saving ? '#9ca3af' : '#1e3a5f',
            color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : '💾 Save Changes'}
        </button>
      </div>
    </div>
  )
}
