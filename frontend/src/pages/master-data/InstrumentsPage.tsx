import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'

interface Instrument { instrumentId: number; labName: string; instrumentCode: string; instrumentType: string; model: string; serialNumber: string; calibrationDue: string; status: string; isActive: boolean }
interface Lab { labId: number; labName: string }
interface Breakdown { breakdownId: number; instrumentId: number; instrumentCode: string; raisedByName: string; raisedAt: string; issueDescription: string; status: string; repairCount: number; returnSignatureId: number | null }
interface UtilisationSummary { summaryId: number; windowDays: number; windowStart: string; windowEnd: string; totalTests: number; totalHours: number; utilisationPct: number | null; calculatedAt: string }

const statusColour = (s: string) => {
  if (s === 'Available') return { bg: '#d1fae5', fg: '#065f46' }
  if (s === 'InUse')     return { bg: '#dbeafe', fg: '#1e40af' }
  if (s === 'Maintenance') return { bg: '#fef3c7', fg: '#92400e' }
  if (s === 'OutOfService') return { bg: '#fee2e2', fg: '#991b1b' }
  return { bg: '#f3f4f6', fg: '#374151' }
}

export default function InstrumentsPage() {
  const [data, setData] = useState<Instrument[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([])
  const [tab, setTab] = useState<'instruments' | 'breakdowns' | 'utilisation'>('instruments')
  const [utilisation, setUtilisation] = useState<UtilisationSummary[]>([])
  const [utilisationInstrumentId, setUtilisationInstrumentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBreakdownForm, setShowBreakdownForm] = useState(false)
  const [showRepairForm, setShowRepairForm] = useState(false)
  const [showRtsForm, setShowRtsForm] = useState(false)
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<number | null>(null)
  const [form, setForm] = useState({ labId: '', instrumentCode: '', instrumentType: '', model: '', serialNumber: '', calibrationDue: '' })
  const [bdForm, setBdForm] = useState({ instrumentId: '', issueDescription: '' })
  const [repairForm, setRepairForm] = useState({ technician: '', repairDate: '', repairDescription: '', partsUsed: '' })
  const [rtsForm, setRtsForm] = useState({ password: '', meaning: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<Instrument | null>(null)
  const [editForm, setEditForm] = useState({ instrumentType: '', model: '', serialNumber: '', calibrationDue: '' })

  function openEdit(r: Instrument) {
    setEditRow(r)
    setEditForm({
      instrumentType: r.instrumentType,
      model: r.model || '',
      serialNumber: r.serialNumber || '',
      calibrationDue: r.calibrationDue ? r.calibrationDue.slice(0, 10) : '',
    })
  }

  async function submitEditInstrument(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/instruments/${editRow!.instrumentId}`, editForm)
      setEditRow(null); load()
      toast(`Instrument "${editRow!.instrumentCode}" updated successfully`, 'success')
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function load() {
    setLoading(true)
    const [r, lr, br] = await Promise.all([
      api.get('/instruments'),
      api.get('/laboratories'),
      api.get('/instruments/breakdowns'),
    ])
    setData(r.data); setLabs(lr.data); setBreakdowns(br.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submitInstrument(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/instruments', { ...form, labId: Number(form.labId) })
      setShowForm(false)
      toast(`Instrument "${form.instrumentCode}" added successfully`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitBreakdown(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/${bdForm.instrumentId}/breakdowns`, { issueDescription: bdForm.issueDescription })
      setShowBreakdownForm(false); setBdForm({ instrumentId: '', issueDescription: '' })
      toast(`Breakdown raised for instrument #${bdForm.instrumentId}`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitRepair(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/breakdowns/${selectedBreakdownId}/repairs`, repairForm)
      setShowRepairForm(false); setRepairForm({ technician: '', repairDate: '', repairDescription: '', partsUsed: '' })
      toast(`Repair recorded for breakdown #${selectedBreakdownId}`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitRts(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/breakdowns/${selectedBreakdownId}/return-to-service`, rtsForm)
      setShowRtsForm(false); setRtsForm({ password: '', meaning: '', reason: '' })
      toast(`Instrument returned to service`, 'success')
      load()
    } catch (err: any) { const msg = err.response?.data?.message ?? 'Failed'; setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function loadUtilisation(instrumentId: number) {
    setUtilisationInstrumentId(instrumentId)
    setTab('utilisation')
    try {
      const r = await api.get(`/instruments/${instrumentId}/utilisation`)
      setUtilisation(r.data)
    } catch { setUtilisation([]) }
  }

  const openBreakdowns = breakdowns.filter(b => b.status !== 'Resolved')

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['instruments', 'breakdowns', 'utilisation'] as const).map(t => (
          <button key={t} onClick={() => t !== 'utilisation' && setTab(t)} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, cursor: t === 'utilisation' ? 'default' : 'pointer', fontWeight: 500, fontSize: 13, background: tab === t ? '#2563eb' : '#e5e7eb', color: tab === t ? '#fff' : '#374151' }}>
            {t === 'instruments' ? 'Instruments' : t === 'breakdowns' ? `Breakdowns${openBreakdowns.length ? ` (${openBreakdowns.length})` : ''}` : utilisationInstrumentId ? `Utilisation — #${utilisationInstrumentId}` : 'Utilisation'}
          </button>
        ))}
      </div>

      {tab === 'instruments' && (
        <>
          <PageHeader title="Instruments" onAdd={() => setShowForm(true)} />
          <DataTable loading={loading} data={data} exportFilename="Instruments" columns={[
            { header: 'Code', accessor: 'instrumentCode' },
            { header: 'Type', accessor: 'instrumentType' },
            { header: 'Lab', accessor: 'labName' },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            {
              header: 'Cal. Due', accessor: r => {
                if (!r.calibrationDue) return <span style={{ color: '#9ca3af' }}>—</span>
                const due  = new Date(r.calibrationDue)
                const days = Math.ceil((due.getTime() - Date.now()) / 86400000)
                const bg   = days < 0 ? '#fee2e2' : days <= 7 ? '#fee2e2' : days <= 30 ? '#fef3c7' : '#d1fae5'
                const fg   = days < 0 ? '#991b1b' : days <= 7 ? '#b91c1c' : days <= 30 ? '#92400e' : '#065f46'
                const txt  = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{due.toLocaleDateString('en-GB')}</span>
                    <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, background: bg, color: fg, display: 'inline-block', width: 'fit-content' }}>
                      {days < 0 ? '⚠ ' : days <= 7 ? '⚠ ' : ''}{txt}
                    </span>
                  </div>
                )
              }
            },
            {
              header: 'Status', accessor: r => {
                const c = statusColour(r.status)
                return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.fg }}>{r.status}</span>
              }
            },
            { header: 'Active', accessor: r => <StatusBadge active={r.isActive} /> },
            {
              header: '', accessor: r => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setBdForm(f => ({ ...f, instrumentId: String(r.instrumentId) })); setShowBreakdownForm(true) }}
                    style={{ fontSize: 12, padding: '2px 8px', background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Raise Breakdown
                  </button>
                  <button onClick={() => loadUtilisation(r.instrumentId)}
                    style={{ fontSize: 12, padding: '2px 8px', background: '#ede9fe', color: '#5b21b6', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Utilisation
                  </button>
                  <button onClick={() => openEdit(r)}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', border:'1px solid #e5e7eb', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:12, color:'#374151', fontFamily:'inherit' }}>
                    <svg viewBox="0 0 24 24" fill="none" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Edit
                  </button>
                </div>
              )
            },
          ]} />
        </>
      )}

      {tab === 'breakdowns' && (
        <>
          <PageHeader title="Instrument Breakdowns" onAdd={() => setShowBreakdownForm(true)} addLabel="Raise Breakdown" />
          <DataTable loading={loading} data={breakdowns} columns={[
            { header: 'ID', accessor: 'breakdownId' },
            { header: 'Instrument', accessor: 'instrumentCode' },
            { header: 'Raised By', accessor: 'raisedByName' },
            { header: 'Raised At', accessor: r => r.raisedAt?.replace('T', ' ').slice(0, 16) + ' UTC' },
            { header: 'Issue', accessor: 'issueDescription' },
            { header: 'Status', accessor: r => <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: r.status === 'Resolved' ? '#d1fae5' : r.status === 'UnderRepair' ? '#fef3c7' : '#fee2e2', color: r.status === 'Resolved' ? '#065f46' : r.status === 'UnderRepair' ? '#92400e' : '#991b1b' }}>{r.status}</span> },
            { header: 'Repairs', accessor: 'repairCount' },
            {
              header: 'Actions', accessor: r => r.status !== 'Resolved' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setSelectedBreakdownId(r.breakdownId); setShowRepairForm(true) }}
                    style={{ fontSize: 12, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Record Repair
                  </button>
                  <button onClick={() => { setSelectedBreakdownId(r.breakdownId); setShowRtsForm(true) }}
                    style={{ fontSize: 12, padding: '2px 8px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Return to Service
                  </button>
                </div>
              ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>Resolved</span>
            },
          ]} />
        </>
      )}

      {tab === 'utilisation' && (
        <>
          <PageHeader title={utilisationInstrumentId ? `Utilisation Summary — Instrument #${utilisationInstrumentId}` : 'Utilisation Summary'} />
          {utilisation.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14, padding: '24px 0' }}>
              No utilisation data yet. The background job computes 7 / 30 / 90-day windows every night.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0' }}>
              {utilisation.map(u => {
                const pct = u.utilisationPct !== null ? Number(u.utilisationPct).toFixed(1) : '—'
                const colour = u.utilisationPct === null ? '#6b7280' : u.utilisationPct >= 80 ? '#dc2626' : u.utilisationPct >= 50 ? '#d97706' : '#059669'
                return (
                  <div key={u.summaryId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 24px', minWidth: 200, background: '#fff' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: colour }}>{pct}{u.utilisationPct !== null ? '%' : ''}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginTop: 4 }}>{u.windowDays}-Day Window</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                      <div>{u.windowStart.slice(0, 10)} → {u.windowEnd.slice(0, 10)}</div>
                      <div style={{ marginTop: 4 }}>{u.totalTests} tests &nbsp;|&nbsp; {Number(u.totalHours).toFixed(1)} hrs</div>
                      <div style={{ marginTop: 4 }}>Calculated: {u.calculatedAt.replace('T', ' ').slice(0, 16)} UTC</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Add Instrument */}
      {showForm && (
        <Modal title="Add Instrument" onClose={() => setShowForm(false)}>
          <form onSubmit={submitInstrument}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Instrument Code"><input style={inp} value={form.instrumentCode} onChange={e => setForm(f => ({ ...f, instrumentCode: e.target.value }))} required /></Field>
            <Field label="Instrument Type"><input style={inp} value={form.instrumentType} onChange={e => setForm(f => ({ ...f, instrumentType: e.target.value }))} required /></Field>
            <Field label="Model"><input style={inp} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Serial Number"><input style={inp} value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></Field>
            <Field label="Calibration Due"><input style={inp} type="date" value={form.calibrationDue} onChange={e => setForm(f => ({ ...f, calibrationDue: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Modal>
      )}

      {/* Raise Breakdown */}
      {showBreakdownForm && (
        <Modal title="Raise Breakdown" onClose={() => setShowBreakdownForm(false)}>
          <form onSubmit={submitBreakdown}>
            <Field label="Instrument">
              <select style={inp} value={bdForm.instrumentId} onChange={e => setBdForm(f => ({ ...f, instrumentId: e.target.value }))} required>
                <option value="">Select…</option>
                {data.filter(i => i.isActive).map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode} — {i.instrumentType}</option>)}
              </select>
            </Field>
            <Field label="Issue Description">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={bdForm.issueDescription} onChange={e => setBdForm(f => ({ ...f, issueDescription: e.target.value }))} required />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowBreakdownForm(false)} label="Raise Breakdown" />
          </form>
        </Modal>
      )}

      {/* Record Repair */}
      {showRepairForm && selectedBreakdownId && (
        <Modal title={`Record Repair — Breakdown #${selectedBreakdownId}`} onClose={() => setShowRepairForm(false)}>
          <form onSubmit={submitRepair}>
            <Field label="Technician"><input style={inp} value={repairForm.technician} onChange={e => setRepairForm(f => ({ ...f, technician: e.target.value }))} required /></Field>
            <Field label="Repair Date"><input style={inp} type="date" value={repairForm.repairDate} onChange={e => setRepairForm(f => ({ ...f, repairDate: e.target.value }))} required /></Field>
            <Field label="Repair Description">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={repairForm.repairDescription} onChange={e => setRepairForm(f => ({ ...f, repairDescription: e.target.value }))} required />
            </Field>
            <Field label="Parts Used"><input style={inp} value={repairForm.partsUsed} onChange={e => setRepairForm(f => ({ ...f, partsUsed: e.target.value }))} /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowRepairForm(false)} label="Save Repair" />
          </form>
        </Modal>
      )}

      {editRow && (
        <Modal title={`Edit Instrument — ${editRow.instrumentCode}`} onClose={() => setEditRow(null)}>
          <form onSubmit={submitEditInstrument}>
            <Field label="Instrument Type"><input style={inp} value={editForm.instrumentType} onChange={e => setEditForm(f => ({ ...f, instrumentType: e.target.value }))} required /></Field>
            <Field label="Model"><input style={inp} value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Serial Number"><input style={inp} value={editForm.serialNumber} onChange={e => setEditForm(f => ({ ...f, serialNumber: e.target.value }))} /></Field>
            <Field label="Calibration Due"><input style={inp} type="date" value={editForm.calibrationDue} onChange={e => setEditForm(f => ({ ...f, calibrationDue: e.target.value }))} required /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Modal>
      )}

      {/* Return to Service — QA §11.50 e-sig */}
      {showRtsForm && selectedBreakdownId && (
        <Modal title={`Return to Service — Breakdown #${selectedBreakdownId}`} onClose={() => setShowRtsForm(false)}>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>
            ⚠️ This action marks the instrument as Available and triggers OOC impact assessment on all logbook entries during the breakdown window. E-signature required (21 CFR Part 11).
          </p>
          <form onSubmit={submitRts}>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={rtsForm.password} onChange={e => setRtsForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning of Signature"><input style={inp} value={rtsForm.meaning} onChange={e => setRtsForm(f => ({ ...f, meaning: e.target.value }))} required placeholder="e.g. QA Return-to-Service Approval" /></Field>
            <Field label="Reason for Signature"><input style={inp} value={rtsForm.reason} onChange={e => setRtsForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Instrument verified in-spec post-repair" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowRtsForm(false)} label="Approve & Return to Service" />
          </form>
        </Modal>
      )}
    </div>
  )
}
