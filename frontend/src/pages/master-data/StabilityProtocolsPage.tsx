// ─────────────────────────────────────────────────────────────────────────────
// StabilityProtocolsPage.tsx — Phase B
//
// QA/Admin manages Stability Protocols that define study design (duration,
// storage conditions, time-points) for a material under stability testing.
// Each protocol has a set of intervals (T=0, T=3M, T=6M, etc.)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import api from '@/api/client'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/utils/errors'
import { Drawer, DrawerFooter } from '@/components/Drawer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StabilityInterval {
  stabilityIntervalId:  number
  monthOffset:          number
  label:                string
  sampleUnitsRequired:  number
  toleranceDays:        number | null
  isMandatory:          boolean
}

interface StabilityProtocol {
  stabilityProtocolId:  number
  protocolName:         string
  storageCondition:     string
  regulatoryBasis:      string | null
  studyDurationMonths:  number
  targetTempC:          number | null
  targetRhPct:          number | null
  description:          string | null
  isActive:             boolean
  createdBy:            string
  createdAt:            string
  updatedBy:            string | null
  updatedAt:            string | null
  material:             { materialId: number; materialName: string }
  specTemplate:         { specTemplateId: number; templateName: string } | null
  intervalCount:        number
  intervals:            StabilityInterval[]
}

interface Material     { materialId: number; materialName: string }
interface SpecTemplate { specTemplateId: number; templateName: string; status: string }

const STORAGE_CONDITIONS = ['Accelerated', 'LongTerm', 'Intermediate', 'Refrigerated']

const CONDITION_STYLE: Record<string, { bg: string; color: string }> = {
  Accelerated:   { bg: '#fef3c7', color: '#92400e' },
  LongTerm:      { bg: '#dbeafe', color: '#1e40af' },
  Intermediate:  { bg: '#ede9fe', color: '#6d28d9' },
  Refrigerated:  { bg: '#d1fae5', color: '#065f46' },
}

const CONDITION_LABEL: Record<string, string> = {
  Accelerated:  '40°C / 75% RH',
  LongTerm:     '25°C / 60% RH',
  Intermediate: '30°C / 65% RH',
  Refrigerated: '5°C ± 3°C',
}

// ── Interval designer row ────────────────────────────────────────────────────
interface IntervalRowDraft {
  id: string  // temp key for React
  monthOffset:         number | string
  label:               string
  sampleUnitsRequired: number | string
  toleranceDays:       number | string
  isMandatory:         boolean
}

function newRow(): IntervalRowDraft {
  return { id: String(Date.now() + Math.random()), monthOffset: '', label: '', sampleUnitsRequired: 1, toleranceDays: '', isMandatory: true }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StabilityProtocolsPage() {
  const [data, setData]               = useState<StabilityProtocol[]>([])
  const [materials, setMaterials]     = useState<Material[]>([])
  const [specTemplates, setSpecTemplates] = useState<SpecTemplate[]>([])
  const [loading, setLoading]         = useState(false)
  const [filterActive, setFilterActive] = useState('true')
  const [showCreate, setShowCreate]   = useState(false)
  const [editing, setEditing]         = useState<StabilityProtocol | null>(null)
  const [intervalsFor, setIntervalsFor] = useState<StabilityProtocol | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Protocol form state
  const [protocolName,       setProtocolName]        = useState('')
  const [materialId,         setMaterialId]          = useState('')
  const [storageCondition,   setStorageCondition]    = useState('')
  const [regulatoryBasis,    setRegulatoryBasis]     = useState('')
  const [studyDurationMonths, setStudyDurationMonths] = useState('24')
  const [targetTempC,        setTargetTempC]         = useState('')
  const [targetRhPct,        setTargetRhPct]         = useState('')
  const [specTemplateId,     setSpecTemplateId]      = useState('')
  const [description,        setDescription]         = useState('')

  // Intervals designer state
  const [intervalRows, setIntervalRows] = useState<IntervalRowDraft[]>([newRow()])

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const params = filterActive !== '' ? `?isActive=${filterActive}` : ''
      const [r, mr, spr] = await Promise.all([
        api.get(`/stability-protocols${params}`).catch(() => ({ data: [] })),
        api.get('/materials').catch(() => ({ data: [] })),
        api.get('/specification-templates?status=Approved').catch(() => ({ data: [] })),
      ])
      setData(r.data)
      setMaterials(mr.data)
      setSpecTemplates(spr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [filterActive])

  function resetForm() {
    setProtocolName(''); setMaterialId(''); setStorageCondition('')
    setRegulatoryBasis(''); setStudyDurationMonths('24')
    setTargetTempC(''); setTargetRhPct(''); setSpecTemplateId('')
    setDescription(''); setError('')
  }

  function openEdit(p: StabilityProtocol) {
    setEditing(p)
    setProtocolName(p.protocolName)
    setMaterialId(String(p.material.materialId))
    setStorageCondition(p.storageCondition)
    setRegulatoryBasis(p.regulatoryBasis ?? '')
    setStudyDurationMonths(String(p.studyDurationMonths))
    setTargetTempC(p.targetTempC != null ? String(p.targetTempC) : '')
    setTargetRhPct(p.targetRhPct != null ? String(p.targetRhPct) : '')
    setSpecTemplateId(p.specTemplate ? String(p.specTemplate.specTemplateId) : '')
    setDescription(p.description ?? '')
    setError('')
  }

  function openIntervalDesigner(p: StabilityProtocol) {
    setIntervalsFor(p)
    setIntervalRows(p.intervals.length > 0
      ? p.intervals.map(i => ({
          id: String(i.stabilityIntervalId),
          monthOffset: i.monthOffset,
          label: i.label,
          sampleUnitsRequired: i.sampleUnitsRequired,
          toleranceDays: i.toleranceDays ?? '',
          isMandatory: i.isMandatory,
        }))
      : [newRow()])
    setError('')
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!protocolName.trim() || !materialId || !storageCondition) {
      setError('Protocol name, material, and storage condition are required.')
      return
    }
    setSaving(true); setError('')
    try {
      await api.post('/stability-protocols', {
        protocolName,
        materialId:          Number(materialId),
        regulatoryBasis:     regulatoryBasis || null,
        studyDurationMonths: Number(studyDurationMonths) || 24,
        storageCondition,
        targetTempC:         targetTempC ? Number(targetTempC) : null,
        targetRhPct:         targetRhPct ? Number(targetRhPct) : null,
        specTemplateId:      specTemplateId ? Number(specTemplateId) : null,
        description:         description || null,
      })
      toast('Stability protocol created', 'success')
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
      await api.put(`/stability-protocols/${editing.stabilityProtocolId}`, {
        protocolName:        protocolName || null,
        regulatoryBasis:     regulatoryBasis || null,
        studyDurationMonths: Number(studyDurationMonths) || null,
        targetTempC:         targetTempC ? Number(targetTempC) : null,
        targetRhPct:         targetRhPct ? Number(targetRhPct) : null,
        specTemplateId:      specTemplateId ? Number(specTemplateId) : null,
        description:         description || null,
        isActive:            editing.isActive,
      })
      toast('Protocol updated', 'success')
      setEditing(null); resetForm(); load()
    } catch (err) {
      setError(getErrorMessage(err, 'Update failed'))
    } finally { setSaving(false) }
  }

  // ── Save intervals ───────────────────────────────────────────────────────────
  async function handleSaveIntervals(e: React.FormEvent) {
    e.preventDefault()
    if (!intervalsFor) return

    // Validate rows
    const validRows = intervalRows.filter(r => r.monthOffset !== '' && r.label.trim())
    if (validRows.length === 0) { setError('Add at least one interval.'); return }

    setSaving(true); setError('')
    try {
      await api.put(`/stability-protocols/${intervalsFor.stabilityProtocolId}/intervals`,
        validRows.map(r => ({
          monthOffset:         Number(r.monthOffset),
          label:               r.label,
          sampleUnitsRequired: Number(r.sampleUnitsRequired) || 1,
          toleranceDays:       r.toleranceDays !== '' ? Number(r.toleranceDays) : null,
          isMandatory:         r.isMandatory,
        }))
      )
      toast(`${validRows.length} intervals saved`, 'success')
      setIntervalsFor(null); load()
    } catch (err) {
      setError(getErrorMessage(err, 'Save intervals failed'))
    } finally { setSaving(false) }
  }

  function updateRow(id: string, field: keyof IntervalRowDraft, value: unknown) {
    setIntervalRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeRow(id: string) {
    setIntervalRows(rows => rows.filter(r => r.id !== id))
  }

  function addPreset() {
    // Add common ICH Q1A presets
    const presets: Array<{ monthOffset: number; label: string }> = [
      { monthOffset: 0,  label: 'T=0 (Initial)' },
      { monthOffset: 3,  label: '3-Month' },
      { monthOffset: 6,  label: '6-Month' },
      { monthOffset: 9,  label: '9-Month' },
      { monthOffset: 12, label: '12-Month' },
      { monthOffset: 18, label: '18-Month' },
      { monthOffset: 24, label: '24-Month' },
    ]
    const existingOffsets = intervalRows.map(r => Number(r.monthOffset))
    const toAdd = presets.filter(p => !existingOffsets.includes(p.monthOffset))
    if (toAdd.length === 0) { toast('All ICH Q1A time-points already added', 'success'); return }
    setIntervalRows(rows => [
      ...rows.filter(r => r.monthOffset !== ''),
      ...toAdd.map(p => ({ ...newRow(), monthOffset: p.monthOffset, label: p.label })),
    ].sort((a, b) => Number(a.monthOffset) - Number(b.monthOffset)))
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function toggleActive(p: StabilityProtocol) {
    try {
      await api.put(`/stability-protocols/${p.stabilityProtocolId}`, { isActive: !p.isActive })
      toast(p.isActive ? 'Protocol deactivated' : 'Protocol activated', 'success')
      load()
    } catch (err) {
      toast(getErrorMessage(err, 'Update failed'), 'error')
    }
  }

  return (
    <ErrorBoundary label="Stability Protocols">
      <div>
        <PageHeader
          title="Stability Protocols"
          onAdd={() => { resetForm(); setShowCreate(true) }}
          addLabel="+ New Protocol"
        />

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select style={{ ...inp, width: 180, margin: 0 }} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <option value="true">Active protocols</option>
            <option value="false">Inactive protocols</option>
            <option value="">All protocols</option>
          </select>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧪</div>
            <p style={{ margin: 0, fontSize: 14 }}>No stability protocols yet. Create the first one.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Protocol Name', 'Material', 'Storage Condition', 'Duration', 'Target Conditions', 'Spec Template', 'Intervals', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((p, i) => {
                  const cs = CONDITION_STYLE[p.storageCondition] ?? { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <tr key={p.stabilityProtocolId} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>
                        {p.protocolName}
                        {p.regulatoryBasis && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.regulatoryBasis}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{p.material.materialName}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.color }}>
                          {p.storageCondition}
                        </span>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{CONDITION_LABEL[p.storageCondition] ?? ''}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{p.studyDurationMonths}M</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>
                        {p.targetTempC != null ? `${p.targetTempC}°C` : '—'}
                        {p.targetRhPct != null ? ` / ${p.targetRhPct}% RH` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: p.specTemplate ? '#0d6e6e' : '#9ca3af' }}>
                        {p.specTemplate ? p.specTemplate.templateName : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => openIntervalDesigner(p)}
                          style={{
                            padding: '3px 10px', background: p.intervalCount > 0 ? '#f0fdf4' : '#fffbeb',
                            color: p.intervalCount > 0 ? '#15803d' : '#92400e',
                            border: `1px solid ${p.intervalCount > 0 ? '#bbf7d0' : '#fde68a'}`,
                            borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          }}>
                          {p.intervalCount} time-point{p.intervalCount !== 1 ? 's' : ''}
                        </button>
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
                        <button onClick={() => openEdit(p)}
                          style={{ padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create Modal ──────────────────────────────────────────────── */}
        {showCreate && (
          <Drawer title="New Stability Protocol" subtitle="Set up a stability study with storage conditions and duration" onClose={() => { setShowCreate(false); resetForm() }} width={540}>
            <form onSubmit={handleCreate}>
              <Field label="Protocol Name *">
                <input style={inp} value={protocolName} onChange={e => setProtocolName(e.target.value)} required placeholder="e.g. Paracetamol 500mg — Long-Term 25°C" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Material *">
                  <select style={inp} value={materialId} onChange={e => setMaterialId(e.target.value)} required>
                    <option value="">— Select —</option>
                    {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
                  </select>
                </Field>
                <Field label="Storage Condition *">
                  <select style={inp} value={storageCondition} onChange={e => setStorageCondition(e.target.value)} required>
                    <option value="">— Select —</option>
                    {STORAGE_CONDITIONS.map(c => <option key={c} value={c}>{c} ({CONDITION_LABEL[c]})</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Duration (months) *">
                  <input type="number" min={1} style={inp} value={studyDurationMonths} onChange={e => setStudyDurationMonths(e.target.value)} required />
                </Field>
                <Field label="Target Temp (°C)">
                  <input type="number" step="0.1" style={inp} value={targetTempC} onChange={e => setTargetTempC(e.target.value)} placeholder="e.g. 25" />
                </Field>
                <Field label="Target RH (%)">
                  <input type="number" step="0.1" style={inp} value={targetRhPct} onChange={e => setTargetRhPct(e.target.value)} placeholder="e.g. 60" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Regulatory Basis">
                  <input style={inp} value={regulatoryBasis} onChange={e => setRegulatoryBasis(e.target.value)} placeholder="e.g. ICH Q1A(R2)" />
                </Field>
                <Field label="Linked Spec Template">
                  <select style={inp} value={specTemplateId} onChange={e => setSpecTemplateId(e.target.value)}>
                    <option value="">— None —</option>
                    {specTemplates.map(t => <option key={t.specTemplateId} value={t.specTemplateId}>{t.templateName}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea style={{ ...inp, height: 60, resize: 'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional study description or purpose" />
              </Field>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <DrawerFooter saving={saving} onCancel={() => { setShowCreate(false); resetForm() }} label="Create Protocol" />
            </form>
          </Drawer>
        )}

        {/* ── Edit Modal ────────────────────────────────────────────────── */}
        {editing && (
          <Drawer title={`Edit: ${editing.protocolName}`} subtitle="Modify stability protocol conditions and spec template" onClose={() => { setEditing(null); resetForm() }} width={540}>
            <form onSubmit={handleUpdate}>
              <Field label="Protocol Name *">
                <input style={inp} value={protocolName} onChange={e => setProtocolName(e.target.value)} required />
              </Field>
              <div style={{ padding: '8px 12px', background: '#f0f4f8', borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#374151' }}>
                <strong>Material:</strong> {editing.material.materialName} &nbsp;|&nbsp;
                <strong>Condition:</strong> {editing.storageCondition}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Duration (months)">
                  <input type="number" min={1} style={inp} value={studyDurationMonths} onChange={e => setStudyDurationMonths(e.target.value)} />
                </Field>
                <Field label="Target Temp (°C)">
                  <input type="number" step="0.1" style={inp} value={targetTempC} onChange={e => setTargetTempC(e.target.value)} />
                </Field>
                <Field label="Target RH (%)">
                  <input type="number" step="0.1" style={inp} value={targetRhPct} onChange={e => setTargetRhPct(e.target.value)} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Regulatory Basis">
                  <input style={inp} value={regulatoryBasis} onChange={e => setRegulatoryBasis(e.target.value)} />
                </Field>
                <Field label="Linked Spec Template">
                  <select style={inp} value={specTemplateId} onChange={e => setSpecTemplateId(e.target.value)}>
                    <option value="">— None —</option>
                    {specTemplates.map(t => <option key={t.specTemplateId} value={t.specTemplateId}>{t.templateName}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea style={{ ...inp, height: 60, resize: 'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)} />
              </Field>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <DrawerFooter saving={saving} onCancel={() => { setEditing(null); resetForm() }} label="Save Changes" />
            </form>
          </Drawer>
        )}

        {/* ── Interval Designer ─────────────────────────────────────────── */}
        {intervalsFor && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '32px 16px', overflowY: 'auto'
          }}>
            <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 740, padding: '28px 28px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    Time-Points — {intervalsFor.protocolName}
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
                    Define each pull time-point for this stability protocol
                  </p>
                </div>
                <button onClick={() => setIntervalsFor(null)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button type="button" onClick={addPreset}
                  style={{ padding: '6px 14px', background: '#f0f4f8', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  ⚡ Load ICH Q1A Presets
                </button>
                <button type="button" onClick={() => setIntervalRows(rows => [...rows, newRow()])}
                  style={{ padding: '6px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#15803d' }}>
                  + Add Row
                </button>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 70px 32px', gap: 8, marginBottom: 6 }}>
                {['Month T+', 'Label', 'Units', 'Tolerance (days)', 'Mandatory', ''].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                ))}
              </div>

              <form onSubmit={handleSaveIntervals}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {intervalRows.map((row) => (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 70px 32px', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number" min={0} style={{ ...inp, margin: 0, textAlign: 'center' as const }}
                        value={row.monthOffset}
                        onChange={e => updateRow(row.id, 'monthOffset', e.target.value)}
                        placeholder="0"
                      />
                      <input
                        style={{ ...inp, margin: 0 }}
                        value={row.label}
                        onChange={e => updateRow(row.id, 'label', e.target.value)}
                        placeholder="e.g. T=0 (Initial)"
                      />
                      <input
                        type="number" min={1} style={{ ...inp, margin: 0, textAlign: 'center' as const }}
                        value={row.sampleUnitsRequired}
                        onChange={e => updateRow(row.id, 'sampleUnitsRequired', e.target.value)}
                      />
                      <input
                        type="number" min={0} style={{ ...inp, margin: 0, textAlign: 'center' as const }}
                        value={row.toleranceDays}
                        onChange={e => updateRow(row.id, 'toleranceDays', e.target.value)}
                        placeholder="±7"
                      />
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input type="checkbox" checked={row.isMandatory}
                          onChange={e => updateRow(row.id, 'isMandatory', e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#0d6e6e', cursor: 'pointer' }}
                        />
                      </div>
                      <button type="button" onClick={() => removeRow(row.id)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: 0 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '12px 0 0' }}>⚠ {error}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" onClick={() => setIntervalsFor(null)}
                    style={{ padding: '9px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ padding: '9px 22px', background: saving ? '#9ca3af' : '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving…' : `Save ${intervalRows.filter(r => r.monthOffset !== '').length} Time-Points`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
