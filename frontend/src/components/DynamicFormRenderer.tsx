import { useState, useEffect } from 'react'
import api from '@/api/client'
import { getErrorMessage, asApiError } from '@/utils/errors'
import { toast } from '@/components/Toast'
import type { FieldDef } from '@/pages/master-data/FormTemplatesPage'
import { inp } from '@/pages/master-data/LaboratoriesPage'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  sampleId:     number
  sampleNumber: string
  onClose:      () => void
  onSubmitted:  () => void
}

// ─── Past submission ──────────────────────────────────────────────────────────
interface PastEntry {
  entryId:     number
  submittedBy: string
  submittedAt: string
  fieldValues: Record<string, string>
}

// ─── Field values map ─────────────────────────────────────────────────────────
type FieldValues = Record<string, string | boolean>

// ─── Styles ───────────────────────────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#374151', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

// ─── Individual field renderer ────────────────────────────────────────────────
function FieldInput({ field, value, onChange }: {
  field:    FieldDef
  value:    string | boolean
  onChange: (v: string | boolean) => void
}) {
  switch (field.fieldType) {

    case 'Checkbox':
      return (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '9px 14px', borderRadius: 8,
          border: `1.5px solid ${value ? '#99f6e4' : '#e5e7eb'}`,
          background: value ? '#f0fdfa' : '#fafafa',
        }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#0d9488', cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: value ? '#0f766e' : '#374151', fontWeight: value ? 700 : 500 }}>
            {value ? 'Yes — confirmed' : 'Not yet confirmed'}
          </span>
        </label>
      )

    case 'Dropdown': {
      const opts = (field.options ?? '').split(',').map(o => o.trim()).filter(Boolean)
      return (
        <select style={inp} value={value as string} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      )
    }

    case 'Date':
      return <input type="date" style={inp} value={value as string} onChange={e => onChange(e.target.value)} />

    case 'DateTime':
      return <input type="datetime-local" style={inp} value={value as string} onChange={e => onChange(e.target.value)} />

    case 'Textarea':
      return (
        <textarea rows={3}
          style={{ ...inp, resize: 'vertical' as const }}
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
        />
      )

    case 'Number':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" step="1" style={{ ...inp, flex: 1 }}
            value={value as string} onChange={e => onChange(e.target.value)} placeholder="0" />
          {field.unit && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>{field.unit}</span>}
        </div>
      )

    case 'Decimal':
    case 'Parameter':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" step="any" style={{ ...inp, flex: 1 }}
            value={value as string} onChange={e => onChange(e.target.value)}
            placeholder={field.fieldType === 'Parameter' ? `Enter ${field.parameterName ?? field.label}` : '0.00'} />
          {(field.unit || field.parameterUom) && (
            <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {field.unit || field.parameterUom}
            </span>
          )}
        </div>
      )

    default: // Text
      return (
        <input type="text" style={inp}
          value={value as string} onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}…`} />
      )
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DynamicFormRenderer({ sampleId, sampleNumber, onClose, onSubmitted }: Props) {
  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState('')
  const [fields,         setFields]         = useState<FieldDef[]>([])
  const [formName,       setFormName]       = useState('')
  const [formTemplateId, setFormTemplateId] = useState<number | null>(null)
  const [values,         setValues]         = useState<FieldValues>({})
  const [pastEntries,    setPastEntries]    = useState<PastEntry[]>([])
  const [showHistory,    setShowHistory]    = useState(false)

  // E-signature state
  const [password,  setPassword]  = useState('')
  const [meaning,   setMeaning]   = useState('I confirm this form entry is accurate and complete')
  const [reason,    setReason]    = useState('')

  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')

  useEffect(() => { loadTemplate() }, [sampleId])

  async function loadTemplate() {
    setLoading(true); setLoadError('')
    try {
      // Step 1: get sample detail to find formTemplateId
      const sampleRes = await api.get(`/samples/${sampleId}`)
      const ftId: number | undefined = sampleRes.data.formTemplateId
      if (!ftId) { setLoadError('No form template is assigned to this sample.'); return }
      setFormTemplateId(ftId)

      // Step 2: get form template fields
      const tplRes = await api.get(`/form-templates/${ftId}`)
      const tpl = tplRes.data
      setFormName(tpl.formName ?? 'Form Entry')

      let parsed: FieldDef[] = []
      try { parsed = JSON.parse(tpl.fieldDefinitionsJson ?? '[]') } catch { parsed = [] }
      setFields(parsed)

      // Initialise values
      const init: FieldValues = {}
      for (const f of parsed) init[f.id] = f.fieldType === 'Checkbox' ? false : ''
      setValues(init)

      // Step 3: load previous submissions (non-blocking)
      try {
        const histRes = await api.get(`/samples/${sampleId}/form-entries`)
        setPastEntries(histRes.data ?? [])
      } catch { setPastEntries([]) }

    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load form template'))
    } finally { setLoading(false) }
  }

  function setValue(fieldId: string, val: string | boolean) {
    setValues(prev => ({ ...prev, [fieldId]: val }))
    setSubmitError('')
  }

  function validate(): string | null {
    for (const field of fields) {
      if (!field.required) continue
      const v = values[field.id]
      if (field.fieldType === 'Checkbox') {
        if (!v) return `"${field.label}" must be confirmed`
      } else {
        if (v === undefined || v === null || (typeof v === 'string' && !v.trim()))
          return `"${field.label}" is required`
      }
    }
    if (!password.trim()) return 'Password is required for e-signature'
    if (!reason.trim())   return 'Reason is required for e-signature'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setSubmitError(err); return }

    setSubmitting(true); setSubmitError('')
    try {
      // Normalise checkbox booleans → string
      const fieldValues: Record<string, string> = {}
      for (const [k, v] of Object.entries(values)) {
        fieldValues[k] = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
      }
      await api.post(`/samples/${sampleId}/form-entries`, {
        formTemplateId,
        fieldValues,
        password,
        meaning,
        reason,
      })
      toast(`Form submitted and signed for ${sampleNumber}`, 'success')
      onSubmitted()
    } catch (err) {
      const ae = asApiError(err)
      if (ae.response?.data?.error === 'ESIGN_AUTH_FAILED')
        setSubmitError('Password incorrect — e-signature failed')
      else
        setSubmitError(getErrorMessage(err, 'Submission failed'))
    } finally { setSubmitting(false) }
  }

  const hasForm = !loading && !loadError && fields.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.50)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 640,
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex', flexDirection: 'column',
        background: '#fff', borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.30)',
        overflow: 'hidden',
      }}>

        {/* ── Sticky header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              {formName || 'Form Entry'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              Sample {sampleNumber} · Fill all required fields and sign to submit
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pastEntries.length > 0 && (
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 7,
                  border: '1px solid #e2e8f0',
                  background: showHistory ? '#f0f9ff' : '#f8fafc',
                  color: '#0369a1', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {showHistory ? 'Hide' : 'History'} ({pastEntries.length})
              </button>
            )}
            <button onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, color: '#374151', fontSize: 18, width: 32, height: 32, cursor: 'pointer', lineHeight: '32px', textAlign: 'center', flexShrink: 0 }}>
              ×
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 13 }}>
              Loading form template…
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
              {loadError}
            </div>
          )}

          {/* History panel */}
          {showHistory && pastEntries.length > 0 && (
            <div style={{ marginBottom: 20, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Previous Submissions
              </div>
              {pastEntries.map((entry, idx) => (
                <div key={entry.entryId} style={{
                  marginBottom: idx < pastEntries.length - 1 ? 12 : 0,
                  paddingBottom: idx < pastEntries.length - 1 ? 12 : 0,
                  borderBottom: idx < pastEntries.length - 1 ? '1px solid #bae6fd' : 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
                    {entry.submittedBy} — {new Date(entry.submittedAt).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px' }}>
                    {Object.entries(entry.fieldValues ?? {}).map(([fieldId, val]) => {
                      const field = fields.find(f => f.id === fieldId)
                      return field ? (
                        <span key={fieldId} style={{ fontSize: 11, color: '#374151' }}>
                          <span style={{ color: '#6b7280' }}>{field.label}: </span>
                          <strong>{String(val)}</strong>
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty fields warning */}
          {!loading && !loadError && fields.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 13 }}>
              No fields defined in this form template yet.<br />
              <span style={{ fontSize: 12 }}>Go to Master Data → Monitoring & Log Forms to add fields.</span>
            </div>
          )}

          {/* Form fields + e-sig */}
          {hasForm && (
            <form id="dynamic-form" onSubmit={handleSubmit}>

              {/* Fields */}
              <div style={{ marginBottom: 24 }}>
                {fields.map((field, idx) => (
                  <div key={field.id} style={{ marginBottom: idx < fields.length - 1 ? 18 : 0 }}>
                    <label style={labelSt}>
                      {field.label}
                      {field.required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
                      {field.fieldType === 'Parameter' && field.parameterCode && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>
                          {field.parameterCode}
                        </span>
                      )}
                    </label>
                    <FieldInput
                      field={field}
                      value={values[field.id] ?? (field.fieldType === 'Checkbox' ? false : '')}
                      onChange={v => setValue(field.id, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #e2e8f0', margin: '4px 0 20px' }} />

              {/* E-Signature block */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  E-Signature — 21 CFR Part 11
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelSt}>Password (re-enter) <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="password" style={inp} value={password}
                    onChange={e => setPassword(e.target.value)} required />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelSt}>Meaning</label>
                  <select style={inp} value={meaning} onChange={e => setMeaning(e.target.value)}>
                    <option>I confirm this form entry is accurate and complete</option>
                    <option>Authorship of form entry</option>
                    <option>Supervisor approval of form entry</option>
                  </select>
                </div>

                <div>
                  <label style={labelSt}>Reason <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" style={inp} value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. End of shift — all readings within normal range" required />
                </div>
              </div>

            </form>
          )}
        </div>

        {/* ── Sticky footer ── */}
        {hasForm && (
          <div style={{
            display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 24px', borderTop: '1px solid #e5e7eb',
            background: '#f8fafc', flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              {submitError && <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>⚠ {submitError}</p>}
            </div>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button form="dynamic-form" type="submit" disabled={submitting}
              style={{
                padding: '9px 22px', border: 'none', borderRadius: 7,
                background: submitting ? '#9ca3af' : '#0d9488',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              {submitting ? 'Submitting…' : 'Submit & Sign'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
