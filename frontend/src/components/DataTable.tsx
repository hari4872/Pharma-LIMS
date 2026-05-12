interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
}

export default function DataTable<T extends object>({ columns, data, loading }: Props<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            {columns.map(c => (
              <th key={c.header} style={thStyle}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading…</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>No records found</td></tr>
          ) : data.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              {columns.map(c => (
                <td key={c.header} style={tdStyle}>
                  {typeof c.accessor === 'function' ? c.accessor(row) : String(row[c.accessor] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 13 }
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: '#374151' }
