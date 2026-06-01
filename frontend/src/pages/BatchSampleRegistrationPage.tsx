import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import api from '@/api/client'
import { toast } from '@/components/Toast'

interface Material   { materialId: number; materialName: string; productType: string }
interface SampleType { sampleTypeId: number; typeName: string; typeCode: string }
interface RowResult  { lotNumber: string; success: boolean; sampleNumber?: string; error?: string }

interface GridRow {
  id: number
  materialId: string; lotNumber: string
  mfgDate: string; expDate: string
  sampleTypeId: string; receivedTemp: string
  sampleCondition: string; isRush: boolean
  externalBatchId: string
}

const inp: React.CSSProperties = {
  width: '100%', padding: '5px 7px', borderRadius: 5,
  border: '1px solid #d1d5db', fontSize: 12, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
}

function emptyRow(id: number): GridRow {
  return { id, materialId: '', lotNumber: '', mfgDate: '', expDate: '', sampleTypeId: '', receivedTemp: '', sampleCondition: 'OK', isRush: false, externalBatchId: '' }
}

export default function BatchSampleRegistrationPage() {
  const { labId } = useSelector((s: RootState) => s.auth)

  const [materials,   setMaterials]   = useState<Material[]>([])
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [rows,        setRows]        = useState<GridRow[]>([emptyRow(1), emptyRow(2), emptyRow(3)])
  const [results,     setResults]     = useState<RowResult[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [nextId,      setNextId]      = useState(4)

  useEffect(() => {
    Promise.all([api.get('/materials'), api.get('/sample-types')])
      .then(([m, s]) => { setMaterials(m.data); setSampleTypes(s.data.filter((t: SampleType) => t.typeCode !== 'DSPQC')) })
      .catch(() => {})
  }, [])

  function updateRow(id: number, field: keyof GridRow, value: string | boolean) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(nextId)])
    setNextId(n => n + 1)
  }

  function removeRow(id: number) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function clearAll() {
    setRows([emptyRow(1), emptyRow(2), emptyRow(3)])
    setNextId(4); setResults([])
  }

  const filledRows = rows.filter(r => r.materialId && r.lotNumber && r.mfgDate && r.expDate && r.sampleTypeId)

  async function submit() {
    if (filledRows.length === 0) { toast('No complete rows to submit', 'error'); return }
    setSubmitting(true); setResults([])
    try {
      const entries = filledRows.map(r => ({
        materialId:      Number(r.materialId),
        lotNumber:       r.lotNumber.trim(),
        mfgDate:         r.mfgDate,
        expDate:         r.expDate,
        sampleTypeId:    Number(r.sampleTypeId),
        receivedTemp:    r.receivedTemp ? Number(r.receivedTemp) : null,
        sampleCondition: r.sampleCondition,
        isRush:          r.isRush,
        externalBatchId: r.externalBatchId || null,
      }))
      const res = await api.post('/samples/batch-register', { labId: labId ?? 1, entries })
      const data = res.data
      setResults(data.rows)
      toast(`Batch registered — ${data.successCount} success, ${data.failCount} failed`, data.failCount > 0 ? 'error' : 'success')
    } catch (err: any) {
      toast(err.response?.data?.message ?? 'Batch registration failed', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Batch Sample Registration</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Register multiple samples at once — fill each row, leave blank rows to skip.
        </p>
      </div>

      {/* Grid */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['#', 'Material *', 'Lot Number *', 'Mfg Date *', 'Exp Date *', 'Sample Type *', 'Temp (°C)', 'Condition', 'Rush', 'Batch Ref', 'Result', ''].map(h => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderRight: '1px solid #334155' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const res = results.find(r => r.lotNumber === row.lotNumber)
                const rowBg = res ? (res.success ? '#f0fdf4' : '#fff1f2') : idx % 2 === 0 ? '#fff' : '#f8fafc'
                return (
                  <tr key={row.id} style={{ background: rowBg, borderBottom: '1px solid #e5e7eb' }}>
                    {/* Row number */}
                    <td style={{ padding: '6px 10px', color: '#9ca3af', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #e5e7eb', width: 32 }}>
                      {idx + 1}
                    </td>

                    {/* Material */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 150 }}>
                      <select style={inp} value={row.materialId} onChange={e => updateRow(row.id, 'materialId', e.target.value)}>
                        <option value="">Select…</option>
                        {materials.map(m => <option key={m.materialId} value={m.materialId}>{m.materialName}</option>)}
                      </select>
                    </td>

                    {/* Lot Number */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 120 }}>
                      <input style={{ ...inp, fontFamily: 'monospace', fontWeight: 600 }} placeholder="LOT-001"
                        value={row.lotNumber} onChange={e => updateRow(row.id, 'lotNumber', e.target.value)} />
                    </td>

                    {/* Mfg Date */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 120 }}>
                      <input type="date" style={inp} value={row.mfgDate} onChange={e => updateRow(row.id, 'mfgDate', e.target.value)} />
                    </td>

                    {/* Exp Date */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 120 }}>
                      <input type="date" style={inp} value={row.expDate} onChange={e => updateRow(row.id, 'expDate', e.target.value)} />
                    </td>

                    {/* Sample Type */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 130 }}>
                      <select style={inp} value={row.sampleTypeId} onChange={e => updateRow(row.id, 'sampleTypeId', e.target.value)}>
                        <option value="">Select…</option>
                        {sampleTypes.map(t => <option key={t.sampleTypeId} value={t.sampleTypeId}>{t.typeName}</option>)}
                      </select>
                    </td>

                    {/* Received Temp */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 80 }}>
                      <input type="number" step="0.1" style={inp} placeholder="22.0"
                        value={row.receivedTemp} onChange={e => updateRow(row.id, 'receivedTemp', e.target.value)} />
                    </td>

                    {/* Condition */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 110 }}>
                      <select style={inp} value={row.sampleCondition} onChange={e => updateRow(row.id, 'sampleCondition', e.target.value)}>
                        <option value="OK">OK</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Compromised">Compromised</option>
                      </select>
                    </td>

                    {/* Rush */}
                    <td style={{ padding: '5px 6px', textAlign: 'center', borderRight: '1px solid #e5e7eb', width: 50 }}>
                      <input type="checkbox" checked={row.isRush}
                        onChange={e => updateRow(row.id, 'isRush', e.target.checked)}
                        style={{ accentColor: '#dc2626', width: 14, height: 14 }} />
                    </td>

                    {/* Batch Ref */}
                    <td style={{ padding: '5px 6px', borderRight: '1px solid #e5e7eb', minWidth: 110 }}>
                      <input style={inp} placeholder="ERP ref…"
                        value={row.externalBatchId} onChange={e => updateRow(row.id, 'externalBatchId', e.target.value)} />
                    </td>

                    {/* Result */}
                    <td style={{ padding: '5px 10px', borderRight: '1px solid #e5e7eb', minWidth: 130 }}>
                      {res && (
                        res.success
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>✅ {res.sampleNumber}</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>❌ {res.error}</span>
                      )}
                    </td>

                    {/* Remove */}
                    <td style={{ padding: '5px 8px', width: 32 }}>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(row.id)} title="Remove row"
                          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={addRow}
            style={{ fontSize: 12, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            + Add Row
          </button>
        </div>
      </div>

      {/* Submit bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={submit} disabled={submitting || filledRows.length === 0}
          style={{ padding: '10px 28px', background: submitting || filledRows.length === 0 ? '#99f6e4' : '#0d9488',
            color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
            cursor: submitting || filledRows.length === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {submitting ? 'Registering…' : `Register ${filledRows.length} Sample${filledRows.length !== 1 ? 's' : ''}`}
        </button>
        <button onClick={clearAll}
          style={{ padding: '10px 20px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Clear All
        </button>
        {filledRows.length < rows.length && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {rows.length - filledRows.length} incomplete row(s) will be skipped
          </span>
        )}
      </div>
    </div>
  )
}
