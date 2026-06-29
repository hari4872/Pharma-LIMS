import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { getErrorMessage, asApiError } from '@/utils/errors'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { fmtDate, fmtDateTime } from '@/utils/dateFormat'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import { MasterDetail, DetailPane } from '@/components/MasterDetail'
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

interface SampleGroup {
  sampleId: number
  sampleNumber: string
  materialName: string
  lotNumber: string
  executions: WorkItem[]
  overallStatus: string
  totalCount: number
  completedCount: number
  inProgressCount: number
  analystName: string
  minPriority: number | null
  earliestDue: string | null
  anyOverdue: boolean
}

interface Sample { sampleId: number; sampleNumber: string; materialName: string; lotNumber: string; specTemplateId?: number }
interface Analyst { userId: number; fullName: string }

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

function groupBySample(items: WorkItem[]): SampleGroup[] {
  const map = new Map<number, WorkItem[]>()
  for (const item of items) {
    if (!map.has(item.sampleId)) map.set(item.sampleId, [])
    map.get(item.sampleId)!.push(item)
  }
  return Array.from(map.values()).map(execs => {
    const completed  = execs.filter(e => e.status === 'Completed').length
    const inProgress = execs.filter(e => e.status === 'InProgress').length
    const hasOOS     = execs.some(e => e.status === 'OOSOpen')

    let overallStatus = 'Assigned'
    if (hasOOS)                        overallStatus = 'OOSOpen'
    else if (inProgress > 0)           overallStatus = 'InProgress'
    else if (completed === execs.length) overallStatus = 'Completed'

    const analysts   = [...new Set(execs.map(e => e.analystName).filter(Boolean))]
    const analystName = analysts.length === 0 ? '—' : analysts.length === 1 ? analysts[0] : 'Multiple'

    const priorities = execs.map(e => e.priorityScore).filter((p): p is number => p !== null)
    const minPriority = priorities.length > 0 ? Math.min(...priorities) : null

    const dues = execs.map(e => e.dueDate).filter(Boolean) as string[]
    const earliestDue = dues.length > 0 ? dues.sort()[0] : null

    const now = new Date()
    const anyOverdue = execs.some(e =>
      e.dueDate && new Date(e.dueDate) < now &&
      (e.status === 'Assigned' || e.status === 'InProgress')
    )

    return {
      sampleId: execs[0].sampleId,
      sampleNumber: execs[0].sampleNumber,
      materialName: execs[0].materialName,
      lotNumber: execs[0].lotNumber,
      executions: execs,
      overallStatus,
      totalCount: execs.length,
      completedCount: completed,
      inProgressCount: inProgress,
      analystName,
      minPriority,
      earliestDue,
      anyOverdue,
    }
  })
}

export default function WorkQueuePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'queue' | 'batch'>('queue')
  const [data, setData] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [samples, setSamples] = useState<Sample[]>([])
  const [analysts, setAnalysts] = useState<Analyst[]>([])
  const [form, setForm] = useState({ sampleId: '', analystId: '', priorityScore: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sampleSearch, setSampleSearch] = useState('')
  const [sampleDropOpen, setSampleDropOpen] = useState(false)
  const [reassignItem, setReassignItem]   = useState<WorkItem | null>(null)
  const [reassignForm, setReassignForm]   = useState({ analystId: '', priorityScore: '' })
  const [reassignSaving, setReassignSaving] = useState(false)
  const [reassignError, setReassignError]   = useState('')
  const [showAi, setShowAi]           = useState(false)
  const [aiData, setAiData]           = useState<QueueIntelligence | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<WorkloadSuggestion | null>(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [handoverOpen, setHandoverOpen]   = useState(false)
  const [handoverData, setHandoverData]   = useState<{ summary: string; generatedAt: string } | null>(null)
  const [handoverLoading, setHandoverLoading] = useState(false)
  const [scanQuery, setScanQuery]       = useState('')
  const [scanSampleIds, setScanSampleIds] = useState<Set<number> | null>(null)
  const scanInputRef                    = useRef<HTMLInputElement>(null)
  const scanBuffer                      = useRef('')
  const scanLastKey                     = useRef(0)
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<SampleGroup | null>(null)

  const role = useSelector((s: RootState) => s.auth.role) ?? ''
  const canAssign = ['Admin', 'QA', 'LabManager', 'QCLead'].includes(role)

  async function load() {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const r = await api.get(`/test-executions${params}`)
      setData(r.data)
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to load work queue'), 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [statusFilter])

  const groups = groupBySample(data)

  const displayGroups = scanSampleIds !== null
    ? groups.filter(g => scanSampleIds.has(g.sampleId))
    : groups

  const runScan = useCallback((value: string) => {
    const q = value.trim().toUpperCase()
    if (!q) { setScanSampleIds(null); return }
    const matched = data.filter(w => w.sampleNumber.toUpperCase().includes(q))
    if (matched.length === 0) {
      toast(`No work items found for "${value.trim()}"`, 'error')
      setScanSampleIds(new Set())
    } else {
      setScanSampleIds(new Set(matched.map(w => w.sampleId)))
    }
  }, [data])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inOtherInput = ['INPUT','SELECT','TEXTAREA'].includes(target.tagName) &&
                           target.id !== 'wq-scan-input'
      if (inOtherInput) return

      const now = Date.now()
      if (now - scanLastKey.current > 80) scanBuffer.current = ''
      scanLastKey.current = now

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 3) {
          const val = scanBuffer.current
          setScanQuery(val)
          scanBuffer.current = ''
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
    if (aiData) return
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

  async function openHandover() {
    setHandoverOpen(true)
    setHandoverLoading(true)
    try {
      const res = await api.get('/shift-handover/summary')
      setHandoverData(res.data)
    } catch {
      toast('Failed to generate shift handover summary', 'error')
      setHandoverOpen(false)
    } finally {
      setHandoverLoading(false)
    }
  }

  async function openAssign() {
    const [sr, ur] = await Promise.all([
      api.get('/samples?status=PendingTesting').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: [] })),
    ])
    setSamples(sr.data); setAnalysts(ur.data)
    setForm({ sampleId: '', analystId: '', priorityScore: '' })
    setShowAssign(true)
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/test-executions', {
        sampleId: Number(form.sampleId),
        analystId: Number(form.analystId),
        priorityScore: form.priorityScore ? Number(form.priorityScore) : null,
      })
      setShowAssign(false); load()
    } catch (err) { setError(getErrorMessage(err, 'Assignment failed')) }
    finally { setSaving(false) }
  }

  async function openReassign(item: WorkItem) {
    if (analysts.length === 0) {
      const ur = await api.get('/users').catch(() => ({ data: [] }))
      setAnalysts(ur.data)
    }
    setReassignItem(item)
    setReassignForm({ analystId: '', priorityScore: item.priorityScore != null ? String(item.priorityScore) : '' })
    setReassignError('')
  }

  async function submitReassign(e: React.FormEvent) {
    e.preventDefault(); setReassignSaving(true); setReassignError('')
    try {
      await api.post(`/test-executions/${reassignItem!.executionId}/assign`, {
        analystId:    Number(reassignForm.analystId),
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
        {scanSampleIds !== null && (
          <button
            onClick={() => { setScanSampleIds(null); setScanQuery(''); if (scanInputRef.current) scanInputRef.current.value = '' }}
            style={{ padding: '7px 12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          Click field · scan label · Enter
        </span>
      </div>

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
        <button
          onClick={openHandover}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1.5px solid #c7d2fe',
            background: '#eef2ff', color: '#4338ca',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          📋 Shift Handover
        </button>
        {canAssign && (
          <button onClick={openAssign} style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + Assign Task
          </button>
        )}
      </div>

      {/* ── AI Intelligence Panel ───────────────────────────────────────── */}
      {showAi && (
        <div style={{
          background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 12,
          padding: '18px 20px', marginBottom: 18, position: 'relative',
        }}>
          <button
            onClick={() => setShowAi(false)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: 18, color: '#0f766e', cursor: 'pointer', lineHeight: 1 }}
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

          {aiLoading && <div style={{ color: '#0d9488', fontSize: 13, padding: '8px 0' }}>Fetching queue intelligence…</div>}

          {!aiLoading && aiData && (
            <>
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
                {aiData.analystLoads.length > 0 && (
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Analyst Loads</div>
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
                {aiData.priorityBands.length > 0 && (
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Priority Bands</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {aiData.priorityBands.map(pb => {
                        const c = BAND_COLORS[pb.band] ?? { bg: '#f3f4f6', color: '#374151' }
                        return (
                          <span key={pb.band} style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {pb.band}
                            <span style={{ background: c.color, color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{pb.count}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {aiSuggestion && (
                <div style={{ marginTop: 14, background: '#fff', border: '1.5px solid #a7f3d0', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
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

      {/* ── Main Table (1 row per sample) ──────────────────────────────────── */}
      <MasterDetail
        onCloseDetail={() => setSelectedGroup(null)}
        detailTitle="Sample Tests"
        detail={selectedGroup ? (
          <DetailPane
            title={selectedGroup.sampleNumber}
            subtitle={`${selectedGroup.materialName} · ${selectedGroup.lotNumber}`}
            onClose={() => setSelectedGroup(null)}
            actions={
              <button
                onClick={() => setDetailSampleId(selectedGroup.sampleId)}
                style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: '#374151' }}
              >
                Sample Info
              </button>
            }
          >
            {/* Progress summary */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {(() => {
                  const c = STATUS_COLORS[selectedGroup.overallStatus] ?? { bg: '#f3f4f6', color: '#374151' }
                  return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{selectedGroup.overallStatus}</span>
                })()}
                {selectedGroup.anyOverdue && <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>OVERDUE</span>}
              </div>
              {/* Progress bar */}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                {selectedGroup.completedCount} of {selectedGroup.totalCount} tests complete
              </div>
              <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6, transition: 'width 0.3s',
                  background: selectedGroup.completedCount === selectedGroup.totalCount ? '#10b981' : '#3b82f6',
                  width: `${selectedGroup.totalCount > 0 ? (selectedGroup.completedCount / selectedGroup.totalCount) * 100 : 0}%`,
                }} />
              </div>
            </div>

            {/* Individual test executions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedGroup.executions.map((exec, idx) => {
                const sc = STATUS_COLORS[exec.status] ?? { bg: '#f3f4f6', color: '#374151' }
                const isOverdue = exec.dueDate && new Date(exec.dueDate) < new Date() &&
                  (exec.status === 'Assigned' || exec.status === 'InProgress')
                return (
                  <div key={exec.executionId} style={{
                    border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
                    background: exec.status === 'Completed' ? '#f0fdf4' : '#fafafa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Test {idx + 1}</span>
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{exec.status}</span>
                      {isOverdue && <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>OVERDUE</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>#{exec.executionId}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      {exec.analystName && <span>👤 {exec.analystName}</span>}
                      {exec.instrumentCode && <span>🔬 {exec.instrumentCode}</span>}
                      {exec.dueDate && <span style={{ color: isOverdue ? '#dc2626' : '#6b7280' }}>📅 {fmtDate(exec.dueDate)}</span>}
                      {exec.startedAt && <span>▶ {fmtDateTime(exec.startedAt)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {exec.status === 'Assigned' && (
                        <button
                          onClick={() => startTask(exec.executionId)}
                          style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >▶ Start</button>
                      )}
                      {exec.status === 'InProgress' && (
                        <a
                          href={`/test-execution/${exec.executionId}`}
                          style={{ padding: '5px 12px', background: '#7c3aed', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
                        >✏ Enter Results</a>
                      )}
                      {(exec.status === 'Assigned' || exec.status === 'InProgress') && canAssign && (
                        <button
                          onClick={() => openReassign(exec)}
                          style={{ padding: '5px 12px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >↩ Re-assign</button>
                      )}
                      {exec.status === 'Completed' && (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Complete</span>
                      )}
                      {exec.status === 'OOSOpen' && (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠ OOS Investigation</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </DetailPane>
        ) : null}
      >
        <DataTable
          loading={loading}
          data={displayGroups}
          onRowClick={row => setSelectedGroup(row)}
          selectedRow={selectedGroup ?? undefined}
          rowStyle={row => scanSampleIds !== null && scanSampleIds.has(row.sampleId)
            ? { background: '#fffbeb', outline: '2px solid #fcd34d', outlineOffset: '-2px' }
            : {}
          }
          columns={[
            { header: 'Sample No.', accessor: r => (
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{r.sampleNumber}</span>
                {r.anyOverdue && <span style={{ marginLeft: 6, fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 8 }}>OVERDUE</span>}
                {scanSampleIds?.has(r.sampleId) && <span style={{ marginLeft: 6, fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>● MATCHED</span>}
              </div>
            )},
            { header: 'Material / Lot', accessor: r => (
              <span>{r.materialName}<br /><span style={{ fontSize: 12, color: '#6b7280' }}>{r.lotNumber}</span></span>
            )},
            { header: 'Analyst', accessor: 'analystName' },
            { header: 'Progress', accessor: r => (
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 600 }}>
                  {r.completedCount}/{r.totalCount} tests
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: r.completedCount === r.totalCount ? '#10b981' : '#3b82f6',
                    width: `${r.totalCount > 0 ? (r.completedCount / r.totalCount) * 100 : 0}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )},
            { header: 'Priority', accessor: 'minPriority', render: r => {
              const pb = priorityBadge(r.minPriority)
              return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: pb.bg, color: pb.color, border: `1px solid ${pb.border}` }}>{pb.label}</span>
            }},
            { header: 'Status', accessor: r => {
              const c = STATUS_COLORS[r.overallStatus] ?? { bg: '#f3f4f6', color: '#374151' }
              return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: c.bg, color: c.color }}>{r.overallStatus}</span>
            }},
            { header: 'Due', accessor: r => r.earliestDue
              ? <span style={{ color: r.anyOverdue ? '#dc2626' : '#374151' }}>{fmtDate(r.earliestDue)}</span>
              : '—'
            },
          ]}
        />
      </MasterDetail>

      {/* ── Re-assign Drawer ─────────────────────────────────────────────── */}
      {reassignItem && (
        <Drawer
          title={`Re-assign — ${reassignItem.sampleNumber}`}
          subtitle={`Execution #${reassignItem.executionId} · Training & calibration checks enforced server-side.`}
          onClose={() => setReassignItem(null)}
        >
          <form onSubmit={submitReassign}>
            <Field label="New Analyst">
              <select style={inp} value={reassignForm.analystId} onChange={e => setReassignForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (optional)">
              <input style={inp} type="number" min="1" max="100" value={reassignForm.priorityScore}
                onChange={e => setReassignForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="1–100 (lower = higher priority)" />
            </Field>
            {reassignError && <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0' }}>{reassignError}</p>}
            <DrawerFooter saving={reassignSaving} onCancel={() => setReassignItem(null)} label="Re-assign" />
          </form>
        </Drawer>
      )}

      {showAssign && (
        <Drawer title="Assign Task" subtitle="WAP rules enforced: trained analyst + calibrated instrument + capacity check server-side." onClose={() => setShowAssign(false)}>
          <form onSubmit={submitAssign}>
            <Field label="Sample (PendingTesting)">
              {/* Custom sample picker — shows product name + lot clearly */}
              <div style={{ position: 'relative' }}>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => { setSampleDropOpen(o => !o); setSampleSearch('') }}
                  style={{
                    ...inp, width: '100%', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#fff', marginTop: 0,
                  }}
                >
                  {form.sampleId
                    ? (() => {
                        const s = samples.find(s => String(s.sampleId) === form.sampleId)
                        return s
                          ? <span><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{s.sampleNumber}</span><span style={{ color: '#6b7280', marginLeft: 8 }}>{s.materialName}</span></span>
                          : 'Select sample…'
                      })()
                    : <span style={{ color: '#9ca3af' }}>Select sample…</span>
                  }
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>▼</span>
                </button>

                {sampleDropOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 2,
                  }}>
                    {/* Search */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by sample no. or product…"
                        value={sampleSearch}
                        onChange={e => setSampleSearch(e.target.value)}
                        style={{
                          width: '100%', border: '1px solid #e2e8f0', borderRadius: 6,
                          padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {/* List */}
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {samples
                        .filter(s => {
                          const q = sampleSearch.toLowerCase()
                          return !q ||
                            s.sampleNumber.toLowerCase().includes(q) ||
                            s.materialName.toLowerCase().includes(q) ||
                            s.lotNumber.toLowerCase().includes(q)
                        })
                        .map(s => (
                          <div
                            key={s.sampleId}
                            onClick={() => {
                              setForm(f => ({ ...f, sampleId: String(s.sampleId) }))
                              setSampleDropOpen(false)
                            }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: String(s.sampleId) === form.sampleId ? '#f0fdf4' : '#fff',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.background = String(s.sampleId) === form.sampleId ? '#f0fdf4' : '#fff')}
                          >
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>
                              {s.sampleNumber}
                            </div>
                            <div style={{ fontSize: 13, color: '#111827', marginTop: 2 }}>
                              {s.materialName}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                              Lot: {s.lotNumber}
                            </div>
                          </div>
                        ))
                      }
                      {samples.filter(s => {
                        const q = sampleSearch.toLowerCase()
                        return !q || s.sampleNumber.toLowerCase().includes(q) || s.materialName.toLowerCase().includes(q) || s.lotNumber.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                          No samples found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Hidden required input for form validation */}
              <input type="hidden" value={form.sampleId} required />
            </Field>
            <Field label="Analyst">
              <select style={inp} value={form.analystId} onChange={e => setForm(f => ({ ...f, analystId: e.target.value }))} required>
                <option value="">Select analyst…</option>
                {analysts.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </Field>
            <Field label="Priority Score (lower = higher priority)">
              <input style={inp} type="number" min="1" max="100" value={form.priorityScore} onChange={e => setForm(f => ({ ...f, priorityScore: e.target.value }))} placeholder="e.g. 1 (urgent)" />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowAssign(false)} label="Assign" />
          </form>
        </Drawer>
      )}

      {detailSampleId !== null && (
        <SampleDetailSheet
          sampleId={detailSampleId}
          onClose={() => setDetailSampleId(null)}
          onStartTask={startTask}
          context="workqueue"
        />
      )}

      {/* ── Shift Handover Drawer ─────────────────────────────────────────── */}
      {handoverOpen && (
        <Drawer title="Shift Handover Report" subtitle="AI-generated summary · Read-only · Print for physical handover record." width={540} onClose={() => setHandoverOpen(false)}>
          {handoverLoading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#4338ca', fontSize: 14 }}>
              Generating AI shift handover summary…
            </div>
          )}
          {!handoverLoading && handoverData && (
            <>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Generated at: {fmtDateTime(handoverData.generatedAt)}</p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
                <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#1e293b' }}>
                  {handoverData.summary}
                </pre>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => window.print()}
                  style={{ padding: '9px 18px', background: '#4338ca', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >🖨 Print / Save</button>
                <button
                  onClick={() => setHandoverOpen(false)}
                  style={{ padding: '9px 18px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >Close</button>
              </div>
            </>
          )}
        </Drawer>
      )}
    </div>}
    </div>
  )
}
