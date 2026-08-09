import type { FieldDefinition, FieldType, Prisma } from '@prisma/client'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Văn bản ngắn',
  TEXTAREA: 'Văn bản dài',
  NUMBER: 'Số',
  DATE: 'Ngày',
  SELECT: 'Chọn 1 đáp án',
  MULTISELECT: 'Chọn nhiều đáp án',
  CHECKBOX: 'Ô tích (có / không)',
  EMAIL: 'Email',
  PHONE: 'Số điện thoại',
  URL: 'Đường dẫn',
}

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[]

export type FieldValue = string | number | boolean | string[] | null

export type JsonData = Record<string, unknown>

export function readData(value: unknown): JsonData {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonData
  return {}
}

/** Ép kiểu dữ liệu JSON động sang InputJsonValue của Prisma khi ghi vào DB. */
export function toJson(data: JsonData): Prisma.InputJsonValue {
  return data as Prisma.InputJsonValue
}

/** Đọc 1 giá trị field từ FormData theo đúng kiểu của cột. */
export function valueFromForm(def: FieldDefinition, fd: FormData, prefix = 'f_'): FieldValue {
  const name = prefix + def.key
  if (def.type === 'CHECKBOX') {
    const v = fd.get(name)
    return v === 'on' || v === 'true' || v === '1'
  }
  if (def.type === 'MULTISELECT') {
    const all = fd.getAll(name).map(String).filter(Boolean)
    return all
  }
  const raw = fd.get(name)
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (v === '') return null
  if (def.type === 'NUMBER') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return v
}

/** Gom toàn bộ giá trị của một bộ cột từ FormData. */
export function collectFieldData(
  defs: FieldDefinition[],
  fd: FormData,
  prefix = 'f_',
): { data: JsonData; errors: string[] } {
  const data: JsonData = {}
  const errors: string[] = []
  for (const def of defs) {
    if (def.archived) continue
    const value = valueFromForm(def, fd, prefix)
    if (def.required && isEmptyValue(value)) {
      errors.push(`"${def.label}" là thông tin bắt buộc.`)
    }
    if (!isEmptyValue(value)) {
      if (def.type === 'EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
        errors.push(`"${def.label}" không phải email hợp lệ.`)
      }
      if (def.type === 'PHONE' && !/^[0-9+()\s.-]{8,15}$/.test(String(value))) {
        errors.push(`"${def.label}" không phải số điện thoại hợp lệ.`)
      }
    }
    data[def.key] = value
  }
  return { data, errors }
}

export function isEmptyValue(v: FieldValue | unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (v === false) return true
  return false
}

/** Hiển thị giá trị field ra text (dùng cho bảng & export Excel). */
export function displayValue(def: FieldDefinition, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return ''
  if (def.type === 'CHECKBOX') return raw ? 'Có' : ''
  if (Array.isArray(raw)) return raw.join(', ')
  if (def.type === 'DATE') {
    const d = new Date(String(raw))
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
    }
  }
  return String(raw)
}

/** Chuẩn hoá giá trị lấy từ ô Excel về đúng kiểu của cột. */
export function coerceImported(def: FieldDefinition, raw: unknown): FieldValue {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '') return null
  switch (def.type) {
    case 'CHECKBOX': {
      const t = s.toLowerCase()
      return ['x', 'v', 'có', 'co', 'true', 'yes', '1', 'y', 'ok', 'đã', 'da'].includes(t)
    }
    case 'NUMBER': {
      const n = Number(s.replace(/[,\s]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    case 'MULTISELECT':
      return s
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean)
    case 'DATE': {
      // Excel có thể trả về serial number hoặc chuỗi dd/mm/yyyy
      if (/^\d+$/.test(s)) {
        const serial = Number(s)
        const ms = (serial - 25569) * 86400 * 1000
        return new Date(ms).toISOString().slice(0, 10)
      }
      const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
    }
    default:
      return s
  }
}

/** Cột hiển thị cho tình nguyện viên. */
export function volunteerVisible(defs: FieldDefinition[]) {
  return defs.filter((d) => !d.archived && d.visibleToVolunteer)
}

export function activeFields(defs: FieldDefinition[]) {
  return defs.filter((d) => !d.archived)
}
