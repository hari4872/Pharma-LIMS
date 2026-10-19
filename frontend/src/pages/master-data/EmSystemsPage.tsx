import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import DataTable from '@/components/DataTable'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface EmSystemParam {
  emSystemParameterId: number
  parameterId: number
  parameterName: string
  parameterCode: string
  uom: string
  alertMin: number | null
  alertMax: number | null
  actionMin: number | null
  actionMax: number | null
}

interface EmSystem {
  emSystemId: number
  systemName: string
  systemCode: string
  description: string | null
  isActive: boolean
  defaultParameters: EmSystemParam[]
}

interface TestMethodParam {
  parameterId: number
  parameterCode: string
  parameterName: string
  uom: string
}

interface ParamRow {
  parameterId: number
  alertMin: string
  alertMax: string
  actionMin: string
  actionMax: string
}

function emptyParamRow(): ParamRow {
  return { parameterId: 0, alertMin: '', alertMax: '', actionMin: '', actionMax: '' }
}

export default function EmSystemsPage() {
  const [data, setData]       = useState<EmSystem[]>([])
  const [allParams, setAllParams] = useState<TestMethodParam[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [editRow, setEditRow] = useState<EmSystem | null>(null)

  const emptyForm = { systemName: '', systemCode: '', description: '' }
  const [form, setForm]       = useState(emptyForm)
  const [paramRows, setParamRows] = useState<ParamRow[]>([emptyParamRow()])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function load() {
    setLoading(true)
    try {
      const [r, pr] = await Promise.all([
        api.get('/em-systems').catch(() => ({ data: [] })),
        api.get('/parameters').catch(() => ({ data: [] })),
      ])
      setData(r.data)
      setAllParams(pr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  function openAdd() {
    setEditRow(null)
    setForm(emptyForm)
    setParamRows([emptyParamRow()])
    setError('')
    setShowForm(true)
  }

  function openEdit(sys: EmSystem) {
    setEditRow(sys)
    setForm({ systemName: sys.systemName, systemCode: sys.systemCode, description: sys.description ?? '' })
    setParamRows(
      sys.defaultParameters.length > 0
        ? sys.defaultParameters.map(p => ({
            parameterId: p.parameterId,
            alertMin:  p.alertMin  != null ? String(p.alertMin)  : '',
            alertMax:  p.alertMax  != null ? String(p.alertMax)  : '',
            actionMin: p.actionMin != null ? String(p.actionMin) : '',
            actionMax: p.actionMax != null ? String(p.actionMax) : '',
          }))
        : [emptyParamRow()]
    )
    setError('')
    setShowForm(true)
  }

  function addParamRow() { setParamRows(r => [...r, emptyParamRow()]) }
  function removeParamRow(i: number) { setParamRows(r => r.filter((_, idx) => idx !== i)) }
  function setParamField(i: number, k: keyof ParamRow, v: string | number) {
    setParamRows(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  }

  function buildParams() {
    return paramRows
      .filter(r => r.parameterId > 0)
      .map(r => ({
        parameterId: r.parameterId,
        alertMin:  r.alertMin  !== '' ? Number(r.alertMin)  : null,
        alertMax:  r.alertMax  !== '' ? Number(r.alertMax)  : null,
        actionMin: r.actionMin !== '' ? Number(r.actionMin) : null,
        actionMax: r.actionMax !== '' ? Number(r.actionMax) : null,
      }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editRow) {
        await api.put(`/em-systems/${editRow.emSystemId}`, {
          systemName:        form.systemName,
          description:       form.description || null,
          isActive:          true,
          defaultParameters: buildParams(),
        })
        toast(`EM System "${form.systemName}" updated`, 'success')
      } else {
        await api.post('/em-systems', {
          systemName:        form.systemName,
          systemCode:        form.systemCode,
          description:       form.description || null,
          defaultParameters: buildParams(),
        })
        toast(`EM System "${form.systemName}" created`, 'success')
      }
      setShowForm(false)
      load()
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to save EM System')
      setError(msg); toast(msg, 'error')
    } finally { setSaving(false) }
  }

  async function retire(sys: EmSystem) {
    if (!confirm(`Retire "${sys.systemName}"? It will no longer appear in checkpoint creation.`)) return
    try {
      await api.delete(`/em-systems/${sys.emSystemId}`)
      toast(`"${sys.systemName}" retired`, 'success')
      load()
    } catch (err) { toast(getErrorMessage(err, 'Failed to retire'), 'error') }
  }

  const usedParamIds = new Set(paramRows.map(r => r.parameterId))

  return (
    <div>
      <PageHeader title="EM Systems" onAdd={openAdd} addLabel="New EM System" />
      <p style={{ margin: '-12px 0 16px', fontSize: 13, color: '#6b7280' }}>
        Environmental Monitoring system masters — defines default parameters and alert/action limits per system type.
        When selected in a checkpoint, parameters auto-populate.
      </p>

      <DataTable
        loading={loading}
        data={data}
        columns={[
          { header: 'Code',        accessor: 'systemCode' as keyof EmSystem, width: 90 },
          { header: 'System Name', accessor: 'systemName' as keyof EmSystem, width: 200 },
          { header: 'Description', accessor: (r: EmSystem) => r.description ?? '—', width: 280 },
          {
            header: 'Parameters', accessor: (r: EmSystem) =>
              r.defaultParameters.length === 0
                ? <span style={{ color: '#9ca3af' }}>—</span>
                : <span style={{ fontSize: 12, color: '#374151' }}>{r.defaultParameters.map(p => p.parameterCode).join(', ')}</span>
          },
          {
            header: 'Status', accessor: (r: EmSystem) =>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: r.isActive ? '#dcfce7' : '#fee2e2', color: r.isActive ? '#15803d' : '#b91c1c' }}>
                {r.isActive ? 'Active' : 'Retired'}
              </span>,
            width: 80,
          },
          {
            header: '', accessor: (r: EmSystem) => (
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(r)}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Edit
                </button>
                {r.isActive && (
                  <button onClick={() => retire(r)}
                    style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5',
                      background: '#fff7f7', cursor: 'pointer', color: '#b91c1c' }}>
                    Retire
                  </button>
                )}
              </span>
            ),
            width: 130,
          },
        ]}
      />

      {showForm && (
      <Drawer onClose={() => setShowForm(false)}
        title={editRow ? `Edit: ${editRow.systemName}` : 'New EM System'}
        width={600}>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="System Name *">
                <input style={inp} value={form.systemName} onChange={set('systemName')} required
                  placeholder="e.g. WFI System" />
              </Field>
              <Field label="System Code *">
                <input style={{ ...inp, background: editRow ? '#f9fafb' : undefined }}
                  value={form.systemCode} onChange={set('systemCode')} required
                  readOnly={!!editRow} placeholder="e.g. WFI" />
              </Field>
            </div>

            <Field label="Description">
              <textarea style={{ ...inp, height: 60, resize: 'vertical' } as React.CSSProperties}
                value={form.description} onChange={set('description')}
                placeholder="Brief description of the monitoring system" />
            </Field>

            {/* Default Parameters */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 8 }}>
                Default Parameters &amp; Limits
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                These are auto-populated when creating checkpoints that use this system.
                Alert / Action values are upper bounds (leave blank = not set).
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px 32px',
                  background: '#f9fafb', padding: '6px 10px', gap: 6,
                  fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  <span>Parameter</span>
                  <span>Alert Min</span>
                  <span>Alert Max</span>
                  <span>Action Min</span>
                  <span>Action Max</span>
                  <span></span>
                </div>

                {paramRows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px 32px',
                    padding: '6px 10px', gap: 6, borderBottom: i < paramRows.length - 1 ? '1px solid #f3f4f6' : 'none',
                    alignItems: 'center' }}>
                    <select
                      style={{ ...inp, fontSize: 12 }}
                      value={row.parameterId || ''}
                      onChange={e => setParamField(i, 'parameterId', Number(e.target.value))}>
                      <option value="">— select —</option>
                      {allParams
                        .filter(p => !usedParamIds.has(p.parameterId) || p.parameterId === row.parameterId)
                        .map(p => (
                          <option key={p.parameterId} value={p.parameterId}>
                            {p.parameterName} ({p.uom})
                          </option>
                        ))}
                    </select>
                    {(['alertMin', 'alertMax', 'actionMin', 'actionMax'] as const).map(field => (
                      <input key={field} type="number" step="any" style={{ ...inp, fontSize: 12, textAlign: 'right' }}
                        placeholder="—"
                        value={(row as Record<string, string>)[field]}
                        onChange={e => setParamField(i, field, e.target.value)} />
                    ))}
                    <button type="button" onClick={() => removeParamRow(i)}
                      style={{ width: 26, height: 26, border: 'none', background: 'transparent',
                        cursor: 'pointer', color: '#9ca3af', fontSize: 16, display: 'flex',
                        alignItems: 'center', justifyContent: 'center' }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addParamRow}
                style={{ marginTop: 8, fontSize: 12, color: '#0d9488', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>
                + Add parameter
              </button>
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}
          </div>

          <DrawerFooter saving={saving} onCancel={() => setShowForm(false)}
            label={editRow ? 'Save Changes' : 'Create System'} />
        </form>
      </Drawer>
      )}
    </div>
  )
}
