import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

const TZ = 'Asia/Ho_Chi_Minh'

export function formatDate(value?: Date | string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(value))
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(value))
}

/** Giá trị cho <input type="datetime-local"> theo giờ Việt Nam. */
export function toDateTimeLocal(value?: Date | string | null) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
    hour12: false,
  }).formatToParts(new Date(value))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function toDateInput(value?: Date | string | null) {
  return toDateTimeLocal(value).slice(0, 10)
}

export function formatRange(start?: Date | null, end?: Date | null) {
  if (!start && !end) return 'Chưa ấn định'
  if (start && !end) return `Từ ${formatDateTime(start)}`
  if (!start && end) return `Đến ${formatDateTime(end)}`
  return `${formatDateTime(start)} → ${formatDateTime(end)}`
}

export function relativeTime(value?: Date | string | null) {
  if (!value) return '—'
  const diff = new Date(value).getTime() - Date.now()
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ]
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return 'vừa xong'
}

const VI_MAP: Record<string, string> = { đ: 'd', Đ: 'd' }

export function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, (c) => VI_MAP[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Chuẩn hoá nhãn cột Excel / tên field thành khoá snake_case an toàn. */
export function toKey(input: string) {
  const s = slugify(input).replace(/-/g, '_')
  return s || 'cot'
}

export function initials(name?: string | null, email?: string | null) {
  const base = (name ?? email ?? '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export function percent(done: number, total: number) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}

export function pluralVi(n: number, word: string) {
  return `${n} ${word}`
}

/** Đọc string từ FormData, trả về undefined nếu rỗng. */
export function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key)
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key)
  return v === 'on' || v === 'true' || v === '1'
}

export function num(fd: FormData, key: string): number | undefined {
  const v = str(fd, key)
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** datetime-local (giờ VN) -> Date UTC. */
export function dateFrom(fd: FormData, key: string): Date | null {
  const v = str(fd, key)
  if (!v) return null
  // Chuỗi dạng 2026-03-01T08:00 được hiểu theo giờ Việt Nam (+07:00)
  const iso = v.length === 10 ? `${v}T00:00:00+07:00` : `${v}:00+07:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function csvList(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isSchoolEmail(email: string, domains: string[]) {
  const d = email.toLowerCase().split('@')[1]
  return Boolean(d && domains.includes(d))
}
