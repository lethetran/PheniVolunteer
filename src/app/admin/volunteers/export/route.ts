import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { hasGlobalPermission, PERMISSIONS, ROLE_LABELS } from '@/lib/permissions'
import { USER_STATUS } from '@/lib/labels'
import { readData, displayValue } from '@/lib/fields'
import { formatDate } from '@/lib/utils'
import { buildWorkbook, type SheetRow } from '@/lib/excel'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !hasGlobalPermission(user, PERMISSIONS.VOLUNTEER_VIEW)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [volunteers, fieldDefs] = await Promise.all([
    prisma.user.findMany({ where: { role: 'VOLUNTEER' }, orderBy: { createdAt: 'desc' } }),
    prisma.fieldDefinition.findMany({ where: { scope: 'VOLUNTEER_PROFILE', archived: false }, orderBy: { order: 'asc' } }),
  ])

  const rows: SheetRow[] = volunteers.map((v) => {
    const data = readData(v.profileData)
    const row: SheetRow = {
      'Họ tên': v.name ?? '',
      Email: v.email,
      'Mã sinh viên': v.studentCode ?? '',
      'Số điện thoại': v.phone ?? '',
      Khoa: v.faculty ?? '',
      Lớp: v.className ?? '',
      'Ngày sinh': formatDate(v.dob),
      'Vai trò': ROLE_LABELS[v.role],
      'Trạng thái': USER_STATUS[v.status].label,
      'Ngày tạo': formatDate(v.createdAt),
    }
    for (const f of fieldDefs) row[f.label] = displayValue(f, data[f.key])
    return row
  })

  const buffer = buildWorkbook([{ name: 'Tinh nguyen vien', rows }])
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tinh-nguyen-vien.xlsx"',
    },
  })
}
