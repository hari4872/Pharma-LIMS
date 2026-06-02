// ─────────────────────────────────────────────────────────────────────────────
// InstrumentMappingPage.tsx — Two-panel explorer layout
//
// Left  : scrollable instrument list (filterable by lab + status)
// Right : selected instrument's mappings + inline add-mapping form
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo } from 'react'
import api from '@/api/client'
import { inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/utils/errors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Instrument {
  instrumentId:   number
  instrumentCode: string
  instrumentType: string
  model:          string | null
  serialNumber:   string | null
  labId:          number
  labName:        string
  calibrationDue: string   // "YYYY-MM-DD"
  status:         string
  isActive:       boolean
}

interface InstrumentMapping {
  mappingId: number
  priority:  number
  notes:     string | null
  isActive:  boolean
  testMethod: { methodId: number; methodName: string; methodCode: string } | null
  parameter:  { parameterId: number; parameterName: string; parameterCode: string } | null
}

interface TestMethod { methodId: number; methodName: string; methodCode: string }
interface Parameter  { parameterId: number; parameterName: string; parameterCode: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

const INST_STATUS: Record<string, { bg: string; color: string; icon: string }> = {
  Available:        { bg: '#d1fae5', color: '#065f46', icon: '✅' },
  InUse:            { bg: '#dbeafe', color: '#1e40af', icon: '🔵' },
  Maintenance:      { bg: '#fef3c7', color: '#92400e', icon: '🔧' },
  OutOfCalibration: { bg: '#fee2e2', color: '#991b1b', icon: '⚠️' },
}

function calStyle(calDue: string): React.CSSProperties {
  const days = Math.floor((new Date(calDue).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { color: '#dc2626', fontWeight: 700 }
  if (days < 30) return { color: '#d97706', fontWeight: 600 }
  return { color: '#374151' }
}

function calLabel(calDue: string): string {
  const days = Math.floor((new Date(calDue).getTime() - Date.now()) / 86_400_000)
  if (days < 0)   return `Cal EXPIRED ${Math.abs(days)}d ago`
  if (days === 0) return 'Cal due TODAY'
  if (days < 30)  return `Cal due in ${days}d`
  return `Cal due ${calDue}`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InstrumentMappingPage() {
  // ── master data ──────────────────────────────────────────────────────────
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [testMethods, setTestMethods] = useState<TestMethod[]>([])
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [mappings,    setMappings]     = useState<InstrumentMapping[]>([])

  // ── selection + filters ──────────────────────────────────────────────────
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [labFilter,  setLabFilter]    = useState('')
  const [search,     setSearch]       = useState('')

  // ── add-mapping form ─────────────────────────────────────────────────────
  const [mapType,      setMapType]     = useState<'method' | 'parameter'>('method')
  const [testMethodId, setTestMethodId] = useState('')
  const [parameterId,  setParameterId]  = useState('')
  const [priority,     setPriority]     = useState('1')
  const [notes,        setNotes]        = useState('')
  const [addError,     setAddError]     = useState('')
  const [saving,       setSaving]       = useState(false)

  // ── inline priority edit ─────────────────────────────────────────────────
  const [editingPriority, setEditingPriority] = useState<{ id: number; val: string } | null>(null)

  // ── Load master data ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/instruments?includeInactive=false'),
      api.get('/test-methods'),
      api.get('/parameters'),
    ]).then(([ir, mr, pr]) => {
      setInstruments(ir.data)
      setTestMethods(mr.data)
      setParameters(pr.data)
    }).catch(() => toast('Failed to load master data', 'error'))
  }, [])

  // ── Load mappings for selected instrument ─────────────────────────────────
  function loadMappings(instId: number) {
    api.get(`/instrument-mappings?instrumentId=${instId}&isActive=`)
      .then(r => setMappings(r.data))
      .catch(() => toast('Failed to load mappings', 'error'))
  }

  function selectInstrument(id: number) {
    setSelectedId(id)
    setMappings([])
    resetAddForm()
    loadMappings(id)
  }

  function resetAddForm() {
    setMapType('method'); setTestMethodId(''); setParameterId('')
    setPriority('1'); setNotes(''); setAddError('')
  }

  // ── Filtered left-panel instrument list ──────────────────────────────────
  const labs = useMemo(() => [...new Set(instruments.map(i => i.labName))].sort(), [instruments])

  const filteredInstruments = useMemo(() => instruments.filter(i => {
    if (labFilter && i.labName !== labFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return i.instrumentCode.toLowerCase().includes(q) || i.instrumentType.toLowerCase().includes(q)
    }
    return true
  }), [instruments, labFilter, search])

  const selectedInstrument = instruments.find(i => i.instrumentId === selectedId)

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    if (mapType === 'method'    && !testMethodId) { setAddError('Select a test method.'); return }
    if (mapType === 'parameter' && !parameterId)  { setAddError('Select a parameter.'); return }
    setSaving(true); setAddError('')
    try {
      await api.post('/instrument-mappings', {
        instrumentId: selectedId,
        testMethodId: mapType === 'method'    ? Number(testMethodId) : null,
        parameterId:  mapType === 'parameter' ? Number(parameterId)  : null,
        priority:     Number(priority) || 1,
        notes:        notes || null,
      })
      toast('Mapping added', 'success')
      resetAddForm()
      loadMappings(selectedId)
    } catch (err) {
      setAddError(getErrorMessage(err, 'Add failed'))
    } finally { setSaving(false) }
  }

  async function handleToggleActive(m: InstrumentMapping) {
    try {
      await api.put(`/instrument-mappings/${m.mappingId}`, { priority: m.priority, isActive: !m.isActive })
      toast(m.isActive ? 'Deactivated' : 'Activated', 'success')
      if (selectedId) loadMappings(selectedId)
    } catch { toast('Update failed', 'error') }
  }

  async function handleSavePriority(m: InstrumentMapping, newPriority: string) {
    const p = Number(newPriority)
    if (!p || p < 1 || p > 99) { setEditingPriority(null); return }
    try {
      await api.put(`/instrument-mappings/${m.mappingId}`, { priority: p, notes: m.notes, isActive: m.isActive })
      toast('Priority updated', 'success')
      setEditingPriority(null)
      if (selectedId) loadMappings(selectedId)
    } catch { toast('Update failed', 'error') }
  }

  async function handleDelete(mappingId: number) {
    if (!window.confirm('Remove this mapping?')) return
    try {
      await api.delete(`/instrument-mappings/${mappingId}`)
      toast('Mapping removed', 'success')
      if (selectedId) loadMappings(selectedId)
    } catch { toast('Delete failed', 'error') }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary label="Instrument Mapping">
      <div style={{ fontFamily: 'inherit' }}>

        {/* Page title + info banner */}
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
            Instrument ↔ Test Mapping
          </h2>
          <div style={{ padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
            💡 <strong>How it works:</strong> When a test is assigned in the Work Queue, the system looks up this table to auto-suggest the best <em>Available + calibrated</em> instrument. Lower priority number = preferred.
          </div>
        </div>

        {/* Two-panel container */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', minHeight: 520, background: '#fff' }}>

          {/* ── LEFT PANEL: Instrument list ─────────────────────────────── */}
          <div style={{ width: 270, minWidth: 270, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>

            {/* Filters */}
            <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0' }}>
              <input
                style={{ ...inp, margin: '0 0 7px', fontSize: 12, padding: '6px 10px' }}
                placeholder="Search code / type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                style={{ ...inp, margin: 0, fontSize: 12, padding: '6px 10px' }}
                value={labFilter}
                onChange={e => setLabFilter(e.target.value)}
              >
                <option value="">All Labs</option>
                {labs.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            {/* Instrument list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredInstruments.length === 0 ? (
                <p style={{ padding: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>No instruments found</p>
              ) : filteredInstruments.map(inst => {
                const ss = INST_STATUS[inst.status] ?? { bg: '#f3f4f6', color: '#374151', icon: '●' }
                const selected = inst.instrumentId === selectedId
                return (
                  <button
                    key={inst.instrumentId}
                    onClick={() => selectInstrument(inst.instrumentId)}
                    style={{
                      width: '100%', display: 'block', textAlign: 'left', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                      background: selected ? '#eff6ff' : 'transparent',
                      borderLeft: selected ? '3px solid #2563eb' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: selected ? '#1d4ed8' : '#111827' }}>
                        {inst.instrumentCode}
                      </div>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: ss.bg, color: ss.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {ss.icon} {inst.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{inst.instrumentType}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{inst.labName}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Empty state */}
            {!selectedInstrument && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>🔬</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select an Instrument</div>
                <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.6 }}>
                  Pick an instrument from the left panel to view and manage its test method / parameter mappings.
                </div>
              </div>
            )}

            {/* Instrument detail */}
            {selectedInstrument && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                {/* Instrument header */}
                <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#111827' }}>
                        {selectedInstrument.instrumentCode}
                      </span>
                      <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>{selectedInstrument.instrumentType}</span>
                      {selectedInstrument.model && <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af' }}>• {selectedInstrument.model}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9, fontWeight: 600, ...(() => { const s = INST_STATUS[selectedInstrument.status] ?? { bg: '#f3f4f6', color: '#374151' }; return { background: s.bg, color: s.color } })() }}>
                        {selectedInstrument.status}
                      </span>
                      <span style={{ fontSize: 11, ...calStyle(selectedInstrument.calibrationDue) }}>
                        📅 {calLabel(selectedInstrument.calibrationDue)}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{selectedInstrument.labName}</span>
                    </div>
                  </div>
                </div>

                {/* Mappings table */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>
                    Mappings ({mappings.length})
                  </div>

                  {mappings.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      No mappings yet — use the form below to add the first one.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          {['Priority', 'Maps To', 'Type', 'Notes', 'Active', ''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...mappings].sort((a, b) => a.priority - b.priority).map(m => (
                          <tr key={m.mappingId} style={{ borderBottom: '1px solid #f3f4f6', opacity: m.isActive ? 1 : 0.5 }}>

                            {/* Priority — click to edit inline */}
                            <td style={{ padding: '9px 12px' }}>
                              {editingPriority?.id === m.mappingId ? (
                                <input
                                  type="number" min={1} max={99} autoFocus
                                  style={{ ...inp, width: 52, margin: 0, padding: '3px 7px', fontSize: 12 }}
                                  value={editingPriority.val}
                                  onChange={e => setEditingPriority({ id: m.mappingId, val: e.target.value })}
                                  onBlur={() => handleSavePriority(m, editingPriority.val)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSavePriority(m, editingPriority.val)
                                    if (e.key === 'Escape') setEditingPriority(null)
                                  }}
                                />
                              ) : (
                                <button
                                  title="Click to edit priority"
                                  onClick={() => setEditingPriority({ id: m.mappingId, val: String(m.priority) })}
                                  style={{
                                    width: 28, height: 28, lineHeight: '28px', borderRadius: '50%', border: 'none',
                                    textAlign: 'center', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    background: m.priority === 1 ? '#dcfce7' : m.priority === 2 ? '#fef9c3' : '#f3f4f6',
                                    color:      m.priority === 1 ? '#15803d' : m.priority === 2 ? '#92400e' : '#374151',
                                  }}>
                                  {m.priority}
                                </button>
                              )}
                            </td>

                            {/* Maps To */}
                            <td style={{ padding: '9px 12px' }}>
                              {m.testMethod ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{m.testMethod.methodName}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{m.testMethod.methodCode}</div>
                                </div>
                              ) : m.parameter ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{m.parameter.parameterName}</div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{m.parameter.parameterCode}</div>
                                </div>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>

                            {/* Type badge */}
                            <td style={{ padding: '9px 12px' }}>
                              {m.testMethod
                                ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', fontWeight: 700 }}>Method</span>
                                : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#fdf4ff', color: '#7c3aed', fontWeight: 700 }}>Param</span>}
                            </td>

                            {/* Notes */}
                            <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280', maxWidth: 160 }}>
                              {m.notes ?? '—'}
                            </td>

                            {/* Active toggle */}
                            <td style={{ padding: '9px 12px' }}>
                              <button
                                onClick={() => handleToggleActive(m)}
                                style={{
                                  padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                                  border: 'none', cursor: 'pointer',
                                  background: m.isActive ? '#dcfce7' : '#f1f5f9',
                                  color:      m.isActive ? '#15803d' : '#64748b',
                                }}>
                                {m.isActive ? '● Active' : '○ Off'}
                              </button>
                            </td>

                            {/* Delete */}
                            <td style={{ padding: '9px 12px' }}>
                              <button
                                onClick={() => handleDelete(m.mappingId)}
                                style={{ padding: '3px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* ── Inline Add Mapping form ───────────────────────────── */}
                <div style={{ padding: '14px 20px 18px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>
                    Add Mapping
                  </div>
                  <form onSubmit={handleAdd}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>

                      {/* Method / Parameter toggle */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['method', 'parameter'] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => { setMapType(t); setTestMethodId(''); setParameterId('') }}
                            style={{
                              padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
                              fontWeight: mapType === t ? 700 : 500,
                              background: mapType === t ? '#0d6e6e' : '#e5e7eb',
                              color: mapType === t ? '#fff' : '#374151',
                            }}>
                            {t === 'method' ? '🔬 Method' : '📊 Param'}
                          </button>
                        ))}
                      </div>

                      {/* Method / Parameter select */}
                      {mapType === 'method' ? (
                        <select
                          style={{ ...inp, margin: 0, flex: 1, minWidth: 200, fontSize: 12, padding: '6px 10px' }}
                          value={testMethodId}
                          onChange={e => setTestMethodId(e.target.value)}
                          required
                        >
                          <option value="">— Select test method —</option>
                          {testMethods.map(m => (
                            <option key={m.methodId} value={m.methodId}>{m.methodName} ({m.methodCode})</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          style={{ ...inp, margin: 0, flex: 1, minWidth: 200, fontSize: 12, padding: '6px 10px' }}
                          value={parameterId}
                          onChange={e => setParameterId(e.target.value)}
                          required
                        >
                          <option value="">— Select parameter —</option>
                          {parameters.map(p => (
                            <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.parameterCode})</option>
                          ))}
                        </select>
                      )}

                      {/* Priority */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</span>
                        <input
                          type="number" min={1} max={99}
                          style={{ ...inp, margin: 0, width: 60, fontSize: 12, padding: '6px 8px' }}
                          value={priority}
                          onChange={e => setPriority(e.target.value)}
                        />
                      </div>

                      {/* Notes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 140 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes (optional)</span>
                        <input
                          style={{ ...inp, margin: 0, fontSize: 12, padding: '6px 10px' }}
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="e.g. Class A tests only"
                        />
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          padding: '7px 18px', background: '#0d6e6e', color: '#fff', border: 'none',
                          borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                          opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap', alignSelf: 'flex-end',
                        }}>
                        {saving ? 'Adding…' : '+ Add'}
                      </button>
                    </div>

                    {addError && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>⚠ {addError}</p>
                    )}
                  </form>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
