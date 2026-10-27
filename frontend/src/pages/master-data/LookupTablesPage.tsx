import { useEffect, useState } from 'react'
import api from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { PageHeader, Field, inp } from './LaboratoriesPage'
import { toast } from '@/components/Toast'
import { Drawer, DrawerFooter } from '@/components/Drawer'

interface LookupTable { lookupTableId: number; lookupCode: string; inputCol1: string; inputCol2: string | null; resultCol: string; isActive: boolean; rowCount: number }
interface LookupRow { rowId: number; inputValue1: number; inputValue2: number | null; resultValue: number }
interface TableDetail extends LookupTable { rows: LookupRow[] }

export default function LookupTablesPage() {
  const [tables, setTables] = useState<LookupTable[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<TableDetail | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ lookupCode: '', inputCol1: '', inputCol2: '', resultCol: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addRow, setAddRow] = useState({ inputValue1: '', inputValue2: '', resultValue: '' })
  const [addingRow, setAddingRow] = useState(false)

  async function load() {
    setLoading(true)
    try { const r = await api.get('/lookup-tables'); setTables(r.data) }
    catch { toast('Failed to load lookup tables', 'error') }
    finally { setLoading(false) }
  }

  async function openTable(t: LookupTable) {
    setLoadingRows(true)
    try {
      const r = await api.get(`/lookup-tables/${t.lookupTableId}`)
      setSelected(r.data)
    } catch { toast('Failed to load table rows', 'error') }
    finally { setLoadingRows(false) }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/lookup-tables', {
        lookupCode: createForm.lookupCode,
        inputCol1: createForm.inputCol1,
        inputCol2: createForm.inputCol2 || null,
        resultCol: createForm.resultCol,
      })
      toast('Lookup table created', 'success')
      setShowCreate(false)
      setCreateForm({ lookupCode: '', inputCol1: '', inputCol2: '', resultCol: '' })
      load()
    } catch (err) { setError(getErrorMessage(err, 'Failed to create')) }
    finally { setSaving(false) }
  }

  async function submitAddRow(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setAddingRow(true)
    try {
      await api.post(`/lookup-tables/${selected.lookupTableId}/rows`, {
        inputValue1: parseFloat(addRow.inputValue1),
        inputValue2: addRow.inputValue2 ? parseFloat(addRow.inputValue2) : null,
        resultValue: parseFloat(addRow.resultValue),
      })
      setAddRow({ inputValue1: '', inputValue2: '', resultValue: '' })
      const r = await api.get(`/lookup-tables/${selected.lookupTableId}`)
      setSelected(r.data)
      load()
    } catch (err) { toast(getErrorMessage(err, 'Failed to add row'), 'error') }
    finally { setAddingRow(false) }
  }

  async function deleteRow(rowId: number) {
    if (!selected) return
    try {
      await api.delete(`/lookup-tables/${selected.lookupTableId}/rows/${rowId}`)
      const r = await api.get(`/lookup-tables/${selected.lookupTableId}`)
      setSelected(r.data)
      load()
    } catch (err) { toast(getErrorMessage(err, 'Failed to delete row'), 'error') }
  }

  useEffect(() => { load() }, [])

  const hasInput2 = selected?.inputCol2

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      <PageHeader
        title="Lookup Tables"
        onAdd={() => setShowCreate(true)}
        addLabel="+ New Lookup Table"
      />
      {loading && <p style={{ color: '#6b7280', fontSize: 14 }}>Loading…</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginTop: 8 }}>
        {/* Table list */}
        <div>
          {tables.length === 0 && !loading && <p style={{ color: '#9ca3af', fontSize: 13 }}>No lookup tables yet.</p>}
          {tables.map(t => (
            <div key={t.lookupTableId}
              onClick={() => openTable(t)}
              style={{
                padding: '10px 14px', borderRadius: 6, cursor: 'pointer', marginBottom: 6,
                background: selected?.lookupTableId === t.lookupTableId ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${selected?.lookupTableId === t.lookupTableId ? '#93c5fd' : '#e2e8f0'}`,
              }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>{t.lookupCode}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {t.inputCol1}{t.inputCol2 ? ` × ${t.inputCol2}` : ''} → {t.resultCol} · {t.rowCount} row{t.rowCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div>
          {!selected && !loadingRows && (
            <div style={{ padding: 24, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              Select a lookup table to view and edit its rows
            </div>
          )}
          {loadingRows && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading rows…</p>}
          {selected && !loadingRows && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', fontFamily: 'monospace' }}>{selected.lookupCode}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 12 }}>
                  {selected.inputCol1}{selected.inputCol2 ? ` × ${selected.inputCol2}` : ''} → {selected.resultCol}
                </span>
              </div>

              {/* Existing rows */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{selected.inputCol1}</th>
                    {hasInput2 && <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{selected.inputCol2}</th>}
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{selected.resultCol}</th>
                    <th style={{ padding: '7px 12px', width: 48, borderBottom: '1px solid #e2e8f0' }} />
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.length === 0 && (
                    <tr><td colSpan={hasInput2 ? 4 : 3} style={{ padding: '12px', color: '#9ca3af', textAlign: 'center' }}>No rows yet — add one below</td></tr>
                  )}
                  {selected.rows.map((row, i) => (
                    <tr key={row.rowId} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{row.inputValue1}</td>
                      {hasInput2 && <td style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{row.inputValue2 ?? '—'}</td>}
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 600 }}>{row.resultValue}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <button onClick={() => deleteRow(row.rowId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, padding: '0 4px' }}
                          title="Delete row">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add row form */}
              <form onSubmit={submitAddRow} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 8 }}>Add Row</div>
                <div style={{ display: 'grid', gridTemplateColumns: hasInput2 ? '1fr 1fr 1fr auto' : '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{selected.inputCol1}</label>
                    <input style={inp} type="number" step="any" required value={addRow.inputValue1}
                      onChange={e => setAddRow(f => ({ ...f, inputValue1: e.target.value }))} />
                  </div>
                  {hasInput2 && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{selected.inputCol2}</label>
                      <input style={inp} type="number" step="any" value={addRow.inputValue2}
                        onChange={e => setAddRow(f => ({ ...f, inputValue2: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{selected.resultCol} (Result)</label>
                    <input style={inp} type="number" step="any" required value={addRow.resultValue}
                      onChange={e => setAddRow(f => ({ ...f, resultValue: e.target.value }))} />
                  </div>
                  <button type="submit" disabled={addingRow}
                    style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {addingRow ? '…' : '+ Add'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Create table drawer */}
      {showCreate && (
        <Drawer title="New Lookup Table" subtitle="Create a lookup table to map input values to a result" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate}>
            <Field label="Lookup Code (unique identifier)">
              <input style={inp} value={createForm.lookupCode}
                onChange={e => setCreateForm(f => ({ ...f, lookupCode: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                placeholder="e.g. SG_TEMP_CONC" required />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>Uppercase code used to identify this table. Used in formula engine.</div>
            </Field>
            <Field label="Input Column 1 label">
              <input style={inp} value={createForm.inputCol1}
                onChange={e => setCreateForm(f => ({ ...f, inputCol1: e.target.value }))}
                placeholder="e.g. Temperature (°C)" required />
            </Field>
            <Field label="Input Column 2 label (optional — leave blank for single-input tables)">
              <input style={inp} value={createForm.inputCol2}
                onChange={e => setCreateForm(f => ({ ...f, inputCol2: e.target.value }))}
                placeholder="e.g. Concentration (%)" />
            </Field>
            <Field label="Result Column label">
              <input style={inp} value={createForm.resultCol}
                onChange={e => setCreateForm(f => ({ ...f, resultCol: e.target.value }))}
                placeholder="e.g. Correction Factor" required />
            </Field>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <DrawerFooter saving={saving} onCancel={() => setShowCreate(false)} label="Create Table" />
          </form>
        </Drawer>
      )}
    </div>
  )
}
