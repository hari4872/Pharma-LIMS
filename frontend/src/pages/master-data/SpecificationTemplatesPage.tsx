// ─────────────────────────────────────────────────────────────────────────────
// SpecificationTemplatesPage.tsx — Phase A
//
// QA/Admin creates Specification Templates that define WHAT tests to run for
// a given Material + SampleType + Stage combination.
// When a sample is registered, the spec engine auto-matches and creates
// TestExecution rows — no manual test selection needed.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment, useEffect, useState } from 'react'
import api from '@/api/client'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/utils/errors'
import { Drawer } from '@/components/Drawer'
import ESignatureDrawer from '@/components/ESignatureDrawer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpecTemplate {
  specTemplateId:     number
  templateName:       string
  version:            string
  description:        string | null
  compendialStandard: string | null
  stage:              string
  status:             string   // Draft | Approved | Obsolete
  effectiveFrom:      string | null
  approvedBy:         string | null
  approvedAt:         string | null
  material:           { materialId: number; materialName: string }
  sampleType:         { sampleTypeId: number; typeName: string; typeCode: string }
  itemCount:          number
  items:              SpecTemplateItem[]
  createdBy:          string
  createdAt:          string
}

interface SpecTemplateItem {
  specTemplateItemId: number
  parameterId:        number | null   // null for method-level items (LabVantage model)
  parameterName:      string | null
  parameterCode:      string | null
  testMethodId:       number | null
  testMethodName:     string | null
  testMethodCode:     string | null
  turnaroundHours:    number
  isMandatory:        boolean
  sortOrder:          number
}

interface Material   { materialId: number; materialName: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }
interface Parameter  { parameterId: number; methodId: number; parameterName: string; parameterCode: string; uom: string }
interface TestMethod { methodId: number; methodName: string; methodCode: string }

const STAGES  = ['Incoming', 'InProcess', 'Finished', 'Stability']
const STATUSES = ['Draft', 'Approved', 'Obsolete']

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Draft:    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Approved: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  Obsolete: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpecificationTemplatesPage() {
  const [templates,    setTemplates]    = useState<SpecTemplate[]>([])
  const [materials,    setMaterials]    = useState<Material[]>([])
  const [sampleTypes,  setSampleTypes]  = useState<SampleType[]>([])
  const [parameters,   setParameters]   = useState<Parameter[]>([])
  const [testMethods,  setTestMethods]  = useState<TestMethod[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search,       setSearch]       = useState('')
  const [showCreate,   setShowCreate]   = useState(false)
  const [designer,     setDesigner]     = useState<SpecTemplate | null>(null)
  const [approveTarget, setApproveTarget] = useState<{ id: number; name: string } | null>(null)
  const [esig,         setEsig]         = useState({ password: '', meaning: 'I approve this specification template', reason: '' })
  const [approving,    setApproving]    = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [tmplRes, matRes, stRes, paramRes, methRes] = await Promise.all([
        api.get('/specification-templates'),
        api.get('/materials'),
        api.get('/sample-types'),
        api.get('/parameters'),
        api.get('/test-methods'),
      ])
      setTemplates(tmplRes.data)
      setMaterials(matRes.data)
      setSampleTypes(stRes.data)
      setParameters(paramRes.data)
      setTestMethods(methRes.data)
    } catch (e) {
      toast(getErrorMessage(e, 'Failed to load specification templates'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = templates.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return t.templateName.toLowerCase().includes(q) ||
             t.material.materialName.toLowerCase().includes(q) ||
             t.sampleType.typeName.toLowerCase().includes(q)
    }
    return true
  })

  async function handleApprove(id: number, name: string) {
    setApproveTarget({ id, name })
    setEsig({ password: '', meaning: 'I approve this specification template', reason: '' })
  }

  async function submitApprove() {
    if (!approveTarget) return
    if (!esig.password || !esig.meaning || !esig.reason) {
      toast('Password, meaning and reason are all required (21 CFR §11.50)', 'error')
      return
    }
    setApproving(true)
    try {
      await api.post(`/specification-templates/${approveTarget.id}/approve`, {
        password: esig.password,
        meaning:  esig.meaning,
        reason:   esig.reason,
      })
      toast(`✓ ${approveTarget.name} approved — spec engine will now auto-apply this template`, 'success')
      setApproveTarget(null)
      loadAll()
    } catch (e) {
      toast(getErrorMessage(e, 'Approval failed'), 'error')
    } finally {
      setApproving(false)
    }
  }

  async function handleObsolete(id: number, name: string) {
    if (!confirm(`Mark "${name}" as Obsolete? This cannot be undone.`)) return
    try {
      await api.post(`/specification-templates/${id}/obsolete`, {})
      toast(`${name} marked Obsolete`, 'success')
      loadAll()
    } catch (e) {
      toast(getErrorMessage(e, 'Failed to obsolete template'), 'error')
    }
  }

  return (
    <ErrorBoundary label="Specification Templates">
      <div>
        <PageHeader
          title="Product Test Plans"
          onAdd={() => setShowCreate(true)}
          addLabel="+ New Template"
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <input
            style={{ ...inp, width: 240 }}
            placeholder="Search material, template name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={{ ...inp, width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#5f6368', alignSelf: 'center' }}>
            {filtered.length} template{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
            No specification templates found.
            <br />
            <span style={{ fontSize: 12 }}>Create a template so the spec engine can auto-assign tests at sample registration.</span>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
                  {['Template Name', 'Material', 'Compendial Std.', 'Sample Type', 'Stage', 'Tests', 'Version', 'Status', 'Effective From', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#111111', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.Draft
                  return (
                    <tr key={t.specTemplateId} style={{ borderBottom: '1px solid #f1f3f4', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>{t.templateName}</div>
                        {t.description && <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>{t.description}</div>}
                        {t.approvedBy && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Approved by {t.approvedBy}</div>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#111111' }}>{t.material.materialName}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {t.compendialStandard
                          ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{t.compendialStandard}</span>
                          : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>{t.sampleType.typeName}</span>
                        <span style={{ fontSize: 10, color: '#5f6368', marginLeft: 4 }}>{t.sampleType.typeCode}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 12, background: '#f0f4f8', color: '#374151', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                          {t.stage}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => setDesigner(t)}
                          style={{
                            fontSize: 12, fontWeight: 700, padding: '3px 10px',
                            background: '#f0fdfa', color: '#0d6e6e',
                            border: '1px solid #99f6e4', borderRadius: 6, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {t.itemCount} test{t.itemCount !== 1 ? 's' : ''} ✎
                        </button>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#111111' }}>v{t.version}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ ...ss, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, border: `1px solid ${ss.border}` }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#5f6368' }}>
                        {t.effectiveFrom ? new Date(t.effectiveFrom).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {t.status === 'Draft' && (
                            <button onClick={() => handleApprove(t.specTemplateId, t.templateName)}
                              style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Approve
                            </button>
                          )}
                          {t.status === 'Approved' && (
                            <button onClick={() => handleObsolete(t.specTemplateId, t.templateName)}
                              style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Obsolete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <CreateTemplateModal
            materials={materials}
            sampleTypes={sampleTypes}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); loadAll() }}
          />
        )}

        {/* Test Item Designer */}
        {designer && (
          <TestItemDesigner
            template={designer}
            parameters={parameters}
            testMethods={testMethods}
            onClose={() => setDesigner(null)}
            onSaved={() => { setDesigner(null); loadAll() }}
          />
        )}

        {/* E-Signature Approval Drawer */}
        {approveTarget && (
          <ESignatureDrawer
            title="Approve Specification Template"
            subtitle={`${approveTarget.name} — 21 CFR §11.50`}
            form={esig} onChange={setEsig}
            onSubmit={e => { e.preventDefault(); submitApprove() }}
            onClose={() => setApproveTarget(null)}
            saving={approving} label="Approve"
            reasonMultiline
            reasonPlaceholder="e.g. Template reviewed and validated against compendial requirements"
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateTemplateModal({
  materials, sampleTypes, onClose, onCreated
}: {
  materials: Material[]; sampleTypes: SampleType[]
  onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    materialId: '', sampleTypeId: '', stage: 'Finished',
    templateName: '', version: '1.0', description: '', compendialStandard: '', effectiveFrom: ''
  })
  const [saving, setSaving] = useState(false)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.materialId || !form.sampleTypeId || !form.templateName) {
      toast('Material, Sample Type and Template Name are required', 'error'); return
    }
    setSaving(true)
    try {
      await api.post('/specification-templates', {
        materialId:         parseInt(form.materialId),
        sampleTypeId:       parseInt(form.sampleTypeId),
        stage:              form.stage,
        templateName:       form.templateName,
        version:            form.version || '1.0',
        description:        form.description || null,
        compendialStandard: form.compendialStandard || null,
        effectiveFrom:      form.effectiveFrom || null,
      })
      toast(`Template "${form.templateName}" created — add tests in the designer`, 'success')
      onCreated()
    } catch (e) {
      toast(getErrorMessage(e, 'Failed to create template'), 'error')
    } finally { setSaving(false) }
  }

  return (
    <Drawer title="New Specification Template" subtitle="Create a spec template to auto-assign tests at sample registration" onClose={onClose} width={540}>
      <Field label="Material *">
        <select style={inp} value={form.materialId} onChange={e => f('materialId', e.target.value)}>
          <option value="">Select material…</option>
          {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
        </select>
      </Field>
      <Field label="Sample Type *">
        <select style={inp} value={form.sampleTypeId} onChange={e => f('sampleTypeId', e.target.value)}>
          <option value="">Select sample type…</option>
          {sampleTypes.map(s => <option key={s.sampleTypeId} value={s.sampleTypeId}>{s.typeName} ({s.typeCode})</option>)}
        </select>
      </Field>
      <Field label="Stage *">
        <select style={inp} value={form.stage} onChange={e => f('stage', e.target.value)}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Template Name *">
        <input style={inp} placeholder="e.g. FP-STP-001" value={form.templateName} onChange={e => f('templateName', e.target.value)} />
      </Field>
      <Field label="Version">
        <input style={{ ...inp, width: 100 }} placeholder="1.0" value={form.version} onChange={e => f('version', e.target.value)} />
      </Field>
      <Field label="Description">
        <input style={inp} placeholder="Optional description" value={form.description} onChange={e => f('description', e.target.value)} />
      </Field>
      <Field label="Compendial Standard">
        <select style={inp} value={form.compendialStandard} onChange={e => f('compendialStandard', e.target.value)}>
          <option value="">None / In-house</option>
          <option value="USP">USP — United States Pharmacopeia</option>
          <option value="EP">EP — European Pharmacopeia</option>
          <option value="BP">BP — British Pharmacopeia</option>
          <option value="JP">JP — Japanese Pharmacopeia</option>
          <option value="IP">IP — Indian Pharmacopeia</option>
          <option value="ICH">ICH Guidelines</option>
          <option value="In-house">In-house Method</option>
        </select>
      </Field>
      <Field label="Effective From">
        <input type="datetime-local" style={{ ...inp, width: 220 }} value={form.effectiveFrom} onChange={e => f('effectiveFrom', e.target.value)} />
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Leave blank to be effective immediately on approval</div>
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onClose}
          style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500 }}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          style={{ padding: '8px 18px', background: saving ? '#9ca3af' : '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
          {saving ? 'Creating…' : 'Create Template'}
        </button>
      </div>
    </Drawer>
  )
}

// ── Test Item Designer ────────────────────────────────────────────────────────

interface DraftItem {
  id:              string
  parameterId:     number | null   // null = method-level item (LabVantage model)
  parameterName:   string | null
  parameterCode:   string | null
  testMethodId:    number | null
  turnaroundHours: number
  isMandatory:     boolean
}

function TestItemDesigner({
  template, parameters, testMethods, onClose, onSaved
}: {
  template:    SpecTemplate
  parameters:  Parameter[]
  testMethods: TestMethod[]
  onClose:     () => void
  onSaved:     () => void
}) {
  const [items,    setItems]    = useState<DraftItem[]>(
    template.items.map(i => ({
      id:              String(i.specTemplateItemId),
      parameterId:     i.parameterId,
      parameterName:   i.parameterName,
      parameterCode:   i.parameterCode,
      testMethodId:    i.testMethodId,
      turnaroundHours: i.turnaroundHours,
      isMandatory:     i.isMandatory,
    }))
  )
  const [paramSearch,  setParamSearch]  = useState('')
  const [methodSearch, setMethodSearch] = useState('')
  const [saving,       setSaving]       = useState(false)

  const isLocked = template.status === 'Approved'

  // Per-param items: exclude params already added (method-level items have null parameterId, skip them)
  const availableParams = parameters.filter(p =>
    !items.some(i => i.parameterId != null && i.parameterId === p.parameterId) &&
    (paramSearch === '' ||
      p.parameterName.toLowerCase().includes(paramSearch.toLowerCase()) ||
      p.parameterCode.toLowerCase().includes(paramSearch.toLowerCase()))
  )

  // Method-level items: exclude methods already added as a group
  const availableMethods = testMethods.filter(m =>
    !items.some(i => i.parameterId == null && i.testMethodId === m.methodId) &&
    (methodSearch === '' ||
      m.methodName.toLowerCase().includes(methodSearch.toLowerCase()) ||
      m.methodCode.toLowerCase().includes(methodSearch.toLowerCase()))
  )

  function addParam(p: Parameter) {
    setItems(prev => [...prev, {
      id:              `new_${Date.now()}`,
      parameterId:     p.parameterId,
      parameterName:   p.parameterName,
      parameterCode:   p.parameterCode,
      testMethodId:    null,
      turnaroundHours: 24,
      isMandatory:     true,
    }])
    setParamSearch('')
  }

  // LabVantage model: one execution per method, all params in that method appear together
  function addMethod(m: TestMethod) {
    setItems(prev => [...prev, {
      id:              `new_${Date.now()}`,
      parameterId:     null,
      parameterName:   null,
      parameterCode:   null,
      testMethodId:    m.methodId,
      turnaroundHours: 24,
      isMandatory:     true,
    }])
    setMethodSearch('')
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    setItems(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })
  }

  function moveDown(idx: number) {
    setItems(prev => {
      if (idx >= prev.length - 1) return prev
      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a
    })
  }

  function updateItem(id: string, field: string, value: number | boolean | null) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put(`/specification-templates/${template.specTemplateId}/items`,
        items.map(i => ({
          parameterId:     i.parameterId,
          testMethodId:    i.testMethodId,
          turnaroundHours: i.turnaroundHours,
          isMandatory:     i.isMandatory,
        }))
      )
      toast(`${items.length} test(s) saved to "${template.templateName}"`, 'success')
      onSaved()
    } catch (e) {
      toast(getErrorMessage(e, 'Failed to save tests'), 'error')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111111' }}>
              Test Item Designer — {template.templateName}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#5f6368' }}>
              {template.material.materialName} · {template.sampleType.typeName} · {template.stage} · v{template.version}
              {isLocked && <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 700 }}>⚠ Approved — read only</span>}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#5f6368' }}>×</button>
        </div>

        {/* Add controls: two sections side-by-side when not locked */}
        {!isLocked && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>

            {/* Add Test Parameter (per-param / classic model) */}
            <div style={{ flex: 1, padding: '12px 16px 12px 24px', background: '#fafafa', borderRight: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                Add Test Parameter
                <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>({availableParams.length} available)</span>
              </div>
              <input
                style={{ ...inp, marginBottom: 6 }}
                placeholder="🔍  Search parameters…"
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
              />
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, maxHeight: 140, overflowY: 'auto', background: '#fff' }}>
                {availableParams.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
                    {paramSearch ? 'No matching parameters' : 'All parameters already added'}
                  </div>
                ) : availableParams.map(p => (
                  <div key={p.parameterId}
                    onClick={() => addParam(p)}
                    style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span style={{ fontSize: 11, background: '#f0f4f8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{p.parameterCode}</span>
                    <span style={{ color: '#111111', flex: 1 }}>{p.parameterName}</span>
                    {p.uom && <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.uom}</span>}
                    <span style={{ fontSize: 11, color: '#0d6e6e', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Add</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Method Group (LabVantage model: 1 execution per method, all params in one form) */}
            <div style={{ flex: 1, padding: '12px 24px 12px 16px', background: '#f0fdfa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                Add Method Group
                <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>({availableMethods.length} available)</span>
                <span style={{ fontSize: 10, color: '#0d6e6e', background: '#ccfbf1', padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 600 }}>1 execution · all params</span>
              </div>
              <input
                style={{ ...inp, marginBottom: 6 }}
                placeholder="🔍  Search test methods…"
                value={methodSearch}
                onChange={e => setMethodSearch(e.target.value)}
              />
              <div style={{ border: '1px solid #99f6e4', borderRadius: 8, maxHeight: 140, overflowY: 'auto', background: '#fff' }}>
                {availableMethods.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
                    {methodSearch ? 'No matching methods' : 'All methods already added'}
                  </div>
                ) : availableMethods.map(m => (
                  <div key={m.methodId}
                    onClick={() => addMethod(m)}
                    style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span style={{ fontSize: 11, background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>{m.methodCode}</span>
                    <span style={{ color: '#111111', flex: 1 }}>{m.methodName}</span>
                    <span style={{ fontSize: 11, color: '#0d6e6e', fontWeight: 600, whiteSpace: 'nowrap' }}>+ Add Group</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px', minHeight: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No tests added yet. Select a parameter from the list above to add it.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  {['Order', 'Parameter', 'Test Method', 'TAT (h)', 'Mandatory', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#111111' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isGroup = item.parameterId == null && item.testMethodId != null
                  const groupParams = isGroup ? parameters.filter(p => p.methodId === item.testMethodId) : []
                  return (
                  <Fragment key={item.id}>
                  <tr style={{ borderBottom: isGroup && groupParams.length > 0 ? 'none' : '1px solid #f1f3f4', background: isGroup ? '#f0f9ff' : '#fff' }}>
                    {/* Order */}
                    <td style={{ padding: '8px 10px', width: 70 }}>
                      {!isLocked && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => moveUp(idx)} disabled={idx === 0}
                            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer', padding: '1px 5px', fontSize: 10, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                          <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 4, cursor: idx === items.length - 1 ? 'default' : 'pointer', padding: '1px 5px', fontSize: 10, opacity: idx === items.length - 1 ? 0.3 : 1 }}>▼</button>
                        </div>
                      )}
                      {isLocked && <span style={{ fontSize: 12, color: '#5f6368' }}>{idx + 1}</span>}
                    </td>
                    {/* Parameter / Method Group label */}
                    <td style={{ padding: '8px 10px' }}>
                      {item.parameterId != null ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{item.parameterName}</div>
                          <div style={{ fontSize: 11, color: '#5f6368' }}>{item.parameterCode}</div>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const m = testMethods.find(x => x.methodId === item.testMethodId)
                            return (
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#0369a1' }}>{m?.methodCode ?? 'GROUP'}</span>
                                {m?.methodName ?? 'Unknown Method'}
                              </div>
                            )
                          })()}
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>All params in this method — 1 execution</div>
                        </>
                      )}
                    </td>
                    {/* Test Method (only editable for per-param items; method-level items already have method set) */}
                    <td style={{ padding: '8px 10px', minWidth: 160 }}>
                      {item.parameterId == null ? (
                        // Method-level item: method is already the primary key — show method code read-only
                        <span style={{ fontSize: 11, background: '#e0f2fe', padding: '1px 8px', borderRadius: 4, fontWeight: 700, color: '#0369a1' }}>
                          {testMethods.find(m => m.methodId === item.testMethodId)?.methodCode ?? '—'}
                        </span>
                      ) : isLocked ? (
                        <span style={{ fontSize: 12, color: '#111111' }}>{item.testMethodId ? (testMethods.find(m => m.methodId === item.testMethodId)?.methodName ?? '—') : '—'}</span>
                      ) : (
                        <select style={{ ...inp, fontSize: 12, padding: '4px 8px' }}
                          value={item.testMethodId ?? ''}
                          onChange={e => updateItem(item.id, 'testMethodId', e.target.value ? parseInt(e.target.value) : null)}>
                          <option value="">None</option>
                          {testMethods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodName}</option>)}
                        </select>
                      )}
                    </td>
                    {/* TAT */}
                    <td style={{ padding: '8px 10px', width: 90 }}>
                      {isLocked ? (
                        <span style={{ fontSize: 13, color: '#111111' }}>{item.turnaroundHours}h</span>
                      ) : (
                        <input type="number" min={1} max={720}
                          style={{ ...inp, width: 70, fontSize: 12, padding: '4px 8px' }}
                          value={item.turnaroundHours}
                          onChange={e => updateItem(item.id, 'turnaroundHours', parseInt(e.target.value) || 24)} />
                      )}
                    </td>
                    {/* Mandatory */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {isLocked ? (
                        <span style={{ fontSize: 12, color: item.isMandatory ? '#15803d' : '#5f6368' }}>
                          {item.isMandatory ? '✓ Yes' : 'Optional'}
                        </span>
                      ) : (
                        <button
                          onClick={() => updateItem(item.id, 'isMandatory', !item.isMandatory)}
                          style={{
                            padding: '3px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                            background: item.isMandatory ? '#dcfce7' : '#f1f5f9',
                            color:      item.isMandatory ? '#15803d' : '#64748b',
                            transition: 'all 0.15s',
                          }}>
                          {item.isMandatory ? 'Mandatory' : 'Optional'}
                        </button>
                      )}
                    </td>
                    {/* Delete */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {!isLocked && (
                        <button onClick={() => removeItem(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: 2 }}>
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Child parameter rows for method groups */}
                  {isGroup && groupParams.map((p, pi) => (
                    <tr key={`gp_${p.parameterId}`} style={{ background: '#f8fbff', borderBottom: pi === groupParams.length - 1 ? '2px solid #bae6fd' : '1px solid #e0f2fe' }}>
                      <td style={{ padding: '5px 10px', width: 70 }} />
                      <td style={{ padding: '5px 10px 5px 28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#0369a1' }}>{p.parameterCode}</span>
                          <span style={{ fontSize: 12, color: '#374151' }}>{p.parameterName}</span>
                          {p.uom && <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.uom}</span>}
                        </div>
                      </td>
                      <td colSpan={4} style={{ padding: '5px 10px', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>included in group</td>
                    </tr>
                  ))}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderRadius: '0 0 14px 14px' }}>
          <div style={{ fontSize: 12, color: '#5f6368' }}>
            {items.length} test{items.length !== 1 ? 's' : ''}
            {items.length > 0 && ` · Max TAT: ${Math.max(...items.map(i => i.turnaroundHours))}h`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ padding: '8px 18px', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              {isLocked ? 'Close' : 'Cancel'}
            </button>
            {!isLocked && (
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '8px 22px', background: saving ? '#6b7280' : '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : `Save ${items.length} Test${items.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
