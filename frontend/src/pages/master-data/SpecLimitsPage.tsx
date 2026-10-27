import { useEffect, useState } from 'react'
import { getErrorMessage } from '@/utils/errors'
const SPEC_STAGES = ['Incoming', 'InProcess', 'Finished', 'Stability']
function stageLabel(s: string) { return s.replace(/([a-z])([A-Z])/g, '$1 $2') }
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import ESignatureDrawer from '@/components/ESignatureDrawer'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface SpecLimit {
  specLimitId: number; parameterName: string; materialName: string; stage: string
  minValue: number; maxValue: number; ootMinValue: number; ootMaxValue: number
  regulatoryTier: string; regulatoryMin: number; regulatoryMax: number
  status: string; version: string
}
interface Param { parameterId: number; parameterName: string }
interface Material { materialId: number; materialName: string }

const REG_TIERS = ['USP', 'EP', 'JP', 'ICH', 'FDA', 'EMA']

export default function SpecLimitsPage() {
  const [data, setData] = useState<SpecLimit[]>([])
  const [params, setParams] = useState<Param[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showApprove, setShowApprove] = useState<number | null>(null)
  const [form, setForm] = useState({
    parameterId: '', materialId: '', stage: 'InProcess',
    minValue: '', maxValue: '', ootMinValue: '', ootMaxValue: '',
    regulatoryTier: '', regulatoryMin: '', regulatoryMax: ''
  })
  const [approveForm, setApproveForm] = useState({ password: '', meaning: 'I approve this spec limit', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<SpecLimit | null>(null)
  const [editForm, setEditForm] = useState({
    minValue: '', maxValue: '', ootMinValue: '', ootMaxValue: '',
    regulatoryTier: '', regulatoryMin: '', regulatoryMax: ''
  })
  const [filterParam, setFilterParam] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  function openEdit(r: SpecLimit) {
    setEditRow(r)
    setEditForm({
      minValue: r.minValue != null ? String(r.minValue) : '',
      maxValue: r.maxValue != null ? String(r.maxValue) : '',
      ootMinValue: r.ootMinValue != null ? String(r.ootMinValue) : '',
      ootMaxValue: r.ootMaxValue != null ? String(r.ootMaxValue) : '',
      regulatoryTier: r.regulatoryTier || '',
      regulatoryMin: r.regulatoryMin != null ? String(r.regulatoryMin) : '',
      regulatoryMax: r.regulatoryMax != null ? String(r.regulatoryMax) : '',
    })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/spec-limits/${editRow!.specLimitId}`, {
        minValue: editForm.minValue ? Number(editForm.minValue) : null,
        maxValue: editForm.maxValue ? Number(editForm.maxValue) : null,
        ootMinValue: editForm.ootMinValue ? Number(editForm.ootMinValue) : null,
        ootMaxValue: editForm.ootMaxValue ? Number(editForm.ootMaxValue) : null,
        regulatoryTier: editForm.regulatoryTier || null,
        regulatoryMin: editForm.regulatoryMin ? Number(editForm.regulatoryMin) : null,
        regulatoryMax: editForm.regulatoryMax ? Number(editForm.regulatoryMax) : null,
      })
      setEditRow(null); load()
      toast(`Spec Limit updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function load() {
    setLoading(true)
    try {
      const [r, pr, mr] = await Promise.all([
        api.get('/spec-limits').catch(() => ({ data: [] })),
        api.get('/parameters').catch(() => ({ data: [] })),
        api.get('/materials').catch(() => ({ data: [] })),
      ])
      setData(r.data); setParams(pr.data); setMaterials(mr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/spec-limits', {
        parameterId: Number(form.parameterId),
        materialId: form.materialId ? Number(form.materialId) : null,
        stage: form.stage,
        minValue: form.minValue ? Number(form.minValue) : null,
        maxValue: form.maxValue ? Number(form.maxValue) : null,
        ootMinValue: form.ootMinValue ? Number(form.ootMinValue) : null,
        ootMaxValue: form.ootMaxValue ? Number(form.ootMaxValue) : null,
        regulatoryTier: form.regulatoryTier || null,
        regulatoryMin: form.regulatoryMin ? Number(form.regulatoryMin) : null,
        regulatoryMax: form.regulatoryMax ? Number(form.regulatoryMax) : null,
      })
      setShowForm(false)
      toast(`Spec Limit added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/spec-limits/${showApprove}/approve`, approveForm)
      setShowApprove(null)
      toast(`Spec Limit approved successfully`, 'success')
      load()
    }
    catch (err) { const msg = getErrorMessage(err, 'E-signature failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  const filteredData = data.filter(r =>
    (!filterParam || r.parameterName === filterParam) &&
    (!filterMaterial || r.materialName === filterMaterial) &&
    (!filterStatus || r.status === filterStatus)
  )

  const uniqueParams = Array.from(new Set(data.map(r => r.parameterName))).sort()
  const uniqueMaterials = Array.from(new Set(data.map(r => r.materialName).filter(Boolean))).sort()

  const filterInp = { ...inp, minWidth: 160 } as React.CSSProperties

  return (
    <div>
      <PageHeader title="Spec Limits" onAdd={() => { setForm({ parameterId: '', materialId: '', stage: 'InProcess', minValue: '', maxValue: '', ootMinValue: '', ootMaxValue: '', regulatoryTier: '', regulatoryMin: '', regulatoryMax: '' }); setError(''); setShowForm(true) }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select style={filterInp} value={filterParam} onChange={e => setFilterParam(e.target.value)}>
          <option value="">All Parameters</option>
          {uniqueParams.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={filterInp} value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
          <option value="">All Materials</option>
          {uniqueMaterials.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select style={filterInp} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
        </select>
        {(filterParam || filterMaterial || filterStatus) && (
          <button onClick={() => { setFilterParam(''); setFilterMaterial(''); setFilterStatus('') }}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
            Clear filters
          </button>
        )}
      </div>
      <DataTable loading={loading} data={filteredData} exportFilename="SpecLimits" columns={[
        { header: 'Parameter', accessor: 'parameterName' },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Stage', accessor: r => stageLabel(r.stage) },
        { header: 'Spec Limit', accessor: r => {
          const mn = r.minValue != null ? `≥ ${r.minValue}` : null
          const mx = r.maxValue != null ? `≤ ${r.maxValue}` : null
          if (mn && mx) return `${mn}  and  ${mx}`
          return mn ?? mx ?? '—'
        }},
        { header: 'OOT Min', accessor: 'ootMinValue' },
        { header: 'OOT Max', accessor: 'ootMaxValue' },
        { header: 'Reg. Tier', accessor: 'regulatoryTier' },
        { header: 'Reg. Min', accessor: 'regulatoryMin' },
        { header: 'Reg. Max', accessor: 'regulatoryMax' },
        { header: 'Version', accessor: 'version' },
        { header: 'Status', accessor: r => <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: r.status === 'Approved' ? '#d1fae5' : '#fef9c3', color: r.status === 'Approved' ? '#065f46' : '#854d0e' }}>{r.status}</span> },
        { header: '', accessor: r => (
          <div style={{ display: 'flex', gap: 4 }}>
            {r.status === 'Draft' && <button onClick={() => setShowApprove(r.specLimitId)} style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Approve</button>}
            <button onClick={() => openEdit(r)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Edit
            </button>
          </div>
        ) },
      ]} />
      {showForm && (
        <Drawer title="Add Spec Limit" subtitle="Define acceptance criteria and OOT limits for a parameter" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Parameter">
              <select style={inp} value={form.parameterId} onChange={e => setForm(f => ({ ...f, parameterId: e.target.value }))} required>
                <option value="">Select…</option>
                {params.map(p => <option key={p.parameterId} value={p.parameterId}>{p.parameterName}</option>)}
              </select>
            </Field>
            <Field label="Material (optional)">
              <select style={inp} value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))}>
                <option value="">All Materials</option>
                {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
              </select>
            </Field>
            <Field label="Stage">
              <select style={inp} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {SPEC_STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Min Value (≥)"><input style={inp} type="number" step="any" placeholder="e.g. 14.0" value={form.minValue} onChange={e => setForm(f => ({ ...f, minValue: e.target.value }))} /></Field>
              <Field label="Max Value (≤)"><input style={inp} type="number" step="any" placeholder="e.g. 2.0" value={form.maxValue} onChange={e => setForm(f => ({ ...f, maxValue: e.target.value }))} /></Field>
              <Field label="OOT Min (≥)"><input style={inp} type="number" step="any" value={form.ootMinValue} onChange={e => setForm(f => ({ ...f, ootMinValue: e.target.value }))} /></Field>
              <Field label="OOT Max (≤)"><input style={inp} type="number" step="any" value={form.ootMaxValue} onChange={e => setForm(f => ({ ...f, ootMaxValue: e.target.value }))} /></Field>
            </div>
            <Field label="Regulatory Tier (optional)">
              <select style={inp} value={form.regulatoryTier} onChange={e => setForm(f => ({ ...f, regulatoryTier: e.target.value }))}>
                <option value="">None</option>
                {REG_TIERS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {form.regulatoryTier && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Regulatory Min"><input style={inp} type="number" step="any" value={form.regulatoryMin} onChange={e => setForm(f => ({ ...f, regulatoryMin: e.target.value }))} /></Field>
                <Field label="Regulatory Max"><input style={inp} type="number" step="any" value={form.regulatoryMax} onChange={e => setForm(f => ({ ...f, regulatoryMax: e.target.value }))} /></Field>
              </div>
            )}
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}
      {editRow && (
        <Drawer title={`Edit Spec Limit — ${editRow.parameterName}`} subtitle="Update OOS/OOT thresholds and regulatory limits" onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Min Value (≥)"><input style={inp} type="number" step="any" value={editForm.minValue} onChange={e => setEditForm(f => ({ ...f, minValue: e.target.value }))} /></Field>
              <Field label="Max Value (≤)"><input style={inp} type="number" step="any" value={editForm.maxValue} onChange={e => setEditForm(f => ({ ...f, maxValue: e.target.value }))} /></Field>
              <Field label="OOT Min (≥)"><input style={inp} type="number" step="any" value={editForm.ootMinValue} onChange={e => setEditForm(f => ({ ...f, ootMinValue: e.target.value }))} /></Field>
              <Field label="OOT Max (≤)"><input style={inp} type="number" step="any" value={editForm.ootMaxValue} onChange={e => setEditForm(f => ({ ...f, ootMaxValue: e.target.value }))} /></Field>
            </div>
            <Field label="Regulatory Tier">
              <select style={inp} value={editForm.regulatoryTier} onChange={e => setEditForm(f => ({ ...f, regulatoryTier: e.target.value }))}>
                <option value="">None</option>
                {['USP', 'EP', 'JP', 'ICH', 'FDA', 'EMA'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {editForm.regulatoryTier && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Regulatory Min"><input style={inp} type="number" step="any" value={editForm.regulatoryMin} onChange={e => setEditForm(f => ({ ...f, regulatoryMin: e.target.value }))} /></Field>
                <Field label="Regulatory Max"><input style={inp} type="number" step="any" value={editForm.regulatoryMax} onChange={e => setEditForm(f => ({ ...f, regulatoryMax: e.target.value }))} /></Field>
              </div>
            )}
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Drawer>
      )}
      {showApprove && (
        <ESignatureDrawer
          title="E-Signature Approval"
          subtitle="Approve this spec limit (21 CFR Part 11)"
          form={approveForm} onChange={setApproveForm}
          onSubmit={submitApprove} onClose={() => { setShowApprove(null); setError('') }}
          saving={saving} error={error} label="Approve"
        />
      )}
    </div>
  )
}
