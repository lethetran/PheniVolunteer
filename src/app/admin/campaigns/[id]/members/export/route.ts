import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { REGISTRATION_STATUS, ATTENDANCE_STATUS } from '@/lib/labels'
import { readData, displayValue } from '@/lib/fields'
import { formatDateTime } from '@/lib/utils'
import { buildWorkbook, type SheetRow } from '@/lib/excel'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await getCampaignScope(id)
  if (!scope || !scope.canAnywhere(PERMISSIONS.DATA_EXPORT)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [registrations, regFields, trackingFields] = await Promise.all([
    prisma.registration.findMany({
      where: scope.registrationWhere,
      include: { user: true, group: true },
      orderBy: { appliedAt: 'asc' },
    }),
    prisma.fieldDefinition.findMany({ where: { scope: 'REGISTRATION_FORM', campaignId: id, archived: false }, orderBy: { order: 'asc' } }),
    prisma.fieldDefinition.findMany({ where: { scope: 'MEMBER_TRACKING', campaignId: id, archived: false }, orderBy: { order: 'asc' } }),
  ])

  const rows: SheetRow[] = registrations.map((r) => {
    const formData = readData(r.formData)
    const trackingData = readData(r.trackingData)
    const row: SheetRow = {
      'Họ tên': r.user.name ?? '',
      Email: r.user.email,
      'Mã sinh viên': r.user.studentCode ?? '',
      'Số điện thoại': r.user.phone ?? '',
      Nhóm: r.group?.name ?? '',
      'Trạng thái': REGISTRATION_STATUS[r.status].label,
      'Điểm danh': ATTENDANCE_STATUS[r.attendance].label,
      'Hoàn thành': r.completed ? 'Có' : '',
      'Giờ TNV': r.hoursAwarded,
      'Điểm rèn luyện': r.pointsAwarded,
      'Ngày đăng ký': formatDateTime(r.appliedAt),
    }
    for (const f of regFields) row[f.label] = displayValue(f, formData[f.key])
    for (const f of trackingFields) row[f.label] = displayValue(f, trackingData[f.key])
    row['Ghi chú'] = r.note ?? ''
    return row
  })

  const buffer = buildWorkbook([{ name: 'Thanh vien', rows }])
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="thanh-vien-${id}.xlsx"`,
    },
  })
}
