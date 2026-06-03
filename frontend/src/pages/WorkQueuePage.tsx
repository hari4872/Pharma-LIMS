import { useEffect, useState, useRef, useCallback } from 'react'
import { getErrorMessage, asApiError } from '@/utils/errors'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'
import SampleDetailSheet from '@/components/SampleDetailSheet'
import BatchResultEntryPage from './BatchResultEntryPage'

interface WorkItem {
  executionId: number; sampleId: number; sampleNumber: string; materialName: string
  materialId: number; lotNumber: string; analystName: string; instrumentCode: string
  status: string; priorityScore: number | null
  startedAt: string | null; completedAt: string | null
  dueDate: string | null; createdAt: string
}
interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; specTemplateId?: number }
interface Analyst { userId: number; fullName: string }
interface Instrument { instrumentId: number; instrumentCode: string }
interface SuggestedInstrument {
  instrumentId:   number
  instrumentCode: string
  instrumentType: string
  model:          string | null
  calibrationDue: string
  priority:       number
  notes:          string | null
  labName:        string
}

// AI Intelligence interfaces
interface AnalystLoad { userId: number; fullName: string; assigned: number; inProgress: number; overdue: number }
interface PriorityBand { band: string; count: number }
interface QueueIntelligence { labId: number; totalOpen: number; overdue: number; oosOpen: number; avgTatHours: number | null; analystLoads: AnalystLoad[]; priorityBands: PriorityBand[] }
interface WorkloadSuggestion { userId: number; fullName: string; activeCount: number; reason: string }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Assigned:   { bg: '#dbeafe', color: '#1e40af' },
  InProgress: { bg: '#fef9c3', color: '#854d0e' },
  Completed:  { bg: '#d1fae5', color: '#065f46' },
  OOSOpen:    { bg: '#fee2e2', color: '#991b1b' },
}

const BAND_COLORS: Record<string, { bg: string; color: string }> = {
  Critical: { bg: '#fee2e2', color: '#991b1b' },
  High:     { bg: '#fef3c7', color: '#92400e' },
  Medium:   { bg: '#dbeafe', color: '#1e40af' },
  Low:      { bg: '#f3f4f6', color: '#374151' },
}

function priorityBadge(score: number | null): { label: string; bg: string; color: string; border: string } {
  if (score === null)  return { label: '⚪ Unset',   bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
  if (score === 1)     return { label: '🔴 URGENT',  bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
  if (score <= 10)     return { label: '🟠 HIGH',    bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
  if (score <= 50)     return { label: '🟡 MEDIUM',  bg: '#fefce8', color: '#854d0e', border: '#fde68a' }
  return                      { label: '🟢 NORMAL',  bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
}

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', border: 'none',
  borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
  background: 'transparent',
  color: active ? '#0d9488' : '#6b7280',
  fontWeight: active ? 700 : 500,
  fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', marginBottom: -2,
  transition: 'all 0.15s',
})

export default function WorkQueuePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'queue' | 'batch'>('queue')
  const [data, setData] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [samples, setSamples] = useState<Sample[]>([])
  const [analysts, setAnalysts] = useState<Analyst[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [form, setForm] = useState({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Re-assign (per-test-method)
  const [reassignItem, setReassignItem]   = useState<WorkItem | null>(null)
  const [reassignForm, setReassignForm]   = useState({ analystId: '', instrumentId: '', priorityScore: '' })
  const [reassignSaving, setReassignSaving] = useState(false)
  const [reassignError, setReassignError]   = useState('')
  // Phase D — auto-suggest
  const [suggestions, setSuggestions]       = useState<SuggestedInstrument[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  // AI Intelligence
  const [showAi, setShowAi]           = useState(false)
  const [aiData, setAiData]           = useState<QueueIntelligence | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<WorkloadSuggestion | null>(null)
  const [aiLoading, setAiLoading]     = useState(false)

  // Barcode scan
  const [scanQuery, setScanQuery]       = useState('')
  const [scanResults, setScanResults]   = useState<WorkItem[] | null>(null)
  const scanInputRef                    = useRef<HTMLInputElement>(null)
  const scanBuffer                      = useRef('')
  const scanLastKey                     = useRef(0)
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const r = await api.get(`/test-executions${params}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [statusFilter])

  // ── Barcode scan / search ────────────────────────────────────────────────
  const runScan = useCallback((value: string) => {
    const q = value.trim().toUpperCase()
    if (!q) { setScanResults(null); return }
    const matches = data
      .filter(w => w.sampleNumber.toUpperCase().includes(q))
      .sort((a, b) => {
        // Sort: active statuses first, then by priority (lower = more urgent)
        const activeA = a.status === 'Assigned' || a.status === 'InProgress' ? 0 : 1
        const activeB = b.status === 'Assigned' || b.status === 'InProgress' ? 0 : 1
        if (activeA !== activeB) return activeA - activeB
        const pa = a.priorityScore ?? 999
        const pb = b.priorityScore ?? 999
        return pa - pb
      })
    setScanResults(matches)
    if (matches.length === 0) toast(`No work items found for "${value.trim()}"`, 'error')
  }, [data])

  // Global keyboard listener — captures scanner rapid-fire input from anywhere on the page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inOtherInput = ['INPUT','SELECT','TEXTAREA'].includes(target.tagName) &&
                           target.id !== 'wq-scan-input'
      if (inOtherInput) return   // don't interfere with forms / modals

      const now = Date.now()
      // Gap > 80ms between keys = human typing; reset buffer
      if (now - scanLastKey.current > 80) scanBuffer.current = ''
      scanLastKey.current = now

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 3) {
          const val = scanBuffer.current
          setScanQuery(val)
          scanBuffer.current = ''
          // Also populate the visible input
          if (scanInputRef.current) scanInputRef.current.value = val
          runScan(val)
          e.preventDefault()
        }
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runScan])

  async function toggleAi() {
    if (showAi) { setShowAi(false); return }
    setShowAi(true)
    if (aiData) return // already loaded
    setAiLoading(true)
    try {
      const [qr, sr] = await Promise.all([
        api.get('/test-executions/queue-intelligence'),
        api.get('/test-executions/suggest-analyst'),
      ])
      setAiData(qr.data)
      setAiSuggestion(sr.data)
    } catch {
      toast('Failed to load AI intelligence', 'error')
    } finally { setAiLoading(false) }
  }

  async function openAssign() {
    const [sr, ur, ir] = await Promise.all([
      api.get('/samples?status=PendingTesting').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: [] })),
      api.get('/instruments').catch(() => ({ data: [] })),
    ])
    setSamples(sr.data); setAnalysts(ur.data); setInstruments(ir.data)
    setSuggestions([]); setForm({ sampleId: '', analystId: '', instrumentId: '', priorityScore: '' })
    setShowAssign(true)
  }

  async function fetchSuggestions(sampleId: string) {
    if (!sampleId) { setSuggestions([]); return }
    // Find the sample to get its spec template items (which carry test method IDs)
    // For now, query without filter to get all available instruments — the endpoint
    // returns all Available+calibrated instruments sorted by priority
    setSuggestLoading(true)
    try {
      const res = await api.get('/test-executions/suggest-instrument')
      setSuggestions(res.data)
    } catch {
      setSuggestions([])
    } finally { setSuggestLoading(false) }
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/test-executions', {
        sampleId: Number(form.sampleId),
        analystId: Number(form.analystId),
        instrumentId: Number(form.instrumentId),
        priorityScore: form.priorityScore ? Number(form.priorityScore) : null,
      })
      setShowAssign(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Assignment failed')) }
    finally { setSaving(false) }
  }

  async function openReassign(item: WorkItem) {
    if (analysts.length === 0) {
      const [ur, ir] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/instruments').catch(() => ({ data: [] })),
      ])
      setAnalysts(ur.data); setInstruments(ir.data)
    }
    setReassignItem(item)
    setReassignForm({ analystId: '', instrumentId: '', priorityScore: item.priorityScore != null ? String(item.priorityScore) : '' })
    setReassignError('')
  }

  async function submitReassign(e: React.FormEvent) {
    e.preventDefault(); setReassignSaving(true); setReassignError('')
    try {
      await api.post(`/test-executions/${reassignItem!.executionId}/assign`, {
        analystId:    Number(reassignForm.analystId),
        instrumentId: Number(reassignForm.instrumentId),
        priorityScore: reassignForm.priorityScore ? Number(reassignForm.priorityScore) : null,
      })
      toast('Execution re-assigned successfully', 'success')
      setReassignItem(null); load()
    } catch (err) {
      const e = asApiError(err)
      const code = e.response?.data?.error
      if (code === 'TRAINING_EXPIRED') setReassignError('Analyst training expired — cannot assign (21 CFR 11.10(i))')
      else if (code === 'INSTRUMENT_OOC') setReassignError('Instrument out of calibration (21 CFR 211.68)')
      else setReassignError(getErrorMessage(err, 'Re-assign failed'))
    } finally { setReassignSaving(false) }
  }

  async function startTask(executionId: number) {
    try {
      await api.post(`/test-executions/${executionId}/start`, {})
      navigate(`/test-execution/${executionId}`)
    } catch (err) {
      const e = asApiError(err)
      const status = e.response?.status
      if (status === 403) toast('Permission denied — only Analyst, QC Lead or Admin can start tasks', 'error')
      else toast(getErrorMessage(err, 'Start failed — please try again'), 'error')
    }
  }

  function isOverdue(item: WorkItem) {
    return item.dueDate && new Date(item.dueDate) < new Date() &&
      (item.status === 'Assigned' || item.status === 'InProgress')
  }

  return (
    <div>
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button style={TAB_STYLE(tab === 'queue')} onClick={() => setTab('queue')}>
          <span>📋</span> Queue
        </button>
        <button style={TAB_STYLE(tab === 'batch')} onClick={() => setTab('batch')}>
          <span>🔬</span> Batch Entry
        </button>
      </div>

      {tab === 'batch' && <BatchResultEntryPage />}
      {tab === 'queue' && <div>
      {/* ── Barcode Scan Bar ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 18 }}>📷</span>
        <input
          id="wq-scan-input"
          ref={scanInputRef}
          type="text"
          placeholder="Scan barcode or type sample number and press Enter…"
          value={scanQuery}
          onChange={e => setScanQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { runScan(scanQuery); e.preventDefault() } }}
          style={{
            flex: 1, border: '1px solid #cbd5e1', borderRadius: 7, padding: '7px 12px',
            fontSize: 13, fontFamily: 'monospace', outline: 'none', background: '#fff',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => runScan(scanQuery)}
          style={{ padding: '7px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Search
        </button>
        {scanResults !== null && (
          <button
            onClick={() => { setScanResults(null); setScanQuery(''); if (scanInputRef.current) scanInputRef.current.value = '' }}
            style={{ padding: '7px 12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          Click field · scan label · Enter
        </span>
      </div>

      {/* ── Scan Results ───────────────────────────────────────────────────── */}
      {scanResults !== null && scanResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            {scanResults.length === 1 ? '1 work item found' : `${scanResults.length} work items found — sorted by priority`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scanResults.map(r => {
              const pb      = priorityBadge(r.priorityScore)
              const overdue = r.dueDate && new Date(r.dueDate) < new Date() && (r.status === 'Assigned' || r.status === 'InProgress')
              const sc      = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
              return (
                <div key={r.executionId} style={{
                  border: `2px solid ${pb.border}`, borderRadius: 10,
                  background: pb.bg, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                  {/* Priority badge */}
                  <div style={{
                    minWidth: 96, padding: '4px 12px', borderRadius: 20, textAlign: 'center',
                    background: '#fff', border: `1.5px solid ${pb.border}`,
                    fontSize: 12, fontWeight: 700, color: pb.color, whiteSpace: 'nowrap',
                  }}>
                    {pb.label}
                    {r.priorityScore !== null && <span style={{ marginLeft: 4, opacity: 0.7 }}>#{r.priorityScore}</span>}
                  </div>

                  {/* Sample info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#111827' }}>{r.sampleNumber}</span>
                      {overdue && <span style={{ fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '1px 7px', borderRadius: 8 }}>⚠ OVERDUE</span>}
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: sc.bg, color: sc.color }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      <strong>{r.materialName}</strong>
                      {r.lotNumber && <span style={{ color: '#6b7280', marginLeft: 8 }}>Lot: {r.lotNumber}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>👤 {r.analystName || '—'}</span>
                      <span>🔬 {r.instrumentCode || '—'}</span>
                      {r.dueDate && <span style={{ color: overdue ? '#dc2626' : '#6b7280' }}>📅 Due: {new Date(r.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.status === 'Assigned' && (
                      <button onClick={() => startTask(r.executionId)}
                        style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        ▶ Start Task
                      </button>
                    )}
                    {r.status === 'InProgress' && (
                      <a href={`/test-execution/${r.executionId}`}
                        style={{ padding: '7px 16px', background: '#7c3aed', color: '#fff', borderRadius: 7, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                        📋 Enter Results
                      </a>
                    )}
                    {(r.status === 'Assigned' || r.status === 'InProgress') && (
                      <button onClick={() => openReassign(r)}
                        style={{ padding: '7px 14px', background: '#fff', color: '#6d28d9', border: '1.5px solid #ddd6fe', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        ↩ Re-assign
                      </button>
                    )}
                    {(r.status === 'Completed' || r.status === 'OOSOpen') && (
                      <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', padding: '7px 0' }}>
                        {r.status === 'Completed' ? '✓ Task completed' : '⚠ OOS under investigation'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        <select style={{ ...inp, width: 180, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Assigned', 'InProgress', 'Completed', 'OOSOpen'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={toggleAi}
          style={{
            padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${showAi ? '#14b8a6' : '#99f6e4'}`,
            background: showAi ? '#14b8a6' : '#f0fdfa', color: showAi ? '#fff' : '#0f766e',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          🧠 AI Intelligence
        </button>
        <button onClick={openAssign} style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + Assign Task
        </button>
      </div>

      {/* ── AI Intelligence Panel ───────────────────────────────────────── */}
      {showAi && (
        <div style={{
          background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 12,
          padding: '18px 20px', marginBottom: 18, position: 'relative',
        }}>
          {/* Close button */}
          <button
            onClick={() => setShowAi(false)}
            style={{
              position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
              fontSize: 18, color: '#0f766e', cursor: 'pointer', lineHeight: 1,
            }}
            title="Close"
          >×</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>🧠 AI Queue Intelligence</span>
            {aiLoading && <span style={{ fontSize: 12, color: '#0d9488' }}>Loading…</span>}
            {!aiLoading && aiData && (
              <button
                onClick={() => { setAiData(null); setAiSuggestion(null); toggleAi() }}
                style={{ marginLeft: 'auto', marginRight: 28, fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >Refresh</button>
            )}
          </div>

          {aiLoading && (
            <div style={{ color: '#0d9488', fontSize: 13, padding: '8px 0' }}>Fetching queue intelligence…</div>
          )}

          {!aiLoading && aiData && (
            <>
              {/* Top Stats Row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Open', value: String(aiData.totalOpen), alert: false },
                  { label: 'Overdue', value: String(aiData.overdue), alert: aiData.overdue > 0 },
                  { label: 'OOS Open', value: String(aiData.oosOpen), alert: aiData.oosOpen > 0 },
                  { label: 'Avg TAT (hrs)', value: aiData.avgTatHours != null ? aiData.avgTatHours.toFixed(1) : '—', alert: false },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: '#fff', border: `1.5px solid ${stat.alert ? '#fca5a5' : '#ccfbf1'}`,
                    borderRadius: 10, padding: '10px 18px', minWidth: 110, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.alert ? '#dc2626' : '#0f766e' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Analyst Loads Table */}
                {aiData.analystLoads.length > 0 && (
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Analyst Loads
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#ccfbf1' }}>
                          {['Analyst', 'Assigned', 'In Progress', 'Overdue'].map(h => (
                            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: '#0f766e', fontWeight: 600, borderBottom: '1px solid #99f6e4' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {aiData.analystLoads.map(al => (
                          <tr key={al.userId} style={{ borderBottom: '1px solid #e6fffa' }}>
                            <td style={{ padding: '5px 10px', color: '#111', fontWeight: 500 }}>{al.fullName}</td>
                            <td style={{ padding: '5px 10px', color: '#374151', textAlign: 'center' }}>{al.assigned}</td>
                            <td style={{ padding: '5px 10px', color: '#92400e', textAlign: 'center' }}>{al.inProgress}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              {al.overdue > 0
                                ? <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }}>{al.overdue}</span>
                                : <span style={{ color: '#6b7280' }}>0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Priority Bands */}
                {aiData.priorityBands.length > 0 && (
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Priority Bands
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {aiData.priorityBands.map(pb => {
                        const c = BAND_COLORS[pb.band] ?? { bg: '#f3f4f6', color: '#374151' }
                        return (
                          <span key={pb.band} style={{
                            background: c.bg, color: c.color,
                            borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            {pb.band}
                            <span style={{
                              background: c.color, color: '#fff', borderRadius: '50%',
                              width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{pb.count}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Analyst */}
              {aiSuggestion && (
                <div style={{
                  marginTop: 14, background: '#fff', border: '1.5px solid #a7f3d0',
                  borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <div>
                    <span style={{ fontWeight: 700, color: '#065f46' }}>Suggested: {aiSuggestion.fullName}</span>
                    <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>(Active: {aiSuggestion.activeCount})</span>
                    <span style={{ color: '#374151', fontSize: 13, marginLeft: 8 }}>— {aiSuggestion.reason}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <DataTable loading={loading} data={data}
        rowStyle={r => {
          if (!scanResults || scanResults.length === 0) return {}
          const isMatch = scanResults.some(s => s.executionId === r.executionId)
          return isMatch
            ? { background: '#fffbeb', outline: '2px solid #fcd34d', outlineOffset: '-2px' }
            : { opacity: 0.4 }
        }}
        columns={[
        { header: 'Sample No.', accessor: r => (
          <div>
            <button onClick={() => setDetailSampleId(r.sampleId)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f', fontSize: 'inherit', textDecoration: 'underline dotted' }}
              title="Click to view sample details">
              {r.sampleNumber}
            </button>
            {isOverdue(r) && <span style={{ marginLeft: 6, fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 8 }}>OVERDUE</span>}
            {scanResults?.some(s => s.executionId === r.executionId) && (
              <span style={{ marginLeft: 6, fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>● MATCHED</span>
            )}
          </div>
        )},
        { header: 'Material / Lot', accessor: r => <span>{r.materialName}<br /><span style={{ fontSize: 12, color: '#6b7280' }}>{r.lotNumber}</span></span> },
        { header: 'Analyst', accessor: 'analystName' },
        { header: 'Instrument', accessor: 'instrumentCode' },
        { header: 'Priority', accessor: 'priorityScore', render: r => {
          const pb = priorityBadge(r.priorityScore)
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: pb.bg, color: pb.color, border: `1px solid ${pb.border}` }}>{pb.label}</span>
        }},
        { header: 'Status', accessor: r => {
          const c = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{r.status}</span>
        }},
        { header: 'Due', accessor: r => r.dueDate ? <span style={{ color: isOverdue(r) ? '#dc2626' : '#374151' }}>{new Date(r.dueDate).toLocaleDateString()}</span> : '—' },
        { header: 'Started', accessor: r => r.startedAt ? new Date(r.startedAt).toLocaleString() : '—' },
        { header: 'Actions', accessor: r => (
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status === 'Assigned' && (
              <button onClick={() => startTask(r.executionId)}
                style={{ padding: '3px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Start Task
              </button>
            )}
            {r.status === 'Assigned' && (
              <button onClick={() => openReassign(r)}
                style={{ padding: '3px 8px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Re-assign
              </button>
            )}
            {r.status === 'InProgress' && (
              <a href={`/test-execution/${r.executionId}`}
                style={{ padding: '3px 8px', background: '#7c3aed', color: '#fff', borderRadius: 4, textDecoration: 'none', fontSize: 11 }}>
                Enter Results
              </a>
            )}
          </div>
        )},
      ]} />

      {/* ── Re-assign Modal ───────────────────────────────────────────── */}
      {reassignItem && (
        <Modal title={`Re-assign Execution #${reassignItem.executionId} — ${reassignItem.sampleNumber}`} onClose={() => setReassignItem(null)}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            ℹ Per-test-method assignment — overrides analyst and instrument for this specific execution.
            Training and calibration checks enforced server-side.
          </p>
          <form onSubmit={submitReassign}>
            <Field label="New Analyst">
              <select style={inp} value={reassignForm.analystId} onChange={e => setReassignForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="New Instrument">
              <select style={inp} value={reassignForm.instrumentId} onChange={e => setReassignForm(f => ({ ...f, instrumentId: e.target.value }))} required>
                <option value="">Select instrument…</option>
                {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (optional)">
              <input style={inp} type="number" min="1" max="100" value={reassignForm.priorityScore}
                onChange={e => setReassignForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="1–100 (lower = higher priority)" />
            </Field>
            {reassignError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0' }}>{reassignError}</p>}
            <ModalFooter saving={reassignSaving} onCancel={() => setReassignItem(null)} label="Re-assign" />
          </form>
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Task" onClose={() => setShowAssign(false)}>
          <form onSubmit={submitAssign}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              ℹ WAP rules enforced: trained analyst + calibrated instrument + capacity check server-side.
            </p>
            <Field label="Sample (PendingTesting)">
              <select style={inp} value={form.sampleId}
                onChange={e => {
                  setForm(f => ({ ...f, sampleId: e.target.value, instrumentId: '' }))
                  fetchSuggestions(e.target.value)
                }} required>
                <option value="">Select sample…</option>
                {samples.map(s => <option key={s.sampleId} value={s.sampleId}>{s.sampleNumber} — {s.materialName} / {s.lotNumber}</option>)}
              </select>
            </Field>
            <Field label="Analyst">
              <select style={inp} value={form.analystId} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Instrument">
              {/* Phase D — show auto-suggest if available, else fall back to full list */}
              {suggestLoading && <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>🔍 Finding best instruments…</p>}
              {!suggestLoading && suggestions.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#0d6e6e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    ✦ Auto-suggested (sorted by priority)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {suggestions.slice(0, 5).map(s => (
                      <label key={s.instrumentId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                          padding: '8px 12px', borderRadius: 7,
                          border: `1.5px solid ${form.instrumentId === String(s.instrumentId) ? '#0d6e6e' : '#e0e0e0'}`,
                          background: form.instrumentId === String(s.instrumentId) ? '#f0fdfa' : '#fff',
                        }}>
                        <input type="radio" name="suggestedInstrument"
                          checked={form.instrumentId === String(s.instrumentId)}
                          onChange={() => setForm(f => ({ ...f, instrumentId: String(s.instrumentId) }))}
                          style={{ accentColor: '#0d6e6e' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#111', fontFamily: 'monospace' }}>{s.instrumentCode}</span>
                          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{s.instrumentType}</span>
                          {s.model && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>({s.model})</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
                          <div>{s.labName}</div>
                          <div>Cal. due: {new Date(s.calibrationDue).toLocaleDateString()}</div>
                        </div>
                        <span style={{
                          minWidth: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                          background: s.priority === 1 ? '#dcfce7' : '#fef9c3',
                          color: s.priority === 1 ? '#15803d' : '#92400e',
                        }}>P{s.priority}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Or choose manually below:</p>
                </div>
              )}
              <select style={inp} value={form.instrumentId} onChange={e => setForm(f => ({ ...f, instrumentId: e.target.value }))} required>
                <option value="">Select instrument…</option>
                {instruments.map(i => <option key={i.instrumentId} value={i.instrumentId}>{i.instrumentCode}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (lower = higher priority)">
              <input style={inp} type="number" min="1" max="100" value={form.priorityScore} onChange={e => setForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="e.g. 1 (urgent)" />
            </Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowAssign(false)} label="Assign" />
          </form>
        </Modal>
      )}
      {detailSampleId !== null && (
        <SampleDetailSheet
          sampleId={detailSampleId}
          onClose={() => setDetailSampleId(null)}
          onStartTask={startTask}
        />
      )}
    </div>}
    </div>
  )
}
