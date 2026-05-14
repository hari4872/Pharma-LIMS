import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Sample {
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  sampleType: string; status: string; barcodePrinted: boolean; dueDate: string
  analystName: string; createdAt: string
}
interface Material { materialId: number; materialName: string; productType: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }
interface Checkpoint {
  checkpointId: number; checkpointCode: string; triggerMode: string
  checkpointType: string; shiftIntervalHrs: number; isActive: boolean
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Registered:      { bg: '#dbeafe', color: '#1e40af' },
  PendingTesting:  { bg: '#fef9c3', color: '#854d0e' },
  InTesting:       { bg: '#fde8d8', color: '#9a3412' },
  PendingQAReview: { bg: '#ede9fe', color: '#6d28d9' },
  Released:        { bg: '#d1fae5', color: '#065f46' },
  Rejected:        { bg: '#fee2e2', color: '#991b1b' },
}

const TRIGGER_LABEL: Record<string, string> = {
  TimeBased:     'Time-Based schedule',
  OperatorScan:  'Per-batch (operator scan)',
  ProcessLog:    'Process log entry',
  DispatchEvent: 'Dispatch event trigger',
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ num, title, subtitle, children }: {
  num: number; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '24px 28px', marginBottom: 16
    }}>
      <div style={{ marginBottom: subtitle ? 16 : 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
          {num} · {title}
        </h3>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Label style ───────────────────────────────────────────────────────────────
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
  color: '#6b7280', textTransform: 'uppercase', marginBottom: 6
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SampleRegistrationPage() {
  const { fullName, userId } = useSelector((s: RootState) => s.auth)

  const [data, setData]               = useState<Sample[]>([])
  const [materials, setMaterials]     = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading, setLoading]         = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [showSRF, setShowSRF]         = useState<number | null>(null)
  const [showReprint, setShowReprint] = useState<number | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [reprintReason, setReprintReason] = useState('')

  // ── Form state ──────────────────────────────────────────────────────────────
  const [materialId, setMaterialId]       = useState('')
  const [sampleTypeId, setSampleTypeId]   = useState('')
  const [selectedCps, setSelectedCps]     = useState<number[]>([])  // checked checkpoint IDs
  const [tankSourceId, setTankSourceId]   = useState('')            // UI only
  const [sampleLabel, setSampleLabel]     = useState('')            // UI only
  const [lotNumber, setLotNumber]         = useState('')
  const [mfgDate, setMfgDate]             = useState('')
  const [expDate, setExpDate]             = useState('')
  const [srfForm, setSrfForm]             = useState({
    password: '', meaning: 'I confirm this Sample Registration Form', reason: ''
  })

  // ── Load master data ────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const [r, mr, str, cpr] = await Promise.all([
      api.get(`/samples${params}`),
      api.get('/materials'),
      api.get('/sample-types'),
      api.get('/checkpoints'),
    ])
    setData(r.data)
    setMaterials(mr.data)
    setSampleTypes(str.data.filter((t: SampleType) => t.typeCode !== 'DSPQC'))
    setCheckpoints(cpr.data.filter((c: Checkpoint) => c.isActive))
    setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  // When material changes — select all checkpoints by default
  function onMaterialChange(mid: string) {
    setMaterialId(mid)
    if (mid) setSelectedCps(checkpoints.map(c => c.checkpointId))
    else setSelectedCps([])
  }

  function toggleCheckpoint(id: number) {
    setSelectedCps(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // ── Frequency summary ───────────────────────────────────────────────────────
  function frequencySummary() {
    if (selectedCps.length === 0) return null
    const selected = checkpoints.filter(c => selectedCps.includes(c.checkpointId))
    const modes = [...new Set(selected.map(c => c.triggerMode))]
    const hasTimeBased = modes.includes('TimeBased')
    if (modes.length === 1) {
      return TRIGGER_LABEL[modes[0]] ?? modes[0]
    }
    return modes.map(m => TRIGGER_LABEL[m] ?? m).join(' · ')
  }

  function hasClockTime() {
    const selected = checkpoints.filter(c => selectedCps.includes(c.checkpointId))
    return selected.some(c => c.triggerMode === 'TimeBased')
  }

  // ── Reset form ──────────────────────────────────────────────────────────────
  function resetForm() {
    setMaterialId(''); setSampleTypeId(''); setSelectedCps([])
    setTankSourceId(''); setSampleLabel(''); setLotNumber('')
    setMfgDate(''); setExpDate(''); setError('')
  }

  // ── Submit registration ─────────────────────────────────────────────────────
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!sampleTypeId) { setError('Please select a Sample Type.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/samples', {
        labId: 1,                        // from logged-in user's lab (server also enforces)
        materialId: Number(materialId),
        lotNumber,
        mfgDate,
        expDate,
        sampleTypeId: Number(sampleTypeId),
      })
      setShowForm(false); resetForm(); load()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed')
    } finally { setSaving(false) }
  }

  async function submitSRF(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showSRF}/sign-srf`, srfForm)
      setShowSRF(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'E-signature failed') }
    finally { setSaving(false) }
  }

  async function submitReprint(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/samples/${showReprint}/barcode-reprint`, { reason: reprintReason })
      setShowReprint(null); setReprintReason(''); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Reprint failed') }
    finally { setSaving(false) }
  }

  const selectedMaterial = materials.find(m => m.materialId === Number(materialId))
  const freqText = frequencySummary()

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Sample Registration</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Register incoming samples and route to the testing work queue</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select style={{ ...inp, width: 180, margin: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected'].map(s =>
              <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '8px 18px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Register Sample
          </button>
        </div>
      </div>

      {/* ── Sample list table ─────────────────────────────────────────────── */}
      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample No.', accessor: r => <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.sampleNumber}</strong> },
        { header: 'Material', accessor: 'materialName' },
        { header: 'Lot / Batch', accessor: 'lotNumber' },
        { header: 'Type', accessor: 'sampleType' },
        {
          header: 'Status', accessor: r => {
            const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>{r.status}</span>
          }
        },
        { header: 'Label', accessor: r => <span style={{ fontSize: 12, color: r.barcodePrinted ? '#16a34a' : '#dc2626' }}>{r.barcodePrinted ? '✓ Printed' : '✗ Pending'}</span> },
        { header: 'Due', accessor: r => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—' },
        { header: 'Analyst', accessor: 'analystName' },
        {
          header: 'Actions', accessor: r => (
            <div style={{ display: 'flex', gap: 5 }}>
              {r.status === 'Registered' && (
                <button onClick={() => { setShowSRF(r.sampleId); setError('') }}
                  style={{ padding: '3px 9px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  Sign SRF
                </button>
              )}
              <button onClick={() => { setShowReprint(r.sampleId); setError('') }}
                style={{ padding: '3px 9px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Reprint
              </button>
            </div>
          )
        },
      ]} />

      {/* ── Registration form — 4-section stepped layout ──────────────────── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '32px 16px', overflowY: 'auto'
        }}>
          <div style={{ width: '100%', maxWidth: 760, position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>New Sample Registration</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Complete all sections · Barcode auto-printed on submit</p>
              </div>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 20, width: 34, height: 34, cursor: 'pointer', lineHeight: '34px', textAlign: 'center' }}>
                ×
              </button>
            </div>

            <form onSubmit={submitRegister}>

              {/* ── Section 1: Requestor & Product ─────────────────────── */}
              <Section num={1} title="Requestor & Product" subtitle="Requestor is auto-filled from your login.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Requestor — read-only */}
                  <div>
                    <span style={label}>Requestor</span>
                    <div style={{ ...inp, background: '#f9fafb', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>👤</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{fullName ?? 'Loading…'}</span>
                    </div>
                  </div>

                  {/* Product / Material */}
                  <div>
                    <span style={label}>Product / Test Type <span style={{ color: '#ef4444' }}>*</span></span>
                    <select style={inp} value={materialId} onChange={e => onMaterialChange(e.target.value)} required>
                      <option value="">— Select a product —</option>
                      {materials.map(m => (
                        <option key={m.materialId} value={m.materialId}>
                          {m.materialName}{m.productType ? ` (${m.productType})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sample Type — shown after product selected */}
                {materialId && (
                  <div style={{ marginTop: 16 }}>
                    <span style={label}>Sample Type <span style={{ color: '#ef4444' }}>*</span></span>
                    <select style={inp} value={sampleTypeId} onChange={e => setSampleTypeId(e.target.value)} required>
                      <option value="">— Select sample type —</option>
                      {sampleTypes.map(t => (
                        <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName} ({t.typeCode})</option>
                      ))}
                    </select>
                  </div>
                )}
              </Section>

              {/* ── Section 2: Checkpoints ──────────────────────────────── */}
              <Section num={2} title="Checkpoints" subtitle="Pick one or more. All checkpoints are selected by default — uncheck anything you don't need.">
                {!materialId ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                    Select a product to see its checkpoints.
                  </p>
                ) : checkpoints.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No active checkpoints configured for this lab.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {checkpoints.map(cp => {
                      const checked = selectedCps.includes(cp.checkpointId)
                      return (
                        <label key={cp.checkpointId}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                            background: checked ? '#eff6ff' : '#f9fafb',
                            border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`,
                            transition: 'all 0.15s'
                          }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheckpoint(cp.checkpointId)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1e3a5f' }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{cp.checkpointCode}</span>
                            <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>{cp.checkpointType}</span>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: checked ? '#dbeafe' : '#f3f4f6',
                            color: checked ? '#1e40af' : '#9ca3af'
                          }}>
                            {TRIGGER_LABEL[cp.triggerMode] ?? cp.triggerMode}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* ── Section 3: Frequency ────────────────────────────────── */}
              <Section num={3} title="Frequency" subtitle="">
                {selectedCps.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Select checkpoints above to see frequency information.</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 20,
                      background: hasClockTime() ? '#fef9c3' : '#d1fae5',
                      borderRadius: 8, width: 40, height: 40,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {hasClockTime() ? '🕐' : '📋'}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{freqText}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        {hasClockTime()
                          ? 'One or more checkpoints require a scheduled clock time.'
                          : `${selectedCps.length} checkpoint${selectedCps.length > 1 ? 's' : ''} selected — all per-batch; no clock time required.`}
                      </p>
                    </div>
                  </div>
                )}
              </Section>

              {/* ── Section 4: Sample Source ─────────────────────────────── */}
              <Section num={4} title="Sample Source" subtitle="Helps the lab identify the physical sample.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <span style={label}>Tank / Source ID</span>
                    <input style={inp} value={tankSourceId} onChange={e => setTankSourceId(e.target.value)}
                      placeholder="e.g. 1T4002" />
                  </div>
                  <div>
                    <span style={label}>Sample Label</span>
                    <input style={inp} value={sampleLabel} onChange={e => setSampleLabel(e.target.value)}
                      placeholder="As written on the bottle" />
                  </div>
                  <div>
                    <span style={label}>D.O. / Batch / Lot No. <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} value={lotNumber} onChange={e => setLotNumber(e.target.value)}
                      required placeholder="e.g. B-20260422-03" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={label}>Manufacturing Date <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} required />
                  </div>
                  <div>
                    <span style={label}>Expiry Date <span style={{ color: '#ef4444' }}>*</span></span>
                    <input style={inp} type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0' }}>
                  ℹ Sample ID is server-generated · Barcode auto-printed · 5 GMP checks run server-side · Form Template auto-selected
                </p>
              </Section>

              {/* ── Submit ──────────────────────────────────────────────── */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠ {error}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '10px 22px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Registering…' : 'Register + Print Barcode'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Sign SRF — §11.50 e-sig ──────────────────────────────────────── */}
      {showSRF && (
        <Modal title="Sign Sample Registration Form (§11.50)" onClose={() => setShowSRF(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR §11.50 — Your full name, timestamp, meaning, and reason will be captured and immutably recorded.
          </p>
          <form onSubmit={submitSRF}>
            <Field label="Password (re-enter)">
              <input style={inp} type="password" value={srfForm.password}
                onChange={e => setSrfForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning">
              <input style={inp} value={srfForm.meaning}
                onChange={e => setSrfForm(f => ({ ...f, meaning: e.target.value }))} required />
            </Field>
            <Field label="Reason">
              <input style={inp} value={srfForm.reason}
                onChange={e => setSrfForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Sample verified and ready for testing" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowSRF(null)} label="Sign & Submit to Work Queue" />
          </form>
        </Modal>
      )}

      {/* ── Barcode Reprint ───────────────────────────────────────────────── */}
      {showReprint && (
        <Modal title="Barcode Label Reprint" onClose={() => setShowReprint(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR 211.170 — Reprint is audit-logged with your name and reason.
          </p>
          <form onSubmit={submitReprint}>
            <Field label="Reason (mandatory)">
              <input style={inp} value={reprintReason} onChange={e => setReprintReason(e.target.value)}
                required placeholder="e.g. Label damaged during storage" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowReprint(null)} label="Reprint Label" />
          </form>
        </Modal>
      )}
    </div>
  )
}
