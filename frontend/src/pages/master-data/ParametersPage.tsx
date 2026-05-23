import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Param { parameterId: number; methodName: string; parameterName: string; parameterCode: string; uom: string; dataType: string; formulaType: string; instrumentType: string; columnFrequency: string; isCritical: boolean; isMandatory: boolean }
interface Method { methodId: number; methodName: string }

export default function ParametersPage() {
  const [data, setData] = useState<Param[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ methodId: '', parameterName: '', parameterCode: '', uom: '', dataType: 'Numeric', formulaType: 'Expression', calcFormula: '', instrumentType: '', columnFrequency: '', isCritical: false, isMandatory: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [r, mr] = await Promise.all([api.get('/parameters'), api.get('/test-methods?statusFilter=Approved')])
    setData(r.data); setMethods(mr.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/parameters', {
        ...form,
        methodId: Number(form.methodId),
        instrumentType: form.instrumentType || null,
        columnFrequency: form.columnFrequency || null,
      })
      setShowForm(false)
      toast(`Parameter "${form.parameterName}" added successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Parameters" onAdd={() => setShowForm(true)} />
      <DataTable loading={loading} data={data} exportFilename="Parameters" columns={[
        { header: 'Code', accessor: 'parameterCode' },
        { header: 'Name', accessor: 'parameterName' },
        { header: 'Method', accessor: 'methodName' },
        { header: 'UOM', accessor: 'uom' },
        { header: 'Data Type', accessor: 'dataType' },
        { header: 'Formula', accessor: 'formulaType' },
        { header: 'Instrument Type', accessor: r => r.instrumentType || '—' },
        { header: 'Col. Frequency', accessor: r => r.columnFrequency || '—' },
        { header: 'Critical', accessor: r => r.isCritical ? <span style={{ color: '#dc2626', fontWeight: 700 }}>✓ Critical</span> : '' },
        { header: 'Mandatory', accessor: r => r.isMandatory ? '✓' : '' },
      ]} />
      {showForm && (
        <Modal title="Add Parameter" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Test Method">
              <select style={inp} value={form.methodId} onChange={e => setForm(f => ({ ...f, methodId: e.target.value }))} required>
                <option value="">Select…</option>
                {methods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodName}</option>)}
              </select>
            </Field>
            <Field label="Parameter Name"><input style={inp} value={form.parameterName} onChange={e => setForm(f => ({ ...f, parameterName: e.target.value }))} required /></Field>
            <Field label="Parameter Code"><input style={inp} value={form.parameterCode} onChange={e => setForm(f => ({ ...f, parameterCode: e.target.value }))} required /></Field>
            <Field label="UOM"><input style={inp} value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} required /></Field>
            <Field label="Data Type">
              <select style={inp} value={form.dataType} onChange={e => setForm(f => ({ ...f, dataType: e.target.value }))}>
                {['Numeric', 'Text', 'Boolean', 'Date', 'Image'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Formula Type">
              <select style={inp} value={form.formulaType} onChange={e => setForm(f => ({ ...f, formulaType: e.target.value }))}>
                {['Expression', 'TableLookup', 'Manual'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {form.formulaType === 'Expression' && <Field label="Calc Formula"><input style={inp} value={form.calcFormula} onChange={e => setForm(f => ({ ...f, calcFormula: e.target.value }))} placeholder="e.g. (rawValue * 0.98) / 100" /></Field>}
            <Field label="Required Instrument Type">
              <input style={inp} value={form.instrumentType} onChange={e => setForm(f => ({ ...f, instrumentType: e.target.value }))}
                placeholder="e.g. HPLC, pH Meter, Titrator" />
            </Field>
            <Field label="Column Frequency (non-critical parameters)">
              <select style={inp} value={form.columnFrequency} onChange={e => setForm(f => ({ ...f, columnFrequency: e.target.value }))}>
                <option value="">— Not set (every trigger) —</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Periodic">Periodic</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 24 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={form.isCritical} onChange={e => setForm(f => ({ ...f, isCritical: e.target.checked }))} /> Critical
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={form.isMandatory} onChange={e => setForm(f => ({ ...f, isMandatory: e.target.checked }))} /> Mandatory
              </label>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
