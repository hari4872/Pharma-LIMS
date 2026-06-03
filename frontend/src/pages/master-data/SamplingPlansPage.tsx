// ─────────────────────────────────────────────────────────────────────────────
// SamplingPlansPage.tsx — Phase B
//
// QA/Admin manages Sampling Plans that define how often and how many samples
// are collected for a given Material + SampleType + Stage combination.
// Plans can be linked to a SpecificationTemplate for automatic test assignment.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import api from '@/api/client'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/utils/errors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SamplingPlan {
  samplingPlanId:  number
  planName:        string
  stage:           string
  frequency:       string
  intervalHours:   number | null
  samplesPerPull:  number
  notes:           string | null
  isActive:        boolean
  createdBy:       string
  createdAt:       string
  updatedBy:       string | null
  updatedAt:       string | null
  material:        { materialId: number; materialName: string }
  sampleType:      { sampleTypeId: number; typeName: string; typeCode: string }
  specTemplate:    { specTemplateId: number; templateName: string } | null
}

interface Material      { materialId: number; materialName: string }
interface SampleType    { sampleTypeId: number; typeName: string; typeCode: string }
interface SpecTemplate  { specTemplateId: number; templateName: string; status: string }

const STAGES      = ['Incoming', 'InProcess', 'Finished', 'Stability']
const FREQUENCIES = ['Hourly', 'Shift', 'Daily', 'Weekly', 'Monthly', 'Batch', 'Event', 'Stability', 'Environmental']

const FREQ_LABEL: Record<string, string> = {
  Hourly:        'Every hour',
  Shift:         'Per shift',
  Daily:         'Daily',
  Weekly:        'Weekly',
  Monthly:       'Monthly',
  Batch:         'Per batch',
  Event:         'Event-triggered',
  Stability:     'Stability pull',
  Environmental: 'Environmental monitoring',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SamplingPlansPage() {
  const [data, setData]               = useState<SamplingPlan[]>([])
  const [materials, setMaterials]     = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [specTemplates, setSpecTemplates] = useState<SpecTemplate[]>([])
  const [loading, setLoading]         = useState(false)
  const [filterActive, setFilterActive] = useState<string>('true')
  const [filterStage, setFilterStage]   = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [editing, setEditing]         = useState<SamplingPlan | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Form state
  const [planName,       setPlanName]       = useState('')
  const [materialId,     setMaterialId]     = useState('')
  const [sampleTypeId,   setSampleTypeId]   = useState('')
  const [stage,          setStage]          = useState('')
  const [frequency,      setFrequency]      = useState('')
  const [intervalHours,  setIntervalHours]  = useState('')
  const [samplesPerPull, setSamplesPerPull] = useState('1')
  const [specTemplateId, setSpecTemplateId] = useState('')
  const [notes,          setNotes]          = useState('')

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStage)     params.set('stage',    filterStage)
      if (filterActive !== '') params.set('isActive', filterActive)
      const [r, mr, str, spr] = await Promise.all([
        api.get(`/sampling-plans?${params}`).catch(() => ({ data: [] })),
        api.get('/materials').catch(() => ({ data: [] })),
        api.get('/sample-types').catch(() => ({ data: [] })),
        api.get('/specification-templates?status=Approved').catch(() => ({ data: [] })),
      ])
      setData(r.data); setMaterials(mr.data); setSampleTypes(str.data); setSpecTemplates(spr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [filterStage, filterActive])  // load is stable: only reads filterStage/filterActive which are in deps

  // ── Reset form ──────────────────────────────────────────────────────────────
  function resetForm() {
    setPlanName(''); setMaterialId(''); setSampleTypeId(''); setStage('')
    setFrequency(''); setIntervalHours(''); setSamplesPerPull('1')
    setSpecTemplateId(''); setNotes(''); setError('')
  }

  function openEdit(p: SamplingPlan) {
    setEditing(p)
    setPlanName(p.planName)
    setMaterialId(String(p.material.materialId))
    setSampleTypeId(String(p.sampleType.sampleTypeId))
    setStage(p.stage)
    setFrequency(p.frequency)
    setIntervalHours(p.intervalHours ? String(p.intervalHours) : '')
    setSamplesPerPull(String(p.samplesPerPull))
    setSpecTemplateId(p.specTemplate ? String(p.specTemplate.specTemplateId) : '')
    setNotes(p.notes ?? '')
    setError('')
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!planName.trim() || !materialId || !sampleTypeId || !stage || !frequency) {
      setError('Plan name, material, sample type, stage and frequency are required.')
      return
    }
    setSaving(true); setError('')
    try {
      await api.post('/sampling-plans', {
        planName,
        materialId:    Number(materialId),
        sampleTypeId:  Number(sampleTypeId),
        stage,
        frequency,
        intervalHours: intervalHours ? Number(intervalHours) : null,
        samplesPerPull: Number(samplesPerPull) || 1,
        specTemplateId: specTemplateId ? Number(specTemplateId) : null,
        notes: notes || null,
      })
      toast('Sampling plan created', 'success')
      setShowCreate(false); resetForm(); load()
    } catch (err) {
      setError(getErrorMessage(err, 'Create failed'))
    } finally { setSaving(false) }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setError('')
    try {
      await api.put(`/sampling-plans/${editing.samplingPlanId}`, {
        planName:       planName || null,
        frequency:      frequency || null,
        intervalHours:  intervalHours ? Number(intervalHours) : null,
        samplesPerPull: Number(samplesPerPull) || 1,
        specTemplateId: specTemplateId ? Number(specTemplateId) : null,
        notes:          notes || null,
        isActive:       editing.isActive,
      })
      toast('Sampling plan updated', 'success')
      setEditing(null); resetForm(); load()
    } catch (err) {
      setError(getErrorMessage(err, 'Update failed'))
    } finally { setSaving(false) }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function toggleActive(p: SamplingPlan) {
    try {
      await api.put(`/sampling-plans/${p.samplingPlanId}`, {
        samplesPerPull: p.samplesPerPull,
        isActive: !p.isActive,
      })
      toast(p.isActive ? 'Plan deactivated' : 'Plan activated', 'success')
      load()
    } catch (err) {
      toast(getErrorMessage(err, 'Update failed'), 'error')
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    if (!window.confirm('Delete this sampling plan? This cannot be undone.')) return
    try {
      await api.delete(`/sampling-plans/${id}`)
      toast('Sampling plan deleted', 'success')
      load()
    } catch (err) {
      toast(getErrorMessage(err, 'Delete failed'), 'error')
    }
  }

  const needsInterval = ['Hourly', 'Shift', 'Daily', 'Weekly', 'Monthly'].includes(frequency)

  return (
    <ErrorBoundary label="Sampling Plans">
      <div>
        <PageHeader
          title="Sampling Plans"
          onAdd={() => { resetForm(); setShowCreate(true) }}
          addLabel="+ New Plan"
        />

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select style={{ ...inp, width: 160, margin: 0 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={{ ...inp, width: 160, margin: 0 }} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
            <option value="">All</option>
          </select>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
            <p style={{ margin: 0, fontSize: 14 }}>No sampling plans yet. Create the first one.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Plan Name', 'Material', 'Sample Type', 'Stage', 'Frequency', 'Per Pull', 'Spec Template', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => (
                  <tr key={p.samplingPlanId} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>
                      {p.planName}
                      {p.notes && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.notes.substring(0, 50)}{p.notes.length > 50 ? '…' : ''}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{p.material.materialName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 10 }}>
                        {p.sampleType.typeCode}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{p.stage}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: '#111827' }}>{FREQ_LABEL[p.frequency] ?? p.frequency}</div>
                      {p.intervalHours && <div style={{ fontSize: 11, color: '#9ca3af' }}>every {p.intervalHours}h</div>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{p.samplesPerPull}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: p.specTemplate ? '#0d6e6e' : '#9ca3af' }}>
                      {p.specTemplate ? p.specTemplate.templateName : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => toggleActive(p)}
                        style={{
                          padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          border: 'none', cursor: 'pointer',
                          background: p.isActive ? '#dcfce7' : '#f1f5f9',
                          color: p.isActive ? '#15803d' : '#64748b',
                        }}>
                        {p.isActive ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(p)}
                          style={{ padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p.samplingPlanId)}
                          style={{ padding: '3px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create Modal ──────────────────────────────────────────────── */}
        {showCreate && (
          <Modal title="New Sampling Plan" onClose={() => { setShowCreate(false); resetForm() }}>
            <form onSubmit={handleCreate}>
              <Field label="Plan Name *">
                <input style={inp} value={planName} onChange={e => setPlanName(e.target.value)} required placeholder="e.g. FP Routine Incoming — Weekly" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Material *">
                  <select style={inp} value={materialId} onChange={e => setMaterialId(e.target.value)} required>
                    <option value="">— Select —</option>
                    {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
                  </select>
                </Field>
                <Field label="Sample Type *">
                  <select style={inp} value={sampleTypeId} onChange={e => setSampleTypeId(e.target.value)} required>
                    <option value="">— Select —</option>
                    {sampleTypes.map(t => <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Stage *">
                  <select style={inp} value={stage} onChange={e => setStage(e.target.value)} required>
                    <option value="">— Select —</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Frequency *">
                  <select style={inp} value={frequency} onChange={e => setFrequency(e.target.value)} required>
                    <option value="">— Select —</option>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{FREQ_LABEL[f] ?? f}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {needsInterval && (
                  <Field label="Interval (hours)">
                    <input type="number" min={1} style={inp} value={intervalHours} onChange={e => setIntervalHours(e.target.value)} placeholder="e.g. 24" />
                  </Field>
                )}
                <Field label="Samples per Pull">
                  <input type="number" min={1} style={inp} value={samplesPerPull} onChange={e => setSamplesPerPull(e.target.value)} />
                </Field>
              </div>
              <Field label="Linked Spec Template (optional)">
                <select style={inp} value={specTemplateId} onChange={e => setSpecTemplateId(e.target.value)}>
                  <option value="">— None —</option>
                  {specTemplates.map(t => <option key={t.specTemplateId} value={t.specTemplateId}>{t.templateName}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea style={{ ...inp, height: 68, resize: 'vertical' as const }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes or SOPs reference" />
              </Field>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <ModalFooter saving={saving} onCancel={() => { setShowCreate(false); resetForm() }} label="Create Plan" />
            </form>
          </Modal>
        )}

        {/* ── Edit Modal ────────────────────────────────────────────────── */}
        {editing && (
          <Modal title={`Edit: ${editing.planName}`} onClose={() => { setEditing(null); resetForm() }}>
            <form onSubmit={handleUpdate}>
              <Field label="Plan Name *">
                <input style={inp} value={planName} onChange={e => setPlanName(e.target.value)} required />
              </Field>
              <div style={{ padding: '8px 12px', background: '#f0f4f8', borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#374151' }}>
                <strong>Material:</strong> {editing.material.materialName} &nbsp;|&nbsp;
                <strong>Type:</strong> {editing.sampleType.typeName} &nbsp;|&nbsp;
                <strong>Stage:</strong> {editing.stage}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Frequency *">
                  <select style={inp} value={frequency} onChange={e => setFrequency(e.target.value)} required>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{FREQ_LABEL[f] ?? f}</option>)}
                  </select>
                </Field>
                {needsInterval && (
                  <Field label="Interval (hours)">
                    <input type="number" min={1} style={inp} value={intervalHours} onChange={e => setIntervalHours(e.target.value)} />
                  </Field>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Samples per Pull">
                  <input type="number" min={1} style={inp} value={samplesPerPull} onChange={e => setSamplesPerPull(e.target.value)} />
                </Field>
                <Field label="Linked Spec Template">
                  <select style={inp} value={specTemplateId} onChange={e => setSpecTemplateId(e.target.value)}>
                    <option value="">— None —</option>
                    {specTemplates.map(t => <option key={t.specTemplateId} value={t.specTemplateId}>{t.templateName}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes">
                <textarea style={{ ...inp, height: 68, resize: 'vertical' as const }} value={notes} onChange={e => setNotes(e.target.value)} />
              </Field>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <ModalFooter saving={saving} onCancel={() => { setEditing(null); resetForm() }} label="Save Changes" />
            </form>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  )
}
