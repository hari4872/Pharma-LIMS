import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Material { materialId: number; materialName: string; uom: string; materialType: string; productType: string; shelfLifeDays: number; isActive: boolean }

export default function MaterialsPage() {
  const [data, setData] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ materialName: '', uom: '', materialType: 'RawMaterial', productType: '', shelfLifeDays: '365' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() { setLoading(true); const r = await api.get('/materials'); setData(r.data); setLoading(false) }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/materials', { ...form, shelfLifeDays: Number(form.shelfLifeDays) })
      setShowForm(false)
      toast(`Material "${form.materialName}" added successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Materials" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="Materials" columns={[
        { header: 'ID', accessor: 'materialId' },
        { header: 'Name', accessor: 'materialName' },
        { header: 'UOM', accessor: 'uom' },
        { header: 'Type', accessor: 'materialType' },
        { header: 'Product Type', accessor: 'productType' },
        { header: 'Shelf Life (days)', accessor: 'shelfLifeDays' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
      ]} />
      {showForm && (
        <Modal title="Add Material" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Material Name"><input style={inp} value={form.materialName} onChange={e => setForm(f => ({ ...f, materialName: e.target.value }))} required /></Field>
            <Field label="UOM"><input style={inp} value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} required /></Field>
            <Field label="Material Type">
              <select style={inp} value={form.materialType} onChange={e => setForm(f => ({ ...f, materialType: e.target.value }))}>
                {['RawMaterial', 'Intermediate', 'FinishedProduct', 'Reagent', 'Standard', 'Solvent'].map(t => <option key={t}>{t}</option>)}
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
