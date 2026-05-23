import { useState, useMemo } from 'react'
import { exportCsv } from '@/utils/exportCsv'

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
  exportFilename?: string   // if set, shows Export CSV button
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function DataTable<T extends object>({
  columns, data, loading, searchable = true, exportFilename,
}: Props<T>) {
  const [hoveredRow, setHoveredRow]   = useState<number | null>(null)
  const [search, setSearch]           = useState('')
  const [sortCol, setSortCol]         = useState<string | null>(null)
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('asc')
  const [page, setPage]               = useState(0)
  const [pageSize, setPageSize]       = useState(25)

  // ── Search ────────────────────────────────────────────────────────────
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

  // ── Sort ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const col = columns.find(c => c.header === sortCol)
    if (!col || typeof col.accessor === 'function') return filtered
    const key = col.accessor as keyof T
    return [...filtered].sort((a, b) => {
      const av = (a as any)[key], bv = (b as any)[key]
      const na = Number(av), nb = Number(bv)
      const cmp = !isNaN(na) && !isNaN(nb)
        ? na - nb
        : String(av ?? '').toLowerCase().localeCompare(String(bv ?? '').toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, columns])

  // ── Pagination ────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const paginated  = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  function handleSort(header: string, accessor: Column<T>['accessor']) {
    if (typeof accessor === 'function') return
    if (sortCol === header) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(header); setSortDir('asc') }
    setPage(0)
  }

  function handleSearch(val: string) { setSearch(val); setPage(0) }

  // ── CSV export — flatten only key-accessor columns ────────────────────
  function handleExport() {
    const exportData = sorted.map(row => {
      const obj: Record<string, unknown> = {}
      columns.forEach(col => {
        if (typeof col.accessor !== 'function') obj[col.header] = (row as any)[col.accessor] ?? ''
      })
      return obj
    })
    exportCsv(exportData, exportFilename ?? 'export')
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      {(searchable || exportFilename) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          {searchable && (
            <div style={{ position: 'relative', flex: '0 0 280px' }}>
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search records…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 36, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {search.trim() ? `${filtered.length} of ${data.length}` : `${data.length}`} record{data.length !== 1 ? 's' : ''}
            </span>
            {exportFilename && (
              <button onClick={handleExport} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#374151',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              {columns.map(col => {
                const isSortable = typeof col.accessor !== 'function'
                const isActive   = sortCol === col.header
                return (
                  <th key={col.header} onClick={() => handleSort(col.header, col.accessor)}
                    title={isSortable ? `Sort by ${col.header}` : undefined}
                    style={{ ...thStyle, width: col.width, cursor: isSortable ? 'pointer' : 'default', userSelect: 'none',
                      color: isActive ? '#0d6e6e' : '#374151', background: isActive ? '#f0fdfa' : '#f8fafc',
                      position: 'sticky', top: 0, zIndex: 1,
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
              // ── Skeleton rows ────────────────────────────────────────
              Array.from({ length: 5 }).map((_, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {columns.map((col, ci) => (
                    <td key={ci} style={{ padding: '12px 14px' }}>
                      <div style={{
                        height: 13, borderRadius: 6,
                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.4s infinite',
                        width: `${55 + (ci * 17 + ri * 11) % 35}%`,
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={emptyCell}>
                  {search.trim()
                    ? <span style={{ color: '#9ca3af', fontSize: 13 }}>No records match "<strong>{search}</strong>"</span>
                    : <span style={{ color: '#9ca3af', fontSize: 13 }}>No records found</span>}
                </td>
              </tr>
            ) : paginated.map((row, i) => (
              <tr key={i}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{ borderBottom: i < paginated.length - 1 ? '1px solid #f1f5f9' : 'none', background: hoveredRow === i ? '#f0fdfa' : i % 2 === 0 ? '#fff' : '#fafcff', transition: 'background 0.08s' }}
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

      {/* ── Pagination ── */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          {/* Page size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Rows per page:</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
              style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#374151', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Page info + nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {safePage * pageSize + 1}–{Math.min(safePage * pageSize + pageSize, sorted.length)} of {sorted.length}
            </span>
            <button onClick={() => setPage(0)} disabled={safePage === 0} style={pgBtn(safePage === 0)} title="First">«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={safePage === 0} style={pgBtn(safePage === 0)} title="Previous">‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', padding: '0 6px' }}>
              {safePage + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={safePage >= totalPages - 1} style={pgBtn(safePage >= totalPages - 1)} title="Next">›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1} style={pgBtn(safePage >= totalPages - 1)} title="Last">»</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, color: disabled ? '#d1d5db' : '#374151',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  opacity: disabled ? 0.5 : 1,
})

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
  color: '#374151', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  transition: 'background 0.1s, color 0.1s',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', color: '#374151', fontSize: 13, verticalAlign: 'middle',
}

const emptyCell: React.CSSProperties = {
  textAlign: 'center', padding: '36px 16px', color: '#6b7280', fontSize: 13,
}
