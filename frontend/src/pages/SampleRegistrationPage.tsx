import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

interface Sample {
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  sampleType: string; status: string; barcodePrinted: boolean; dueDate: string
  analystName: string; createdAt: string
}
interface Lab { labId: number; labName: string }
interface Material { materialId: number; materialName: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
}

export default function SampleRegistrationPage() {
  const userId = useSelector((s: RootState) => s.auth.userId)
  const [data, setData] = useState<Sample[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showSRF, setShowSRF] = useState<number | null>(null)
  const [showReprint, setShowReprint] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({
    labId: '', materialId: '', lotNumber: '',
    mfgDate: '', expDate: '', sampleTypeId: ''
  })
  const [srfForm, setSrfForm] = useState({ password: '', meaning: 'I confirm this Sample Registration Form', reason: '' })
  const [reprintReason, setReprintReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const [r, lr, mr, str] = await Promise.all([
      api.get(`/samples${params}`), api.get('/laboratories'),
      api.get('/materials'), api.get('/sample-types')
    ])
    setData(r.data); setLabs(lr.data); setMaterials(mr.data); setSampleTypes(str.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/samples', {
        labId: Number(form.labId), materialId: Number(form.materialId),
        lotNumber: form.lotNumber, mfgDate: form.mfgDate,
        expDate: form.expDate, sampleTypeId: Number(form.sampleTypeId)
      })
      setShowForm(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Registration failed') }
    finally { setSaving(false) }
  }

  async function submitSRF(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showSRF}/sign-srf`, srfForm)
      setShowSRF(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'E-signature failed') }
    finally { setSaving(false) }
  }

  async function submitReprint(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showReprint}/barcode-reprint`, { reason: reprintReason })
      setShowReprint(null); setReprintReason('')
    } catch (err: any) { setError(err.response?.data?.message ?? 'Reprint failed') }
    finally { setSaving(false) }
  }


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="Sample Registration" onAdd={() => setShowForm(true)} />
        <select style={{ ...inp, width: 180, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected'].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot', accessor: 'lotNumber' },
        { header: 'Type', accessor: 'sampleType' },
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Label', accessor: r => <span style={{ fontSize: 12, color: r.barcodePrinted ? '#16a34a' : '#dc2626' }}>{r.barcodePrinted ? '✓ Printed' : '✗ Not Printed'}</span> },
        { header: 'Due', accessor: r => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
        { header: 'Analyst', accessor: 'analystName' },
        { header: '', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status === 'Registered' && (
              <button onClick={() => { setShowSRF(r.sampleId); setError('') }}
                style={{ padding: '3px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Sign SRF
              </button>
            )}
            <button onClick={() => { setShowReprint(r.sampleId); setError('') }}
              style={{ padding: '3px 8px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              Reprint
            </button>
          </div>
        )},
      ]} />

      {/* Register Sample Modal — 7-step registration */}
      {showForm && (
        <Modal title="Register Sample (Steps 2–3)" onClose={() => setShowForm(false)}>
          <form onSubmit={submitRegister}>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select lab…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Material">
              <select style={inp} value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))} required>
                <option value="">Select material…</option>
                {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
              </select>
            </Field>
            <Field label="Lot Number">
              <input style={inp} value={form.lotNumber} onChange={e => setForm(f => ({ ...f, lotNumber: e.target.value }))} required placeholder="e.g. LOT-2026-001" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Mfg Date"><input style={inp} type="date" value={form.mfgDate} onChange={e => setForm(f => ({ ...f, mfgDate: e.target.value }))} required /></Field>
              <Field label="Exp Date"><input style={inp} type="date" value={form.expDate} onChange={e => setForm(f => ({ ...f, expDate: e.target.value }))} required /></Field>
            </div>
            <Field label="Sample Type">
              <select style={inp} value={form.sampleTypeId} onChange={e => setForm(f => ({ ...f, sampleTypeId: e.target.value }))} required>
                <option value="">Select sample type…</option>
                {sampleTypes.filter(t => t.typeCode !== 'DSPQC').map(t =>
                  <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                )}
              </select>
            </Field>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0' }}>
              ℹ Sample ID generated by system · Barcode auto-printed · 5 GMP checks run server-side · Form Template auto-selected
            </p>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} label="Register + Print Barcode" />
          </form>
        </Modal>
      )}

      {/* Sign SRF — Step 7: §11.50 e-sig → PendingTesting */}
      {showSRF && (
        <Modal title="Sign Sample Registration Form (§11.50)" onClose={() => setShowSRF(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR §11.50 — Your full name, timestamp, meaning, and reason will be captured and immutably recorded.
          </p>
          <form onSubmit={submitSRF}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={srfForm.password} onChange={e => setSrfForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={srfForm.meaning} onChange={e => setSrfForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={srfForm.reason} onChange={e => setSrfForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Sample verified and ready for testing" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSRF(null)} label="Sign & Submit to Work Queue" />
          </form>
        </Modal>
      )}

      {/* Barcode Reprint — FR-18: mandatory reason, audit-logged */}
      {showReprint && (
        <Modal title="Barcode Label Reprint" onClose={() => setShowReprint(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR 211.170 — Reprint is audit-logged with your name and reason.
          </p>
          <form onSubmit={submitReprint}>
            <Field label="Reason (mandatory)">
              <input style={inp} value={reprintReason} onChange={e => setReprintReason(e.target.value)} required placeholder="e.g. Label damaged during storage" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReprint(null)} label="Reprint Label" />
          </form>
        </Modal>
      )}
    </div>
  )
}
