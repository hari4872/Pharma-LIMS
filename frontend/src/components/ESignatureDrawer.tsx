import type { FormEvent, ReactNode } from 'react'
import { Drawer, DrawerFooter } from './Drawer'
import { Field, inp } from '@/pages/master-data/LaboratoriesPage'
import { useESignConfig } from '@/hooks/useESignConfig'

export interface ESignForm {
  password: string
  meaning:  string
  reason:   string
}

interface Props {
  title:               string
  subtitle?:           string
  form:                ESignForm
  onChange:            (f: ESignForm) => void
  onSubmit:            (e: FormEvent) => void
  onClose:             () => void
  saving:              boolean
  error?:              string
  /** Save button label — defaults to "Sign & Save" */
  label?:              string
  /** Label for the Reason field — defaults to "Reason" */
  reasonLabel?:        string
  reasonPlaceholder?:  string
  /** Render a textarea instead of input for Reason */
  reasonMultiline?:    boolean
  /**
   * Config-driven action key (e.g. "BatchRelease.Approve").
   * When provided the drawer reads the admin-configured method and shows fields accordingly.
   * Takes priority over passwordOnly prop.
   */
  actionKey?:          string
  /**
   * Fallback field-visibility flag used when actionKey is not provided.
   * true  → show password only  (PasswordOnly mode)
   * false → show all fields     (PasswordAndSignature mode, default)
   */
  passwordOnly?:       boolean
  /** Extra content rendered above the form fields (info banners, warnings, etc.) */
  children?:           ReactNode
}

/**
 * Reusable right-side Drawer for all 21 CFR Part 11 e-signature flows.
 * Replaces the centred Modal pattern — blocking backdrop so the page
 * behind is not interactive while the user is signing.
 *
 * When actionKey is provided the component looks up the admin-configured method:
 *   PasswordOnly         → password field only
 *   SignatureOnly        → meaning + reason fields only (no re-auth)
 *   PasswordAndSignature → all three fields (full 21 CFR §11.50)
 *   None                 → just a confirmation button (no credential entry)
 */
export default function ESignatureDrawer({
  title, subtitle, form, onChange, onSubmit, onClose,
  saving, error, label = 'Sign & Save',
  reasonLabel = 'Reason', reasonPlaceholder, reasonMultiline = false,
  actionKey,
  passwordOnly = false,
  children,
}: Props) {
  const { method, loading } = useESignConfig(actionKey ?? '')

  // Derive field visibility from config (if actionKey provided) or legacy prop
  const effective = actionKey ? method : (passwordOnly ? 'PasswordOnly' : 'PasswordAndSignature')
  const showPassword  = effective !== 'SignatureOnly' && effective !== 'None'
  const showSignature = effective !== 'PasswordOnly'  && effective !== 'None'

  return (
    <Drawer title={title} subtitle={subtitle} onClose={onClose} blocking width={440}>

      {/* Optional context / warning banners passed by the parent */}
      {children}

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13, padding: '16px 0' }}>Loading signature requirements…</p>
      ) : (
        <form onSubmit={onSubmit}>

          {showPassword && (
            <Field label="Password (re-enter)">
              <input
                style={inp} type="password" autoFocus={showPassword} required
                value={form.password}
                onChange={e => onChange({ ...form, password: e.target.value })}
              />
            </Field>
          )}

          {showSignature && (
            <Field label="Meaning">
              <input
                style={inp} autoFocus={!showPassword} required
                value={form.meaning}
                onChange={e => onChange({ ...form, meaning: e.target.value })}
              />
            </Field>
          )}

          {showSignature && (
            <Field label={reasonLabel}>
              {reasonMultiline ? (
                <textarea
                  style={{ ...inp, height: 72, resize: 'vertical' }} required
                  value={form.reason}
                  placeholder={reasonPlaceholder}
                  onChange={e => onChange({ ...form, reason: e.target.value })}
                />
              ) : (
                <input
                  style={inp} required
                  value={form.reason}
                  placeholder={reasonPlaceholder}
                  onChange={e => onChange({ ...form, reason: e.target.value })}
                />
              )}
            </Field>
          )}

          {effective === 'None' && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0' }}>
              No e-signature required for this action. Click to continue.
            </p>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}

          <DrawerFooter saving={saving} onCancel={onClose} label={label} />
        </form>
      )}
    </Drawer>
  )
}
