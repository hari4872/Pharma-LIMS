import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

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

export default function OosInvestigationsPage() {
  const [data, setData] = useState<OosItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Open')
  const [showClose, setShowClose] = useState<OosItem | null>(null)
  const [closeForm, setCloseForm] = useState({ rootCause: '', capaRef: '', password: '', meaning: 'I confirm this OOS/OOT investigation is complete', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const r = await api.get(`/oos-investigations${params}`)
    setData(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

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

  async function submitClose(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/oos-investigations/${showClose!.investigationId}/close`, closeForm)
      setShowClose(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Close failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHeader title="OOS / OOT Investigations" />
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {r.status === 'Open' && (
              <button
                onClick={() => { setShowClose(r); setCloseForm(f => ({ ...f, rootCause: '', capaRef: '' })); setError('') }}
                style={{ padding: '3px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Close Investigation
              </button>
            )}
            <button
              onClick={() => downloadPdf(r)}
              title="Download OOS Investigation Report PDF"
              style={{
                padding: '3px 10px', border: 'none', borderRadius: 4,
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: r.status === 'Closed' ? '#7c3aed' : '#e9d5ff',
                color: r.status === 'Closed' ? '#fff' : '#7c3aed',
              }}>
              📄 PDF
            </button>
          </div>
        )},
      ]} />

      {showClose && (
        <Modal title={`Close ${showClose.flagType} Investigation — ${showClose.sampleNumber}`} onClose={() => setShowClose(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            FDA OOS Guidance Phase 1 — Root cause and CAPA reference required before investigation can be closed.
          </p>
          <form onSubmit={submitClose}>
            <Field label="Root Cause (mandatory)">
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
