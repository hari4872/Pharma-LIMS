import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { toast } from '@/components/Toast'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface Material   { materialId: number; materialName: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkflowStep {
  workflowStepId: number
  workflowTemplateId: number
  stepOrder: number
  stepName: string
  requiredRole: string
  requiresESignature: boolean
  minTestsRequired: number | null
  gateCondition: string | null
  isOptional: boolean
  notes: string | null
}

interface WorkflowTemplate {
  workflowTemplateId: number
  name: string
  description: string | null
  materialId: number | null
  materialName: string | null
  sampleTypeId: number | null
  sampleTypeName: string | null
  isDefault: boolean
  isActive: boolean
  createdBy: string
  createdAt: string
  steps: WorkflowStep[]
}

const ROLES    = ['Analyst', 'QCLead', 'LabManager', 'QA', 'Admin']

// ── Step 1: Full gate list ────────────────────────────────────────────────────
const GATES = [
  '', 'AllTestsComplete', 'NoOpenOOS', 'LogbookSigned', 'CoAApproved',
  'SRFSigned', 'FormTemplateFilled', 'CheckpointsSigned', 'SpecAssigned',
]
const GATE_LABEL: Record<string, string> = {
  AllTestsComplete:   'All Tests Complete',
  NoOpenOOS:          'No Open OOS',
  LogbookSigned:      'Logbook Signed',
  CoAApproved:        'CoA Approved',
  SRFSigned:          'SRF Signed',
  FormTemplateFilled: 'Form Template Filled',
  CheckpointsSigned:  'Checkpoints Signed Today',
  SpecAssigned:       'Spec Template Assigned',
}
export const GATE_HELP: Record<string, string> = {
  AllTestsComplete:   'Complete all test executions in Work Queue',
  NoOpenOOS:          'Close open OOS investigations in QA → OOS Investigations',
  LogbookSigned:      'Sign all logbook entries in Digital Logbook',
  CoAApproved:        'Approve the CoA in Release → CoA Review',
  SRFSigned:          'Sign the SRF in Sample Registration',
  FormTemplateFilled: 'Fill the monitoring form in Work Queue → Test Execution',
  CheckpointsSigned:  'Sign pending checkpoint slots in Digital Logbook → Process Log',
  SpecAssigned:       'Assign a spec template via 📋 Plan in Sample Registration',
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  Analyst:    { bg: '#dbeafe', color: '#1d4ed8' },
  QCLead:     { bg: '#e0f2fe', color: '#0369a1' },
  LabManager: { bg: '#fef3c7', color: '#92400e' },
  QA:         { bg: '#ede9fe', color: '#7c3aed' },
  Admin:      { bg: '#fee2e2', color: '#b91c1c' },
}

// ── Empty step form ───────────────────────────────────────────────────────────
const emptyStep = () => ({
  stepOrder: 1, stepName: '', requiredRole: 'Analyst', requiresESignature: false,
  minTestsRequired: '' as string | number, gateCondition: '', isOptional: false, notes: ''
})

const emptyTemplate = () => ({
  name: '', description: '', materialId: '' as string | number,
  sampleTypeId: '' as string | number, isDefault: false, isActive: true
})

export default function WorkflowConfigPage() {
  const [templates, setTemplates]       = useState<WorkflowTemplate[]>([])
  const [selected, setSelected]         = useState<WorkflowTemplate | null>(null)
  const [loading, setLoading]           = useState(false)
  const [materials,    setMaterials]    = useState<Material[]>([])
  const [sampleTypes,  setSampleTypes]  = useState<SampleType[]>([])

  // Inline confirm state
  const [confirmMsg,  setConfirmMsg]   = useState('')
  const [confirmFn,   setConfirmFn]    = useState<(() => void) | null>(null)

  function askConfirm(msg: string, fn: () => void) {
    setConfirmMsg(msg); setConfirmFn(() => fn)
  }

  // Step 2: view toggle + reorder
  const [flowView, setFlowView] = useState(false)

  // Template modal state
  const [showTplModal, setShowTplModal] = useState(false)
  const [editTpl, setEditTpl]           = useState<WorkflowTemplate | null>(null)
  const [tplForm, setTplForm]           = useState(emptyTemplate())
  const [tplSaving, setTplSaving]       = useState(false)
  const [tplError, setTplError]         = useState('')

  // Step modal state
  const [showStepModal, setShowStepModal] = useState(false)
  const [editStep, setEditStep]           = useState<WorkflowStep | null>(null)
  const [stepForm, setStepForm]           = useState(emptyStep())
  const [stepSaving, setStepSaving]       = useState(false)
  const [stepError, setStepError]         = useState('')

  async function load() {
    setLoading(true)
    try {
      const [r, mr, str] = await Promise.all([
        api.get('/workflow-templates'),
        api.get('/materials').catch(() => ({ data: [] })),
        api.get('/sample-types').catch(() => ({ data: [] })),
      ])
      setTemplates(r.data)
      setMaterials(mr.data)
      setSampleTypes(str.data)
      if (selected) {
        const fresh = r.data.find((t: WorkflowTemplate) => t.workflowTemplateId === selected.workflowTemplateId)
        setSelected(fresh ?? null)
      }
    } catch { toast('Failed to load workflow templates', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function selectTemplate(t: WorkflowTemplate) {
    try {
      const r = await api.get(`/workflow-templates/${t.workflowTemplateId}`)
      setSelected(r.data)
    } catch { setSelected(t) }
  }

  // ── Template CRUD ────────────────────────────────────────────────────────
  function openNewTpl() {
    setEditTpl(null); setTplForm(emptyTemplate()); setTplError(''); setShowTplModal(true)
  }
  function openEditTpl(t: WorkflowTemplate) {
    setEditTpl(t)
    setTplForm({
      name: t.name, description: t.description ?? '',
      materialId: t.materialId ?? '', sampleTypeId: t.sampleTypeId ?? '',
      isDefault: t.isDefault, isActive: t.isActive
    })
    setTplError(''); setShowTplModal(true)
  }

  async function saveTpl(e: React.FormEvent) {
    e.preventDefault()
    if (!tplForm.name.trim()) { setTplError('Name is required'); return }
    setTplSaving(true); setTplError('')
    const body = {
      name: tplForm.name.trim(),
      description: tplForm.description || null,
      materialId: tplForm.materialId !== '' ? Number(tplForm.materialId) : null,
      sampleTypeId: tplForm.sampleTypeId !== '' ? Number(tplForm.sampleTypeId) : null,
      isDefault: tplForm.isDefault,
      isActive: tplForm.isActive,
    }
    try {
      if (editTpl) {
        await api.put(`/workflow-templates/${editTpl.workflowTemplateId}`, body)
        toast('Workflow template updated', 'success')
      } else {
        await api.post('/workflow-templates', body)
        toast('Workflow template created', 'success')
      }
      setShowTplModal(false); load()
    } catch (err) { setTplError(getErrorMessage(err, 'Save failed')) }
    finally { setTplSaving(false) }
  }

  async function deleteTpl(t: WorkflowTemplate) {
    askConfirm(`Delete "${t.name}"? All steps will also be removed.`, async () => {
      try {
        await api.delete(`/workflow-templates/${t.workflowTemplateId}`)
        toast('Template deleted', 'success')
        if (selected?.workflowTemplateId === t.workflowTemplateId) setSelected(null)
        load()
      } catch (err) { toast(getErrorMessage(err, 'Delete failed'), 'error') }
    })
  }

  // ── Step CRUD ────────────────────────────────────────────────────────────
  function openNewStep() {
    const nextOrder = (selected?.steps.length ?? 0) + 1
    setEditStep(null); setStepForm({ ...emptyStep(), stepOrder: nextOrder })
    setStepError(''); setShowStepModal(true)
  }
  function openEditStep(s: WorkflowStep) {
    setEditStep(s)
    setStepForm({
      stepOrder: s.stepOrder, stepName: s.stepName, requiredRole: s.requiredRole,
      requiresESignature: s.requiresESignature, minTestsRequired: s.minTestsRequired ?? '',
      gateCondition: s.gateCondition ?? '', isOptional: s.isOptional, notes: s.notes ?? ''
    })
    setStepError(''); setShowStepModal(true)
  }

  async function saveStep(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!stepForm.stepName.trim()) { setStepError('Step name is required'); return }
    setStepSaving(true); setStepError('')
    const body = {
      stepOrder: Number(stepForm.stepOrder),
      stepName: stepForm.stepName.trim(),
      requiredRole: stepForm.requiredRole,
      requiresESignature: stepForm.requiresESignature,
      minTestsRequired: stepForm.minTestsRequired !== '' ? Number(stepForm.minTestsRequired) : null,
      gateCondition: stepForm.gateCondition || null,
      isOptional: stepForm.isOptional,
      notes: stepForm.notes || null,
    }
    try {
      if (editStep) {
        await api.put(`/workflow-templates/${selected.workflowTemplateId}/steps/${editStep.workflowStepId}`, body)
        toast('Step updated', 'success')
      } else {
        await api.post(`/workflow-templates/${selected.workflowTemplateId}/steps`, body)
        toast('Step added', 'success')
      }
      setShowStepModal(false)
      // Refresh selected
      const r = await api.get(`/workflow-templates/${selected.workflowTemplateId}`)
      setSelected(r.data)
    } catch (err) { setStepError(getErrorMessage(err, 'Save failed')) }
    finally { setStepSaving(false) }
  }

  async function deleteStep(s: WorkflowStep) {
    if (!selected) return
    askConfirm(`Delete step "${s.stepName}"?`, async () => {
      try {
        await api.delete(`/workflow-templates/${selected.workflowTemplateId}/steps/${s.workflowStepId}`)
        toast('Step deleted', 'success')
        const r = await api.get(`/workflow-templates/${selected.workflowTemplateId}`)
        setSelected(r.data)
      } catch (err) { toast(getErrorMessage(err, 'Delete failed'), 'error') }
    })
  }

  // ── Step 2: Reorder steps ────────────────────────────────────────────────
  async function reorderStep(s: WorkflowStep, direction: 'up' | 'down') {
    if (!selected) return
    const sorted = [...selected.steps].sort((a, b) => a.stepOrder - b.stepOrder)
    const idx = sorted.findIndex(x => x.workflowStepId === s.workflowStepId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    try {
      await Promise.all([
        api.put(`/workflow-templates/${selected.workflowTemplateId}/steps/${s.workflowStepId}`,     { ...s, stepOrder: other.stepOrder }),
        api.put(`/workflow-templates/${selected.workflowTemplateId}/steps/${other.workflowStepId}`, { ...other, stepOrder: s.stepOrder }),
      ])
      const r = await api.get(`/workflow-templates/${selected.workflowTemplateId}`)
      setSelected(r.data)
    } catch { toast('Reorder failed', 'error') }
  }

  const scopeLabel = (t: WorkflowTemplate) => {
    if (t.materialName && t.sampleTypeName) return `${t.materialName} → ${t.sampleTypeName}`
    if (t.materialName) return `${t.materialName} → Any Type`
    if (t.sampleTypeName) return `Any Material → ${t.sampleTypeName}`
    return 'All Samples (Global)'
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Configurable Workflow Engine</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Define step-by-step quality workflows per material/sample type · Gate conditions enforce 21 CFR compliance
          </p>
        </div>
        <button onClick={openNewTpl}
          style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          + New Template
        </button>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Left: Template list */}
        <div style={{ width: 320, flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading…</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              No workflow templates yet. Click "+ New Template" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => (
                <div key={t.workflowTemplateId}
                  onClick={() => selectTemplate(t)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${selected?.workflowTemplateId === t.workflowTemplateId ? '#0d6e6e' : '#e5e7eb'}`,
                    background: selected?.workflowTemplateId === t.workflowTemplateId ? '#f0fdfa' : '#fff',
                    transition: 'all 0.12s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', flex: 1 }}>{t.name}</span>
                    {t.isDefault && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8' }}>DEFAULT</span>
                    )}
                    {!t.isActive && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>INACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{scopeLabel(t)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '1px 8px', background: '#f0fdfa', color: '#0d6e6e', borderRadius: 8, border: '1px solid #99f6e4' }}>
                      {t.steps?.length ?? 0} steps
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); openEditTpl(t) }}
                        style={{ padding: '2px 8px', fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', color: '#374151' }}>
                        Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteTpl(t) }}
                        style={{ padding: '2px 8px', fontSize: 11, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', color: '#dc2626' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Step details */}
        <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>
              ← Select a workflow template to view and edit its steps
            </div>
          ) : (
            <div>
              {/* Steps header with view toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Steps: {selected.name}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>{scopeLabel(selected)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Step 5: View toggle */}
                  <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 7, overflow: 'hidden' }}>
                    <button onClick={() => setFlowView(false)}
                      style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: !flowView ? '#0d9488' : '#fff', color: !flowView ? '#fff' : '#6b7280', fontFamily: 'inherit' }}>
                      ☰ List
                    </button>
                    <button onClick={() => setFlowView(true)}
                      style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: flowView ? '#0d9488' : '#fff', color: flowView ? '#fff' : '#6b7280', fontFamily: 'inherit' }}>
                      ⟶ Flow
                    </button>
                  </div>
                  <button onClick={openNewStep}
                    style={{ padding: '6px 14px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    + Add Step
                  </button>
                </div>
              </div>

              {selected.steps.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                  No steps yet. Click "+ Add Step" to build the workflow.
                </div>
              ) : flowView ? (

                /* ── Step 5: Visual flow view ─────────────────────────── */
                <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content' }}>
                    {[...selected.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((s, idx, arr) => {
                      const rc = ROLE_COLOR[s.requiredRole] ?? { bg: '#f3f4f6', color: '#374151' }
                      return (
                        <div key={s.workflowStepId} style={{ display: 'flex', alignItems: 'center' }}>
                          {/* Step box */}
                          <div style={{ width: 160, border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                            {/* Step number + role */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d6e6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                {s.stepOrder}
                              </div>
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: rc.bg, color: rc.color, fontWeight: 700 }}>{s.requiredRole}</span>
                            </div>
                            {/* Step name */}
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>{s.stepName}</div>
                            {/* Gate */}
                            {s.gateCondition && (
                              <div style={{ marginBottom: 4 }}>
                                <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-block' }}>
                                  🔒 {GATE_LABEL[s.gateCondition] ?? s.gateCondition}
                                </div>
                                {GATE_HELP[s.gateCondition] && (
                                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, fontStyle: 'italic' }}>
                                    {GATE_HELP[s.gateCondition]}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* E-sign */}
                            {s.requiresESignature && (
                              <div style={{ fontSize: 10, color: '#854d0e', fontWeight: 600 }}>🔏 E-Sign required</div>
                            )}
                            {/* Edit/Del */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                              <button onClick={() => openEditStep(s)} style={{ flex: 1, padding: '3px 0', fontSize: 10, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', color: '#374151' }}>Edit</button>
                              <button onClick={() => deleteStep(s)} style={{ flex: 1, padding: '3px 0', fontSize: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', color: '#dc2626' }}>Del</button>
                            </div>
                          </div>
                          {/* Arrow connector */}
                          {idx < arr.length - 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: '#94a3b8', fontSize: 20, fontWeight: 300 }}>→</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

              ) : (

                /* ── List view with ▲▼ reorder ────────────────────────── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...selected.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((s, idx, arr) => {
                    const rc = ROLE_COLOR[s.requiredRole] ?? { bg: '#f3f4f6', color: '#374151' }
                    return (
                      <div key={s.workflowStepId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {/* Step 2: ▲▼ reorder buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                          <button onClick={() => reorderStep(s, 'up')} disabled={idx === 0}
                            style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0', background: idx === 0 ? '#f8fafc' : '#fff', color: idx === 0 ? '#d1d5db' : '#374151', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
                          <button onClick={() => reorderStep(s, 'down')} disabled={idx === arr.length - 1}
                            style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0', background: idx === arr.length - 1 ? '#f8fafc' : '#fff', color: idx === arr.length - 1 ? '#d1d5db' : '#374151', cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
                        </div>
                        {/* Step number circle */}
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0d6e6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {s.stepOrder}
                        </div>
                        {/* Step card */}
                        <div style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.stepName}</span>
                            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: rc.bg, color: rc.color, fontWeight: 600 }}>{s.requiredRole}</span>
                            {s.requiresESignature && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: '#fef9c3', color: '#854d0e', fontWeight: 600 }}>🔏 E-Sign</span>}
                            {s.isOptional && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>optional</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                            {s.gateCondition && (
                              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 6, background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                🔒 Gate: {GATE_LABEL[s.gateCondition] ?? s.gateCondition}
                              </span>
                            )}
                            {s.minTestsRequired != null && (
                              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 6, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                Min {s.minTestsRequired} test(s)
                              </span>
                            )}
                            {s.notes && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>{s.notes}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
                          <button onClick={() => openEditStep(s)} style={{ padding: '3px 8px', fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', color: '#374151' }}>Edit</button>
                          <button onClick={() => deleteStep(s)} style={{ padding: '3px 8px', fontSize: 11, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', color: '#dc2626' }}>Del</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Template Modal ───────────────────────────────────────────────────── */}
      {showTplModal && (
        <Drawer title={editTpl ? 'Edit Workflow Template' : 'New Workflow Template'} subtitle="Define matching rules — material, sample type, default priority." width={540} onClose={() => setShowTplModal(false)}>
          <form onSubmit={saveTpl}>
            <Field label="Template Name *">
              <input style={inp} value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Standard Release Workflow" />
            </Field>
            <Field label="Description">
              <input style={inp} value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Material (optional)">
                <select style={inp} value={tplForm.materialId} onChange={e => setTplForm(f => ({ ...f, materialId: e.target.value }))}>
                  <option value="">All Materials</option>
                  {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
                </select>
              </Field>
              <Field label="Sample Type (optional)">
                <select style={inp} value={tplForm.sampleTypeId} onChange={e => setTplForm(f => ({ ...f, sampleTypeId: e.target.value }))}>
                  <option value="">All Sample Types</option>
                  {sampleTypes.map(s => <option key={s.sampleTypeId} value={s.sampleTypeId}>{s.typeName} ({s.typeCode})</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={tplForm.isDefault} onChange={e => setTplForm(f => ({ ...f, isDefault: e.target.checked }))} style={{ accentColor: '#0d6e6e' }} />
                Set as Default
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={tplForm.isActive} onChange={e => setTplForm(f => ({ ...f, isActive: e.target.checked }))} style={{ accentColor: '#0d6e6e' }} />
                Active
              </label>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>
              Matching priority: Material + SampleType → Material only → SampleType only → Default (global)
            </p>
            {tplError && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{tplError}</p>}
            <DrawerFooter saving={tplSaving} onCancel={() => setShowTplModal(false)} label={editTpl ? 'Save Changes' : 'Create Template'} />
          </form>
        </Drawer>
      )}

      {/* ── Inline Confirm Modal ─────────────────────────────────────────────── */}
      {confirmFn && (
        <Drawer title="Confirm Delete" subtitle="This action cannot be undone." width={400} onClose={() => { setConfirmFn(null); setConfirmMsg('') }}>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>{confirmMsg}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setConfirmFn(null); setConfirmMsg('') }}
              style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={() => { confirmFn(); setConfirmFn(null); setConfirmMsg('') }}
              style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              Delete
            </button>
          </div>
        </Drawer>
      )}

      {/* ── Step Modal ───────────────────────────────────────────────────────── */}
      {showStepModal && (
        <Drawer title={editStep ? 'Edit Step' : 'Add Workflow Step'} subtitle="Define order, assignee role, and time limit for this step." width={540} onClose={() => setShowStepModal(false)}>
          <form onSubmit={saveStep}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 12, marginBottom: 12 }}>
              <Field label="Order *">
                <input style={inp} type="number" min={1} value={stepForm.stepOrder}
                  onChange={e => setStepForm(f => ({ ...f, stepOrder: parseInt(e.target.value) || 1 }))} required />
              </Field>
              <Field label="Step Name *">
                <input style={inp} value={stepForm.stepName}
                  onChange={e => setStepForm(f => ({ ...f, stepName: e.target.value }))} required placeholder="e.g. Analyst Signs Logbook" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Required Role">
                <select style={inp} value={stepForm.requiredRole} onChange={e => setStepForm(f => ({ ...f, requiredRole: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Gate Condition">
                <select style={inp} value={stepForm.gateCondition} onChange={e => setStepForm(f => ({ ...f, gateCondition: e.target.value }))}>
                  {GATES.map(g => <option key={g} value={g}>{g ? GATE_LABEL[g] : '— None —'}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Min Tests Required (optional)">
              <input style={inp} type="number" min={0} value={stepForm.minTestsRequired}
                onChange={e => setStepForm(f => ({ ...f, minTestsRequired: e.target.value }))} placeholder="Leave blank = no minimum" />
            </Field>
            <Field label="Notes">
              <textarea style={{ ...inp, height: 60, resize: 'vertical' }} value={stepForm.notes}
                onChange={e => setStepForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional step notes" />
            </Field>
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={stepForm.requiresESignature}
                  onChange={e => setStepForm(f => ({ ...f, requiresESignature: e.target.checked }))} style={{ accentColor: '#0d6e6e' }} />
                Requires E-Signature
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={stepForm.isOptional}
                  onChange={e => setStepForm(f => ({ ...f, isOptional: e.target.checked }))} style={{ accentColor: '#0d6e6e' }} />
                Optional Step
              </label>
            </div>
            {stepError && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{stepError}</p>}
            <DrawerFooter saving={stepSaving} onCancel={() => setShowStepModal(false)} label={editStep ? 'Save Step' : 'Add Step'} />
          </form>
        </Drawer>
      )}
    </div>
  )
}
