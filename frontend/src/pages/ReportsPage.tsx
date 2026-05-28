import { useState } from 'react'
import api from '@/api/client'

// ─── Types ───────────────────────────────────────────────────────────────────
type ReportType = 'samples' | 'results' | 'audit-trail' | 'multi-site-summary'

const REPORTS = [
  {
    id: 'samples' as ReportType,
    title: 'Sample Register',
    desc: 'All sample registrations with status, material, lot, analyst, and TAT data',
    icon: '🧪',
    color: '#0284c7',
    bg: '#e0f2fe',
    filters: ['status'],
  },
  {
    id: 'results' as ReportType,
    title: 'Test Results',
    desc: 'Digital logbook entries with values, OOS/OOT flags, and analyst sign-off status',
    icon: '📊',
    color: '#7c3aed',
    bg: '#f3e8ff',
    filters: [],
  },
  {
    id: 'audit-trail' as ReportType,
    title: 'Audit Trail',
    desc: '21 CFR Part 11 compliant audit log — all create/update/approve/retire events',
    icon: '🔍',
    color: '#b45309',
    bg: '#fef3c7',
    filters: ['entityType'],
    adminOnly: true,
  },
  {
    id: 'multi-site-summary' as ReportType,
    title: 'Multi-Site Summary',
    desc: 'Consolidated cross-site KPIs, pipeline status, OOS rates and TAT breakdown per laboratory',
    icon: '🌐',
    color: '#1d4ed8',
    bg: '#dbeafe',
    filters: [],
    adminOnly: true,
  },
]

const SAMPLE_STATUSES = ['Registered', 'PendingTesting', 'InTesting', 'PendingQAReview', 'Released', 'Rejected']
const ENTITY_TYPES    = ['User', 'Sample', 'Instrument', 'Material', 'TestMethod', 'SpecLimit', 'CoA']

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
}

export default function ReportsPage() {
  const [selected,     setSelected]     = useState<ReportType | null>(null)
  const [from,         setFrom]         = useState('')
  const [to,           setTo]           = useState('')
  const [status,       setStatus]       = useState('')
  const [entityType,   setEntityType]   = useState('')
  const [downloading,  setDownloading]  = useState(false)
  const [error,        setError]        = useState('')

  async function download() {
    if (!selected) return
    setDownloading(true); setError('')

    try {
      const params = new URLSearchParams()
      if (from)       params.set('from', from)
      if (to)         params.set('to', to)
      if (status)     params.set('status', status)
      if (entityType) params.set('entityType', entityType)

      const url = `/reports/${selected}?${params.toString()}`
      const response = await api.get(url, { responseType: 'blob' })

      // Extract filename from Content-Disposition header or use default
      const cd = response.headers['content-disposition'] ?? ''
      const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = match?.[1]?.replace(/['"]/g, '') ?? `LIMS_${selected}_${new Date().toISOString().slice(0,10)}.xlsx`

      // Trigger browser download
      const blobUrl = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      setError('Export failed. Check your access permissions or date range.')
    } finally { setDownloading(false) }
  }

  const report = REPORTS.find(r => r.id === selected)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Reports & Exports</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Download Excel reports for samples, results, and audit trail (21 CFR Part 11 compliant)
        </p>
      </div>

      {/* ── Report cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
        {REPORTS.map(r => (
          <div key={r.id}
            onClick={() => { setSelected(r.id); setStatus(''); setEntityType('') }}
            style={{
              padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
              border: `2px solid ${selected === r.id ? r.color : '#e2e8f0'}`,
              background: selected === r.id ? r.bg : '#fff',
              boxShadow: selected === r.id ? `0 4px 16px ${r.color}22` : '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{r.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: selected === r.id ? r.color : '#0f172a', marginBottom: 4 }}>
              {r.title}
              {r.adminOnly && <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '1px 6px', marginLeft: 6 }}>QA/Admin</span>}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Export panel ── */}
      {selected && report && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e2e8f0', maxWidth: 600 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
            Export: {report.title}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>From Date</label>
              <input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>To Date</label>
              <input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {report.filters.includes('status') && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Filter by Status (optional)</label>
              <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {SAMPLE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {report.filters.includes('entityType') && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Filter by Entity Type (optional)</label>
              <select style={inp} value={entityType} onChange={e => setEntityType(e.target.value)}>
                <option value="">All Entity Types</option>
                {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Format note */}
          <div style={{ padding: '10px 14px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4', marginBottom: 16, fontSize: 12, color: '#0f766e' }}>
            📥 Output: Excel (.xlsx) — formatted with teal header row, auto-fitted columns, header/footer with date stamp
          </div>

          {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>{error}</div>}

          <button
            onClick={download}
            disabled={downloading}
            style={{
              width: '100%', padding: '11px 0',
              background: downloading ? '#9ca3af' : report.color,
              color: '#fff', border: 'none', borderRadius: 9,
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
            }}>
            {downloading ? '⏳ Generating Excel…' : `⬇ Download ${report.title} Excel`}
          </button>
        </div>
      )}

      {!selected && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Select a report type above to configure and download
        </div>
      )}
    </div>
  )
}
