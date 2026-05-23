// ─────────────────────────────────────────────────────────────────────────────
// InstrumentMappingPage.tsx — Phase D
//
// Configures which instruments can run which TestMethods / Parameters.
// This drives the WorkQueue auto-suggest feature — when assigning a test,
// the system recommends the best available calibrated instrument.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import api from '@/api/client'
import { PageHeader, Modal, Field, ModalFooter, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import ErrorBoundary from '@/components/ErrorBoundary'

// ── Types ─────────────────────────────────────────────────────────────────────

interface InstrumentMapping {
  mappingId:   number
  priority:    number
  notes:       string | null
  isActive:    boolean
  createdBy:   string
  createdAt:   string
  instrument: {
    instrumentId:   number
    instrumentCode: string
    instrumentType: string
    status:         string
    labName:        string
  }
  testMethod: { methodId: number; methodName: string; methodCode: string } | null
  parameter:  { parameterId: number; parameterName: string; parameterCode: string } | null
}

interface Instrument { instrumentId: number; instrumentCode: string; instrumentType: string; labName?: string; status: string; isActive: boolean }
interface TestMethod  { methodId: number; methodName: string; methodCode: string }
interface Parameter   { parameterId: number; parameterName: string; parameterCode: string }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Available:          { bg: '#d1fae5', color: '#065f46' },
  InUse:              { bg: '#dbeafe', color: '#1e40af' },
  Maintenance:        { bg: '#fef3c7', color: '#92400e' },
  OutOfCalibration:   { bg: '#fee2e2', color: '#991b1b' },
}

const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: '#6b7280', marginBottom: 6,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InstrumentMappingPage() {
  const [data, setData]             = useState<InstrumentMapping[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [testMethods, setTestMethods] = useState<TestMethod[]>([])
  const [parameters, setParameters]   = useState<Parameter[]>([])
  const [loading, setLoading]       = useState(false)
  const [filterInstrumentId, setFilterInstrumentId] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<InstrumentMapping | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Form state
  const [instrumentId, setInstrumentId] = useState('')
  const [testMethodId, setTestMethodId] = useState('')
  const [parameterId,  setParameterId]  = useState('')
  const [priority,     setPriority]     = useState('1')
  const [notes,        setNotes]        = useState('')
  const [mapType,      setMapType]      = useState<'method' | 'parameter'>('method')

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterInstrumentId) params.set('instrumentId', filterInstrumentId)
    if (filterActive !== '') params.set('isActive', filterActive)

    const [r, ir, mr, pr] = await Promise.all([
      api.get(`/instrument-mappings?${params}`),
      api.get('/instruments'),
      api.get('/test-methods'),
      api.get('/parameters'),
    ])
    setData(r.data)
    setInstruments(ir.data.filter((i: Instrument) => i.isActive))
    setTestMethods(mr.data)
    setParameters(pr.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [filterInstrumentId, filterActive])

  function resetForm() {
    setInstrumentId(''); setTestMethodId(''); setParameterId('')
    setPriority('1'); setNotes(''); setMapType('method'); setError('')
  }

  function openEdit(m: InstrumentMapping) {
    setEditing(m)
    setPriority(String(m.priority))
    setNotes(m.notes ?? '')
    setError('')
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!instrumentId) { setError('Select an instrument.'); return }
    if (mapType === 'method' && !testMethodId) { setError('Select a test method.'); return }
    if (mapType === 'parameter' && !parameterId) { setError('Select a parameter.'); return }

    setSaving(true); setError('')
    try {
      await api.post('/instrument-mappings', {
        instrumentId: Number(instrumentId),
        testMethodId: mapType === 'method' ? Number(testMethodId) : null,
        parameterId:  mapType === 'parameter' ? Number(parameterId) : null,
        priority:     Number(priority) || 1,
        notes:        notes || null,
      })
      toast('Mapping created', 'success')
      setShowCreate(false); resetForm(); load()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Create failed')
    } finally { setSaving(false) }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setError('')
    try {
      await api.put(`/instrument-mappings/${editing.mappingId}`, {
        priority: Number(priority) || 1,
        notes:    notes || null,
        isActive: editing.isActive,
      })
      toast('Mapping updated', 'success')
      setEditing(null); resetForm(); load()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Update failed')
    } finally { setSaving(false) }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function toggleActive(m: InstrumentMapping) {
    try {
      await api.put(`/instrument-mappings/${m.mappingId}`, {
        priority: m.priority,
        isActive: !m.isActive,
      })
      toast(m.isActive ? 'Mapping deactivated' : 'Mapping activated', 'success')
      load()
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Update failed', 'error')
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    if (!window.confirm('Delete this instrument mapping?')) return
    try {
      await api.delete(`/instrument-mappings/${id}`)
      toast('Mapping deleted', 'success')
      load()
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Delete failed', 'error')
    }
  }

  return (
    <ErrorBoundary label="Instrument Mapping">
      <div>
        <PageHeader
          title="Instrument ↔ Test Mapping"
          subtitle="Map instruments to the test methods / parameters they can execute. Powers Work Queue auto-suggest."
          action={<button
            onClick={() => { resetForm(); setShowCreate(true) }}
            style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Add Mapping
          </button>}
        />

        {/* ── Info banner ───────────────────────────────────────────────── */}
        <div style={{ padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          💡 <strong>How it works:</strong> When a Lab Manager assigns a test in the Work Queue, the system looks up this table to suggest the best <em>Available</em> + <em>calibrated</em> instrument for that test method. Lower priority number = preferred choice.
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select style={{ ...inp, width: 240, margin: 0 }} value={filterInstrumentId} onChange={e => setFilterInstrumentId(e.target.value)}>
            <option value="">All Instruments</option>
            {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode} — {i.instrumentType}</option>)}
          </select>
          <select style={{ ...inp, width: 160, margin: 0 }} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <option value="true">Active mappings</option>
            <option value="false">Inactive mappings</option>
            <option value="">All</option>
          </select>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔬</div>
            <p style={{ margin: 0, fontSize: 14 }}>No instrument mappings yet. Add the first one to enable auto-suggest.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Instrument', 'Lab', 'Instrument Status', 'Maps To', 'Priority', 'Notes', 'Active', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((m, i) => {
                  const ss = STATUS_STYLE[m.instrument.status] ?? { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <tr key={m.mappingId} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: m.isActive ? 1 : 0.55 }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#111827', fontFamily: 'monospace', fontSize: 12 }}>{m.instrument.instrumentCode}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.instrument.instrumentType}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{m.instrument.labName}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color }}>
                          {m.instrument.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {m.testMethod ? (
                          <div>
                            <span style={{ fontSize: 11, padding: '1px 7px', background: '#f0f9ff', color: '#0369a1', borderRadius: 8, fontWeight: 600 }}>Method</span>
                            <div style={{ fontSize: 12, color: '#111827', marginTop: 3 }}>{m.testMethod.methodName}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{m.testMethod.methodCode}</div>
                          </div>
                        ) : m.parameter ? (
                          <div>
                            <span style={{ fontSize: 11, padding: '1px 7px', background: '#fdf4ff', color: '#7c3aed', borderRadius: 8, fontWeight: 600 }}>Parameter</span>
                            <div style={{ fontSize: 12, color: '#111827', marginTop: 3 }}>{m.parameter.parameterName}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{m.parameter.parameterCode}</div>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', width: 28, height: 28, lineHeight: '28px',
                          borderRadius: '50%', textAlign: 'center', fontWeight: 700, fontSize: 13,
                          background: m.priority === 1 ? '#dcfce7' : m.priority === 2 ? '#fef9c3' : '#f3f4f6',
                          color: m.priority === 1 ? '#15803d' : m.priority === 2 ? '#92400e' : '#374151',
                        }}>
                          {m.priority}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 180 }}>
                        {m.notes ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => toggleActive(m)}
                          style={{
                            padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: 'pointer',
                            background: m.isActive ? '#dcfce7' : '#f1f5f9',
                            color: m.isActive ? '#15803d' : '#64748b',
                          }}>
                          {m.isActive ? '●' : '○'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(m)}
                            style={{ padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(m.mappingId)}
                            style={{ padding: '3px 10px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
                            Delete
                          </button>
                        </div>
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
          <Modal title="Add Instrument Mapping" onClose={() => { setShowCreate(false); resetForm() }}>
            <form onSubmit={handleCreate}>
              <Field label="Instrument *">
                <select style={inp} value={instrumentId} onChange={e => setInstrumentId(e.target.value)} required>
                  <option value="">— Select instrument —</option>
                  {instruments.map(i => (
                    <option key={i.instrumentId} value={i.instrumentId}>
                      {i.instrumentCode} — {i.instrumentType} ({i.status})
                    </option>
                  ))}
                </select>
              </Field>

              {/* Map type toggle */}
              <div style={{ marginBottom: 14 }}>
                <span style={label}>Map To *</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['method', 'parameter'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => { setMapType(t); setTestMethodId(''); setParameterId('') }}
                      style={{
                        padding: '7px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none',
                        fontWeight: mapType === t ? 700 : 500,
                        background: mapType === t ? '#0d6e6e' : '#f3f4f6',
                        color: mapType === t ? '#fff' : '#374151',
                      }}>
                      {t === 'method' ? '🔬 Test Method' : '📊 Parameter'}
                    </button>
                  ))}
                </div>
              </div>

              {mapType === 'method' ? (
                <Field label="Test Method *">
                  <select style={inp} value={testMethodId} onChange={e => setTestMethodId(e.target.value)} required>
                    <option value="">— Select test method —</option>
                    {testMethods.map(m => <option key={m.methodId} value={m.methodId}>{m.methodName} ({m.methodCode})</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Parameter *">
                  <select style={inp} value={parameterId} onChange={e => setParameterId(e.target.value)} required>
                    <option value="">— Select parameter —</option>
                    {parameters.map(p => <option key={p.parameterId} value={p.parameterId}>{p.parameterName} ({p.parameterCode})</option>)}
                  </select>
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14 }}>
                <Field label="Priority">
                  <input type="number" min={1} max={99} style={inp} value={priority} onChange={e => setPriority(e.target.value)} />
                </Field>
                <Field label="Notes">
                  <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional — e.g. Class A tests only" />
                </Field>
              </div>

              <div style={{ padding: '8px 12px', background: '#f0f4f8', borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#374151' }}>
                💡 Priority <strong>1</strong> = most preferred. When multiple instruments can run the same test, the system picks the lowest priority number that is Available + in calibration.
              </div>

              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <ModalFooter saving={saving} onCancel={() => { setShowCreate(false); resetForm() }} label="Add Mapping" />
            </form>
          </Modal>
        )}

        {/* ── Edit Modal ────────────────────────────────────────────────── */}
        {editing && (
          <Modal title="Edit Mapping" onClose={() => { setEditing(null); resetForm() }}>
            <form onSubmit={handleUpdate}>
              <div style={{ padding: '10px 14px', background: '#f0f4f8', borderRadius: 6, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{editing.instrument.instrumentCode} — {editing.instrument.instrumentType}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {editing.testMethod
                    ? `Method: ${editing.testMethod.methodName}`
                    : editing.parameter
                    ? `Parameter: ${editing.parameter.parameterName}`
                    : '—'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14 }}>
                <Field label="Priority">
                  <input type="number" min={1} max={99} style={inp} value={priority} onChange={e => setPriority(e.target.value)} />
                </Field>
                <Field label="Notes">
                  <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} />
                </Field>
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
              <ModalFooter saving={saving} onCancel={() => { setEditing(null); resetForm() }} label="Save Changes" />
            </form>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  )
}
