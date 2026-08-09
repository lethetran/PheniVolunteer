import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { REGISTRATION_STATUS } from '@/lib/labels'
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { SelectInput, TextInput } from '@/components/ui/field'
import { MemberRow } from '@/components/campaign/member-row'
import { ImportJobList } from '@/components/campaign/import-job-list'
import { importCampaignMembers, importApprovalDecisions } from '@/actions/import'
import { bulkAssignGroup } from '@/actions/registrations'
import type { Prisma, RegistrationStatus } from '@prisma/client'

export default async function CampaignMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; q?: string; groupId?: string }>
}) {
  const { id } = await params
  const { status, q, groupId } = await searchParams
  const scope = await requireCampaignScope(id)
  if (!scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) && !scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW)) {
    scope.assert(PERMISSIONS.MEMBER_MANAGE)
  }

  const statusFilter = status && status in REGISTRATION_STATUS ? (status as RegistrationStatus) : undefined
  const search = q?.trim()
  const groupFilter = groupId?.trim()

  const searchWhere: Prisma.RegistrationWhereInput = search
    ? {
        user: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { studentCode: { contains: search, mode: 'insensitive' } },
          ],
        },
      }
    : {}
  const groupWhere: Prisma.RegistrationWhereInput =
    groupFilter === 'none' ? { groupId: null } : groupFilter ? { groupId: groupFilter } : {}

  const [registrations, groups, trackingFields, regFields] = await Promise.all([
    prisma.registration.findMany({
      where: {
        ...scope.registrationWhere,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...searchWhere,
        ...groupWhere,
      },
      include: { user: true, group: true },
      orderBy: [{ appliedAt: 'desc' }],
    }),
    prisma.campaignGroup.findMany({ where: { campaignId: id }, orderBy: { order: 'asc' } }),
    prisma.fieldDefinition.findMany({ where: { scope: 'MEMBER_TRACKING', campaignId: id, archived: false }, orderBy: { order: 'asc' } }),
    prisma.fieldDefinition.findMany({ where: { scope: 'REGISTRATION_FORM', campaignId: id, archived: false }, orderBy: { order: 'asc' } }),
  ])

  const counts = await prisma.registration.groupBy({ by: ['status'], where: scope.registrationWhere, _count: true })
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<RegistrationStatus, number>
  const totalCount = counts.reduce((s, c) => s + c._count, 0)

  const canReviewAnywhere = scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW)
  const canBulkAssign = scope.can(PERMISSIONS.MEMBER_MANAGE)
  const importJobs = scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) || canReviewAnywhere
    ? await prisma.importJob.findMany({
        where: { campaignId: id, kind: { in: ['CAMPAIGN_MEMBERS', 'APPROVAL_LIST'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterLink id={id} status={undefined} q={q} groupId={groupId} label={`Tất cả (${totalCount})`} active={!statusFilter} />
            {(Object.keys(REGISTRATION_STATUS) as RegistrationStatus[]).map((s) => (
              <FilterLink
                key={s}
                id={id}
                status={s}
                q={q}
                groupId={groupId}
                label={`${REGISTRATION_STATUS[s].label} (${countMap[s] ?? 0})`}
                active={statusFilter === s}
              />
            ))}
            <div className="ml-auto">
              <LinkButton href={`/admin/campaigns/${id}/members/export`} variant="outline" size="sm">
                Xuất Excel
              </LinkButton>
            </div>
          </div>

          <form method="GET" className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <TextInput name="q" defaultValue={q ?? ''} placeholder="Tìm theo tên, email, MSSV…" className="w-56" />
            {groups.length > 0 && (
              <SelectInput name="groupId" defaultValue={groupFilter ?? ''} className="w-48">
                <option value="">Tất cả nhóm</option>
                <option value="none">Chưa xếp nhóm</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectInput>
            )}
            <SubmitButton variant="outline" size="sm" pendingLabel="Đang lọc…">
              Lọc
            </SubmitButton>
            {(search || groupFilter) && (
              <a
                href={statusFilter ? `/admin/campaigns/${id}/members?status=${statusFilter}` : `/admin/campaigns/${id}/members`}
                className="text-xs text-slate-500 hover:underline"
              >
                Xoá bộ lọc
              </a>
            )}
          </form>
        </CardBody>
      </Card>

      {scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) && (
        <Card>
          <CardHeader
            title="Nhập danh sách thành viên từ Excel"
            description={`Cột "MSSV" dùng để khớp với tài khoản Google của TNV (ưu tiên hơn Email) — cần ít nhất 1 trong 2. Các cột khác (kỹ năng, size áo...) khớp theo tên cột đã cấu hình ở "Cột thông tin". Người mới sẽ ở trạng thái "Chờ duyệt".`}
          />
          <CardBody>
            <form action={importCampaignMembers.bind(null, id)} className="flex flex-wrap items-end gap-3">
              <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
              {scope.isCampaignWide && groups.length > 0 && (
                <SelectInput name="groupId" className="w-48">
                  <option value="">Theo cột "Nhóm" trong file</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Tất cả vào nhóm: {g.name}
                    </option>
                  ))}
                </SelectInput>
              )}
              <SubmitButton size="sm" pendingLabel="Đang nhập…">
                Nhập file
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}

      {canReviewAnywhere && (
        <Card>
          <CardHeader
            title="Nhập danh sách duyệt"
            description={`Tải lên danh sách MSSV/Email (VD kết quả từ vòng xét duyệt riêng) để gộp thành trạng thái duyệt cuối cùng. Có cột "Kết quả" thì đọc theo đó (Duyệt/Từ chối/Chờ...), không có thì mặc định cả danh sách là "Đã duyệt". Chỉ áp dụng cho người đã có trong danh sách thành viên.`}
          />
          <CardBody>
            <form action={importApprovalDecisions.bind(null, id)} className="flex flex-wrap items-end gap-3">
              <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
              <SubmitButton size="sm" variant="outline" pendingLabel="Đang xử lý…">
                Nhập danh sách duyệt
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}

      {importJobs.length > 0 && (
        <Card>
          <CardHeader title="Lịch sử nhập file" />
          <CardBody>
            <ImportJobList jobs={importJobs} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Thành viên (${registrations.length})`}
          description={canBulkAssign && groups.length > 0 ? 'Tích chọn thành viên bên dưới rồi xếp cùng lúc vào 1 nhóm.' : undefined}
          action={
            canBulkAssign && groups.length > 0 ? (
              <form id="bulk-group-form" action={bulkAssignGroup.bind(null, id)} className="flex items-center gap-2">
                <SelectInput name="groupId" defaultValue="" className="w-44">
                  <option value="">Bỏ khỏi nhóm</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </SelectInput>
                <SubmitButton size="sm" variant="outline" pendingLabel="Đang xếp…">
                  Xếp vào nhóm
                </SubmitButton>
              </form>
            ) : undefined
          }
        />
        <CardBody className="space-y-2">
          {registrations.length === 0 ? (
            <EmptyState title="Không tìm thấy thành viên phù hợp" />
          ) : (
            registrations.map((reg) => (
              <MemberRow
                key={reg.id}
                reg={reg}
                groups={groups}
                trackingFields={trackingFields}
                regFields={regFields}
                canReview={scope.can(PERMISSIONS.REGISTRATION_REVIEW, reg.groupId)}
                canManage={scope.can(PERMISSIONS.MEMBER_MANAGE, reg.groupId)}
                canChangeGroup={scope.can(PERMISSIONS.MEMBER_MANAGE)}
                canAttendance={scope.can(PERMISSIONS.ATTENDANCE_MANAGE, reg.groupId)}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function FilterLink({
  id,
  status,
  q,
  groupId,
  label,
  active,
}: {
  id: string
  status?: string
  q?: string
  groupId?: string
  label: string
  active: boolean
}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  if (groupId) params.set('groupId', groupId)
  const qs = params.toString()
  return (
    <a href={`/admin/campaigns/${id}/members${qs ? `?${qs}` : ''}`}>
      <Badge tone={active ? 'blue' : 'gray'} className={active ? 'ring-2 ring-brand-300' : ''}>
        {label}
      </Badge>
    </a>
  )
}
