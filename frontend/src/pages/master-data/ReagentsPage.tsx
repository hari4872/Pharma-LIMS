import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, StatusBadge, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

// Master Data FR-09: Reagents & Standards — lot-traceable, potency-tracked, method-linked

interface Reagent {
  reagentId: number; reagentCode: string; reagentName: string; reagentType: string
  lotNumber: string; potency: number | null; potencyUom: string | null
  manufacturer: string | null; expiryDate: string | null; openedDate: string | null
  linkedMethodId: number | null; methodCode: string | null
  storageCondition: string | null; isActive: boolean; createdBy: string
}

interface Method { methodId: number; methodCode: string; methodName: string }

const TYPES = ['Reagent', 'Standard', 'ReferenceStandard']

export default function ReagentsPage() {
  const [data, setData]       = useState<Reagent[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const emptyForm = {
    reagentCode: '', reagentName: '', reagentType: 'Reagent',
    lotNumber: '', potency: '', potencyUom: '', manufacturer: '',
    expiryDate: '', openedDate: '', linkedMethodId: '', storageCondition: ''
  }
  const [form, setForm] = useState(emptyForm)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function load() {
    setLoading(true)
    try {
      const [r, mr] = await Promise.all([
        api.get('/reagents').catch(() => ({ data: [] })),
        api.get('/test-methods').catch(() => ({ data: [] })),
      ])
      setData(r.data); setMethods(mr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/reagents', {
        reagentCode:      form.reagentCode,
        reagentName:      form.reagentName,
        reagentType:      form.reagentType,
        lotNumber:        form.lotNumber,
        potency:          form.potency ? Number(form.potency) : null,
        potencyUom:       form.potencyUom || null,
        manufacturer:     form.manufacturer || null,
        expiryDate:       form.expiryDate || null,
        openedDate:       form.openedDate || null,
        linkedMethodId:   form.linkedMethodId ? Number(form.linkedMethodId) : null,
        storageCondition: form.storageCondition || null,
      })
      setShowForm(false); setForm(emptyForm)
      toast(`Reagent "${form.reagentName}" added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  const expiryStatus = (d: string | null) => {
    if (!d) return null
    const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
    if (days < 0) return <span style={{ color: '#dc2626', fontWeight: 700 }}>EXPIRED</span>
    if (days <= 30) return <span style={{ color: '#d97706', fontWeight: 600 }}>Exp. {days}d</span>
    return <span style={{ color: '#059669' }}>{new Date(d).toLocaleDateString()}</span>
  }

  return (
    <div>
      <PageHeader title="Reagents & Standards" onAdd={() => { setForm(emptyForm); setError(''); setShowForm(true) }} />
      <DataTable loading={loading} data={data} exportFilename="Reagents" columns={[
        { header: 'Code',        accessor: 'reagentCode' },
        { header: 'Name',        accessor: 'reagentName' },
        { header: 'Type',        accessor: 'reagentType' },
        { header: 'Lot No.',     accessor: 'lotNumber' },
        { header: 'Potency',     accessor: r => r.potency != null ? `${r.potency} ${r.potencyUom ?? ''}` : '—' },
        { header: 'Method',      accessor: r => r.methodCode ?? '—' },
        { header: 'Expiry',      accessor: r => expiryStatus(r.expiryDate) },
        { header: 'Storage',     accessor: r => r.storageCondition ?? '—' },
        { header: 'Status',      accessor: r => <StatusBadge active={r.isActive} /> },
      ]} />

      {showForm && (
        <Drawer title="Add Reagent / Standard" subtitle="Register a new reagent or reference standard with lot details" onClose={() => setShowForm(false)} width={560}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Reagent Code *">
                <input style={inp} value={form.reagentCode} onChange={set('reagentCode')} required />
              </Field>
              <Field label="Type *">
                <select style={inp} value={form.reagentType} onChange={set('reagentType')}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Name *" >
                <input style={inp} value={form.reagentName} onChange={set('reagentName')} required />
              </Field>
              <Field label="Lot Number *">
                <input style={inp} value={form.lotNumber} onChange={set('lotNumber')} required />
              </Field>
              <Field label="Potency">
                <input style={inp} type="number" step="0.001" value={form.potency} onChange={set('potency')} placeholder="e.g. 99.5" />
              </Field>
              <Field label="Potency UOM">
                <input style={inp} value={form.potencyUom} onChange={set('potencyUom')} placeholder="% or mg/mL" />
              </Field>
              <Field label="Manufacturer">
                <input style={inp} value={form.manufacturer} onChange={set('manufacturer')} />
              </Field>
              <Field label="Storage Condition">
                <input style={inp} value={form.storageCondition} onChange={set('storageCondition')} placeholder="2–8°C | RT | Frozen" />
              </Field>
              <Field label="Expiry Date">
                <input style={inp} type="date" value={form.expiryDate} onChange={set('expiryDate')} />
              </Field>
              <Field label="Opened Date">
                <input style={inp} type="date" value={form.openedDate} onChange={set('openedDate')} />
              </Field>
            </div>
            <Field label="Linked Test Method">
              <select style={inp} value={form.linkedMethodId} onChange={set('linkedMethodId')}>
                <option value="">— None —</option>
                {methods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodCode} — {m.methodName}</option>)}
              </select>
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}
    </div>
  )
}
