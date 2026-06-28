import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Modal, Field, ModalFooter, inp, StatusBadge } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface SampleType { sampleTypeId: number; typeName: string; typeCode: string; matrix: string; stage: string; description: string; isActive: boolean }
interface Checkpoint { checkpointId: number; checkpointCode: string; triggerMode: string; checkpointType: string }

const MATRICES = ['Solid', 'Liquid', 'Gas', 'Swab', 'Powder', 'Granule', 'Suspension', 'Emulsion']
const STAGES = ['Incoming', 'InProcess', 'Finished', 'Stability']
function stageLabel(s: string) { return s.replace(/([a-z])([A-Z])/g, '$1 $2') }

const TRIGGER_LABEL: Record<string, string> = {
  TimeBased: 'Time-Based', OperatorScan: 'Operator Scan',
  ProcessLog: 'Process Log', DispatchEvent: 'Dispatch Event',
}

export default function SampleTypesPage() {
  const [data, setData] = useState<SampleType[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ typeName: '', typeCode: '', matrix: 'Liquid', stage: 'InProcess', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Default checkpoints config
  const [cpModal, setCpModal] = useState<SampleType | null>(null)
  const [allCheckpoints, setAllCheckpoints] = useState<Checkpoint[]>([])
  const [selectedCps, setSelectedCps] = useState<number[]>([])
  const [cpSaving, setCpSaving] = useState(false)

  async function load() { setLoading(true); const r = await api.get('/sample-types'); setData(r.data); setLoading(false) }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  async function openCpModal(st: SampleType) {
    setCpModal(st)
    const [cpsRes, defaultsRes] = await Promise.all([
      api.get('/checkpoints'),
      api.get(`/sample-types/${st.sampleTypeId}/checkpoints`),
    ])
    setAllCheckpoints(cpsRes.data.filter((c: Checkpoint & { isActive: boolean }) => c.isActive))
    setSelectedCps(defaultsRes.data)
  }

  async function saveCps() {
    if (!cpModal) return
    setCpSaving(true)
    try {
      await api.put(`/sample-types/${cpModal.sampleTypeId}/checkpoints`, selectedCps)
      toast(`Default checkpoints saved for "${cpModal.typeName}"`, 'success')
      setCpModal(null)
    } catch (err) { toast(getErrorMessage(err, 'Failed to save'), 'error') }
    finally { setCpSaving(false) }
  }

  function toggleCp(id: number) {
    setSelectedCps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/sample-types', form)
      setShowForm(false)
      toast(`Sample Type "${form.typeName}" added successfully`, 'success')
      load()
    } catch (err) { const msg = getErrorMessage(err, 'Failed'); setError(msg); toast(msg, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Sample Types" onAdd={() => { setForm({ typeName: '', typeCode: '', matrix: 'Liquid', stage: 'InProcess', description: '' }); setError(''); setShowForm(true) }} />
      <DataTable loading={loading} data={data} exportFilename="SampleTypes" columns={[
        { header: 'Code', accessor: 'typeCode' },
        { header: 'Name', accessor: 'typeName' },
        { header: 'Matrix', accessor: 'matrix' },
        { header: 'Stage', accessor: r => stageLabel(r.stage) },
        { header: 'Description', accessor: 'description' },
        { header: 'Status', accessor: r => <StatusBadge active={r.isActive} /> },
        {
          header: 'Default Checkpoints', accessor: r => (
            <button onClick={() => openCpModal(r)}
              style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 6, cursor: 'pointer' }}>
              ⚙ Configure
            </button>
          )
        },
      ]} />

      {/* Add Sample Type modal */}
      {showForm && (
        <Drawer title="Add Sample Type" subtitle="Define a new sample matrix and stage classification" onClose={() => setShowForm(false)}>
          <form onSubmit={submit}>
            <Field label="ID"><input style={{ ...inp, background: '#f8fafc', color: '#9ca3af', cursor: 'not-allowed' }} value="Auto-generated" readOnly /></Field>
            <Field label="Type Code"><input style={inp} value={form.typeCode} onChange={e => setForm(f => ({ ...f, typeCode: e.target.value }))} required placeholder="e.g. ST-LIQ-001" /></Field>
            <Field label="Type Name"><input style={inp} value={form.typeName} onChange={e => setForm(f => ({ ...f, typeName: e.target.value }))} required /></Field>
            <Field label="Matrix">
              <select style={inp} value={form.matrix} onChange={e => setForm(f => ({ ...f, matrix: e.target.value }))}>
                {MATRICES.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Stage">
              <select style={inp} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </Field>
            <Field label="Description"><input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowForm(false)} />
          </form>
        </Drawer>
      )}

      {/* Default Checkpoints config modal */}
      {cpModal && (
        <Drawer title={`Default Checkpoints — ${cpModal.typeName}`} subtitle="Choose which checkpoints are auto-selected for this sample type" onClose={() => setCpModal(null)}>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
            Selected checkpoints will be auto-checked when this sample type is chosen during registration. Analyst can still adjust before submitting.
          </p>
          {allCheckpoints.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No active checkpoints found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {allCheckpoints.map(cp => {
                const checked = selectedCps.includes(cp.checkpointId)
                return (
                  <label key={cp.checkpointId} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderRadius: 8, border: `1.5px solid ${checked ? '#0d9488' : '#e5e7eb'}`,
                    background: checked ? '#f0fdfa' : '#fff', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCp(cp.checkpointId)}
                      style={{ accentColor: '#0d9488', width: 15, height: 15 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{cp.checkpointCode}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{cp.checkpointType}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{TRIGGER_LABEL[cp.triggerMode] ?? cp.triggerMode}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setCpModal(null)}
              style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={saveCps} disabled={cpSaving}
              style={{ padding: '8px 20px', background: cpSaving ? '#99f6e4' : '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: cpSaving ? 'default' : 'pointer' }}>
              {cpSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Drawer>
      )}
    </div>
  )
}
