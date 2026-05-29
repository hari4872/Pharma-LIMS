import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'
import { toast } from '@/components/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Lab { labId: number; labName: string; site: string; location: string }

interface SampleTransfer {
  sampleTransferId: number; sampleId: number
  sampleNumber: string; materialName: string; lotNumber: string
  fromLabId: number; fromLabName: string
  toLabId: number; toLabName: string
  status: string; transferReason: string; chainOfCustodyNote: string | null
  requestedBy: string; requestedAt: string
  respondedBy: string | null; respondedAt: string | null; responseNote: string | null
  receivedBy: string | null; receivedAt: string | null
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Pending:    { background: '#fef9c3', color: '#854d0e' },
  Accepted:   { background: '#dbeafe', color: '#1e40af' },
  Rejected:   { background: '#fee2e2', color: '#991b1b' },
  InTransit:  { background: '#ffedd5', color: '#9a3412' },
  Received:   { background: '#d1fae5', color: '#065f46' },
  Cancelled:  { background: '#f3f4f6', color: '#6b7280' },
}

const STATUS_FLOW: Record<string, string[]> = {
  Pending:   ['Accept', 'Reject', 'Cancel'],
  Accepted:  ['Dispatch', 'Cancel'],
  InTransit: ['Receive'],
  Rejected:  [],
  Received:  [],
  Cancelled: [],
}

const ACTION_COLOR: Record<string, React.CSSProperties> = {
  Accept:   { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  Reject:   { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  Cancel:   { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' },
  Dispatch: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  Receive:  { background: '#f0fdfa', color: '#0d6e6e', border: '1px solid #99f6e4' },
}

export default function SiteTransferPage() {
  const [transfers, setTransfers] = useState<SampleTransfer[]>([])
  const [labs, setLabs]           = useState<Lab[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilter] = useState('')

  // Initiate transfer modal
  const [showInitiate, setShowInitiate] = useState(false)
  const [initForm, setInitForm] = useState({ sampleId: '', toLabId: '', transferReason: '', chainOfCustodyNote: '' })
  const [initSaving, setInitSaving] = useState(false)
  const [initError, setInitError]   = useState('')

  // Respond modal (accept/reject/cancel/dispatch/receive)
  const [showRespond, setShowRespond] = useState<{ transfer: SampleTransfer; action: string } | null>(null)
  const [respondNote, setRespondNote] = useState('')
  const [respondSaving, setRespondSaving] = useState(false)
  const [respondError, setRespondError]   = useState('')

  async function load() {
    setLoading(true)
    const params = filterStatus ? `?status=${filterStatus}` : ''
    try {
      const [tr, lr] = await Promise.all([
        api.get(`/sample-transfers${params}`),
        api.get('/laboratories'),
      ])
      setTransfers(tr.data)
      setLabs(lr.data)
    } catch { /* interceptor handles */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterStatus])

  async function submitInitiate(e: React.FormEvent) {
    e.preventDefault()
    if (!initForm.sampleId || !initForm.toLabId || !initForm.transferReason.trim()) {
      setInitError('Sample ID, destination lab, and reason are required.'); return
    }
    setInitSaving(true); setInitError('')
    try {
      await api.post('/sample-transfers', {
        sampleId:           Number(initForm.sampleId),
        toLabId:            Number(initForm.toLabId),
        transferReason:     initForm.transferReason,
        chainOfCustodyNote: initForm.chainOfCustodyNote || null,
      })
      toast('Transfer request submitted', 'success')
      setShowInitiate(false)
      setInitForm({ sampleId: '', toLabId: '', transferReason: '', chainOfCustodyNote: '' })
      load()
    } catch (err: any) { setInitError(err.friendlyMessage ?? err.response?.data?.message ?? 'Failed') }
    finally { setInitSaving(false) }
  }

  async function submitRespond(e: React.FormEvent) {
    e.preventDefault()
    if (!showRespond) return
    const { transfer, action } = showRespond
    const endpoint = `/sample-transfers/${transfer.sampleTransferId}/${action.toLowerCase()}`
    setRespondSaving(true); setRespondError('')
    try {
      await api.post(endpoint, { note: respondNote || null })
      toast(`Transfer ${action.toLowerCase()}d`, 'success')
      setShowRespond(null); setRespondNote(''); load()
    } catch (err: any) { setRespondError(err.friendlyMessage ?? err.response?.data?.message ?? 'Action failed') }
    finally { setRespondSaving(false) }
  }

  // Status filter chips
  const statuses = ['Pending', 'Accepted', 'InTransit', 'Received', 'Rejected', 'Cancelled']

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
            🔄 Inter-site Sample Transfers
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            Chain-of-custody tracked · 21 CFR 211.186 compliant
          </p>
        </div>
        <button onClick={() => { setInitForm({ sampleId: '', toLabId: '', transferReason: '', chainOfCustodyNote: '' }); setInitError(''); setShowInitiate(true) }}
          style={{ padding: '8px 18px', background: '#0d6e6e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          + Request Transfer
        </button>
      </div>

      {/* ── Status filter chips ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('')}
          style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${!filterStatus ? '#0d6e6e' : '#e5e7eb'}`, background: !filterStatus ? '#f0fdfa' : '#fff', color: !filterStatus ? '#0d6e6e' : '#6b7280', fontWeight: !filterStatus ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          All ({transfers.length})
        </button>
        {statuses.map(s => {
          const count = transfers.filter(t => t.status === s).length
          const st = STATUS_STYLE[s] ?? {}
          return (
            <button key={s} onClick={() => setFilter(s === filterStatus ? '' : s)}
              style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${filterStatus === s ? (st.color as string) : '#e5e7eb'}`, background: filterStatus === s ? (st.background as string) : '#fff', color: filterStatus === s ? (st.color as string) : '#6b7280', fontWeight: filterStatus === s ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Transfer table ───────────────────────────────────────────────── */}
      <DataTable loading={loading} data={transfers} columns={[
        {
          header: 'Sample', accessor: r => (
            <div>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#111827' }}>{r.sampleNumber}</span>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{r.materialName} · {r.lotNumber}</div>
            </div>
          )
        },
        {
          header: 'Route', accessor: r => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.fromLabName}</span>
              <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><path d="M4 10h12M12 6l4 4-4 4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.toLabName}</span>
            </div>
          )
        },
        {
          header: 'Status', accessor: r => (
            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, ...(STATUS_STYLE[r.status] ?? {}) }}>
              {r.status}
            </span>
          )
        },
        { header: 'Reason', accessor: r => <span style={{ fontSize: 12, color: '#374151' }}>{r.transferReason}</span> },
        {
          header: 'Requested', accessor: r => (
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              <div>{r.requestedBy}</div>
              <div>{new Date(r.requestedAt).toLocaleDateString()}</div>
            </div>
          )
        },
        {
          header: 'Response', accessor: r => r.respondedBy ? (
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              <div>{r.respondedBy}</div>
              <div>{r.respondedAt ? new Date(r.respondedAt).toLocaleDateString() : ''}</div>
              {r.responseNote && <div style={{ fontStyle: 'italic' }}>{r.responseNote}</div>}
            </div>
          ) : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
        },
        {
          header: 'Actions', accessor: r => {
            const actions = STATUS_FLOW[r.status] ?? []
            return (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {actions.map(action => (
                  <button key={action}
                    onClick={() => { setShowRespond({ transfer: r, action }); setRespondNote(''); setRespondError('') }}
                    style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', ...(ACTION_COLOR[action] ?? {}) }}>
                    {action}
                  </button>
                ))}
              </div>
            )
          }
        },
      ]} />

      {/* ── Initiate Transfer Modal ───────────────────────────────────────── */}
      {showInitiate && (
        <Modal title="Request Inter-site Transfer" onClose={() => setShowInitiate(false)}>
          <form onSubmit={submitInitiate}>
            <Field label="Sample ID *">
              <input style={inp} type="number" value={initForm.sampleId}
                onChange={e => setInitForm(f => ({ ...f, sampleId: e.target.value }))}
                required placeholder="Enter the numeric Sample ID" />
            </Field>
            <Field label="Destination Laboratory *">
              <select style={inp} value={initForm.toLabId}
                onChange={e => setInitForm(f => ({ ...f, toLabId: e.target.value }))} required>
                <option value="">— Select destination lab —</option>
                {labs.map(l => (
                  <option key={l.labId} value={l.labId}>
                    {l.labName}{l.site ? ` (${l.site})` : ''}{l.location ? ` · ${l.location}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Transfer Reason *">
              <input style={inp} value={initForm.transferReason}
                onChange={e => setInitForm(f => ({ ...f, transferReason: e.target.value }))}
                required placeholder="e.g. Specialist equipment only available at Site B" />
            </Field>
            <Field label="Chain of Custody Note">
              <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={initForm.chainOfCustodyNote}
                onChange={e => setInitForm(f => ({ ...f, chainOfCustodyNote: e.target.value }))}
                placeholder="Courier name, container type, temperature requirement, etc." />
            </Field>
            <div style={{ padding: '8px 12px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, marginBottom: 12, fontSize: 12, color: '#0d6e6e' }}>
              ℹ The destination lab must Accept the transfer before the sample is dispatched.
            </div>
            {initError && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 10px' }}>{initError}</p>}
            <ModalFooter saving={initSaving} onCancel={() => setShowInitiate(false)} label="Submit Transfer Request" />
          </form>
        </Modal>
      )}

      {/* ── Respond Modal ────────────────────────────────────────────────── */}
      {showRespond && (
        <Modal title={`${showRespond.action} Transfer`} onClose={() => setShowRespond(null)}>
          <form onSubmit={submitRespond}>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Transfer</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{showRespond.transfer.sampleNumber}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                {showRespond.transfer.fromLabName} → {showRespond.transfer.toLabName}
              </div>
            </div>

            {showRespond.action === 'Dispatch' && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                ⚠ Confirming dispatch means the sample has physically left your lab.
              </div>
            )}
            {showRespond.action === 'Receive' && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, fontSize: 12, color: '#0d6e6e' }}>
                ✓ Confirming receipt will re-home this sample to your laboratory.
              </div>
            )}

            <Field label={showRespond.action === 'Reject' ? 'Rejection Reason' : 'Note (optional)'}>
              <input style={inp} value={respondNote}
                onChange={e => setRespondNote(e.target.value)}
                required={showRespond.action === 'Reject'}
                placeholder={showRespond.action === 'Reject' ? 'Why is this transfer being rejected?' : 'Optional note'} />
            </Field>

            {respondError && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 10px' }}>{respondError}</p>}
            <ModalFooter
              saving={respondSaving}
              onCancel={() => setShowRespond(null)}
              label={`Confirm ${showRespond.action}`}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
