import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Field, inp, StatusBadge } from './LaboratoriesPage'
import ESignatureDrawer from '@/components/ESignatureDrawer'
import { toast } from '@/components/Toast'
import { getErrorMessage } from '@/utils/errors'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface Instrument { instrumentId: number; labName: string; instrumentCode: string; instrumentName: string; instrumentType: string; manufacturer: string; model: string; serialNumber: string; location: string; calibrationDue: string; lastCalibration: string; status: string; isActive: boolean }
interface Lab { labId: number; labName: string }
interface Breakdown { breakdownId: number; instrumentId: number; instrumentCode: string; raisedByName: string; raisedAt: string; issueDescription: string; status: string; repairCount: number; returnSignatureId: number | null }
interface UtilisationSummary { summaryId: number; windowDays: number; windowStart: string; windowEnd: string; totalTests: number; totalHours: number; utilisationPct: number | null; calculatedAt: string }
interface CalibrationRecord { calibrationId: number; calibrationDate: string; nextCalibrationDue: string; certificateRef: string; performedBy: string; frequency: string | null; createdBy: string; createdAt: string; isApproved: boolean }

const FREQUENCIES = ['Monthly', '3 months', '6 months', 'Annual', '2 years']

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
  const [form, setForm] = useState({ labId: '', instrumentCode: '', instrumentName: '', instrumentType: '', manufacturer: '', model: '', serialNumber: '', location: '', calibrationDue: '', lastCalibration: '' })
  const [bdForm, setBdForm] = useState({ instrumentId: '', issueDescription: '' })
  const [repairForm, setRepairForm] = useState({ technician: '', repairDate: '', repairDescription: '', partsUsed: '' })
  const [rtsForm, setRtsForm] = useState({ password: '', meaning: 'Instrument returned to service', reason: 'Return to service approved' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editRow, setEditRow] = useState<Instrument | null>(null)
  const [editForm, setEditForm] = useState({ instrumentName: '', instrumentType: '', manufacturer: '', model: '', serialNumber: '', location: '', calibrationDue: '', lastCalibration: '' })
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [showBulkRts, setShowBulkRts] = useState(false)
  const [bulkRtsForm, setBulkRtsForm] = useState({ password: '', meaning: 'Instruments returned to service', reason: 'Bulk return to service approved' })
  const [bulkSaving, setBulkSaving] = useState(false)

  // Calibration records
  const [calibInstrument, setCalibInstrument] = useState<Instrument | null>(null)
  const [calibRecords, setCalibRecords] = useState<CalibrationRecord[]>([])
  const [calibLoading, setCalibLoading] = useState(false)
  const [showCalibForm, setShowCalibForm] = useState(false)
  const [calibForm, setCalibForm] = useState({ calibrationDate: '', nextCalibrationDue: '', certificateRef: '', performedBy: '', frequency: '' })
  const [calibSaving, setCalibSaving] = useState(false)
  const [calibError, setCalibError] = useState('')

  async function openCalibrations(r: Instrument) {
    setCalibInstrument(r); setCalibRecords([]); setCalibLoading(true)
    try { const res = await api.get(`/instruments/${r.instrumentId}/calibrations`); setCalibRecords(res.data) }
    catch { setCalibRecords([]) }
    finally { setCalibLoading(false) }
  }

  async function submitCalibRecord(e: React.FormEvent) {
    e.preventDefault(); setCalibSaving(true); setCalibError('')
    try {
      await api.post(`/instruments/${calibInstrument!.instrumentId}/calibrations`, {
        calibrationDate: calibForm.calibrationDate,
        nextCalibrationDue: calibForm.nextCalibrationDue,
        certificateRef: calibForm.certificateRef,
        performedBy: calibForm.performedBy,
        frequency: calibForm.frequency || null,
      })
      toast('Calibration record added', 'success')
      setShowCalibForm(false)
      setCalibForm({ calibrationDate: '', nextCalibrationDue: '', certificateRef: '', performedBy: '', frequency: '' })
      openCalibrations(calibInstrument!)
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setCalibError(msg); toast(msg, 'error') }
    finally { setCalibSaving(false) }
  }

  function openEdit(r: Instrument) {
    setEditRow(r)
    setEditForm({
      instrumentName: r.instrumentName || '',
      instrumentType: r.instrumentType,
      manufacturer: r.manufacturer || '',
      model: r.model || '',
      serialNumber: r.serialNumber || '',
      location: r.location || '',
      calibrationDue: r.calibrationDue ? r.calibrationDue.slice(0, 10) : '',
      lastCalibration: r.lastCalibration ? r.lastCalibration.slice(0, 10) : '',
    })
  }

  async function submitEditInstrument(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.put(`/instruments/${editRow!.instrumentId}`, editForm)
      setEditRow(null); load()
      toast(`Instrument "${editRow!.instrumentCode}" updated successfully`, 'success')
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
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
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitBreakdown(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/${bdForm.instrumentId}/breakdowns`, { issueDescription: bdForm.issueDescription })
      setShowBreakdownForm(false); setBdForm({ instrumentId: '', issueDescription: '' })
      toast(`Breakdown raised for instrument #${bdForm.instrumentId}`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitRepair(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/breakdowns/${selectedBreakdownId}/repairs`, repairForm)
      setShowRepairForm(false); setRepairForm({ technician: '', repairDate: '', repairDescription: '', partsUsed: '' })
      toast(`Repair recorded for breakdown #${selectedBreakdownId}`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function submitRts(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/instruments/breakdowns/${selectedBreakdownId}/return-to-service`, rtsForm)
      setShowRtsForm(false); setRtsForm({ password: '', meaning: '', reason: '' })
      toast(`Instrument returned to service`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  async function downloadCalibCert(r: Instrument) {
    try {
      const res = await api.get(`/instruments/${r.instrumentId}/calibration-certificate`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `CalibCert_${r.instrumentCode}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast(`Calibration certificate downloaded — ${r.instrumentCode}`, 'success')
    } catch {
      toast('Failed to download calibration certificate', 'error')
    }
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

  function daysOpen(raisedAt: string) {
    return Math.floor((Date.now() - new Date(raisedAt).getTime()) / 86400000)
  }

  function toggleBulkSelect(id: number) {
    setBulkSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function submitBulkRts(e: React.FormEvent) {
    e.preventDefault(); setBulkSaving(true)
    const count = bulkSelected.size
    try {
      await Promise.all([...bulkSelected].map(id =>
        api.post(`/instruments/breakdowns/${id}/return-to-service`, bulkRtsForm)
      ))
      setBulkSelected(new Set()); setShowBulkRts(false)
      setBulkRtsForm({ password: '', meaning: '', reason: '' })
      toast(`${count} breakdown(s) returned to service`, 'success')
      load()
    } catch (err) { toast(getErrorMessage(err, 'Bulk RTS failed'), 'error') }
    finally { setBulkSaving(false) }
  }

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
          <PageHeader title="Instruments" onAdd={() => { setForm({ labId: '', instrumentCode: '', instrumentName: '', instrumentType: '', manufacturer: '', model: '', serialNumber: '', location: '', calibrationDue: '', lastCalibration: '' }); setError(''); setShowForm(true) }} />
          <DataTable loading={loading} data={data} exportFilename="Instruments" columns={[
            { header: 'Code', accessor: r => (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{r.instrumentCode}</div>
                {r.instrumentName && <div style={{ fontSize: 11, color: '#6b7280' }}>{r.instrumentName}</div>}
              </div>
            )},
            { header: 'Type', accessor: 'instrumentType' },
            { header: 'Manufacturer', accessor: r => r.manufacturer || <span style={{ color: '#9ca3af' }}>—</span> },
            { header: 'Lab', accessor: 'labName' },
            { header: 'Location', accessor: r => r.location || <span style={{ color: '#9ca3af' }}>—</span> },
            { header: 'Model', accessor: 'model' },
            { header: 'Serial No.', accessor: 'serialNumber' },
            { header: 'Last Cal.', accessor: r => r.lastCalibration
              ? <span style={{ fontSize: 12, color: '#374151' }}>{new Date(r.lastCalibration).toLocaleDateString('en-GB')}</span>
              : <span style={{ color: '#9ca3af' }}>—</span>
            },
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
            { header: 'Active', accessor: r => <StatusBadge active={r.isActive && r.status === 'Available'} /> },
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
                  <button onClick={() => openCalibrations(r)}
                    title="View / Add Calibration Records"
                    style={{ fontSize: 12, padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                    🗓 Calibration
                  </button>
                  <button
                    onClick={() => downloadCalibCert(r)}
                    title="Download Calibration Certificate PDF"
                    style={{ fontSize: 12, padding: '2px 8px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                    📄 Cert
                  </button>
                </div>
              )
            },
          ]} />
        </>
      )}

      {tab === 'breakdowns' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <PageHeader title="Instrument Breakdowns" onAdd={() => setShowBreakdownForm(true)} addLabel="Raise Breakdown" />
            {bulkSelected.size > 0 && (
              <button onClick={() => { setError(''); setShowBulkRts(true) }}
                style={{ padding: '7px 16px', background: '#065f46', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ✓ Return {bulkSelected.size} to Service
              </button>
            )}
          </div>
          <DataTable loading={loading} data={breakdowns} columns={[
            { header: '', accessor: r => r.status !== 'Resolved' ? (
              <input type="checkbox" checked={bulkSelected.has(r.breakdownId)}
                onChange={() => toggleBulkSelect(r.breakdownId)}
                style={{ accentColor: '#065f46', width: 14, height: 14, cursor: 'pointer' }} />
            ) : null },
            { header: 'ID', accessor: 'breakdownId' },
            { header: 'Instrument', accessor: 'instrumentCode' },
            { header: 'Raised By', accessor: 'raisedByName' },
            { header: 'Raised At', accessor: r => r.raisedAt?.replace('T', ' ').slice(0, 16) + ' UTC' },
            { header: 'Days Open', accessor: r => {
              if (r.status === 'Resolved') return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
              const d = daysOpen(r.raisedAt)
              return <span style={{ fontWeight: 700, color: d >= 7 ? '#dc2626' : d >= 3 ? '#d97706' : '#374151' }}>{d}d</span>
            }},
            { header: 'Issue', accessor: 'issueDescription' },
            { header: 'Status', accessor: r => <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: r.status === 'Resolved' ? '#d1fae5' : r.status === 'InRepair' ? '#fef3c7' : '#fee2e2', color: r.status === 'Resolved' ? '#065f46' : r.status === 'InRepair' ? '#92400e' : '#991b1b' }}>{r.status}</span> },
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
        <Drawer title="Add Instrument" subtitle="Register a new instrument in the laboratory" onClose={() => setShowForm(false)}>
          <form onSubmit={submitInstrument}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Laboratory">
              <select style={inp} value={form.labId} onChange={e => setForm(f => ({ ...f, labId: e.target.value }))} required>
                <option value="">Select…</option>
                {labs.map(l => <option key={l.labId} value={l.labId}>{l.labName}</option>)}
              </select>
            </Field>
            <Field label="Instrument Code"><input style={inp} value={form.instrumentCode} onChange={e => setForm(f => ({ ...f, instrumentCode: e.target.value }))} required /></Field>
            <Field label="Instrument Name"><input style={inp} value={form.instrumentName} onChange={e => setForm(f => ({ ...f, instrumentName: e.target.value }))} placeholder="e.g. Agilent HPLC System" /></Field>
            <Field label="Instrument Type"><input style={inp} value={form.instrumentType} onChange={e => setForm(f => ({ ...f, instrumentType: e.target.value }))} required /></Field>
            <Field label="Manufacturer"><input style={inp} value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="e.g. Agilent Technologies" /></Field>
            <Field label="Model"><input style={inp} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Serial Number"><input style={inp} value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></Field>
            <Field label="Location"><input style={inp} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. QC Lab — Room 204" /></Field>
            <Field label="Calibration Due"><input style={inp} type="date" value={form.calibrationDue} onChange={e => setForm(f => ({ ...f, calibrationDue: e.target.value }))} required /></Field>
            <Field label="Last Calibration"><input style={inp} type="date" value={form.lastCalibration} onChange={e => setForm(f => ({ ...f, lastCalibration: e.target.value }))} /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}

      {/* Raise Breakdown */}
      {showBreakdownForm && (
        <Drawer title="Raise Breakdown" subtitle="Report an instrument breakdown or fault" onClose={() => setShowBreakdownForm(false)}>
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
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowBreakdownForm(false)} label="Raise Breakdown" />
          </form>
        </Drawer>
      )}

      {/* Record Repair */}
      {showRepairForm && selectedBreakdownId && (
        <Drawer title={`Record Repair — Breakdown #${selectedBreakdownId}`} subtitle="Log technician repair details" onClose={() => setShowRepairForm(false)}>
          <form onSubmit={submitRepair}>
            <Field label="Technician"><input style={inp} value={repairForm.technician} onChange={e => setRepairForm(f => ({ ...f, technician: e.target.value }))} required /></Field>
            <Field label="Repair Date"><input style={inp} type="date" value={repairForm.repairDate} onChange={e => setRepairForm(f => ({ ...f, repairDate: e.target.value }))} required /></Field>
            <Field label="Repair Description">
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={repairForm.repairDescription} onChange={e => setRepairForm(f => ({ ...f, repairDescription: e.target.value }))} required />
            </Field>
            <Field label="Parts Used"><input style={inp} value={repairForm.partsUsed} onChange={e => setRepairForm(f => ({ ...f, partsUsed: e.target.value }))} /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowRepairForm(false)} label="Save Repair" />
          </form>
        </Drawer>
      )}

      {editRow && (
        <Drawer title={`Edit Instrument — ${editRow.instrumentCode}`} subtitle="Update instrument details and calibration dates" onClose={() => setEditRow(null)}>
          <form onSubmit={submitEditInstrument}>
            <Field label="Instrument Name"><input style={inp} value={editForm.instrumentName} onChange={e => setEditForm(f => ({ ...f, instrumentName: e.target.value }))} /></Field>
            <Field label="Instrument Type"><input style={inp} value={editForm.instrumentType} onChange={e => setEditForm(f => ({ ...f, instrumentType: e.target.value }))} required /></Field>
            <Field label="Manufacturer"><input style={inp} value={editForm.manufacturer} onChange={e => setEditForm(f => ({ ...f, manufacturer: e.target.value }))} /></Field>
            <Field label="Model"><input style={inp} value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Serial Number"><input style={inp} value={editForm.serialNumber} onChange={e => setEditForm(f => ({ ...f, serialNumber: e.target.value }))} /></Field>
            <Field label="Location"><input style={inp} value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} /></Field>
            <Field label="Calibration Due"><input style={inp} type="date" value={editForm.calibrationDue} onChange={e => setEditForm(f => ({ ...f, calibrationDue: e.target.value }))} required /></Field>
            <Field label="Last Calibration"><input style={inp} type="date" value={editForm.lastCalibration} onChange={e => setEditForm(f => ({ ...f, lastCalibration: e.target.value }))} /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setEditRow(null)} label="Save Changes" />
          </form>
        </Drawer>
      )}

      {/* Bulk Return to Service */}
      {showBulkRts && (
        <ESignatureDrawer
          title={`Bulk Return to Service — ${bulkSelected.size} breakdown(s)`}
          subtitle="A single e-signature covers all selected breakdowns (21 CFR Part 11)"
          form={bulkRtsForm} onChange={setBulkRtsForm}
          onSubmit={submitBulkRts}
          onClose={() => setShowBulkRts(false)}
          saving={bulkSaving} error={error}
          label={`Approve & Return ${bulkSelected.size} to Service`}
          reasonLabel="Reason for Signature"
          reasonPlaceholder="e.g. All instruments verified in-spec post-maintenance"
          passwordOnly
        >
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
              ⚠ Marks all {bulkSelected.size} selected breakdown(s) as resolved — instruments set to Available.
            </p>
          </div>
        </ESignatureDrawer>
      )}

      {/* Calibration Records */}
      {calibInstrument && (
        <Drawer title={`Calibration Records — ${calibInstrument.instrumentCode}`} subtitle="View and add calibration history" onClose={() => { setCalibInstrument(null); setShowCalibForm(false) }} width={560}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{calibInstrument.instrumentName}</span>
            <button onClick={() => { setShowCalibForm(true); setCalibError('') }}
              style={{ padding: '4px 12px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              + Add Record
            </button>
          </div>

          {showCalibForm && (
            <form onSubmit={submitCalibRecord} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 10 }}>New Calibration Record</div>
              <Field label="Calibration Date"><input style={inp} type="date" value={calibForm.calibrationDate} onChange={e => setCalibForm(f => ({ ...f, calibrationDate: e.target.value }))} required /></Field>
              <Field label="Next Due Date"><input style={inp} type="date" value={calibForm.nextCalibrationDue} onChange={e => setCalibForm(f => ({ ...f, nextCalibrationDue: e.target.value }))} required /></Field>
              <Field label="Certificate Ref."><input style={inp} value={calibForm.certificateRef} onChange={e => setCalibForm(f => ({ ...f, certificateRef: e.target.value }))} required placeholder="e.g. CERT-2026-BOD001" /></Field>
              <Field label="Performed By"><input style={inp} value={calibForm.performedBy} onChange={e => setCalibForm(f => ({ ...f, performedBy: e.target.value }))} required placeholder="Technician / lab name" /></Field>
              <Field label="Frequency">
                <select style={inp} value={calibForm.frequency} onChange={e => setCalibForm(f => ({ ...f, frequency: e.target.value }))}>
                  <option value="">— Select —</option>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              {calibError && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0' }}>{calibError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="submit" disabled={calibSaving}
                  style={{ padding: '6px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {calibSaving ? 'Saving…' : 'Save Record'}
                </button>
                <button type="button" onClick={() => setShowCalibForm(false)}
                  style={{ padding: '6px 12px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {calibLoading ? (
            <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</p>
          ) : calibRecords.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>No calibration records yet. Click "+ Add Record" to add one.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Cal. Date', 'Next Due', 'Cert. Ref', 'Performed By', 'Frequency', 'Status'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calibRecords.map(c => (
                  <tr key={c.calibrationId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px' }}>{c.calibrationDate?.slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px' }}>{c.nextCalibrationDue?.slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', color: '#2563eb' }}>{c.certificateRef}</td>
                    <td style={{ padding: '6px 8px' }}>{c.performedBy}</td>
                    <td style={{ padding: '6px 8px' }}>{c.frequency || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {c.isApproved
                        ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Approved</span>
                        : <span style={{ color: '#d97706' }}>Pending QA</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Drawer>
      )}

      {/* Return to Service — QA §11.50 e-sig */}
      {showRtsForm && selectedBreakdownId && (
        <ESignatureDrawer
          title={`Return to Service — Breakdown #${selectedBreakdownId}`}
          subtitle="Marks instrument Available and triggers OOC impact assessment (21 CFR Part 11)"
          form={rtsForm} onChange={setRtsForm}
          onSubmit={submitRts}
          onClose={() => setShowRtsForm(false)}
          saving={saving} error={error}
          label="Approve & Return to Service"
          reasonLabel="Reason for Signature"
          reasonPlaceholder="e.g. Instrument verified in-spec post-repair"
          passwordOnly
        >
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
              ⚠ Triggers OOC impact assessment on all logbook entries during the breakdown window.
            </p>
          </div>
        </ESignatureDrawer>
      )}
    </div>
  )
}
