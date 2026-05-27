import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

interface LogbookEntry {
  entryId: number; sampleId: number; sampleNumber: string; executionId: number
  parameterId: number; parameterName: string; isCritical: boolean
  triggerSource: string
  rawValue: string; calculatedResult: number | null
  autoCorectionApplied: boolean; correctionDetail: string | null
  specMinSnapshot: number | null; specMaxSnapshot: number | null
  passFail: string; isOos: boolean; isOot: boolean
  instrumentName: string | null; analystName: string
  evidenceFileRef: string | null; status: string
  signedByFullName: string | null; signedAt: string | null
  createdAt: string
}

const TRIGGER_COLORS: Record<string, { bg: string; color: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9' },
}

export default function DigitalLogbookPage() {
  const [data, setData] = useState<LogbookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [oosFilter, setOosFilter] = useState('')

  // Amendment state
  interface AmendForm { newRawValue: string; amendmentReason: string; password: string; meaning: string; reason: string }
  const [amendEntry, setAmendEntry] = useState<LogbookEntry | null>(null)
  const [amendForm, setAmendForm]   = useState<AmendForm>({ newRawValue: '', amendmentReason: '', password: '', meaning: 'I attest the amendment is accurate and complete', reason: '' })
  const [amendSaving, setAmendSaving] = useState(false)
  const [amendError, setAmendError]   = useState('')

  async function handleAmend(e: React.FormEvent) {
    e.preventDefault(); setAmendSaving(true); setAmendError('')
    try {
      await api.post(`/digital-logbook/${amendEntry!.entryId}/amend`, amendForm)
      toast('Amendment created — original preserved as Superseded', 'success')
      setAmendEntry(null); load()
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'ESIGN_AUTH_FAILED') setAmendError('Password incorrect (21 CFR §11.300)')
      else setAmendError(err.response?.data?.message ?? 'Amendment failed')
    } finally { setAmendSaving(false) }
  }

  function exportCsv() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
    window.open(`${base}/digital-logbook/export?${params.toString()}`)
  }

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const r = await api.get(`/digital-logbook?${params.toString()}`)
    let rows: LogbookEntry[] = r.data
    if (oosFilter === 'oos') rows = rows.filter(e => e.isOos)
    else if (oosFilter === 'oot') rows = rows.filter(e => e.isOot)
    else if (oosFilter === 'critical') rows = rows.filter(e => e.isCritical)
    setData(rows); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter, oosFilter])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111827' }}>Digital Logbook</h1>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Signed">Signed</option>
          <option value="Superseded">Superseded</option>
        </select>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={oosFilter} onChange={e => setOosFilter(e.target.value)}>
          <option value="">All Results</option>
          <option value="oos">OOS Only</option>
          <option value="oot">OOT Only</option>
          <option value="critical">Critical Parameters</option>
        </select>
        <button onClick={exportCsv} style={{ padding: '6px 14px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>
          ⬇ Export CSV
        </button>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
        { header: 'Parameter', accessor: r => (
          <div>
            {r.parameterName}
            {r.isCritical && <span style={{ marginLeft: 4, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>CRITICAL</span>}
          </div>
        )},
        { header: 'Trigger', accessor: r => {
          const c = TRIGGER_COLORS[r.triggerSource] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{r.triggerSource}</span>
        }},
        { header: 'Raw / Calculated', accessor: r => (
          <div>
            <span style={{ fontFamily: 'monospace' }}>{r.rawValue}</span>
            {r.calculatedResult !== null && r.calculatedResult.toString() !== r.rawValue && (
              <span style={{ marginLeft: 6, fontSize: 12, color: '#2563eb' }}>→ {r.calculatedResult}</span>
            )}
            {r.autoCorectionApplied && <span style={{ marginLeft: 4, fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 4px', borderRadius: 4 }}>CORRECTED</span>}
          </div>
        )},
        { header: 'Spec (Min–Max)', accessor: r => r.specMinSnapshot !== null || r.specMaxSnapshot !== null
          ? `${r.specMinSnapshot ?? '—'} – ${r.specMaxSnapshot ?? '—'}` : '—' },
        { header: 'Result', accessor: r => (
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: r.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
              color: r.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{r.passFail}</span>
            {r.isOos && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>OOS</span>}
            {r.isOot && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fef9c3', color: '#854d0e' }}>OOT</span>}
          </div>
        )},
        { header: 'Analyst', accessor: 'analystName' },
        { header: 'Evidence', accessor: r => r.evidenceFileRef
          ? <span style={{ fontSize: 12, color: '#16a34a' }}>✓ {r.evidenceFileRef}</span>
          : r.isCritical ? <span style={{ fontSize: 12, color: '#dc2626' }}>✗ Missing</span> : '—' },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
            background: r.status === 'Signed' ? '#d1fae5' : r.status === 'Superseded' ? '#f3f4f6' : '#fef9c3',
            color: r.status === 'Signed' ? '#065f46' : r.status === 'Superseded' ? '#6b7280' : '#854d0e' }}>{r.status}</span>
        )},
        { header: 'Signed By / At', accessor: r => r.signedByFullName
          ? <span style={{ fontSize: 12 }}>{r.signedByFullName}<br /><span style={{ color: '#6b7280' }}>{new Date(r.signedAt!).toLocaleString()}</span></span>
          : '—' },
        { header: 'Created', accessor: r => new Date(r.createdAt).toLocaleString() },
        { header: 'Actions', accessor: r => r.status === 'Signed' ? (
          <button onClick={() => { setAmendEntry(r); setAmendForm({ newRawValue: r.rawValue, amendmentReason: '', password: '', meaning: 'I attest the amendment is accurate and complete', reason: '' }); setAmendError('') }}
            style={{ padding: '3px 8px', background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            Amend
          </button>
        ) : null },
      ]}

      />

      {/* ── Amendment Modal — §11.10(e) ──────────────────────────────────── */}
      {amendEntry && (
        <Modal title={`Amend Entry — §11.10(e)`} onClose={() => setAmendEntry(null)}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            21 CFR §11.10(e) — Original preserved as Superseded. New entry created as Pending.
            E-signature re-authentication required.
          </p>
          <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#374151' }}>
            <strong>Entry #{amendEntry.entryId}</strong> · {amendEntry.parameterName} · Sample {amendEntry.sampleNumber}
            <br />Current value: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{amendEntry.rawValue}</span>
          </div>
          <form onSubmit={handleAmend}>
            <Field label="New Raw Value *">
              <input style={inp} value={amendForm.newRawValue}
                onChange={e => setAmendForm(f => ({ ...f, newRawValue: e.target.value }))} required />
            </Field>
            <Field label="Amendment Reason *">
              <textarea style={{ ...inp, height: 60, resize: 'vertical' as const }} value={amendForm.amendmentReason}
                onChange={e => setAmendForm(f => ({ ...f, amendmentReason: e.target.value }))} required
                placeholder="e.g. Transcription error — instrument read incorrectly" />
            </Field>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 4px' }}>21 CFR §11.50 Electronic Signature</p>
            <Field label="Password *">
              <input type="password" style={inp} value={amendForm.password}
                onChange={e => setAmendForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning *">
              <select style={inp} value={amendForm.meaning} onChange={e => setAmendForm(f => ({ ...f, meaning: e.target.value }))}>
                <option>I attest the amendment is accurate and complete</option>
                <option>Authorship of amendment</option>
                <option>Amendment approved</option>
              </select>
            </Field>
            <Field label="Reason *">
              <input style={inp} value={amendForm.reason}
                onChange={e => setAmendForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Correcting data entry error per SOP-LAB-012" />
            </Field>
            {amendError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0' }}>{amendError}</p>}
            <ModalFooter saving={amendSaving} onCancel={() => setAmendEntry(null)} label="Submit Amendment" />
          </form>
        </Modal>
      )}
    </div>
  )
}
