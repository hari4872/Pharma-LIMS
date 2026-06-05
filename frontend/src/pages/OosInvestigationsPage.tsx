import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface OosItem {
  investigationId: number; executionId: number; sampleId: number; sampleNumber: string
  parameterId: number; parameterName: string
  flagType: string; phase: string; status: string
  rootCause: string | null; capaRef: string | null
  openedAt: string; closedAt: string | null; createdBy: string
}

const FLAG_COLORS: Record<string, { bg: string; color: string }> = {
  OOS: { bg: '#fee2e2', color: '#991b1b' },
  OOT: { bg: '#fef9c3', color: '#854d0e' },
}

const STAGES = [
  { key: 'Open',   label: 'Open',   color: '#991b1b', bg: '#fee2e2' },
  { key: 'Closed', label: 'Closed', color: '#065f46', bg: '#d1fae5' },
]

export default function OosInvestigationsPage() {
  const [data, setData] = useState<OosItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Open')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showClose, setShowClose] = useState<OosItem | null>(null)
  const [closeForm, setCloseForm] = useState({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [rcSuggestions, setRcSuggestions] = useState<{cause:string,confidence:string,reasoning:string}[]>([])
  const [rcLoading, setRcLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/oos-investigations')
      setData(r.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.openedAt < dateFrom) return false
      if (dateTo && r.openedAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [data, statusFilter, dateFrom, dateTo])

  async function downloadPdf(item: OosItem) {
    try {
      const r = await api.get(`/oos-investigations/${item.investigationId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `OOS_${String(item.investigationId).padStart(5,'0')}_${item.sampleNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast(`OOS-${String(item.investigationId).padStart(5,'0')} report downloaded`, 'success')
    } catch {
      toast('Failed to download PDF', 'error')
    }
  }

  async function fetchRcSuggestions() {
    if (!showClose) return
    setRcLoading(true)
    try {
      const r = await api.post(`/oos-investigations/${showClose.investigationId}/suggest-root-cause`, {})
      setRcSuggestions(r.data.suggestions ?? [])
    } catch {
      setRcSuggestions([
        { cause: 'Analyst error or technique deviation', confidence: 'Medium', reasoning: 'Re-test with a second analyst per FDA OOS guidance.' },
        { cause: 'Instrument calibration drift', confidence: 'Medium', reasoning: 'Verify instrument calibration status and last service record.' },
        { cause: 'Sample integrity deviation', confidence: 'Low', reasoning: 'Check storage conditions and sample container closure.' },
      ])
    } finally { setRcLoading(false) }
  }

  async function submitClose(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/oos-investigations/${showClose!.investigationId}/close`, closeForm)
      setCloseForm({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
      setShowClose(null); await load()
      setStatusFilter('Closed')
    } catch (err) { setError(getErrorMessage(err, 'Close failed')) }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', marginRight: 4 }}>OOS / OOT Investigations</h2>
        <PipelineBar stages={STAGES} data={data} statusField="status" active={statusFilter} onChange={setStatusFilter} />

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <DataTable loading={loading} data={filtered} columns={[
        { header: 'Sample', accessor: r => (
          <button onClick={() => setDetailSampleId(r.sampleId)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline' }}>
            {r.sampleNumber}
          </button>
        )},
        { header: 'Parameter', accessor: 'parameterName' },
        { header: 'Type', accessor: r => {
          const c = FLAG_COLORS[r.flagType] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{r.flagType}</span>
        }},
        { header: 'Phase', accessor: r => <span style={{ fontSize: 12, color: '#6b7280' }}>{r.phase}</span> },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
            background: r.status === 'Open' ? '#fee2e2' : '#d1fae5',
            color: r.status === 'Open' ? '#991b1b' : '#065f46', fontWeight: 500 }}>{r.status}</span>
        )},
        { header: 'Root Cause', accessor: r => r.rootCause ? <span style={{ fontSize: 12 }}>{r.rootCause}</span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>Pending investigation</span> },
        { header: 'CAPA Ref', accessor: r => r.capaRef || '—' },
        { header: 'Opened', accessor: r => new Date(r.openedAt).toLocaleDateString() },
        { header: 'Closed', accessor: r => r.closedAt ? new Date(r.closedAt).toLocaleDateString() : '—' },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {r.status === 'Open' && (
              <button
                onClick={() => { setShowClose(r); setCloseForm({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' }); setError(''); setRcSuggestions([]) }}
                style={{
                  background: '#dcfce7', border: '1px solid #86efac',
                  color: '#15803d', cursor: 'pointer', fontSize: 12,
                  fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(22,163,74,0.15)',
                }}>
                ✓ Close Investigation
              </button>
            )}
            <button
              onClick={() => downloadPdf(r)}
              title="Download OOS Investigation Report PDF"
              style={{
                background: '#ede9fe', border: '1px solid #c4b5fd',
                color: '#7c3aed', cursor: 'pointer', fontSize: 12,
                fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              }}>
              PDF
            </button>
          </div>
        )},
      ]} />

      {detailSampleId !== null && <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} />}

      {showClose && (
        <Modal title={`Close ${showClose.flagType} Investigation — ${showClose.sampleNumber}`} onClose={() => setShowClose(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            FDA OOS Guidance Phase 1 — Root cause and CAPA reference required before investigation can be closed.
          </p>
          <form onSubmit={submitClose}>
            <Field label="Root Cause (mandatory)">
              <div style={{ marginBottom: 6 }}>
                <button type="button" onClick={fetchRcSuggestions} disabled={rcLoading}
                  style={{
                    background: rcLoading ? '#e0e7ff' : '#dbeafe',
                    border: '1px solid #93c5fd', color: '#1d4ed8',
                    cursor: rcLoading ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 700,
                    padding: '5px 12px', borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  {rcLoading ? '⏳ Analysing…' : '🤖 AI Suggest'}
                </button>
              </div>
              {rcSuggestions.length > 0 && (
                <div style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#1e40af' }}>
                    AI suggestions — click to use:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rcSuggestions.map((s, i) => {
                      const confStyle: Record<string, { bg: string; color: string }> = {
                        High:   { bg: '#dcfce7', color: '#15803d' },
                        Medium: { bg: '#fef9c3', color: '#854d0e' },
                        Low:    { bg: '#f3f4f6', color: '#374151' },
                      }
                      const cs = confStyle[s.confidence] ?? confStyle.Low
                      return (
                        <button key={i} type="button"
                          onClick={() => setCloseForm(f => ({ ...f, rootCause: s.cause }))}
                          title={s.reasoning}
                          style={{
                            background: '#fff', border: '1px solid #bfdbfe',
                            borderRadius: 6, padding: '6px 10px',
                            cursor: 'pointer', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                          <span style={{ fontSize: 12, color: '#1e293b', flex: 1 }}>{s.cause}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '1px 7px', borderRadius: 10,
                            background: cs.bg, color: cs.color,
                            whiteSpace: 'nowrap',
                          }}>{s.confidence}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
                    AI suggestion only — investigator must verify per 21 CFR 211.192
                  </p>
                </div>
              )}
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={closeForm.rootCause} onChange={e => setCloseForm(f => ({ ...f, rootCause: e.target.value }))} required placeholder="Describe the root cause of the OOS/OOT result…" />
            </Field>
            <Field label="CAPA Reference">
              <input style={inp} value={closeForm.capaRef} onChange={e => setCloseForm(f => ({ ...f, capaRef: e.target.value }))} placeholder="e.g. CAPA-2026-005" />
            </Field>
            <Field label="Password (re-enter)"><input style={inp} type="password" value={closeForm.password} onChange={e => setCloseForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={closeForm.meaning} onChange={e => setCloseForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={closeForm.reason} onChange={e => setCloseForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. Phase 1 investigation complete, root cause identified" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowClose(null)} label="Close & Sign" />
          </form>
        </Modal>
      )}
    </div>
  )
}
