import { useEffect, useState } from 'react'
import api from '@/api/client'
import DataTable from '@/components/DataTable'

interface LoginLog {
  loginAuditLogId: number
  username: string
  userId: number | null
  ipAddress: string
  userAgent: string | null
  outcome: string
  attemptedAt: string
}

const OUTCOME_META: Record<string, { bg: string; color: string; label: string }> = {
  Success:         { bg: '#dcfce7', color: '#15803d', label: 'Success' },
  InvalidPassword: { bg: '#fef3c7', color: '#b45309', label: 'Wrong Password' },
  UserNotFound:    { bg: '#fef3c7', color: '#92400e', label: 'User Not Found' },
  AccountLocked:   { bg: '#fee2e2', color: '#b91c1c', label: 'Account Locked' },
  AccountInactive: { bg: '#f1f5f9', color: '#64748b', label: 'Inactive' },
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const m = OUTCOME_META[outcome] ?? { bg: '#f1f5f9', color: '#374151', label: outcome }
  return (
    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 700, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

function browserLabel(ua: string | null): string {
  if (!ua) return '—'
  if (ua.includes('Edg'))     return 'Edge'
  if (ua.includes('Chrome'))  return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari'))  return 'Safari'
  if (ua.includes('curl') || ua.includes('python') || ua.includes('Postman')) return 'API Client'
  return ua.substring(0, 28)
}

const filt: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #dadce0', borderRadius: 6,
  fontSize: 12, fontFamily: 'inherit', background: '#fff', outline: 'none',
}

export default function SessionManagementPage() {
  const [logs,    setLogs]    = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')

  async function load(oc = outcome, f = from, t = to) {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (oc) params.outcome = oc
      if (f)  params.from    = new Date(f).toISOString()
      if (t)  params.to      = new Date(t + 'T23:59:59').toISOString()
      const res = await api.get('/audit/login-history', { params })
      setLogs(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load('', '', '') }, [])

  function reset() { setOutcome(''); setFrom(''); setTo(''); load('', '', '') }

  const counts = Object.fromEntries(
    Object.keys(OUTCOME_META).map(k => [k, logs.filter(l => l.outcome === k).length])
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>
          Session History
        </h3>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          21 CFR §11.10(d) — All login attempts with IP addresses and outcomes. Newest 1,000 records.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 600 }}>Outcome</label>
          <select style={filt} value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option value="">All outcomes</option>
            <option value="Success">Success</option>
            <option value="InvalidPassword">Wrong Password</option>
            <option value="UserNotFound">User Not Found</option>
            <option value="AccountLocked">Account Locked</option>
            <option value="AccountInactive">Inactive</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 600 }}>From</label>
          <input type="date" style={filt} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 600 }}>To</label>
          <input type="date" style={filt} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button onClick={() => load()}
          style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
          Apply
        </button>
        <button onClick={reset}
          style={{ padding: '6px 12px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          Reset
        </button>
        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto', alignSelf: 'center' }}>
          {logs.length} record{logs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary chips */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.entries(OUTCOME_META).map(([key, m]) =>
            counts[key] > 0 ? (
              <span key={key} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: m.bg, color: m.color, fontWeight: 700 }}>
                {m.label}: {counts[key]}
              </span>
            ) : null
          )}
        </div>
      )}

      <DataTable
        loading={loading}
        data={logs}
        exportFilename="SessionHistory"
        columns={[
          {
            header: 'Time',
            accessor: r => {
              const d = new Date(r.attemptedAt)
              return (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{d.toLocaleDateString()}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{d.toLocaleTimeString()}</div>
                </div>
              )
            },
          },
          {
            header: 'User',
            accessor: r => (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{r.username}</div>
                {r.userId != null
                  ? <div style={{ fontSize: 11, color: '#6b7280' }}>ID #{r.userId}</div>
                  : <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>unknown</div>
                }
              </div>
            ),
          },
          {
            header: 'IP Address',
            accessor: r => (
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151', background: '#f8fafc', padding: '2px 8px', borderRadius: 4, border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                {r.ipAddress}
              </span>
            ),
          },
          {
            header: 'Browser / Client',
            accessor: r => (
              <span style={{ fontSize: 11, color: '#6b7280' }} title={r.userAgent ?? ''}>
                {browserLabel(r.userAgent)}
              </span>
            ),
          },
          {
            header: 'Outcome',
            accessor: r => <OutcomeBadge outcome={r.outcome} />,
          },
        ]}
      />
    </div>
  )
}
