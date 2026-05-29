import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LogbookEntry {
  entryId: number; sampleId: number; sampleNumber: string; executionId: number
  parameterId: number; parameterName: string; isCritical: boolean
  triggerSource: string
  rawValue: string; calculatedResult: number | null
  autoCorectionApplied: boolean; correctionDetail: string | null
  specMinSnapshot: number | null; specMaxSnapshot: number | null
  passFail: string; isOos: boolean; isOot: boolean
  instrumentName: string | null; analystName: string
  evidenceFileRef: string | null; status: string
  signedByFullName: string | null; signedAt: string | null
  createdAt: string
}

interface CheckpointParam { parameterId: number; parameterName: string; parameterCode: string; uom: string | null; dataType: string }

interface ProcessLogRow {
  rowId: number; checkpointId: number; checkpointCode: string; triggerMode: string
  slotTime: string; slotLabel: string; status: string; isSigned: boolean
}

interface SignForm { password: string; meaning: string; reason: string }

const TRIGGER_COLORS: Record<string, { bg: string; color: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9' },
}

type Tab = 'logbook' | 'processlog'

export default function DigitalLogbookPage() {
  const [tab, setTab] = useState<Tab>('logbook')

  // ── Logbook tab state ──────────────────────────────────────────────────────
  const [data, setData]               = useState<LogbookEntry[]>([])
  const [loading, setLoading]         = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [oosFilter, setOosFilter]     = useState('')

  // Amendment
  const [amendEntry, setAmendEntry]   = useState<LogbookEntry | null>(null)
  const [amendForm, setAmendForm]     = useState<{ newRawValue: string; amendmentReason: string; password: string; meaning: string; reason: string }>({
    newRawValue: '', amendmentReason: '', password: '',
    meaning: 'I attest the amendment is accurate and complete', reason: ''
  })
  const [amendSaving, setAmendSaving] = useState(false)
  const [amendError, setAmendError]   = useState('')

  // ── Process Log tab state ──────────────────────────────────────────────────
  const [plRows, setPlRows]           = useState<ProcessLogRow[]>([])
  const [plLoading, setPlLoading]     = useState(false)
  const [plDate, setPlDate]           = useState<string>(new Date().toISOString().slice(0, 10))
  const [plStatusFilter, setPlStatusFilter] = useState<string>('')

  // Sign modal
  const [signRow, setSignRow]         = useState<ProcessLogRow | null>(null)
  const [signForm, setSignForm]       = useState<SignForm>({ password: '', meaning: 'I confirm this process log entry is accurate', reason: '' })
  const [signSaving, setSignSaving]   = useState(false)
  const [signError, setSignError]     = useState('')
  const [signReadings, setSignReadings] = useState<Record<number, string>>({})
  const [cpParams, setCpParams]       = useState<CheckpointParam[]>([])

  // ── Logbook load ───────────────────────────────────────────────────────────
  async function loadLogbook() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const r = await api.get(`/digital-logbook?${params.toString()}`)
    let rows: LogbookEntry[] = r.data
    if (oosFilter === 'oos')      rows = rows.filter(e => e.isOos)
    else if (oosFilter === 'oot') rows = rows.filter(e => e.isOot)
    else if (oosFilter === 'critical') rows = rows.filter(e => e.isCritical)
    setData(rows); setLoading(false)
  }
  useEffect(() => { if (tab === 'logbook') loadLogbook() }, [statusFilter, oosFilter, tab])

  // ── Process Log load ───────────────────────────────────────────────────────
  async function loadProcessLog() {
    setPlLoading(true)
    try {
      const r = await api.get(`/checkpoints/process-log?date=${plDate}`)
      setPlRows(r.data)
    } catch { setPlRows([]) }
    finally { setPlLoading(false) }
  }
  useEffect(() => { if (tab === 'processlog') loadProcessLog() }, [tab, plDate])

  // ── Amendment submit ───────────────────────────────────────────────────────
  async function handleAmend(e: React.FormEvent) {
    e.preventDefault(); setAmendSaving(true); setAmendError('')
    try {
      await api.post(`/digital-logbook/${amendEntry!.entryId}/amend`, amendForm)
      toast('Amendment created — original preserved as Superseded', 'success')
      setAmendEntry(null); loadLogbook()
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'ESIGN_AUTH_FAILED') setAmendError('Password incorrect')
      else setAmendError(err.response?.data?.message ?? 'Amendment failed')
    } finally { setAmendSaving(false) }
  }

  // ── Sign process log row ───────────────────────────────────────────────────
  async function handleSign(e: React.FormEvent) {
    e.preventDefault(); setSignSaving(true); setSignError('')
    if (!signRow) return
    try {
      const readingsList = Object.entries(signReadings)
        .filter(([, v]) => v.trim() !== '')
        .map(([parameterId, value]) => ({ parameterId: Number(parameterId), value }))
      await api.post(`/checkpoints/${signRow.checkpointId}/process-log/${signRow.rowId}/sign`,
        { ...signForm, readings: readingsList })
      toast(`Process log row signed and locked ✓`, 'success')
      setSignRow(null); setSignReadings({}); setCpParams([])
      loadProcessLog()
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'ESIGN_AUTH_FAILED') setSignError('Password incorrect')
      else setSignError(err.response?.data?.message ?? 'Sign failed')
    } finally { setSignSaving(false) }
  }

  function exportCsv() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
    window.open(`${base}/digital-logbook/export?${params.toString()}`)
  }

  const filteredPlRows = plStatusFilter
    ? plRows.filter(r => r.status === plStatusFilter)
    : plRows

  const openCount  = plRows.filter(r => r.status === 'Open').length
  const lockedCount = plRows.filter(r => r.status === 'Locked').length

  return (
    <div>
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111827' }}>Digital Logbook</h1>
        {tab === 'processlog' && openCount > 0 && (
          <span style={{ padding: '4px 12px', background: '#fef9c3', color: '#854d0e', borderRadius: 20, fontSize: 13, fontWeight: 700, border: '1px solid #fde68a' }}>
            🔔 {openCount} row{openCount > 1 ? 's' : ''} pending sign-off
          </span>
        )}
      </div>

      {/* ── Tab strip ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { id: 'logbook' as Tab,    label: '📋 Test Results',   desc: 'Sample test execution records' },
          { id: 'processlog' as Tab, label: '📝 Process Log',    desc: 'Checkpoint shift sign-offs' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: tab === t.id ? '2px solid #0369a1' : '2px solid transparent',
            background: 'transparent', marginBottom: -2,
            color: tab === t.id ? '#0369a1' : '#6b7280',
            fontWeight: tab === t.id ? 700 : 500, fontSize: 14,
          }}>
            {t.label}
            {t.id === 'processlog' && openCount > 0 && (
              <span style={{ marginLeft: 6, padding: '1px 7px', background: '#f59e0b', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — Test Results (existing logbook)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'logbook' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Signed">Signed</option>
              <option value="Superseded">Superseded</option>
            </select>
            <select style={{ ...inp, width: 160, marginTop: 0 }} value={oosFilter} onChange={e => setOosFilter(e.target.value)}>
              <option value="">All Results</option>
              <option value="oos">OOS Only</option>
              <option value="oot">OOT Only</option>
              <option value="critical">Critical Parameters</option>
            </select>
            <button onClick={exportCsv} style={{ padding: '6px 14px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>
              ⬇ Export CSV
            </button>
          </div>

          <DataTable loading={loading} data={data} columns={[
            { header: 'Sample', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
            { header: 'Parameter', accessor: r => (
              <div>
                {r.parameterName}
                {r.isCritical && <span style={{ marginLeft: 4, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>CRITICAL</span>}
              </div>
            )},
            { header: 'Trigger', accessor: r => {
              const c = TRIGGER_COLORS[r.triggerSource] ?? { bg: '#f3f4f6', color: '#374151' }
              return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{r.triggerSource}</span>
            }},
            { header: 'Raw / Calculated', accessor: r => (
              <div>
                <span style={{ fontFamily: 'monospace' }}>{r.rawValue}</span>
                {r.calculatedResult !== null && r.calculatedResult.toString() !== r.rawValue && (
                  <span style={{ marginLeft: 6, fontSize: 12, color: '#2563eb' }}>→ {r.calculatedResult}</span>
                )}
                {r.autoCorectionApplied && <span style={{ marginLeft: 4, fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 4px', borderRadius: 4 }}>CORRECTED</span>}
              </div>
            )},
            { header: 'Spec (Min–Max)', accessor: r => r.specMinSnapshot !== null || r.specMaxSnapshot !== null
              ? `${r.specMinSnapshot ?? '—'} – ${r.specMaxSnapshot ?? '—'}` : '—' },
            { header: 'Result', accessor: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: r.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
                  color: r.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{r.passFail}</span>
                {r.isOos && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>OOS</span>}
                {r.isOot && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fef9c3', color: '#854d0e' }}>OOT</span>}
              </div>
            )},
            { header: 'Analyst', accessor: 'analystName' },
            { header: 'Evidence', accessor: r => r.evidenceFileRef
              ? <span style={{ fontSize: 12, color: '#16a34a' }}>✓ {r.evidenceFileRef}</span>
              : r.isCritical ? <span style={{ fontSize: 12, color: '#dc2626' }}>✗ Missing</span> : '—' },
            { header: 'Status', accessor: r => (
              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
                background: r.status === 'Signed' ? '#d1fae5' : r.status === 'Superseded' ? '#f3f4f6' : '#fef9c3',
                color: r.status === 'Signed' ? '#065f46' : r.status === 'Superseded' ? '#6b7280' : '#854d0e' }}>{r.status}</span>
            )},
            { header: 'Signed By / At', accessor: r => r.signedByFullName
              ? <span style={{ fontSize: 12 }}>{r.signedByFullName}<br /><span style={{ color: '#6b7280' }}>{new Date(r.signedAt!).toLocaleString()}</span></span>
              : '—' },
            { header: 'Actions', accessor: r => r.status === 'Signed' ? (
              <button onClick={() => { setAmendEntry(r); setAmendForm({ newRawValue: r.rawValue, amendmentReason: '', password: '', meaning: 'I attest the amendment is accurate and complete', reason: '' }); setAmendError('') }}
                style={{ padding: '3px 8px', background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Amend
              </button>
            ) : null },
          ]} />
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — Process Log (checkpoint shift sign-offs)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'processlog' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginRight: 6 }}>Date</label>
              <input type="date" style={{ ...inp, width: 170, marginTop: 0 }} value={plDate}
                onChange={e => setPlDate(e.target.value)} />
            </div>
            <select style={{ ...inp, width: 160, marginTop: 0 }} value={plStatusFilter} onChange={e => setPlStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">Open (pending sign)</option>
              <option value="Locked">Locked (signed)</option>
            </select>
            <button onClick={loadProcessLog}
              style={{ padding: '8px 16px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              🔄 Refresh
            </button>
            {/* Summary chips */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <span style={{ padding: '4px 12px', background: '#fef9c3', color: '#854d0e', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid #fde68a' }}>
                🟡 Open: {openCount}
              </span>
              <span style={{ padding: '4px 12px', background: '#d1fae5', color: '#065f46', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid #6ee7b7' }}>
                ✅ Locked: {lockedCount}
              </span>
            </div>
          </div>

          {/* Process log table */}
          <DataTable loading={plLoading} data={filteredPlRows} columns={[
            { header: 'Checkpoint', accessor: r => (
              <strong style={{ fontFamily: 'monospace', color: '#1e3a5f' }}>{r.checkpointCode}</strong>
            )},
            { header: 'Mode', accessor: r => {
              const c = TRIGGER_COLORS[r.triggerMode] ?? { bg: '#f3f4f6', color: '#374151' }
              const labels: Record<string, string> = {
                TimeBased: 'Time-Based', OperatorScan: 'Operator Scan',
                ProcessLog: 'Process Log', DispatchEvent: 'Dispatch Event'
              }
              return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{labels[r.triggerMode] ?? r.triggerMode}</span>
            }},
            { header: 'Shift Slot', accessor: r => (
              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 15 }}>{r.slotLabel}</span>
            )},
            { header: 'Date / Time (UTC)', accessor: r => (
              <span style={{ fontSize: 13, color: '#374151' }}>{new Date(r.slotTime).toLocaleString()}</span>
            )},
            { header: 'Status', accessor: r => (
              <span style={{
                padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: r.status === 'Locked' ? '#d1fae5' : '#fef9c3',
                color: r.status === 'Locked' ? '#065f46' : '#854d0e',
              }}>
                {r.status === 'Locked' ? '✅ Locked' : '🟡 Open'}
              </span>
            )},
            { header: 'Action', accessor: r => r.status === 'Open' ? (
              <button
                onClick={async () => {
                  setSignRow(r)
                  setSignForm({ password: '', meaning: 'I confirm this process log entry is accurate', reason: '' })
                  setSignError(''); setSignReadings({})
                  try {
                    const all = await api.get('/checkpoints')
                    const cp = all.data.find((c: any) => c.checkpointId === r.checkpointId)
                    setCpParams(cp?.parameters ?? [])
                  } catch { setCpParams([]) }
                }}
                style={{
                  padding: '6px 16px', background: '#7c3aed', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                }}>
                ✍ Sign & Lock
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>— Signed —</span>
            )},
          ]} />

          {filteredPlRows.length === 0 && !plLoading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>📋</p>
              <p style={{ margin: 0, fontSize: 14 }}>No process log rows for {plDate}.</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>Rows are auto-created at midnight UTC based on checkpoint shift intervals.</p>
            </div>
          )}
        </>
      )}

      {/* ── Amendment Modal ───────────────────────────────────────────────── */}
      {amendEntry && (
        <Modal title="Amend Entry" onClose={() => setAmendEntry(null)}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            21 CFR Part 11 — Original preserved as Superseded. New entry created as Pending.
            E-signature re-authentication required.
          </p>
          <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#374151' }}>
            <strong>Entry #{amendEntry.entryId}</strong> · {amendEntry.parameterName} · Sample {amendEntry.sampleNumber}
            <br />Current value: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{amendEntry.rawValue}</span>
          </div>
          <form onSubmit={handleAmend}>
            <Field label="New Raw Value *">
              <input style={inp} value={amendForm.newRawValue} onChange={e => setAmendForm(f => ({ ...f, newRawValue: e.target.value }))} required />
            </Field>
            <Field label="Amendment Reason *">
              <textarea style={{ ...inp, height: 60, resize: 'vertical' as const }} value={amendForm.amendmentReason}
                onChange={e => setAmendForm(f => ({ ...f, amendmentReason: e.target.value }))} required
                placeholder="e.g. Transcription error — instrument read incorrectly" />
            </Field>
            <Field label="Password *">
              <input type="password" style={inp} value={amendForm.password} onChange={e => setAmendForm(f => ({ ...f, password: e.target.value }))} required />
            </Field>
            <Field label="Meaning *">
              <select style={inp} value={amendForm.meaning} onChange={e => setAmendForm(f => ({ ...f, meaning: e.target.value }))}>
                <option>I attest the amendment is accurate and complete</option>
                <option>Authorship of amendment</option>
                <option>Amendment approved</option>
              </select>
            </Field>
            <Field label="Reason *">
              <input style={inp} value={amendForm.reason} onChange={e => setAmendForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. Correcting data entry error per SOP-LAB-012" />
            </Field>
            {amendError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0' }}>{amendError}</p>}
            <ModalFooter saving={amendSaving} onCancel={() => setAmendEntry(null)} label="Submit Amendment" />
          </form>
        </Modal>
      )}

      {/* ── Sign Process Log Row Modal ────────────────────────────────────── */}
      {signRow && (
        <Modal title="Sign & Lock Process Log Row" onClose={() => setSignRow(null)}>
          <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, marginBottom: 16, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
              {signRow.checkpointCode} — Shift Slot {signRow.slotLabel}
            </div>
            <div style={{ fontSize: 12, color: '#374151' }}>
              {new Date(signRow.slotTime).toLocaleString()} UTC
            </div>
          </div>
          <form onSubmit={handleSign}>
            {/* ── Parameter readings ── */}
            {cpParams.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📊 Enter Parameter Readings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cpParams.map(p => (
                    <div key={p.parameterId} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                        {p.parameterName}
                        <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.parameterCode}</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.dataType === 'PassFail' ? (
                          <select style={{ ...inp, margin: 0, width: '100%' }}
                            value={signReadings[p.parameterId] ?? ''}
                            onChange={e => setSignReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}>
                            <option value="">—</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                          </select>
                        ) : (
                          <input type="number" step="any"
                            style={{ ...inp, margin: 0, width: '100%' }}
                            value={signReadings[p.parameterId] ?? ''}
                            onChange={e => setSignReadings(r => ({ ...r, [p.parameterId]: e.target.value }))}
                            placeholder="value" />
                        )}
                        {p.uom && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{p.uom}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: '#e5e7eb', margin: '14px 0' }} />
              </div>
            )}

            <Field label="Password (re-enter)">
              <input type="password" style={inp} value={signForm.password}
                onChange={e => setSignForm(f => ({ ...f, password: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Meaning">
              <select style={inp} value={signForm.meaning} onChange={e => setSignForm(f => ({ ...f, meaning: e.target.value }))}>
                <option>I confirm this process log entry is accurate</option>
                <option>Authorship of process log entry</option>
                <option>Shift supervisor approval</option>
              </select>
            </Field>
            <Field label="Reason">
              <input style={inp} value={signForm.reason}
                onChange={e => setSignForm(f => ({ ...f, reason: e.target.value }))} required
                placeholder="e.g. End of shift — all parameters within range" />
            </Field>
            {signError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0' }}>{signError}</p>}
            <ModalFooter saving={signSaving} onCancel={() => setSignRow(null)} label="✍ Sign & Lock Row" />
          </form>
        </Modal>
      )}
    </div>
  )
}
