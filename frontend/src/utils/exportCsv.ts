/**
 * Export any array of objects to a CSV file download.
 * Usage: exportCsv(data, 'Laboratories')
 */
export function exportCsv<T extends object>(data: T[], filename: string) {
  if (!data.length) return

  const keys = Object.keys(data[0]) as (keyof T)[]
  const header = keys.join(',')
  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k]
      const str = val === null || val === undefined ? '' : String(val)
      // Wrap in quotes if contains comma, newline, or quote
      return /[,\n"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
