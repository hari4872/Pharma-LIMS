import { useEffect, useState, useMemo } from 'react'
import api from '@/api/client'
import { inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/utils/errors'

interface Instrument {
  instrumentId: number; instrumentCode: string; instrumentType: string
  model: string | null; serialNumber: string | null
  labId: number; labName: string; calibrationDue: string; status: string; isActive: boolean
}
interface InstrumentMapping {
  mappingId: number; priority: number; notes: string | null; isActive: boolean
  testMethod: { methodId: number; methodName: string; methodCode: string } | null
  parameter:  { parameterId: number; parameterName: string; parameterCode: string } | null
}
interface TestMethod { methodId: number; methodName: string; methodCode: string }
interface Parameter  { parameterId: number; parameterName: string; parameterCode: string }

const STATUS_META: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Available:        { bg: '#d1fae5', color: '#065f46', dot: '#10b981', label: 'Available' },
  InUse:            { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', label: 'In Use' },
  Maintenance:      { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Maintenance' },
  OutOfCalibration: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Out of Cal.' },
}

function calDays(calDue: string) {
  return Math.floor((new Date(calDue).getTime() - Date.now()) / 86_400_000)
}
function calLabel(calDue: string): string {
  const d = calDays(calDue)
  if (d < 0)   return `Expired ${Math.abs(d)}d ago`
  if (d === 0) return 'Due today'
  if (d < 30)  return `Due in ${d}d`
  return `Due ${calDue}`
}
function calColor(calDue: string): string {
  const d = calDays(calDue)
  if (d < 0)  return '#dc2626'
  if (d < 30) return '#d97706'
  return '#6b7280'
}

export default function InstrumentMappingPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [testMethods, setTestMethods] = useState<TestMethod[]>([])
  const [parameters,  setParameters]  = useState<Parameter[]>([])
  const [mappings,    setMappings]     = useState<InstrumentMapping[]>([])
  const [selectedId,  setSelectedId]  = useState<number | null>(null)
  const [search,      setSearch]      = useState('')
  const [mapType,     setMapType]     = useState<'method' | 'parameter'>('method')
  const [testMethodId, setTestMethodId] = useState('')
  const [parameterId,  setParameterId]  = useState('')
  const [priority,    setPriority]    = useState('1')
  const [notes,       setNotes]       = useState('')
  const [addError,    setAddError]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [editingPriority, setEditingPriority] = useState<{ id: number; val: string } | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/instruments?includeInactive=false'),
      api.get('/test-methods'),
      api.get('/parameters'),
    ]).then(([ir, mr, pr]) => {
      setInstruments(ir.data); setTestMethods(mr.data); setParameters(pr.data)
    }).catch(() => toast('Failed to load master data', 'error'))
  }, [])

  function loadMappings(instId: number) {
    api.get(`/instrument-mappings?instrumentId=${instId}&isActive=`)
      .then(r => setMappings(r.data))
      .catch(() => toast('Failed to load mappings', 'error'))
  }

  function selectInstrument(id: number) {
    setSelectedId(id); setMappings([])
    setMapType('method'); setTestMethodId(''); setParameterId('')
    setPriority('1'); setNotes(''); setAddError('')
    loadMappings(id)
  }

  const filteredInstruments = useMemo(() => instruments.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return i.instrumentCode.toLowerCase().includes(q) || i.instrumentType.toLowerCase().includes(q)
  }), [instruments, search])

  const selectedInstrument = instruments.find(i => i.instrumentId === selectedId)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    if (mapType === 'method' && !testMethodId) { setAddError('Select a test method.'); return }
    if (mapType === 'parameter' && !parameterId) { setAddError('Select a parameter.'); return }
    setSaving(true); setAddError('')
    try {
      await api.post('/instrument-mappings', {
        instrumentId: selectedId,
        testMethodId: mapType === 'method' ? Number(testMethodId) : null,
        parameterId:  mapType === 'parameter' ? Number(parameterId) : null,
        priority: Number(priority) || 1,
        notes: notes || null,
      })
      toast('Mapping added', 'success')
      setTestMethodId(''); setParameterId(''); setNotes(''); setPriority('1'); setAddError('')
      loadMappings(selectedId)
    } catch (err) { setAddError(getErrorMessage(err, 'Add failed')) }
    finally { setSaving(false) }
  }

  async function handleToggleActive(m: InstrumentMapping) {
    try {
      await api.put(`/instrument-mappings/${m.mappingId}`, { priority: m.priority, isActive: !m.isActive })
      toast(m.isActive ? 'Deactivated' : 'Activated', 'success')
      if (selectedId) loadMappings(selectedId)
    } catch { toast('Update failed', 'error') }
  }

  async function handleSavePriority(m: InstrumentMapping, val: string) {
    const p = Number(val)
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

  return (
    <ErrorBoundary label="Instrument Mapping">
      <div style={{ fontFamily: 'inherit', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
            Instrument ↔ Test Mapping
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Map instruments to test methods or parameters. Lower priority number = preferred auto-assignment.
          </p>
        </div>

        {/* Two-panel */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              {/* Search */}
              <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <input
                  style={{ ...inp, margin: 0, fontSize: 12, padding: '7px 10px' }}
                  placeholder="🔍  Search instruments…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                  {filteredInstruments.length} instrument{filteredInstruments.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* List */}
              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {filteredInstruments.length === 0 ? (
                  <p style={{ padding: 20, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>No instruments found</p>
                ) : filteredInstruments.map(inst => {
                  const s = STATUS_META[inst.status] ?? { bg: '#f3f4f6', color: '#374151', dot: '#9ca3af', label: inst.status }
                  const sel = inst.instrumentId === selectedId
                  return (
                    <button key={inst.instrumentId} onClick={() => selectInstrument(inst.instrumentId)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                        borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                        background: sel ? '#f0f9ff' : 'transparent',
                        borderLeft: `3px solid ${sel ? '#0d6e6e' : 'transparent'}`,
                        transition: 'all 0.1s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: sel ? '#0d6e6e' : '#111827' }}>
                          {inst.instrumentCode}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: s.color }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                          {s.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{inst.instrumentType}</div>
                      <div style={{ fontSize: 10, color: calColor(inst.calibrationDue), marginTop: 2 }}>
                        📅 {calLabel(inst.calibrationDue)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
          <div style={{ flex: 1 }}>

            {/* Empty state */}
            {!selectedInstrument && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select an Instrument</div>
                <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 300, margin: '0 auto', lineHeight: 1.6 }}>
                  Pick an instrument from the left to view and manage its test method mappings.
                </div>
              </div>
            )}

            {selectedInstrument && (() => {
              const s = STATUS_META[selectedInstrument.status] ?? { bg: '#f3f4f6', color: '#374151', dot: '#9ca3af', label: selectedInstrument.status }
              const sorted = [...mappings].sort((a, b) => a.priority - b.priority)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Instrument header card */}
                  <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0d6e6e 100%)', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18 }}>{selectedInstrument.instrumentCode}</span>
                          <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 20 }}>
                            {selectedInstrument.instrumentType}
                          </span>
                        </div>
                        {selectedInstrument.model && (
                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Model: {selectedInstrument.model}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.85, color: calColor(selectedInstrument.calibrationDue) === '#dc2626' ? '#fca5a5' : calColor(selectedInstrument.calibrationDue) === '#d97706' ? '#fde68a' : '#e2e8f0' }}>
                          📅 {calLabel(selectedInstrument.calibrationDue)}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>{selectedInstrument.labName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mappings */}
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Mappings
                      </span>
                      <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
                        {mappings.length} total
                      </span>
                    </div>

                    {sorted.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                        No mappings yet — add one below.
                      </div>
                    ) : (
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sorted.map(m => (
                          <div key={m.mappingId} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                            border: `1px solid ${m.isActive ? '#e5e7eb' : '#f1f5f9'}`,
                            borderRadius: 8, background: m.isActive ? '#fff' : '#fafafa',
                            opacity: m.isActive ? 1 : 0.6, transition: 'all 0.15s',
                          }}>
                            {/* Priority badge */}
                            {editingPriority?.id === m.mappingId ? (
                              <input type="number" min={1} max={99} autoFocus
                                style={{ ...inp, width: 48, margin: 0, padding: '4px 6px', fontSize: 13, textAlign: 'center' }}
                                value={editingPriority.val}
                                onChange={e => setEditingPriority({ id: m.mappingId, val: e.target.value })}
                                onBlur={() => handleSavePriority(m, editingPriority.val)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSavePriority(m, editingPriority.val)
                                  if (e.key === 'Escape') setEditingPriority(null)
                                }}
                              />
                            ) : (
                              <button title="Click to edit" onClick={() => setEditingPriority({ id: m.mappingId, val: String(m.priority) })}
                                style={{
                                  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                  fontWeight: 800, fontSize: 13, flexShrink: 0,
                                  background: m.priority === 1 ? '#dcfce7' : m.priority === 2 ? '#fef9c3' : '#f1f5f9',
                                  color:      m.priority === 1 ? '#15803d' : m.priority === 2 ? '#92400e' : '#374151',
                                }}>
                                {m.priority}
                              </button>
                            )}

                            {/* Type badge */}
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                              background: m.testMethod ? '#f0f9ff' : '#fdf4ff',
                              color:      m.testMethod ? '#0369a1' : '#7c3aed',
                            }}>
                              {m.testMethod ? 'Method' : 'Param'}
                            </span>

                            {/* Name */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.testMethod?.methodName ?? m.parameter?.parameterName ?? '—'}
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>
                                {m.testMethod?.methodCode ?? m.parameter?.parameterCode}
                                {m.notes && <span style={{ marginLeft: 8, color: '#6b7280', fontFamily: 'inherit' }}>· {m.notes}</span>}
                              </div>
                            </div>

                            {/* Active toggle */}
                            <button onClick={() => handleToggleActive(m)}
                              style={{
                                padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                border: 'none', cursor: 'pointer', flexShrink: 0,
                                background: m.isActive ? '#dcfce7' : '#f1f5f9',
                                color:      m.isActive ? '#15803d' : '#64748b',
                              }}>
                              {m.isActive ? '● Active' : '○ Off'}
                            </button>

                            {/* Remove */}
                            <button onClick={() => handleDelete(m.mappingId)}
                              style={{ padding: '3px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Mapping form */}
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        + Add Mapping
                      </span>
                    </div>
                    <form onSubmit={handleAdd} style={{ padding: '14px 16px' }}>
                      {/* Type toggle */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        {(['method', 'parameter'] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => { setMapType(t); setTestMethodId(''); setParameterId('') }}
                            style={{
                              padding: '5px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                              border: `1.5px solid ${mapType === t ? '#0d6e6e' : '#e5e7eb'}`,
                              fontWeight: mapType === t ? 700 : 500,
                              background: mapType === t ? '#0d6e6e' : '#fff',
                              color: mapType === t ? '#fff' : '#374151',
                            }}>
                            {t === 'method' ? '🔬 Test Method' : '📊 Parameter'}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                        {/* Select */}
                        {mapType === 'method' ? (
                          <select style={{ ...inp, margin: 0, fontSize: 12 }} value={testMethodId} onChange={e => setTestMethodId(e.target.value)} required>
                            <option value="">— Select test method —</option>
                            {testMethods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodName} ({m.methodCode})</option>)}
                          </select>
                        ) : (
                          <select style={{ ...inp, margin: 0, fontSize: 12 }} value={parameterId} onChange={e => setParameterId(e.target.value)} required>
                            <option value="">— Select parameter —</option>
                            {parameters.map(p => <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.parameterCode})</option>)}
                          </select>
                        )}

                        {/* Priority */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Priority</div>
                          <input type="number" min={1} max={99} style={{ ...inp, margin: 0, fontSize: 12 }} value={priority} onChange={e => setPriority(e.target.value)} />
                        </div>

                        {/* Notes */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Notes (optional)</div>
                          <input style={{ ...inp, margin: 0, fontSize: 12 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Class A only" />
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={saving}
                          style={{ padding: '8px 20px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                          {saving ? 'Adding…' : '+ Add'}
                        </button>
                      </div>

                      {addError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>⚠ {addError}</p>}
                    </form>
                  </div>

                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
