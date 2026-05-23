import { useState } from 'react'

interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  width?: string | number
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
}

export default function DataTable<T extends object>({ columns, data, loading }: Props<T>) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  return (
    <div style={{
      overflowX: 'auto',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
            {columns.map(c => (
              <th
                key={c.header}
                style={{
                  ...thStyle,
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
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
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={emptyCell}>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>No records found</span>
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr
              key={i}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                borderBottom: i < data.length - 1 ? '1px solid #f1f5f9' : 'none',
                background: hoveredRow === i
                  ? '#f0f7ff'
                  : i % 2 === 0 ? '#fff' : '#fafcff',
                transition: 'background 0.08s',
              }}
            >
              {columns.map(c => (
                <td key={c.header} style={tdStyle}>
                  {typeof c.accessor === 'function'
                    ? c.accessor(row)
                    : String(row[c.accessor] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  fontSize: 12,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
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
