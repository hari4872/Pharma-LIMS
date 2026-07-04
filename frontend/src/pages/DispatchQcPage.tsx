import { useEffect, useMemo, useState } from 'react'
import api from '@/api/client'
import { fmtDate } from '@/utils/dateFormat'
import { fmtLabel } from '@/utils/formatLabel'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { Field, inp } from './master-data/LaboratoriesPage'
import ESignatureDrawer from '@/components/ESignatureDrawer'
import { Drawer, DrawerFooter } from '@/components/Drawer'
import PipelineBar from '@/components/PipelineBar'
import SampleDetailSheet from '@/components/SampleDetailSheet'

interface DeliveryOrder {
  doId: number; doNumber: string; customerName: string | null
  despatchDate: string | null; packingType: string | null
  productName: string; status: string; createdAt: string
  tasks: DispatchTask[]
}

interface DispatchTask {
  taskId: number; doId: number; doNumber: string; customerName: string | null
  sampleId: number; sampleNumber: string; materialName: string; lotNumber: string
  formTemplateName: string; executionId: number | null; status: string; createdAt: string
}

const DO_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:       { bg: '#f3f4f6', color: '#374151' },
  InDispatchQC:  { bg: '#dbeafe', color: '#1e40af' },
  CLEARED:       { bg: '#d1fae5', color: '#065f46' },
  BLOCKED:       { bg: '#fee2e2', color: '#991b1b' },
}

const TASK_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Open:        { bg: '#fef9c3', color: '#854d0e' },
  InProgress:  { bg: '#dbeafe', color: '#1e40af' },
  Passed:      { bg: '#d1fae5', color: '#065f46' },
  Failed:      { bg: '#fee2e2', color: '#991b1b' },
  QAApproved:  { bg: '#ede9fe', color: '#6d28d9' },
}

const TASK_STAGES = [
  { key: 'Open',       label: 'Open',        color: '#b45309', bg: '#fef9c3' },
  { key: 'InProgress', label: 'In Progress', color: '#1e40af', bg: '#dbeafe' },
  { key: 'Passed',     label: 'Passed',      color: '#065f46', bg: '#d1fae5' },
  { key: 'Failed',     label: 'Failed',      color: '#991b1b', bg: '#fee2e2' },
  { key: 'QAApproved', label: 'QA Approved', color: '#6d28d9', bg: '#ede9fe' },
]

const ORDER_STAGES = [
  { key: 'Pending',      label: 'Pending',        color: '#374151', bg: '#f3f4f6' },
  { key: 'InDispatchQC', label: 'In Dispatch QC', color: '#1e40af', bg: '#dbeafe' },
  { key: 'CLEARED',      label: 'Cleared',        color: '#065f46', bg: '#d1fae5' },
  { key: 'BLOCKED',      label: 'Blocked',        color: '#991b1b', bg: '#fee2e2' },
]

export default function DispatchQcPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [tasks, setTasks] = useState<DispatchTask[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'orders' | 'tasks'>('tasks')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreateDO, setShowCreateDO] = useState(false)
  const [showApprove, setShowApprove] = useState<DispatchTask | null>(null)
  const [doForm, setDoForm] = useState({ doNumber: '', customerName: '', despatchDate: '', packingType: '', productId: '' })
  const [approveForm, setApproveForm] = useState({ password: '', meaning: 'I approve this Dispatch QC — product cleared for dispatch.', reason: 'Dispatch QC cleared' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [successBanner, setSuccessBanner] = useState('')
  const [products, setProducts] = useState<{ materialId: number; materialName: string; materialType: string }[]>([])

  async function load() {
    setLoading(true)
    try {
      const [ordersRes, tasksRes] = await Promise.all([
        api.get('/delivery-orders').catch(() => ({ data: [] })),
        api.get('/dispatch-qc').catch(() => ({ data: [] }))
      ])
      setOrders(ordersRes.data); setTasks(tasksRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    const r = await api.get('/materials')
    // Only Finished Products are dispatched — filter to avoid selecting raw materials / reagents
    setProducts(r.data.filter((m: { materialType: string }) => m.materialType === 'FinishedProduct'))
  }

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])
  useEffect(() => { const t = setTimeout(loadProducts, 0); return () => clearTimeout(t) }, [])

  // Reset filter when switching views
  function switchView(v: 'tasks' | 'orders') {
    setView(v)
    setStatusFilter('')
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.createdAt < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [tasks, statusFilter, dateFrom, dateTo])

  const filteredOrders = useMemo(() => {
    return orders.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (dateFrom && r.createdAt < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [orders, statusFilter, dateFrom, dateTo])

  async function submitCreateDO(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/delivery-orders', {
        doNumber:     doForm.doNumber,
        customerName: doForm.customerName || null,
        despatchDate: doForm.despatchDate || null,
        packingType:  doForm.packingType || null,
        productId:    parseInt(doForm.productId) || 0
      })
      setShowCreateDO(false)
      await load()
      // Switch to QC Tasks tab so the user sees the auto-created Dispatch QC task
      setView('tasks')
      setStatusFilter('Open')
      setSuccessBanner(`Delivery Order ${doForm.doNumber} created — Dispatch QC task is now open below.`)
      setTimeout(() => setSuccessBanner(''), 6000)
    } catch (err) { setError(getErrorMessage(err, 'Create failed')) }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/dispatch-qc/${showApprove!.taskId}/approve`, approveForm)
      setShowApprove(null); load()
    } catch (err) { setError(getErrorMessage(err, 'Approval failed')) }
    finally { setSaving(false) }
  }

  const displayCount = view === 'tasks' ? filteredTasks.length : filteredOrders.length

  return (
    <div>
      {successBanner && (
        <div style={{ marginBottom: 12, background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#166534', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ {successBanner}
        </div>
      )}
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>Dispatch QC</h2>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        GMP — Dispatch QC triggered by Delivery Order. BLOCKED = OOS open. CLEARED = QA e-signature approved. Full traceability: DO → Sample → Test → CoA.
      </p>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 14 }}>
        {(['tasks', 'orders'] as const).map(v => (
          <button key={v} onClick={() => switchView(v)} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none',
            cursor: 'pointer', color: view === v ? '#2563eb' : '#6b7280',
            borderBottom: view === v ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {v === 'tasks' ? 'QC Tasks' : 'Delivery Orders'}
          </button>
        ))}
      </div>

      {/* ── Pipeline bar ── */}
      {view === 'tasks'
        ? <PipelineBar stages={TASK_STAGES} data={tasks} statusField="status" active={statusFilter} onChange={setStatusFilter} />
        : <PipelineBar stages={ORDER_STAGES} data={orders} statusField="status" active={statusFilter} onChange={setStatusFilter} />
      }

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, marginTop: 12 }}>
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>From</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>To</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{displayCount} record{displayCount !== 1 ? 's' : ''}</span>
          <button onClick={() => { setShowCreateDO(true); setError('') }}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            + New Delivery Order
          </button>
        </div>
      </div>

      {view === 'tasks' && (
        <DataTable loading={loading} data={filteredTasks} columns={[
          { header: 'DO No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.doNumber}</strong> },
          { header: 'Customer', accessor: r => r.customerName ?? '—' },
          { header: 'Sample', accessor: r => (
            <button onClick={() => setDetailSampleId(r.sampleId)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', textDecoration: 'underline' }}>
              {r.sampleNumber}
            </button>
          )},
          { header: 'Material / Lot', accessor: r => `${r.materialName} / ${r.lotNumber}` },
          { header: 'Form Template', accessor: 'formTemplateName' },
          { header: 'Status', accessor: r => {
            const c = TASK_STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{fmtLabel(r.status)}</span>
          }},
          { header: 'Actions', accessor: r => r.status === 'Passed' ? (
            <button onClick={() => { setShowApprove(r); setApproveForm(f => ({ ...f, password: '', reason: '' })); setError('') }}
              style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              QA Approve (CLEARED)
            </button>
          ) : null },
        ]} />
      )}

      {view === 'orders' && (
        <DataTable loading={loading} data={filteredOrders} columns={[
          { header: 'DO No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.doNumber}</strong> },
          { header: 'Customer', accessor: r => r.customerName ?? '—' },
          { header: 'Product', accessor: 'productName' },
          { header: 'Despatch Date', accessor: r => r.despatchDate ?? '—' },
          { header: 'Packing', accessor: r => r.packingType ?? '—' },
          { header: 'Status', accessor: r => {
            const c = DO_STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{fmtLabel(r.status)}</span>
          }},
          { header: 'QC Tasks', accessor: r => <span style={{ fontSize: 12 }}>{r.tasks.length} task(s)</span> },
          { header: 'Created', accessor: r => fmtDate(r.createdAt) },
        ]} />
      )}

      {detailSampleId !== null && <SampleDetailSheet sampleId={detailSampleId} onClose={() => setDetailSampleId(null)} context="release" />}

      {/* Create Delivery Order Modal */}
      {showCreateDO && (
        <Drawer title="New Delivery Order" subtitle="Auto-triggers a Dispatch QC task via DispatchEventService." onClose={() => setShowCreateDO(false)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Creating a DO will auto-trigger a Dispatch QC task via DispatchEventService (Contract 1).
          </p>
          <form onSubmit={submitCreateDO}>
            <Field label="DO Number *"><input style={inp} value={doForm.doNumber} onChange={e => setDoForm(f => ({ ...f, doNumber: e.target.value }))} required placeholder="e.g. DO-2026-001" /></Field>
            <Field label="Product *">
              <select style={inp} value={doForm.productId} onChange={e => setDoForm(f => ({ ...f, productId: e.target.value }))} required>
                <option value="">Select product…</option>
                {products.map(p => <option key={p.materialId} value={p.materialId}>{p.materialName}</option>)}
              </select>
            </Field>
            <Field label="Customer Name"><input style={inp} value={doForm.customerName} onChange={e => setDoForm(f => ({ ...f, customerName: e.target.value }))} /></Field>
            <Field label="Despatch Date"><input style={inp} type="date" value={doForm.despatchDate} onChange={e => setDoForm(f => ({ ...f, despatchDate: e.target.value }))} /></Field>
            <Field label="Packing Type"><input style={inp} value={doForm.packingType} onChange={e => setDoForm(f => ({ ...f, packingType: e.target.value }))} placeholder="e.g. Carton, Pallet…" /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowCreateDO(false)} label="Create DO" />
          </form>
        </Drawer>
      )}

      {/* QA Approve Drawer */}
      {showApprove && (
        <ESignatureDrawer
          title={`QA Approve Dispatch QC — ${showApprove.doNumber}`}
          subtitle="CLEARED status set server-side (21 CFR Part 11)"
          form={approveForm} onChange={setApproveForm}
          onSubmit={submitApprove} onClose={() => { setShowApprove(null); setError('') }}
          saving={saving} error={error} label="Sign & Set CLEARED"
          reasonPlaceholder="e.g. All Dispatch QC tests passed, product cleared"
          passwordOnly
        />
      )}
    </div>
  )
}
