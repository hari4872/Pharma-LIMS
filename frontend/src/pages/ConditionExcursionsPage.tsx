import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface Excursion {
  excursionId: number; locationId: number; locationCode: string; locationName: string
  excursionType: string; measuredValue: number; limitExceeded: string
  excursionStart: string; excursionEnd: string | null
  recordedBy: string; recordedAt: string
  impactAssessed: boolean; impactOutcome: string | null
  affectedSampleCount: number
}
interface StorageLocation { locationId: number; locationCode: string; locationName: string }

const EXCURSION_TYPES = ['Temperature', 'Humidity', 'Light']

export default function ConditionExcursionsPage() {
  const [data, setData]           = useState<Excursion[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading]     = useState(false)
  const [showLog, setShowLog]     = useState(false)
  const [showImpact, setShowImpact] = useState<Excursion | null>(null)
  const [logForm, setLogForm] = useState({ locationId: '', excursionType: 'Temperature', measuredValue: '', limitExceeded: 'Max', excursionStart: '', excursionEnd: '' })
  const [impactOutcome, setImpactOutcome] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    setLoading(true)
    const [r, lr] = await Promise.all([
      api.get('/condition-excursions'),
      api.get('/storage-locations')
    ])
    setData(r.data); setLocations(lr.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submitLog(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/storage-locations/${logForm.locationId}/excursions`, {
        excursionType: logForm.excursionType,
        measuredValue: Number(logForm.measuredValue),
        limitExceeded: logForm.limitExceeded,
        excursionStart: logForm.excursionStart,
        excursionEnd: logForm.excursionEnd || null
      })
      setShowLog(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function submitImpact(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/storage-locations/${showImpact!.locationId}/excursions/${showImpact!.excursionId}/impact`, { impactOutcome })
      setShowImpact(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Condition Excursions" onAdd={() => { setLogForm({ locationId: '', excursionType: 'Temperature', measuredValue: '', limitExceeded: 'Max', excursionStart: '', excursionEnd: '' }); setError(''); setShowLog(true) }} />
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Log temperature/humidity/light excursions. ExcursionImpactService auto-flags affected samples and notifies QA via SignalR (FR-13).
      </p>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Location',  accessor: r => `${r.locationCode} — ${r.locationName}` },
        { header: 'Type',      accessor: 'excursionType' },
        { header: 'Value',     accessor: 'measuredValue' },
        { header: 'Exceeded',  accessor: 'limitExceeded' },
        { header: 'Start',     accessor: 'excursionStart' },
        { header: 'End',       accessor: r => r.excursionEnd ?? <span style={{ color: '#9ca3af', fontSize: 12 }}>Ongoing</span> },
        { header: 'Impact', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12,
            background: r.impactAssessed ? '#d1fae5' : '#fef9c3',
            color: r.impactAssessed ? '#065f46' : '#854d0e' }}>
            {r.impactAssessed ? 'Assessed' : 'Pending'}
          </span>
        )},
        { header: '', accessor: r => !r.impactAssessed
          ? <button onClick={() => { setImpactOutcome(''); setError(''); setShowImpact(r) }}
              style={{ padding: '4px 10px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
              Assess Impact
            </button>
          : null
        },
      ]} />

      {showLog && (
        <Modal title="Log Condition Excursion" onClose={() => setShowLog(false)}>
          <form onSubmit={submitLog}>
            <Field label="Storage Location">
              <select style={inp} value={logForm.locationId} onChange={e => setLogForm(f => ({ ...f, locationId: e.target.value }))} required>
                <option value="">Select…</option>
                {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.locationCode} — {l.locationName}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Excursion Type">
                <select style={inp} value={logForm.excursionType} onChange={e => setLogForm(f => ({ ...f, excursionType: e.target.value }))}>
                  {EXCURSION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Limit Exceeded">
                <select style={inp} value={logForm.limitExceeded} onChange={e => setLogForm(f => ({ ...f, limitExceeded: e.target.value }))}>
                  <option>Min</option><option>Max</option>
                </select>
              </Field>
            </div>
            <Field label="Measured Value">
              <input style={inp} type="number" step="0.01" value={logForm.measuredValue} onChange={e => setLogForm(f => ({ ...f, measuredValue: e.target.value }))} required placeholder="e.g. 12.5 for temperature" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Excursion Start">
                <input style={inp} type="datetime-local" value={logForm.excursionStart} onChange={e => setLogForm(f => ({ ...f, excursionStart: e.target.value }))} required />
              </Field>
              <Field label="Excursion End (if resolved)">
                <input style={inp} type="datetime-local" value={logForm.excursionEnd} onChange={e => setLogForm(f => ({ ...f, excursionEnd: e.target.value }))} />
              </Field>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowLog(false)} />
          </form>
        </Modal>
      )}

      {showImpact && (
        <Modal title={`Assess Impact — Excursion #${showImpact.excursionId}`} onClose={() => setShowImpact(null)}>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            <strong>{showImpact.excursionType}</strong> excursion at <strong>{showImpact.locationCode}</strong><br />
            Value: {showImpact.measuredValue} | {showImpact.limitExceeded} limit exceeded<br />
            Window: {showImpact.excursionStart} → {showImpact.excursionEnd ?? 'ongoing'}
          </p>
          <form onSubmit={submitImpact}>
            <Field label="Impact Outcome">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={impactOutcome} onChange={e => setImpactOutcome(e.target.value)} required
                placeholder="Describe impact assessment outcome and any actions taken…" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowImpact(null)} label="Submit Assessment" />
          </form>
        </Modal>
      )}
    </div>
  )
}
