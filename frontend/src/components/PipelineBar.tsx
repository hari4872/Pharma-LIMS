// Shared pipeline status bar — matches SampleRegistrationPage workflow timeline style
// Shows live count badge per stage, arrow connectors, click-to-filter behaviour

interface Stage {
  key: string
  label: string
  color: string
  bg: string
}

interface Props<T extends object> {
  stages: Stage[]
  data: T[]
  statusField: keyof T
  active: string          // '' = All
  onChange: (key: string) => void
}

export default function PipelineBar<T extends object>({
  stages, data, statusField, active, onChange,
}: Props<T>) {
  const counts = stages.reduce((acc, s) => {
    acc[s.key] = data.filter(d => String((d as Record<string, unknown>)[statusField as string]) === s.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* "All" button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onChange('')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${active === '' ? '#374151' : '#e5e7eb'}`,
            background: active === '' ? '#f1f5f9' : '#fff',
            transition: 'all 0.12s',
          }}>
          <span style={{
            minWidth: 22, height: 22, borderRadius: 6,
            background: '#f1f5f9', color: '#374151',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>{data.length}</span>
          <span style={{
            fontSize: 12, whiteSpace: 'nowrap',
            fontWeight: active === '' ? 700 : 500,
            color: active === '' ? '#374151' : '#6b7280',
          }}>All</span>
        </button>
        <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
          <path d="M4 8h8M9 5l3 3-3 3" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {stages.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => onChange(active === s.key ? '' : s.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${active === s.key ? s.color : '#e5e7eb'}`,
              background: active === s.key ? s.bg : '#fff',
              transition: 'all 0.12s',
            }}>
            <span style={{
              minWidth: 22, height: 22, borderRadius: 6,
              background: s.bg, color: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>{counts[s.key] ?? 0}</span>
            <span style={{
              fontSize: 12, whiteSpace: 'nowrap',
              fontWeight: active === s.key ? 700 : 500,
              color: active === s.key ? s.color : '#374151',
            }}>{s.label}</span>
          </button>
          {i < stages.length - 1 && (
            <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
              <path d="M4 8h8M9 5l3 3-3 3" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}
