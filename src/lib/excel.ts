import 'server-only'
import * as XLSX from 'xlsx'

export type SheetRow = Record<string, unknown>

/** Đọc sheet đầu tiên của file Excel/CSV thành mảng object theo tên cột ở hàng 1. */
export function parseSheet(buffer: ArrayBuffer | Buffer): {
  headers: string[]
  rows: SheetRow[]
} {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
  if (matrix.length === 0) return { headers: [], rows: [] }

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim())
  const rows: SheetRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] as unknown[]
    if (!line || line.every((c) => c === '' || c === null || c === undefined)) continue
    const row: SheetRow = {}
    headers.forEach((h, idx) => {
      if (!h) return
      const cell = line[idx]
      row[h] = cell instanceof Date ? cell.toISOString().slice(0, 10) : cell
    })
    rows.push(row)
  }
  return { headers: headers.filter(Boolean), rows }
}

/** Tạo file .xlsx từ mảng object. */
export function buildWorkbook(sheets: { name: string; rows: SheetRow[] }[]): Buffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}])
    const widths = new Map<number, number>()
    const keys = Object.keys(s.rows[0] ?? {})
    keys.forEach((k, i) => {
      const maxLen = s.rows.reduce(
        (acc, r) => Math.max(acc, String(r[k] ?? '').length),
        k.length,
      )
      widths.set(i, Math.min(Math.max(maxLen + 2, 10), 50))
    })
    ws['!cols'] = keys.map((_, i) => ({ wch: widths.get(i) ?? 14 }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || 'Sheet1')
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Tìm giá trị của một trong nhiều tên cột có thể có (không phân biệt hoa thường/dấu cách). */
export function pick(row: SheetRow, ...names: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const map = new Map<string, unknown>()
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v)
  for (const n of names) {
    const v = map.get(norm(n))
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}
