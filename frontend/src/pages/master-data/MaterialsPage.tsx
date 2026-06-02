import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Material { materialId: number; materialName: string; uom: string; materialType: string; productType: string; shelfLifeDays: number; isActive: boolean }

// "RawMaterial" → "Raw Material",  "FinishedProduct" → "Finished Product"
function typeLabel(t: string) { return t.replace(/([a-z])([A-Z])/g, '$1 $2') }

export default function MaterialsPage() {
  const [data, setData] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ materialName: '', uom: '', materialType: 'RawMaterial', productType: '', shelfLifeDays: '365' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<Material | null>(null)
  const [editForm, setEditForm] = useState({ materialName: '', uom: '', materialType: 'RawMaterial', productType: '', shelfLifeDays: '365' })

  function openEdit(r: Material) {
    setEditRow(r)
    setEditForm({ materialName: r.materialName, uom: r.uom, materialType: r.materialType, productType: r.productType || '', shelfLifeDays: String(r.shelfLifeDays) })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/materials/${editRow!.materialId}`, { ...editForm, shelfLifeDays: Number(editForm.shelfLifeDays) })
      setEditRow(null); load()
      toast(`Material "${editForm.materialName}" updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function load() { setLoading(true); const r = await api.get('/materials'); setData(r.data); setLoading(false) }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/materials', { ...form, shelfLifeDays: Number(form.shelfLifeDays) })
      setShowForm(false)
      toast(`Material "${form.materialName}" added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Materials" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="Materials" columns={[
        { header: 'ID', accessor: 'materialId' },
        { header: 'Name', accessor: 'materialName' },
        { header: 'UOM', accessor: 'uom' },
        { header: 'Type', accessor: r => typeLabel(r.materialType) },
        { header: 'Product Type', accessor: 'productType' },
        { header: 'Shelf Life (days)', accessor: 'shelfLifeDays' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
        { header: 'Edit', accessor: r => (
          <button onClick={() => openEdit(r)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Edit
          </button>
        ) },
      ]} />
      {editRow && (
        <Modal title={`Edit Material — ${editRow.materialName}`} onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <Field label="Material Name"><input style={inp} value={editForm.materialName} onChange={e => setEditForm(f => ({ ...f, materialName: e.target.value }))} required /></Field>
            <Field label="UOM"><input style={inp} value={editForm.uom} onChange={e => setEditForm(f => ({ ...f, uom: e.target.value }))} required /></Field>
            <Field label="Material Type">
              <select style={inp} value={editForm.materialType} onChange={e => setEditForm(f => ({ ...f, materialType: e.target.value }))}>
                {['RawMaterial', 'IntermediateProduct', 'FinishedProduct', 'Reagent', 'Standard'].map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Product Type"><input style={inp} value={editForm.productType} onChange={e => setEditForm(f => ({ ...f, productType: e.target.value }))} /></Field>
            <Field label="Shelf Life (days)"><input style={inp} type="number" value={editForm.shelfLifeDays} onChange={e => setEditForm(f => ({ ...f, shelfLifeDays: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Modal>
      )}
      {showForm && (
        <Modal title="Add Material" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Material Name"><input style={inp} value={form.materialName} onChange={e => setForm(f => ({ ...f, materialName: e.target.value }))} required /></Field>
            <Field label="UOM"><input style={inp} value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} required /></Field>
            <Field label="Material Type">
              <select style={inp} value={form.materialType} onChange={e => setForm(f => ({ ...f, materialType: e.target.value }))}>
                {['RawMaterial', 'IntermediateProduct', 'FinishedProduct', 'Reagent', 'Standard'].map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Product Type"><input style={inp} value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} /></Field>
            <Field label="Shelf Life (days)"><input style={inp} type="number" value={form.shelfLifeDays} onChange={e => setForm(f => ({ ...f, shelfLifeDays: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
