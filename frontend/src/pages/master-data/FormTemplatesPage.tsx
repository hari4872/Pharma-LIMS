import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { getErrorMessage } from '@/utils/errors'

// ── Types ──────────────────────────────────────────────────────────────────

interface Template {
  formTemplateId: number; formCode: string; formName: string
  formType: string; triggerType: string; status: string; version: string
  locationCount: number; parameterCount: number
  sampleTypeId: number | null; sampleTypeName: string | null
  fieldDefinitionsJson: string | null
}
interface Lab        { labId: number; labName: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }
interface Param      { parameterId: number; parameterName: string; parameterCode: string; uom: string; dataType: string }
interface LinkedParam    { parameterId: number; parameterName: string; parameterCode: string; uom: string }
interface LinkedLocation { locationId: number; locationName: string; locationCode: string }

export type FieldType = 'Text' | 'Number' | 'Decimal' | 'Dropdown' | 'Date' | 'DateTime' | 'Checkbox' | 'Textarea' | 'Parameter'

export interface FieldDef {
  id: string
  fieldType: FieldType
  label: string
  unit?: string            // for Number / Decimal
  required: boolean
  options?: string         // comma-separated list for Dropdown
  parameterId?: number     // when fieldType === 'Parameter'
  parameterCode?: string   // display only
  parameterName?: string   // display only
  parameterUom?: string    // display only
}

const FIELD_TYPES: FieldType[] = ['Text', 'Number', 'Decimal', 'Dropdown', 'Date', 'DateTime', 'Checkbox', 'Textarea', 'Parameter']
const TRIGGER_TYPES = ['TimeBased', 'OperatorScan', 'ProcessLog', 'DispatchEvent']
const FORM_TYPES    = ['Single', 'Grouped']

function uid() { return `f${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

// ── Field type badge colours ───────────────────────────────────────────────
const FT_COLOR: Record<FieldType, { bg: string; color: string }> = {
  Text:      { bg: '#dbeafe', color: '#1d4ed8' },
  Number:    { bg: '#dcfce7', color: '#15803d' },
  Decimal:   { bg: '#d1fae5', color: '#065f46' },
  Dropdown:  { bg: '#fef3c7', color: '#92400e' },
  Date:      { bg: '#e0f2fe', color: '#0369a1' },
  DateTime:  { bg: '#cffafe', color: '#0e7490' },
  Checkbox:  { bg: '#f3e8ff', color: '#7c3aed' },
  Textarea:  { bg: '#fce7f3', color: '#9d174d' },
  Parameter: { bg: '#f0fdfa', color: '#0d6e6e' },
}

// ── Page component ─────────────────────────────────────────────────────────
export default function FormTemplatesPage() {
  const [data, setData]               = useState<Template[]>([])
  const [labs, setLabs]               = useState<Lab[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [params, setParams]           = useState<Param[]>([])
  const [loading, setLoading]         = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [showApprove, setShowApprove] = useState<number | null>(null)
  const [designRow, setDesignRow]     = useState<Template | null>(null)
  const [allLocations, setAllLocations] = useState<{ locationId: number; locationName: string; locationCode: string }[]>([])
  const [manageRow, setManageRow]         = useState<Template | null>(null)
  const [manageTab, setManageTab]         = useState<'params' | 'locs'>('params')
  const [linkedParams, setLinkedParams]   = useState<LinkedParam[]>([])
  const [linkedLocs, setLinkedLocs]       = useState<LinkedLocation[]>([])
  const [manageLoading, setManageLoading] = useState(false)
  const [addParamId, setAddParamId]       = useState('')
  const [addLocId, setAddLocId]           = useState('')

  const [form, setForm] = useState({
    formCode: '', formName: '', labId: '', formType: 'Single',
    triggerType: 'TimeBased', regulatoryTier: '',
    evidenceMandatory: false, sampleTypeId: ''
  })
  const [approveForm, setApproveForm] = useState({
    password: '', meaning: 'I approve this form template', reason: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    setLoading(true)
    try {
      const [r, lr, str, pr, slr] = await Promise.all([
        api.get('/form-templates').catch(() => ({ data: [] })),
        api.get('/laboratories').catch(() => ({ data: [] })),
        api.get('/sample-types').catch(() => ({ data: [] })),
        api.get('/parameters').catch(() => ({ data: [] })),
        api.get('/storage-locations').catch(() => ({ data: [] })),
      ])
      setData(r.data); setLabs(lr.data); setSampleTypes(str.data); setParams(pr.data)
      setAllLocations(slr.data)
    } finally { setLoading(false) }
  }

  async function openManage(row: Template) {
    setManageRow(row)
    setManageTab('params')
    setManageLoading(true)
    try {
      const [pr, lr] = await Promise.all([
        api.get(`/form-templates/${row.formTemplateId}/parameters`).catch(() => ({ data: [] })),
        api.get(`/form-templates/${row.formTemplateId}/locations`).catch(() => ({ data: [] })),
      ])
      setLinkedParams(pr.data); setLinkedLocs(lr.data)
    } finally { setManageLoading(false) }
  }

  async function linkParam(parameterId: number) {
    // POST body — backend route is POST /form-templates/{id}/parameters with body { parameterId, displayOrder }
    await api.post(`/form-templates/${manageRow!.formTemplateId}/parameters`, {
      parameterId,
      displayOrder: linkedParams.length + 1,
      columnFrequency: null,
    })
    setAddParamId('')
    openManage(manageRow!)
  }
  async function unlinkParam(parameterId: number) {
    await api.delete(`/form-templates/${manageRow!.formTemplateId}/parameters/${parameterId}`)
    openManage(manageRow!)
  }
  async function linkLoc(locationId: number) {
    await api.post(`/form-templates/${manageRow!.formTemplateId}/locations/${locationId}`, {})
    setAddLocId('')
    openManage(manageRow!)
  }
  async function unlinkLoc(locationId: number) {
    await api.delete(`/form-templates/${manageRow!.formTemplateId}/locations/${locationId}`)
    openManage(manageRow!)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/form-templates', {
        ...form, labId: Number(form.labId),
        sampleTypeId: form.sampleTypeId ? Number(form.sampleTypeId) : null
      })
      setShowForm(false)
      toast(`Form Template "${form.formName}" added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/form-templates/${showApprove}/approve`, approveForm)
      setShowApprove(null)
      toast(`Form Template approved successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'E-signature failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Monitoring & Log Forms" onAdd={() => { setForm({ formCode: '', formName: '', labId: '', formType: 'Single', triggerType: 'TimeBased', regulatoryTier: '', evidenceMandatory: false, sampleTypeId: '' }); setError(''); setShowForm(true) }} />

      <DataTable loading={loading} data={data} exportFilename="FormTemplates" columns={[
        { header: 'Code',       accessor: 'formCode' },
        { header: 'Name',       accessor: 'formName' },
        { header: 'Type',       accessor: 'formType' },
        { header: 'Trigger',    accessor: 'triggerType' },
        { header: 'Sample Type', accessor: r => r.sampleTypeName ?? <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span> },
        { header: 'Version',    accessor: 'version' },
        { header: 'Fields',     accessor: r => {
          const count = r.fieldDefinitionsJson ? (() => { try { return JSON.parse(r.fieldDefinitionsJson).length } catch { return 0 } })() : 0
          return count > 0
            ? <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, background: '#f0fdfa', color: '#0d6e6e', fontWeight: 600 }}>{count} field{count !== 1 ? 's' : ''}</span>
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>No fields</span>
        }},
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12,
            background: r.status === 'Active' ? '#d1fae5' : '#fef9c3',
            color: r.status === 'Active' ? '#065f46' : '#854d0e' }}>{r.status}</span>
        )},
        { header: '', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setDesignRow(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11">
                <path d="M4 6h16M4 10h16M4 14h10M4 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Design Fields
            </button>
            <button onClick={() => openManage(r)}
              style={{ padding: '4px 10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>⚙ Manage</button>
            {r.status === 'Draft' && (
              <button onClick={() => setShowApprove(r.formTemplateId)}
                style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Approve</button>
            )}
          </div>
        )},
      ]} />

      {/* ── Add Template modal ── */}
      {showForm && (
        <Modal title="Add Form Template" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Form Code">
              <input style={inp} value={form.formCode} onChange={e => setForm(f => ({ ...f, formCode: e.target.value }))} required />
            </Field>
            <Field label="Form Name">
              <input style={inp} value={form.formName} onChange={e => setForm(f => ({ ...f, formName: e.target.value }))} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Form Type">
                <select style={inp} value={form.formType} onChange={e => setForm(f => ({ ...f, formType: e.target.value }))}>
                  {FORM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Trigger Type">
                <select style={inp} value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value, sampleTypeId: '' }))}>
                  {TRIGGER_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label={`Sample Type${form.triggerType === 'DispatchEvent' ? ' *' : ' (optional)'}`}>
              <select style={inp} value={form.sampleTypeId}
                onChange={e => setForm(f => ({ ...f, sampleTypeId: e.target.value }))}
                required={form.triggerType === 'DispatchEvent'}>
                <option value="">Select sample type…</option>
                {sampleTypes.map(t =>
                  <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                )}
              </select>
            </Field>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.evidenceMandatory}
                onChange={e => setForm(f => ({ ...f, evidenceMandatory: e.target.checked }))} />
              Evidence Mandatory
            </label>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}

      {/* ── E-Signature Approval modal ── */}
      {showApprove && (
        <Modal title="E-Signature Approval" onClose={() => setShowApprove(null)}>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={approveForm.password} onChange={e => setApproveForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={approveForm.meaning} onChange={e => setApproveForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={approveForm.reason} onChange={e => setApproveForm(f => ({ ...f, reason: e.target.value }))} required />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(null)} />
          </form>
        </Modal>
      )}

      {/* ── Manage Parameters & Locations modal ── */}
      {manageRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111111' }}>Manage: {manageRow.formName}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#5f6368' }}>{manageRow.formCode}</p>
              </div>
              <button onClick={() => setManageRow(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
              {(['params', 'locs'] as const).map(tab => (
                <button key={tab} onClick={() => setManageTab(tab)}
                  style={{ padding: '10px 20px', border: 'none', borderBottom: manageTab === tab ? '2px solid #6d28d9' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: manageTab === tab ? 700 : 400, color: manageTab === tab ? '#6d28d9' : '#5f6368', fontFamily: 'inherit' }}>
                  {tab === 'params' ? 'Parameters' : 'Locations'}
                </button>
              ))}
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {manageLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : manageTab === 'params' ? (
                <>
                  {/* Add parameter */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select value={addParamId} onChange={e => setAddParamId(e.target.value)}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #dadce0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: '#111111' }}>
                      <option value="">Select parameter to add…</option>
                      {params.filter(p => !linkedParams.some(lp => lp.parameterId === p.parameterId)).map(p => (
                        <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.parameterCode})</option>
                      ))}
                    </select>
                    <button onClick={() => addParamId && linkParam(Number(addParamId))} disabled={!addParamId}
                      style={{ padding: '7px 16px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 6, cursor: addParamId ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: addParamId ? 1 : 0.5, fontFamily: 'inherit' }}>Add</button>
                  </div>
                  {/* Linked params table */}
                  {linkedParams.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No parameters linked yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Code</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600, color: '#374151' }}>UOM</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedParams.map(lp => (
                          <tr key={lp.parameterId}>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', color: '#0d6e6e', fontWeight: 600 }}>{lp.parameterCode}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', color: '#111111' }}>{lp.parameterName}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', color: '#5f6368' }}>{lp.uom || '—'}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                              <button onClick={() => unlinkParam(lp.parameterId)}
                                style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <>
                  {/* Add location */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select value={addLocId} onChange={e => setAddLocId(e.target.value)}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #dadce0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: '#111111' }}>
                      <option value="">Select location to add…</option>
                      {allLocations.filter(l => !linkedLocs.some(ll => ll.locationId === l.locationId)).map(l => (
                        <option key={l.locationId} value={l.locationId}>{l.locationName} ({l.locationCode})</option>
                      ))}
                    </select>
                    <button onClick={() => addLocId && linkLoc(Number(addLocId))} disabled={!addLocId}
                      style={{ padding: '7px 16px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 6, cursor: addLocId ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: addLocId ? 1 : 0.5, fontFamily: 'inherit' }}>Add</button>
                  </div>
                  {/* Linked locs table */}
                  {linkedLocs.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No locations linked yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Code</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedLocs.map(ll => (
                          <tr key={ll.locationId}>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', color: '#6d28d9', fontWeight: 600 }}>{ll.locationCode}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', color: '#111111' }}>{ll.locationName}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                              <button onClick={() => unlinkLoc(ll.locationId)}
                                style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setManageRow(null)}
                style={{ padding: '8px 20px', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#111111', fontFamily: 'inherit' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Field Designer (full-page overlay) ── */}
      {designRow && (
        <FieldDesigner
          template={designRow}
          allParams={params}
          onClose={() => setDesignRow(null)}
          onSaved={() => { setDesignRow(null); load() }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Field Designer Component
// ══════════════════════════════════════════════════════════════════════════════

function FieldDesigner({
  template, allParams, onClose, onSaved
}: {
  template: Template
  allParams: Param[]
  onClose: () => void
  onSaved: () => void
}) {
  const [fields, setFields]         = useState<FieldDef[]>(() => {
    if (!template.fieldDefinitionsJson) return []
    try { return JSON.parse(template.fieldDefinitionsJson) } catch { return [] }
  })
  const [saving, setSaving]         = useState(false)
  const [showParamPicker, setShowParamPicker] = useState(false)
  const [paramSearch, setParamSearch]         = useState('')

  // ── Helpers ────────────────────────────────────────────────────────────────
  function addField(type: FieldType) {
    if (type === 'Parameter') { setShowParamPicker(true); return }
    setFields(f => [...f, { id: uid(), fieldType: type, label: '', required: false }])
  }

  function addParam(p: Param) {
    const already = fields.some(f => f.fieldType === 'Parameter' && f.parameterId === p.parameterId)
    if (already) { toast(`Parameter "${p.parameterName}" already added`, 'error'); return }
    setFields(f => [...f, {
      id: uid(), fieldType: 'Parameter',
      label: p.parameterName, required: true,
      parameterId: p.parameterId, parameterCode: p.parameterCode,
      parameterName: p.parameterName, parameterUom: p.uom,
      unit: p.uom,
    }])
    setShowParamPicker(false)
    setParamSearch('')
  }

  function removeField(id: string) { setFields(f => f.filter(x => x.id !== id)) }

  function updateField(id: string, patch: Partial<FieldDef>) {
    setFields(f => f.map(x => x.id === id ? { ...x, ...patch } : x))
  }

  function moveUp(i: number) {
    if (i === 0) return
    setFields(f => { const a = [...f]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a })
  }

  function moveDown(i: number) {
    setFields(f => { if (i >= f.length - 1) return f; const a = [...f]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a })
  }

  async function save() {
    setSaving(true)
    try {
      await api.put(`/form-templates/${template.formTemplateId}/fields`, {
        fieldDefinitionsJson: JSON.stringify(fields)
      })
      toast(`Field layout saved — ${fields.length} field${fields.length !== 1 ? 's' : ''}`, 'success')
      onSaved()
    } catch (err) {
      toast(getErrorMessage(err, 'Save failed'), 'error')
    } finally { setSaving(false) }
  }

  const filteredParams = allParams.filter(p =>
    !paramSearch.trim() ||
    p.parameterName.toLowerCase().includes(paramSearch.toLowerCase()) ||
    p.parameterCode.toLowerCase().includes(paramSearch.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111111' }}>Design Fields</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#5f6368' }}>
              {template.formCode} — {template.formName} &nbsp;·&nbsp; {fields.length} field{fields.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
        </div>

        {/* Toolbar — Add field buttons */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0, background: '#fafafa' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5f6368', marginRight: 4 }}>ADD FIELD:</span>
          {FIELD_TYPES.map(type => (
            <button key={type} onClick={() => addField(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', border: `1px solid ${FT_COLOR[type].bg === '#f0fdfa' ? '#0d6e6e' : '#e0e0e0'}`,
                borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: FT_COLOR[type].bg, color: FT_COLOR[type].color,
                fontFamily: 'inherit',
              }}>
              {type === 'Parameter' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" width="11" height="11">
                    <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  + Parameter
                </>
              ) : `+ ${type}`}
            </button>
          ))}
        </div>

        {/* Field list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          {fields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <svg viewBox="0 0 80 60" fill="none" width="80" height="60" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
                <rect x="10" y="10" width="60" height="40" rx="6" stroke="#e2e8f0" strokeWidth="2"/>
                <path d="M20 22h40M20 30h30M20 38h20" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"/>
              </svg>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6b7280' }}>No fields yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>Click the field type buttons above to start building your form</p>
            </div>
          ) : fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              index={i}
              total={fields.length}
              onUpdate={patch => updateField(field.id, patch)}
              onRemove={() => removeField(field.id)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa', borderRadius: '0 0 14px 14px' }}>
          <span style={{ fontSize: 12, color: '#5f6368' }}>
            {fields.length === 0 ? 'No fields defined' : `${fields.length} field${fields.length !== 1 ? 's' : ''} · ${fields.filter(f => f.required).length} required`}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ padding: '8px 18px', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#111111', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding: '8px 22px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : '💾 Save Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* Parameter Picker overlay */}
      {showParamPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111111' }}>Select Parameter</h4>
              <button onClick={() => { setShowParamPicker(false); setParamSearch('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#5f6368' }}>×</button>
            </div>
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #f1f3f4' }}>
              <input
                autoFocus
                placeholder="Search parameters…"
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
                style={{ ...inp, fontSize: 13 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {filteredParams.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No parameters found</div>
              ) : filteredParams.map(p => {
                const alreadyAdded = fields.some(f => f.fieldType === 'Parameter' && f.parameterId === p.parameterId)
                return (
                  <div key={p.parameterId}
                    onClick={() => !alreadyAdded && addParam(p)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 12,
                      cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      opacity: alreadyAdded ? 0.45 : 1,
                      borderBottom: '1px solid #f8f9fa',
                      transition: 'background 0.08s',
                    }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLDivElement).style.background = '#f0fdfa' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                        <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke="#0d6e6e" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{p.parameterName}</div>
                      <div style={{ fontSize: 11, color: '#80868b', marginTop: 2 }}>
                        {p.parameterCode} · {p.dataType}{p.uom ? ` · ${p.uom}` : ''}
                      </div>
                    </div>
                    {alreadyAdded
                      ? <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Added</span>
                      : <span style={{ fontSize: 11, background: '#f0fdfa', color: '#0d6e6e', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>+ Add</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Single Field Row
// ══════════════════════════════════════════════════════════════════════════════

function FieldRow({
  field, index, total, onUpdate, onRemove, onMoveUp, onMoveDown
}: {
  field: FieldDef
  index: number
  total: number
  onUpdate: (patch: Partial<FieldDef>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const ft = FT_COLOR[field.fieldType]
  const isParam = field.fieldType === 'Parameter'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px auto 1fr auto auto auto',
      gap: 8, alignItems: 'center',
      padding: '10px 12px',
      marginBottom: 6,
      background: '#fff',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      transition: 'box-shadow 0.1s',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
    >
      {/* Order buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button onClick={onMoveUp} disabled={index === 0}
          title="Move up"
          style={{ width: 22, height: 22, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === 0 ? 0.3 : 1 }}>
          <svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M18 15l-6-6-6 6" stroke="#5f6368" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          title="Move down"
          style={{ width: 22, height: 22, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff', cursor: index === total - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === total - 1 ? 0.3 : 1 }}>
          <svg viewBox="0 0 24 24" fill="none" width="10" height="10"><path d="M6 9l6 6 6-6" stroke="#5f6368" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Type badge */}
      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ft.bg, color: ft.color, whiteSpace: 'nowrap' }}>
        {field.fieldType}
      </span>

      {/* Main content — label + extras */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
        {/* Label */}
        <input
          placeholder={isParam ? `Parameter label` : `Field label *`}
          value={field.label}
          onChange={e => onUpdate({ label: e.target.value })}
          readOnly={isParam}
          style={{
            padding: '6px 10px', border: '1px solid #dadce0', borderRadius: 6,
            fontSize: 13, flex: '1 1 160px', minWidth: 120,
            color: '#111111', fontFamily: 'inherit',
            background: isParam ? '#f8f9fa' : '#fff',
            cursor: isParam ? 'default' : 'text',
          }}
        />

        {/* Unit — for Number / Decimal / Parameter */}
        {(field.fieldType === 'Number' || field.fieldType === 'Decimal' || isParam) && (
          <input
            placeholder="Unit (e.g. mg/mL)"
            value={field.unit ?? ''}
            onChange={e => onUpdate({ unit: e.target.value })}
            readOnly={isParam && !!field.parameterUom}
            style={{
              padding: '6px 10px', border: '1px solid #dadce0', borderRadius: 6,
              fontSize: 13, width: 110, color: '#111111', fontFamily: 'inherit',
              background: isParam && !!field.parameterUom ? '#f8f9fa' : '#fff',
            }}
          />
        )}

        {/* Options — for Dropdown */}
        {field.fieldType === 'Dropdown' && (
          <input
            placeholder="Options: A, B, C (comma-separated)"
            value={field.options ?? ''}
            onChange={e => onUpdate({ options: e.target.value })}
            style={{
              padding: '6px 10px', border: '1px solid #dadce0', borderRadius: 6,
              fontSize: 13, flex: '2 1 200px', color: '#111111', fontFamily: 'inherit',
            }}
          />
        )}

        {/* Parameter info badge */}
        {isParam && field.parameterCode && (
          <span style={{ fontSize: 11, color: '#0d6e6e', background: '#f0fdfa', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap', border: '1px solid #99f6e4' }}>
            {field.parameterCode}
          </span>
        )}
      </div>

      {/* Required toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#5f6368', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
        <div
          onClick={() => onUpdate({ required: !field.required })}
          style={{
            width: 34, height: 18, borderRadius: 9, position: 'relative', cursor: 'pointer',
            background: field.required ? '#0d6e6e' : '#d1d5db',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}>
          <div style={{
            position: 'absolute', top: 2, left: field.required ? 18 : 2,
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s',
          }} />
        </div>
        <span style={{ color: field.required ? '#0d6e6e' : '#9ca3af', fontWeight: field.required ? 600 : 400 }}>
          {field.required ? 'Required' : 'Optional'}
        </span>
      </label>

      {/* Remove button */}
      <button onClick={onRemove} title="Remove field"
        style={{ width: 28, height: 28, border: '1px solid #fee2e2', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
