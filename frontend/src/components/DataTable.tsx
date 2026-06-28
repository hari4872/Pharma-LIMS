import { useState, useMemo, useRef, useEffect } from 'react'
import { exportCsv } from '@/utils/exportCsv'

interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  render?: (row: T) => React.ReactNode
  width?: string | number
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  searchable?: boolean
  exportFilename?: string
  rowStyle?: (row: T) => React.CSSProperties
  initialSortCol?: string   // column header to sort by on first render
  initialSortDir?: 'asc' | 'desc'
  onRowClick?: (row: T) => void
  selectedRow?: T | null
}

type Density = 'compact' | 'default' | 'spacious'

const PAGE_SIZES = [10, 25, 50, 100]

const DEN: Record<Density, { cell: string; head: string; fs: number }> = {
  compact:  { cell: '5px 10px',  head: '7px 10px',  fs: 13 },
  default:  { cell: '10px 14px', head: '10px 14px', fs: 14 },
  spacious: { cell: '15px 14px', head: '13px 14px', fs: 14 },
}

// ── Empty state components ────────────────────────────────────────────────
function EmptySearch({ query }: { query: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
      <svg viewBox="0 0 96 80" fill="none" width="96" height="80">
        {/* lens */}
        <circle cx="38" cy="34" r="22" stroke="#e2e8f0" strokeWidth="3"/>
        {/* handle */}
        <path d="M54 50L70 66" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
        {/* X inside lens */}
        <path d="M30 26L46 42M46 26L30 42" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', textAlign: 'center' }}>No results found</div>
        <div style={{ fontSize: 13, color: '#80868b', textAlign: 'center', marginTop: 4 }}>
          No records match <strong style={{ color: '#5f6368' }}>"{query}"</strong> — try a different search term
        </div>
      </div>
    </div>
  )
}

function EmptyData() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
      <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
        {/* clipboard body */}
        <rect x="14" y="14" width="52" height="58" rx="6" stroke="#e2e8f0" strokeWidth="2.5"/>
        {/* clipboard clip */}
        <rect x="28" y="10" width="24" height="11" rx="5.5" stroke="#e2e8f0" strokeWidth="2.5" fill="#f8fafc"/>
        {/* dashed content lines */}
        <path d="M24 36h32" stroke="#e9ecef" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4"/>
        <path d="M24 46h32" stroke="#e9ecef" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4"/>
        <path d="M24 56h20" stroke="#e9ecef" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4"/>
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', textAlign: 'center' }}>No records yet</div>
        <div style={{ fontSize: 13, color: '#80868b', textAlign: 'center', marginTop: 4 }}>
          Add your first record using the <strong style={{ color: '#5f6368' }}>+ Add</strong> button above
        </div>
      </div>
    </div>
  )
}

// ── Density icon buttons ──────────────────────────────────────────────────
function DensityIcon({ type }: { type: Density }) {
  if (type === 'compact') return (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M2 3.5h12M2 6.5h12M2 9.5h12M2 12.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'default') return (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M2 2.5h12M2 8h12M2 13.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function DataTable<T extends object>({
  columns, data, loading, searchable = true, exportFilename, rowStyle,
  initialSortCol, initialSortDir, onRowClick, selectedRow,
}: Props<T>) {

  const [search,       setSearch]       = useState('')
  const [sortCol,      setSortCol]      = useState<string | null>(initialSortCol ?? null)
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>(initialSortDir ?? 'asc')
  const [page,         setPage]         = useState(0)
  const [pageSize,     setPageSize]     = useState(25)
  const [hoveredRow,   setHoveredRow]   = useState<number | null>(null)
  const [density,      setDensity]      = useState<Density>('default')
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const [selected,     setSelected]     = useState<Set<number>>(new Set())

  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(columns.map(c => c.header))
  )

  const colPickerRef   = useRef<HTMLDivElement>(null)
  const prevColSig     = useRef(columns.map(c => c.header).join('|'))

  // Reset when column set changes (e.g. tab switch in Instruments)
  useEffect(() => {
    const sig = columns.map(c => c.header).join('|')
    if (sig !== prevColSig.current) {
      prevColSig.current = sig
      setVisibleCols(new Set(columns.map(c => c.header)))
      setSelected(new Set())
    }
  }, [columns])

  // Close col picker on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setColPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ── Search ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        if (typeof col.accessor === 'function') return false
        return String((row as Record<string, unknown>)[col.accessor as string] ?? '').toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  // ── Sort ───────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const col = columns.find(c => c.header === sortCol)
    if (!col || typeof col.accessor === 'function') return filtered
    const key = col.accessor as keyof T
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key as string], bv = (b as Record<string, unknown>)[key as string]
      const na = Number(av), nb = Number(bv)
      const cmp = !isNaN(na) && !isNaN(nb)
        ? na - nb
        : String(av ?? '').toLowerCase().localeCompare(String(bv ?? '').toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir, columns])

  // ── Pagination ─────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const paginated  = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  // ── Visible columns ────────────────────────────────────────────────────
  const visCols = columns.filter(c => visibleCols.has(c.header))

  // ── Selection ──────────────────────────────────────────────────────────
  const pageIndices     = paginated.map((_, i) => safePage * pageSize + i)
  const allPageSelected = pageIndices.length > 0 && pageIndices.every(i => selected.has(i))
  const someSelected    = pageIndices.some(i => selected.has(i))

  function toggleRow(idx: number) {
    setSelected(s => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  }
  function togglePage() {
    if (allPageSelected)
      setSelected(s => { const n = new Set(s); pageIndices.forEach(i => n.delete(i)); return n })
    else
      setSelected(s => { const n = new Set(s); pageIndices.forEach(i => n.add(i)); return n })
  }
  function clearSelection() { setSelected(new Set()) }

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleSort(header: string, accessor: Column<T>['accessor']) {
    if (typeof accessor === 'function') return
    if (sortCol === header) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(header); setSortDir('asc') }
    setPage(0)
  }
  function handleSearch(val: string) { setSearch(val); setPage(0); setSelected(new Set()) }

  function buildExportRows(rows: T[]) {
    return rows.map(row => {
      const obj: Record<string, unknown> = {}
      columns.forEach(col => {
        if (typeof col.accessor !== 'function') obj[col.header] = (row as Record<string, unknown>)[col.accessor as string] ?? ''
      })
      return obj
    })
  }
  function handleExportAll() { exportCsv(buildExportRows(sorted), exportFilename ?? 'export') }
  function handleExportSelected() {
    const rows = [...selected].sort((a, b) => a - b).map(i => sorted[i]).filter(Boolean)
    exportCsv(buildExportRows(rows), `${exportFilename ?? 'export'}_selected`)
  }

  const d   = DEN[density]
  const colSpan = visCols.length + 1  // +1 for checkbox

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Toolbar ── */}
      {/* Toolbar always renders (density + column-visibility controls are always available) */}
      {(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>

          {/* Search */}
          {searchable && (
            <div style={{ position: 'relative', flex: '0 0 280px' }}>
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#80868b' }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search records…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 36, border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, color: '#111111', outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>

            {/* ── Row density toggle ── */}
            <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 7, overflow: 'hidden' }}>
              {(['compact', 'default', 'spacious'] as Density[]).map((d, i, arr) => (
                <button key={d} onClick={() => setDensity(d)}
                  title={d.charAt(0).toUpperCase() + d.slice(1)}
                  style={{
                    width: 30, height: 30, border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid #e0e0e0' : 'none',
                    background: density === d ? '#f0fdfa' : '#fff',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: density === d ? '#0d6e6e' : '#80868b',
                    transition: 'background 0.1s, color 0.1s',
                  }}>
                  <DensityIcon type={d} />
                </button>
              ))}
            </div>

            {/* ── Column visibility ── */}
            <div ref={colPickerRef} style={{ position: 'relative' }}>
              <button onClick={() => setColPickerOpen(o => !o)}
                style={{
                  height: 30, padding: '0 11px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: '1px solid #e0e0e0', borderRadius: 7,
                  background: colPickerOpen ? '#f0fdfa' : '#fff',
                  cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
                  color: colPickerOpen ? '#0d6e6e' : '#111111',
                  fontFamily: 'inherit',
                }}>
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Columns
                <svg viewBox="0 0 24 24" fill="none" width="10" height="10">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>

              {colPickerOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#fff', borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid #e0e0e0',
                  zIndex: 50, minWidth: 190, padding: '6px 0',
                  maxHeight: 340, overflowY: 'auto',
                }}>
                  <div style={{ padding: '5px 14px 8px', fontSize: 10.5, fontWeight: 700, color: '#80868b', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f3f4', marginBottom: 3 }}>
                    Show / Hide Columns
                  </div>
                  {columns.map(col => (
                    <label key={col.header}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#111111', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox"
                        checked={visibleCols.has(col.header)}
                        onChange={() => setVisibleCols(s => {
                          const n = new Set(s)
                          if (n.has(col.header)) { if (n.size > 1) n.delete(col.header) }
                          else n.add(col.header)
                          return n
                        })}
                        style={{ accentColor: '#0d9488', width: 14, height: 14, cursor: 'pointer' }}
                      />
                      {col.header || <span style={{ color: '#80868b', fontStyle: 'italic' }}>Actions</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Record count */}
            <span style={{ fontSize: 12, color: '#80868b', whiteSpace: 'nowrap' }}>
              {search.trim() ? `${filtered.length} of ${data.length}` : `${data.length}`} record{data.length !== 1 ? 's' : ''}
            </span>

            {/* Export CSV */}
            {exportFilename && (
              <button onClick={handleExportAll} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px', height: 30,
                border: '1px solid #e0e0e0', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#111111',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Selection action bar ── */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 14px', marginBottom: 8,
          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0d6e6e', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 13l4 4L19 7" stroke="#0d6e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {selected.size} row{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ width: 1, height: 16, background: '#99f6e4' }} />
          {exportFilename && (
            <button onClick={handleExportSelected}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', height: 28, border: '1px solid #0d9488', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0d6e6e', fontFamily: 'inherit' }}>
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export Selected
            </button>
          )}
          <button onClick={clearSelection}
            style={{ padding: '4px 12px', height: 28, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#5f6368', fontFamily: 'inherit' }}>
            Clear
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#80868b' }}>
            {data.length} total
          </span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: d.fs }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
              {/* Select-all checkbox */}
              <th style={{ ...thBase, padding: d.head, width: 42, position: 'sticky', top: 0, zIndex: 1 }}>
                <input type="checkbox"
                  checked={allPageSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allPageSelected }}
                  onChange={togglePage}
                  style={{ accentColor: '#0d9488', width: 14, height: 14, cursor: 'pointer', display: 'block', margin: '0 auto' }}
                />
              </th>

              {visCols.map(col => {
                const isSortable = typeof col.accessor !== 'function'
                const isActive   = sortCol === col.header
                return (
                  <th key={col.header}
                    onClick={() => handleSort(col.header, col.accessor)}
                    title={isSortable ? `Sort by ${col.header}` : undefined}
                    style={{
                      ...thBase, padding: d.head,
                      width: col.width, cursor: isSortable ? 'pointer' : 'default', userSelect: 'none',
                      color: isActive ? '#0d6e6e' : '#111111',
                      background: isActive ? '#f0fdfa' : '#f8f9fa',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {col.header}
                      {isSortable && (
                        <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.3, color: isActive ? '#0d6e6e' : '#5f6368' }}>
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
              // ── Skeleton rows ───────────────────────────────────────
              Array.from({ length: 5 }).map((_, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: d.cell }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: '#f1f5f9', margin: '0 auto' }} />
                  </td>
                  {visCols.map((_, ci) => (
                    <td key={ci} style={{ padding: d.cell }}>
                      <div style={{
                        height: 13, borderRadius: 6,
                        background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.4s infinite',
                        width: `${55 + (ci * 17 + ri * 11) % 35}%`,
                      }} />
                    </td>
                  ))}
                </tr>
              ))

            ) : paginated.length === 0 ? (
              // ── Empty state ─────────────────────────────────────────
              <tr>
                <td colSpan={colSpan} style={{ padding: '40px 16px' }}>
                  {search.trim() ? <EmptySearch query={search} /> : <EmptyData />}
                </td>
              </tr>

            ) : paginated.map((row, i) => {
              const sortedIdx  = safePage * pageSize + i
              const isSelected = selected.has(sortedIdx)
              const isRowSelected = selectedRow === row
              const extraStyle = rowStyle ? rowStyle(row) : {}
              return (
                <tr key={i}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={onRowClick ? (e: React.MouseEvent<HTMLTableRowElement>) => {
                    if ((e.target as HTMLElement).closest('button,a,input,select,textarea')) return
                    onRowClick(row)
                  } : undefined}
                  style={{
                    borderBottom: i < paginated.length - 1 ? '1px solid #f1f3f4' : 'none',
                    background: isRowSelected
                      ? '#eff6ff'
                      : isSelected
                      ? '#f0fdfa'
                      : hoveredRow === i ? '#f8f9fa'
                      : '#ffffff',
                    cursor: onRowClick ? 'pointer' : undefined,
                    outline: isRowSelected ? '2px solid #3b82f6' : undefined,
                    outlineOffset: isRowSelected ? '-2px' : undefined,
                    transition: 'background 0.08s',
                    ...extraStyle,
                  }}>
                  <td style={{ padding: d.cell, verticalAlign: 'middle', textAlign: 'center' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(sortedIdx)}
                      style={{ accentColor: '#0d9488', width: 14, height: 14, cursor: 'pointer' }} />
                  </td>
                  {visCols.map(col => (
                    <td key={col.header} style={{ padding: d.cell, color: '#111111', fontSize: d.fs, verticalAlign: 'middle' }}>
                      {col.render
                        ? col.render(row)
                        : typeof col.accessor === 'function'
                          ? col.accessor(row)
                          : String((row as Record<string, unknown>)[col.accessor as string] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#80868b' }}>Rows per page:</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
              style={{ fontSize: 12, border: '1px solid #e0e0e0', borderRadius: 6, padding: '3px 8px', color: '#111111', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#80868b' }}>
              {safePage * pageSize + 1}–{Math.min(safePage * pageSize + pageSize, sorted.length)} of {sorted.length}
            </span>
            <button onClick={() => setPage(0)}              disabled={safePage === 0}              style={pgBtn(safePage === 0)}              title="First">«</button>
            <button onClick={() => setPage(p => p - 1)}    disabled={safePage === 0}              style={pgBtn(safePage === 0)}              title="Previous">‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111111', padding: '0 6px' }}>
              {safePage + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => p + 1)}    disabled={safePage >= totalPages - 1} style={pgBtn(safePage >= totalPages - 1)} title="Next">›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1} style={pgBtn(safePage >= totalPages - 1)} title="Last">»</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  )
}

// ── Static styles ─────────────────────────────────────────────────────────
const pgBtn = (disabled: boolean): React.CSSProperties => ({
  width: 28, height: 28, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, color: disabled ? '#d1d5db' : '#111111',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  opacity: disabled ? 0.5 : 1,
})

const thBase: React.CSSProperties = {
  textAlign: 'left', fontWeight: 700,
  color: '#111111', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  transition: 'background 0.1s, color 0.1s',
}
