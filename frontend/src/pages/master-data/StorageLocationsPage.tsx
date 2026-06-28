import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { getErrorMessage } from '@/utils/errors'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface StorageLocation {
  locationId: number; locationCode: string; locationName: string
  locationTyp: string; labId: number; labName: string
  tempMinC: number | null; tempMaxC: number | null
  humidityMinPct: number | null; humidityMaxPct: number | null
  lowStockThreshold: number | null; isActive: boolean
}
interface Lab { labId: number; labName: string }

const LOCATION_TYPES = ['Ambient', 'Cold', 'Freezer', 'StabilityChamber']

export default function StorageLocationsPage() {
  const [data, setData]   = useState<StorageLocation[]>([])
  const [labs, setLabs]   = useState<Lab[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<StorageLocation | null>(null)
  const [form, setForm] = useState({
    labId: '', locationCode: '', locationName: '',
    locationType: 'Ambient',
    tempMinC: '', tempMaxC: '',
    humidityMinPct: '', humidityMaxPct: '',
    lowStockThreshold: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    setLoading(true)
    const [r, lr] = await Promise.all([api.get('/storage-locations'), api.get('/laboratories')])
    setData(r.data); setLabs(lr.data); setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  function openAdd() {
    setEditing(null)
    setForm({ labId: '', locationCode: '', locationName: '', locationType: 'Ambient', tempMinC: '', tempMaxC: '', humidityMinPct: '', humidityMaxPct: '', lowStockThreshold: '' })
    setError(''); setShowForm(true)
  }

  function openEdit(loc: StorageLocation) {
    setEditing(loc)
    setForm({
      labId: String(loc.labId), locationCode: loc.locationCode, locationName: loc.locationName,
      locationType: loc.locationTyp,
      tempMinC: loc.tempMinC != null ? String(loc.tempMinC) : '',
      tempMaxC: loc.tempMaxC != null ? String(loc.tempMaxC) : '',
      humidityMinPct: loc.humidityMinPct != null ? String(loc.humidityMinPct) : '',
      humidityMaxPct: loc.humidityMaxPct != null ? String(loc.humidityMaxPct) : '',
      lowStockThreshold: loc.lowStockThreshold != null ? String(loc.lowStockThreshold) : ''
    })
    setError(''); setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = {
        labId: Number(form.labId),
        locationCode: form.locationCode, locationName: form.locationName,
        locationType: form.locationType,
        tempMinC: form.tempMinC ? Number(form.tempMinC) : null,
        tempMaxC: form.tempMaxC ? Number(form.tempMaxC) : null,
        humidityMinPct: form.humidityMinPct ? Number(form.humidityMinPct) : null,
        humidityMaxPct: form.humidityMaxPct ? Number(form.humidityMaxPct) : null,
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : null
      }
      if (editing) await api.put(`/storage-locations/${editing.locationId}`, body)
      else await api.post('/storage-locations', body)
      setShowForm(false)
      toast(`Storage Location "${form.locationName}" ${editing ? 'updated' : 'added'} successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Storage Locations" onAdd={openAdd} />
      <DataTable loading={loading} data={data} exportFilename="StorageLocations" columns={[
        { header: 'Code',      accessor: 'locationCode' },
        { header: 'Name',      accessor: 'locationName' },
        { header: 'Type',      accessor: 'locationTyp' },
        { header: 'Lab',       accessor: 'labName' },
        { header: 'Temp Range (°C)', accessor: r =>
          r.tempMinC != null && r.tempMaxC != null
            ? `${r.tempMinC} – ${r.tempMaxC}`
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
        },
        { header: 'Humidity (%)', accessor: r =>
          r.humidityMinPct != null && r.humidityMaxPct != null
            ? `${r.humidityMinPct} – ${r.humidityMaxPct}`
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
        },
        { header: 'Low Stock Alert', accessor: r =>
          r.lowStockThreshold != null ? String(r.lowStockThreshold) : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
        },
        { header: '', accessor: r => (
          <button onClick={() => openEdit(r)}
            style={{ padding: '3px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            Edit
          </button>
        )},
      ]} />

      {showForm && (
        <Drawer title={editing ? 'Edit Storage Location' : 'Add Storage Location'} subtitle={editing ? 'Update location conditions and thresholds' : 'Register a new storage location with condition limits'} onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            {!editing && (
              <Field label="Laboratory">
                <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                  <option value="">Select…</option>
                  {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
                </select>
              </Field>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Location Code">
                <input style={inp} value={form.locationCode} onChange={e => setForm(f => ({ ...f, locationCode: e.target.value }))} required disabled={!!editing} />
              </Field>
              <Field label="Location Type">
                <select style={inp} value={form.locationType} onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))}>
                  {LOCATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Location Name">
              <input style={inp} value={form.locationName} onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))} required />
            </Field>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 4px' }}>Condition limits (from DB — Contract 2, not hardcoded)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Temp Min (°C)">
                <input style={inp} type="number" step="0.1" value={form.tempMinC} onChange={e => setForm(f => ({ ...f, tempMinC: e.target.value }))} placeholder="e.g. 2" />
              </Field>
              <Field label="Temp Max (°C)">
                <input style={inp} type="number" step="0.1" value={form.tempMaxC} onChange={e => setForm(f => ({ ...f, tempMaxC: e.target.value }))} placeholder="e.g. 8" />
              </Field>
              <Field label="Humidity Min (%)">
                <input style={inp} type="number" step="0.1" value={form.humidityMinPct} onChange={e => setForm(f => ({ ...f, humidityMinPct: e.target.value }))} />
              </Field>
              <Field label="Humidity Max (%)">
                <input style={inp} type="number" step="0.1" value={form.humidityMaxPct} onChange={e => setForm(f => ({ ...f, humidityMaxPct: e.target.value }))} />
              </Field>
            </div>
            <Field label="Low Stock Threshold">
              <input style={inp} type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} placeholder="Alert when count below this" />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}
    </div>
  )
}
