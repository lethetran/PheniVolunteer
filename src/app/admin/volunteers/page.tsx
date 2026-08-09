import { requirePermission } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasGlobalPermission } from '@/lib/permissions'
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { TextInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { LinkButton } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { USER_STATUS } from '@/lib/labels'
import { FieldManager } from '@/components/fields/field-manager'
import { importVolunteers } from '@/actions/import'

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await requirePermission(PERMISSIONS.VOLUNTEER_VIEW)
  const { q } = await searchParams

  const volunteers = await prisma.user.findMany({
    where: {
      role: 'VOLUNTEER',
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { studentCode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const canImport = hasGlobalPermission(user, PERMISSIONS.VOLUNTEER_IMPORT)
  const canManageFields = hasGlobalPermission(user, PERMISSIONS.FIELD_MANAGE)

  const profileFields = canManageFields
    ? await prisma.fieldDefinition.findMany({ where: { scope: 'VOLUNTEER_PROFILE' }, orderBy: { order: 'asc' } })
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tình nguyện viên"
        description="Danh bạ tình nguyện viên toàn hệ thống."
        action={
          <LinkButton href="/admin/volunteers/export" variant="outline" size="sm">
            Xuất Excel
          </LinkButton>
        }
      />

      <form className="flex gap-2">
        <TextInput name="q" defaultValue={q ?? ''} placeholder="Tìm theo tên, email, mã sinh viên…" className="max-w-sm" />
        <SubmitButton variant="outline" pendingLabel="Đang tìm…">
          Tìm kiếm
        </SubmitButton>
      </form>

      {canImport && (
        <Card>
          <CardHeader title="Nhập danh sách từ Excel" description="Cột Email là bắt buộc." />
          <CardBody>
            <form action={importVolunteers} className="flex flex-wrap items-end gap-3">
              <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
              <SubmitButton size="sm" pendingLabel="Đang nhập…">
                Nhập file
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={`Danh sách (${volunteers.length})`} />
        <CardBody className="space-y-2">
          {volunteers.length === 0 ? (
            <EmptyState title="Không tìm thấy tình nguyện viên nào" />
          ) : (
            volunteers.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={v.name} email={v.email} image={v.image} size={32} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{v.name ?? v.email}</p>
                    <p className="text-xs text-slate-500">
                      {v.email}
                      {v.studentCode ? ` · ${v.studentCode}` : ''}
                      {v.faculty ? ` · ${v.faculty}` : ''}
                    </p>
                  </div>
                </div>
                <Badge tone={USER_STATUS[v.status].tone}>{USER_STATUS[v.status].label}</Badge>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {canManageFields && (
        <Card>
          <CardHeader title="Cột thông tin hồ sơ" description="Cột thêm vào hồ sơ tình nguyện viên toàn hệ thống." />
          <CardBody>
            <FieldManager scope="VOLUNTEER_PROFILE" defs={profileFields} title="Cột hồ sơ" />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
