import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'
import { inp } from './master-data/LaboratoriesPage'

interface LogbookEntry {
  entryId: number; sampleId: number; sampleNumber: string; executionId: number
  parameterId: number; parameterName: string; isCritical: boolean
  triggerSource: string
  rawValue: string; calculatedResult: number | null
  autoCorectionApplied: boolean; correctionDetail: string | null
  specMinSnapshot: number | null; specMaxSnapshot: number | null
  passFail: string; isOos: boolean; isOot: boolean
  instrumentName: string | null; analystName: string
  evidenceFileRef: string | null; status: string
  signedByFullName: string | null; signedAt: string | null
  createdAt: string
}

const TRIGGER_COLORS: Record<string, { bg: string; color: string }> = {
  TimeBased:     { bg: '#dbeafe', color: '#1e40af' },
  OperatorScan:  { bg: '#d1fae5', color: '#065f46' },
  ProcessLog:    { bg: '#fef9c3', color: '#854d0e' },
  DispatchEvent: { bg: '#ede9fe', color: '#6d28d9' },
}

export default function DigitalLogbookPage() {
  const [data, setData] = useState<LogbookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [oosFilter, setOosFilter] = useState('')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const r = await api.get(`/digital-logbook?${params.toString()}`)
    let rows: LogbookEntry[] = r.data
    if (oosFilter === 'oos') rows = rows.filter(e => e.isOos)
    else if (oosFilter === 'oot') rows = rows.filter(e => e.isOot)
    else if (oosFilter === 'critical') rows = rows.filter(e => e.isCritical)
    setData(rows); setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter, oosFilter])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111827' }}>Digital Logbook</h1>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Signed">Signed</option>
          <option value="Superseded">Superseded</option>
        </select>
        <select style={{ ...inp, width: 160, marginTop: 0 }} value={oosFilter} onChange={e => setOosFilter(e.target.value)}>
          <option value="">All Results</option>
          <option value="oos">OOS Only</option>
          <option value="oot">OOT Only</option>
          <option value="critical">Critical Parameters</option>
        </select>
      </div>

      <DataTable loading={loading} data={data} columns={[
        { header: 'Sample', accessor: r => <strong style={{ fontFamily: 'monospace' }}>{r.sampleNumber}</strong> },
        { header: 'Parameter', accessor: r => (
          <div>
            {r.parameterName}
            {r.isCritical && <span style={{ marginLeft: 4, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>CRITICAL</span>}
          </div>
        )},
        { header: 'Trigger', accessor: r => {
          const c = TRIGGER_COLORS[r.triggerSource] ?? { bg: '#f3f4f6', color: '#374151' }
          return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.bg, color: c.color }}>{r.triggerSource}</span>
        }},
        { header: 'Raw / Calculated', accessor: r => (
          <div>
            <span style={{ fontFamily: 'monospace' }}>{r.rawValue}</span>
            {r.calculatedResult !== null && r.calculatedResult.toString() !== r.rawValue && (
              <span style={{ marginLeft: 6, fontSize: 12, color: '#2563eb' }}>→ {r.calculatedResult}</span>
            )}
            {r.autoCorectionApplied && <span style={{ marginLeft: 4, fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 4px', borderRadius: 4 }}>CORRECTED</span>}
          </div>
        )},
        { header: 'Spec (Min–Max)', accessor: r => r.specMinSnapshot !== null || r.specMaxSnapshot !== null
          ? `${r.specMinSnapshot ?? '—'} – ${r.specMaxSnapshot ?? '—'}` : '—' },
        { header: 'Result', accessor: r => (
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: r.passFail === 'PASS' ? '#d1fae5' : '#fee2e2',
              color: r.passFail === 'PASS' ? '#065f46' : '#991b1b' }}>{r.passFail}</span>
            {r.isOos && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>OOS</span>}
            {r.isOot && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 11, background: '#fef9c3', color: '#854d0e' }}>OOT</span>}
          </div>
        )},
        { header: 'Analyst', accessor: 'analystName' },
        { header: 'Evidence', accessor: r => r.evidenceFileRef
          ? <span style={{ fontSize: 12, color: '#16a34a' }}>✓ {r.evidenceFileRef}</span>
          : r.isCritical ? <span style={{ fontSize: 12, color: '#dc2626' }}>✗ Missing</span> : '—' },
        { header: 'Status', accessor: r => (
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12,
            background: r.status === 'Signed' ? '#d1fae5' : r.status === 'Superseded' ? '#f3f4f6' : '#fef9c3',
            color: r.status === 'Signed' ? '#065f46' : r.status === 'Superseded' ? '#6b7280' : '#854d0e' }}>{r.status}</span>
        )},
        { header: 'Signed By / At', accessor: r => r.signedByFullName
          ? <span style={{ fontSize: 12 }}>{r.signedByFullName}<br /><span style={{ color: '#6b7280' }}>{new Date(r.signedAt!).toLocaleString()}</span></span>
          : '—' },
        { header: 'Created', accessor: r => new Date(r.createdAt).toLocaleString() },
      ]} />
    </div>
  )
}
