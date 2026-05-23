import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { Modal, Field, ModalFooter, inp } from './master-data/LaboratoriesPage'

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

export default function DispatchQcPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [tasks, setTasks] = useState<DispatchTask[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'orders' | 'tasks'>('tasks')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateDO, setShowCreateDO] = useState(false)
  const [showApprove, setShowApprove] = useState<DispatchTask | null>(null)
  const [doForm, setDoForm] = useState({ doNumber: '', customerName: '', despatchDate: '', packingType: '', productId: '' })
  const [approveForm, setApproveForm] = useState({ password: '', meaning: 'I approve this Dispatch QC — product cleared for dispatch.', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<{ materialId: number; materialName: string }[]>([])

  async function load() {
    setLoading(true)
    const [ordersRes, tasksRes] = await Promise.all([
      api.get('/delivery-orders' + (statusFilter ? `?status=${statusFilter}` : '')),
      api.get('/dispatch-qc' + (statusFilter ? `?status=${statusFilter}` : ''))
    ])
    setOrders(ordersRes.data); setTasks(tasksRes.data); setLoading(false)
  }

  async function loadProducts() {
    const r = await api.get('/materials')
    setProducts(r.data)
  }

  useEffect(() => { load() }, [statusFilter])
  useEffect(() => { loadProducts() }, [])

  async function submitCreateDO(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/delivery-orders', {
        doNumber:     doForm.doNumber,
        customerName: doForm.customerName || null,
        despatchDate: doForm.despatchDate || null,
        packingType:  doForm.packingType || null,
        productId:    parseInt(doForm.productId)
      })
      setShowCreateDO(false); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Create failed') }
    finally { setSaving(false) }
  }

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post(`/dispatch-qc/${showApprove!.taskId}/approve`, approveForm)
      setShowApprove(null); load()
    } catch (err: any) { setError(err.response?.data?.message ?? 'Approval failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111827' }}>Dispatch QC</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tasks', 'orders'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', fontSize: 13, borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer',
              background: view === v ? '#1e40af' : '#fff', color: view === v ? '#fff' : '#374151'
            }}>{v === 'tasks' ? 'QC Tasks' : 'Delivery Orders'}</button>
          ))}
        </div>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {view === 'tasks'
            ? ['Open','InProgress','Passed','Failed','QAApproved'].map(s => <option key={s} value={s}>{s}</option>)
            : ['Pending','InDispatchQC','CLEARED','BLOCKED'].map(s => <option key={s} value={s}>{s}</option>)
          }
        </select>
        <button onClick={() => { setShowCreateDO(true); setError('') }}
          style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
          + New Delivery Order
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        GMP — Dispatch QC triggered by Delivery Order. BLOCKED = OOS open. CLEARED = QA §11.50 approved. Full traceability: DO → Sample → Test → CoA.
      </p>

      {view === 'tasks' && (
        <DataTable loading={loading} data={tasks} columns={[
          { header: 'DO No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.doNumber}</strong> },
          { header: 'Customer', accessor: r => r.customerName ?? '—' },
          { header: 'Sample', accessor: 'sampleNumber' },
          { header: 'Material / Lot', accessor: r => `${r.materialName} / ${r.lotNumber}` },
          { header: 'Form Template', accessor: 'formTemplateName' },
          { header: 'Status', accessor: r => {
            const c = TASK_STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{r.status}</span>
          }},
          { header: 'Actions', accessor: r => r.status === 'Passed' ? (
            <button onClick={() => { setShowApprove(r); setApproveForm(f => ({ ...f, password: '', reason: '' })); setError('') }}
              style={{ padding: '3px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              QA Approve (CLEARED)
            </button>
          ) : null },
        ]} />
      )}

      {view === 'orders' && (
        <DataTable loading={loading} data={orders} columns={[
          { header: 'DO No.', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.doNumber}</strong> },
          { header: 'Customer', accessor: r => r.customerName ?? '—' },
          { header: 'Product', accessor: 'productName' },
          { header: 'Despatch Date', accessor: r => r.despatchDate ?? '—' },
          { header: 'Packing', accessor: r => r.packingType ?? '—' },
          { header: 'Status', accessor: r => {
            const c = DO_STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' }
            return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{r.status}</span>
          }},
          { header: 'QC Tasks', accessor: r => <span style={{ fontSize: 12 }}>{r.tasks.length} task(s)</span> },
          { header: 'Created', accessor: r => new Date(r.createdAt).toLocaleDateString() },
        ]} />
      )}

      {/* Create Delivery Order Modal */}
      {showCreateDO && (
        <Modal title="New Delivery Order" onClose={() => setShowCreateDO(false)}>
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
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowCreateDO(false)} label="Create DO" />
          </form>
        </Modal>
      )}

      {/* QA Approve Modal */}
      {showApprove && (
        <Modal title={`QA Approve Dispatch QC — ${showApprove.doNumber}`} onClose={() => setShowApprove(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            21 CFR §11.50 — QA e-signature required. CLEARED status set server-side by DispatchStatusService (Contract 1).
            No role can set CLEARED manually.
          </p>
          <form onSubmit={submitApprove}>
            <Field label="Password (re-enter — §11.300)"><input style={inp} type="password" value={approveForm.password} onChange={e => setApproveForm(f => ({ ...f, password: e.target.value }))} required /></Field>
            <Field label="Meaning"><input style={inp} value={approveForm.meaning} onChange={e => setApproveForm(f => ({ ...f, meaning: e.target.value }))} required /></Field>
            <Field label="Reason"><input style={inp} value={approveForm.reason} onChange={e => setApproveForm(f => ({ ...f, reason: e.target.value }))} required placeholder="e.g. All Dispatch QC tests passed, product cleared" /></Field>
            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
            <ModalFooter saving={saving} onCancel={() => setShowApprove(null)} label="Sign & Set CLEARED" />
          </form>
        </Modal>
      )}
    </div>
  )
}
