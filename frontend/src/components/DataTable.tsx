import { useState, useMemo } from 'react'

interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  width?: string | number
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  searchable?: boolean
}

export default function DataTable<T extends object>({
  columns, data, loading, searchable = true,
}: Props<T>) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [search, setSearch]         = useState('')
  const [sortCol, setSortCol]       = useState<string | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')

  // ── Client-side search across all string/number key accessors ─────────
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        if (typeof col.accessor === 'function') return false
        return String((row as any)[col.accessor] ?? '').toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  // ── Client-side sort ──────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const col = columns.find(c => c.header === sortCol)
    if (!col || typeof col.accessor === 'function') return filtered
    const key = col.accessor as keyof T
    return [...filtered].sort((a, b) => {
      const av = (a as any)[key]
      const bv = (b as any)[key]
      // numeric sort if both parse
      const na = Number(av), nb = Number(bv)
      const cmp = !isNaN(na) && !isNaN(nb)
        ? na - nb
        : String(av ?? '').toLowerCase().localeCompare(String(bv ?? '').toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, columns])

  function handleSort(header: string, accessor: Column<T>['accessor']) {
    if (typeof accessor === 'function') return   // non-sortable
    if (sortCol === header) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(header); setSortDir('asc') }
  }

  return (
    <div>
      {/* ── Search + count bar ── */}
      {searchable && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            {/* search icon */}
            <svg
              viewBox="0 0 24 24" fill="none" width="14" height="14"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }}
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search records…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 10,
                height: 36, border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, color: '#111827', outline: 'none',
                fontFamily: 'inherit', background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {search.trim()
              ? `${filtered.length} of ${data.length} records`
              : `${data.length} record${data.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{
        overflowX: 'auto',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              {columns.map(col => {
                const isSortable = typeof col.accessor !== 'function'
                const isActive   = sortCol === col.header
                return (
                  <th
                    key={col.header}
                    onClick={() => handleSort(col.header, col.accessor)}
                    title={isSortable ? `Sort by ${col.header}` : undefined}
                    style={{
                      ...thStyle,
                      width: col.width,
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      color: isActive ? '#0d6e6e' : '#374151',
                      background: isActive ? '#f0fdfa' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {col.header}
                      {isSortable && (
                        <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.3, color: isActive ? '#0d6e6e' : '#6b7280' }}>
                          {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={emptyCell}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#9ca3af' }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    Loading…
                  </span>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={emptyCell}>
                  {search.trim()
                    ? <span style={{ color: '#9ca3af', fontSize: 13 }}>No records match "<strong>{search}</strong>"</span>
                    : <span style={{ color: '#9ca3af', fontSize: 13 }}>No records found</span>}
                </td>
              </tr>
            ) : sorted.map((row, i) => (
              <tr
                key={i}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  borderBottom: i < sorted.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: hoveredRow === i ? '#f0fdfa' : i % 2 === 0 ? '#fff' : '#fafcff',
                  transition: 'background 0.08s',
                }}
              >
                {columns.map(col => (
                  <td key={col.header} style={tdStyle}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : String((row as any)[col.accessor] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#374151',
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  transition: 'background 0.1s, color 0.1s',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  color: '#374151',
  fontSize: 13,
  verticalAlign: 'middle',
}

const emptyCell: React.CSSProperties = {
  textAlign: 'center',
  padding: '36px 16px',
  color: '#6b7280',
  fontSize: 13,
}
