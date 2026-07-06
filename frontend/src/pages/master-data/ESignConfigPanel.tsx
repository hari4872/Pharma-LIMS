import { useState, useEffect } from 'react'
import { toast } from '@/components/Toast'
import api from '@/api/client'
import type { ESignMethod } from '@/hooks/useESignConfig'
import { invalidateESignCache } from '@/hooks/useESignConfig'

// ─── Action registry ──────────────────────────────────────────────────────────
const ACTIONS = [
  { key: 'BatchRelease.Approve',       label: 'Batch Release',          sub: 'Approve' },
  { key: 'BatchRelease.Reject',        label: 'Batch Release',          sub: 'Reject' },
  { key: 'CoA.Release',               label: 'CoA',                    sub: 'Release' },
  { key: 'OosInvestigation.Close',     label: 'OOS Investigation',      sub: 'Close' },
  { key: 'QualityEvent.ApproveCapa',   label: 'QA / CAPA Event',        sub: 'Approve' },
  { key: 'TestResult.MarkComplete',    label: 'Test Result',            sub: 'Mark Complete' },
  { key: 'Checkpoint.Acknowledge',     label: 'Checkpoint',             sub: 'Acknowledge' },
  { key: 'DigitalLogbook.SignEntry',   label: 'Digital Logbook',        sub: 'Sign Entry' },
  { key: 'SampleRegistration.Submit',  label: 'Sample Registration',    sub: 'Submit / SRF' },
  { key: 'WorkQueue.Complete',         label: 'Work Queue Task',        sub: 'Mark Complete' },
]

const METHODS: { key: ESignMethod; label: string; desc: string }[] = [
  { key: 'None',                  label: 'Not Required', desc: 'No prompt — action completes immediately' },
  { key: 'PasswordOnly',          label: 'Password',     desc: 'User confirms with password only' },
  { key: 'SignatureOnly',         label: 'Signature',    desc: 'Meaning + reason fields, no re-auth' },
  { key: 'PasswordAndSignature',  label: 'Pass + Sign',  desc: 'Full 21 CFR Part 11 — password and signature' },
]

const DEFAULTS: Record<string, ESignMethod> = {
  'BatchRelease.Approve':      'PasswordAndSignature',
  'BatchRelease.Reject':       'PasswordAndSignature',
  'CoA.Release':               'PasswordAndSignature',
  'OosInvestigation.Close':    'PasswordAndSignature',
  'QualityEvent.ApproveCapa':  'PasswordOnly',
  'TestResult.MarkComplete':   'PasswordOnly',
  'Checkpoint.Acknowledge':    'None',
  'DigitalLogbook.SignEntry':  'SignatureOnly',
  'SampleRegistration.Submit': 'PasswordOnly',
  'WorkQueue.Complete':        'None',
}

const BADGE: Record<ESignMethod, { bg: string; color: string }> = {
  None:                 { bg: '#f3f4f6', color: '#6b7280' },
  PasswordOnly:         { bg: '#dbeafe', color: '#1e40af' },
  SignatureOnly:        { bg: '#f3e8ff', color: '#7c3aed' },
  PasswordAndSignature: { bg: '#d1fae5', color: '#065f46' },
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ESignConfigPanel() {
  const [config,  setConfig]  = useState<Record<string, ESignMethod>>(DEFAULTS)
  const [fourEye, setFourEye] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // Load current config from backend
  useEffect(() => {
    api.get('/admin/esign-config')
      .then(r => {
        const cfg: Record<string, ESignMethod> = { ...DEFAULTS }
        const fe: Record<string, boolean> = {}
        for (const row of r.data as Array<{ actionKey: string; method: ESignMethod; fourEye: boolean }>) {
          cfg[row.actionKey] = row.method
          fe[row.actionKey]  = row.fourEye
        }
        setConfig(cfg)
        setFourEye(fe)
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  function selectMethod(actionKey: string, method: ESignMethod) {
    setConfig(c => ({ ...c, [actionKey]: method }))
  }

  function toggleFourEye(actionKey: string) {
    setFourEye(fe => ({ ...fe, [actionKey]: !fe[actionKey] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const rows = ACTIONS.map(a => ({
        actionKey: a.key,
        method: config[a.key] ?? 'None',
        fourEye: fourEye[a.key] ?? false,
      }))
      await api.put('/admin/esign-config', rows)
      invalidateESignCache()
      toast('E-signature configuration saved', 'success')
    } catch {
      toast('Failed to save — try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  const th: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottom: '2px solid #e5e7eb', textAlign: 'center',
    whiteSpace: 'nowrap',
  }
  const thLeft: React.CSSProperties = { ...th, textAlign: 'left', minWidth: 220 }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
      Loading configuration…
    </div>
  )

  return (
    <div style={{ maxWidth: 960 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111111', margin: 0 }}>
          E-Signature Configuration
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          Choose the verification method required for each action. Only Admin can change these settings.
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {METHODS.map(m => (
          <div key={m.key} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 20,
            background: BADGE[m.key].bg, color: BADGE[m.key].color,
            fontSize: 11, fontWeight: 600,
          }}>
            {m.label}
            <span style={{ fontWeight: 400, color: BADGE[m.key].color, opacity: 0.8 }}>— {m.desc}</span>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={thLeft}>Action</th>
              {METHODS.map(m => (
                <th key={m.key} style={th}>{m.label}</th>
              ))}
              <th style={{ ...th, minWidth: 90 }}>Four-Eye</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action, i) => {
              const current = config[action.key] ?? 'None'
              const badge = BADGE[current]
              const isFourEye = fourEye[action.key] ?? false
              return (
                <tr key={action.key} style={{
                  borderBottom: i < ACTIONS.length - 1 ? '1px solid #f1f3f4' : 'none',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                }}>
                  {/* Action label */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#111111', fontSize: 13 }}>{action.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{action.sub}</div>
                    {current !== 'None' && (
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: badge.bg, color: badge.color,
                      }}>
                        {METHODS.find(m => m.key === current)?.label}
                      </span>
                    )}
                  </td>

                  {/* Radio cells */}
                  {METHODS.map(method => (
                    <td key={method.key} style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="radio"
                          name={action.key}
                          checked={current === method.key}
                          onChange={() => selectMethod(action.key, method.key)}
                          style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                        />
                      </label>
                    </td>
                  ))}

                  {/* Four-eye toggle */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <input
                        type="checkbox"
                        checked={isFourEye}
                        onChange={() => toggleFourEye(action.key)}
                        disabled={current === 'None'}
                        style={{ width: 15, height: 15, accentColor: '#0d9488', cursor: current === 'None' ? 'not-allowed' : 'pointer' }}
                      />
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Four-eye explanation */}
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
        <strong style={{ color: '#6b7280' }}>Four-eye principle:</strong> when enabled, a second different user must countersign the same action. The original signer cannot countersign their own entry.
      </p>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 24px', borderRadius: 8, border: 'none',
            background: saving ? '#d1d5db' : '#7c3aed', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
