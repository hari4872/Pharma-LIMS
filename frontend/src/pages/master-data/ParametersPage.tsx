import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface InputField { key: string; label: string }
interface Param { parameterId: number; methodName: string; parameterName: string; parameterCode: string; uom: string; dataType: string; formulaType: string; instrumentType: string; columnFrequency: string; isCritical: boolean; isMandatory: boolean; inputFields?: string | null }

const MATH_KEYWORDS = new Set(['Math','abs','sqrt','pow','log','exp','round','floor','ceil','min','max','PI','E'])

function detectVars(formula: string): string[] {
  const matches = formula.match(/\b([a-z_][a-z0-9_]*)\b/gi) ?? []
  return [...new Set(matches.filter(m => !MATH_KEYWORDS.has(m) && isNaN(Number(m))))]
}

function parseInputFields(raw: string | null | undefined): InputField[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}
interface Method { methodId: number; methodName: string }

export default function ParametersPage() {
  const [data, setData] = useState<Param[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ methodId: '', parameterName: '', parameterCode: '', uom: '', dataType: 'Numeric', formulaType: 'Expression', calcFormula: '', instrumentType: '', columnFrequency: '', isCritical: false, isMandatory: true, inputFields: [] as InputField[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<Param | null>(null)
  const [editForm, setEditForm] = useState({ parameterName: '', parameterCode: '', uom: '', dataType: 'Numeric', formulaType: 'Expression', calcFormula: '', instrumentType: '', columnFrequency: '', isCritical: false, isMandatory: true, inputFields: [] as InputField[] })

  function openEdit(r: Param) {
    setEditRow(r)
    setEditForm({
      parameterName: r.parameterName, parameterCode: r.parameterCode, uom: r.uom,
      dataType: r.dataType, formulaType: r.formulaType, calcFormula: '',
      instrumentType: r.instrumentType || '', columnFrequency: r.columnFrequency || '',
      isCritical: r.isCritical, isMandatory: r.isMandatory,
      inputFields: parseInputFields(r.inputFields),
    })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/parameters/${editRow!.parameterId}`, {
        ...editForm,
        instrumentType: editForm.instrumentType || null,
        columnFrequency: editForm.columnFrequency || null,
        inputFields: editForm.inputFields.length > 0 ? JSON.stringify(editForm.inputFields) : null,
      })
      setEditRow(null); load()
      toast(`Parameter "${editForm.parameterName}" updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function load() {
    setLoading(true)
    try {
      const [r, mr] = await Promise.all([
        api.get('/parameters').catch(() => ({ data: [] })),
        api.get('/test-methods?statusFilter=Approved').catch(() => ({ data: [] })),
      ])
      setData(r.data); setMethods(mr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/parameters', {
        ...form,
        methodId: Number(form.methodId),
        instrumentType: form.instrumentType || null,
        columnFrequency: form.columnFrequency || null,
        inputFields: form.inputFields.length > 0 ? JSON.stringify(form.inputFields) : null,
      })
      setShowForm(false)
      toast(`Parameter "${form.parameterName}" added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Parameters" onAdd={() => { setForm({ methodId: '', parameterName: '', parameterCode: '', uom: '', dataType: 'Numeric', formulaType: 'Expression', calcFormula: '', instrumentType: '', columnFrequency: '', isCritical: false, isMandatory: true, inputFields: [] }); setError(''); setShowForm(true) }} />
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
        { header: 'Edit', accessor: r => (
          <button onClick={() => openEdit(r)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Edit
          </button>
        ) },
      ]} />
      {editRow && (
        <Drawer title={`Edit Parameter — ${editRow.parameterCode}`} subtitle="Update parameter definition and measurement settings" onClose={() => setEditRow(null)}>
          <form onSubmit={submitEdit}>
            <Field label="Parameter Name"><input style={inp} value={editForm.parameterName} onChange={e => setEditForm(f => ({ ...f, parameterName: e.target.value }))} required /></Field>
            <Field label="Parameter Code"><input style={inp} value={editForm.parameterCode} onChange={e => setEditForm(f => ({ ...f, parameterCode: e.target.value }))} required /></Field>
            <Field label="UOM"><input style={inp} value={editForm.uom} onChange={e => setEditForm(f => ({ ...f, uom: e.target.value }))} required /></Field>
            <Field label="Data Type">
              <select style={inp} value={editForm.dataType} onChange={e => setEditForm(f => ({ ...f, dataType: e.target.value }))}>
                {['Numeric', 'Text', 'PassFail'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Formula Type">
              <select style={inp} value={editForm.formulaType} onChange={e => setEditForm(f => ({ ...f, formulaType: e.target.value }))}>
                {['Expression', 'TableLookup'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {editForm.formulaType === 'Expression' && <>
              <Field label="Calc Formula">
                <input style={inp} value={editForm.calcFormula}
                  onChange={e => {
                    const formula = e.target.value
                    const vars = detectVars(formula)
                    const existing = editForm.inputFields
                    const merged = vars.map(v => ({ key: v, label: existing.find(f => f.key === v)?.label ?? v.replace(/_/g, ' ') }))
                    setEditForm(f => ({ ...f, calcFormula: formula, inputFields: merged }))
                  }}
                  placeholder="e.g. (blank_ml - titrant_ml) * normality * 12.69 / sample_wt_g" />
              </Field>
              {editForm.inputFields.length > 0 && (
                <Field label="Detected input fields — edit display labels">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {editForm.inputFields.map((f, i) => (
                      <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 4, padding: '3px 8px', color: '#0d6e6e', fontWeight: 600 }}>{f.key}</span>
                        <input style={{ ...inp, margin: 0 }} value={f.label}
                          onChange={e => setEditForm(prev => ({ ...prev, inputFields: prev.inputFields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))}
                          placeholder="Display label for analyst" />
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </>}
            <Field label="Required Instrument Type">
              <input style={inp} value={editForm.instrumentType} onChange={e => setEditForm(f => ({ ...f, instrumentType: e.target.value }))} placeholder="e.g. HPLC, pH Meter" />
            </Field>
            <Field label="Column Frequency">
              <select style={inp} value={editForm.columnFrequency} onChange={e => setEditForm(f => ({ ...f, columnFrequency: e.target.value }))}>
                <option value="">— Not set —</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Periodic">Periodic</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 24 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={editForm.isCritical} onChange={e => setEditForm(f => ({ ...f, isCritical: e.target.checked }))} /> Critical
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={editForm.isMandatory} onChange={e => setEditForm(f => ({ ...f, isMandatory: e.target.checked }))} /> Mandatory
              </label>
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Drawer>
      )}
      {showForm && (
        <Drawer title="Add Parameter" subtitle="Define a new test parameter linked to a method" onClose={() => setShowForm(false)}>
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
                {['Numeric', 'Text', 'PassFail'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Formula Type">
              <select style={inp} value={form.formulaType} onChange={e => setForm(f => ({ ...f, formulaType: e.target.value }))}>
                {['Expression', 'TableLookup'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {form.formulaType === 'Expression' && <>
              <Field label="Calc Formula">
                <input style={inp} value={form.calcFormula}
                  onChange={e => {
                    const formula = e.target.value
                    const vars = detectVars(formula)
                    const existing = form.inputFields
                    const merged = vars.map(v => ({ key: v, label: existing.find(f => f.key === v)?.label ?? v.replace(/_/g, ' ') }))
                    setForm(f => ({ ...f, calcFormula: formula, inputFields: merged }))
                  }}
                  placeholder="e.g. (blank_ml - titrant_ml) * normality * 12.69 / sample_wt_g" />
              </Field>
              {form.inputFields.length > 0 && (
                <Field label="Detected input fields — edit display labels">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {form.inputFields.map((f, i) => (
                      <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 4, padding: '3px 8px', color: '#0d6e6e', fontWeight: 600 }}>{f.key}</span>
                        <input style={{ ...inp, margin: 0 }} value={f.label}
                          onChange={e => setForm(prev => ({ ...prev, inputFields: prev.inputFields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))}
                          placeholder="Display label for analyst" />
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </>}
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
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}
    </div>
  )
}
