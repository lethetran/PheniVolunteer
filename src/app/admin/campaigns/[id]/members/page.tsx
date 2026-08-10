import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { REGISTRATION_STATUS } from '@/lib/labels'
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { SelectInput, TextInput } from '@/components/ui/field'
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select'
import { MemberRow, MemberTableHeader } from '@/components/campaign/member-row'
import { ImportJobList } from '@/components/campaign/import-job-list'
import { importCampaignMembers, importApprovalDecisions } from '@/actions/import'
import { bulkAssignGroup } from '@/actions/registrations'
import { sendBulkNotification } from '@/actions/notifications-actions'
import type { Prisma, RegistrationStatus } from '@prisma/client'

export default async function CampaignMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; q?: string; groupId?: string; from?: string; to?: string }>
}) {
  const { id } = await params
  const { status, q, groupId, from, to } = await searchParams
  const scope = await requireCampaignScope(id)
  if (!scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) && !scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW)) {
    scope.assert(PERMISSIONS.MEMBER_MANAGE)
  }

  const statusFilter = status && status in REGISTRATION_STATUS ? (status as RegistrationStatus) : undefined
  const search = q?.trim()
  const groupFilter = groupId?.trim()
  const fromRow = from ? Number(from) : undefined
  const toRow = to ? Number(to) : undefined

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

  const dynamicFields = [...regFields, ...trackingFields]
  const numbered = registrations.map((reg, i) => ({ reg, stt: i + 1 }))
  const rangedRegistrations = numbered.filter(
    ({ stt }) => (fromRow === undefined || stt >= fromRow) && (toRow === undefined || stt <= toRow),
  )

  const counts = await prisma.registration.groupBy({ by: ['status'], where: scope.registrationWhere, _count: true })
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<RegistrationStatus, number>
  const totalCount = counts.reduce((s, c) => s + c._count, 0)

  const canReviewAnywhere = scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW)
  const managedGroups = groups.filter((g) => scope.can(PERMISSIONS.MEMBER_MANAGE, g.id))
  const canBulkAssign = scope.isCampaignWide ? scope.can(PERMISSIONS.MEMBER_MANAGE) : managedGroups.length > 0
  const bulkGroupOptions = scope.isCampaignWide ? groups : managedGroups

  // Trưởng nhóm (không quản lý toàn sự kiện) được thêm người từ danh sách chung
  // (chưa xếp nhóm) vào nhóm mình phụ trách — không cần tải file lên nữa.
  const candidates =
    !scope.isCampaignWide && managedGroups.length > 0
      ? await prisma.registration.findMany({
          where: { campaignId: id, groupId: null, status: { in: ['PENDING', 'APPROVED'] } },
          include: { user: true, group: true },
          orderBy: [{ appliedAt: 'desc' }],
        })
      : []

  const importJobs = scope.isCampaignWide
    ? await prisma.importJob.findMany({
        where: { campaignId: id, kind: { in: ['CAMPAIGN_MEMBERS', 'APPROVAL_LIST'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : []

  const campaignApprovedCount = scope.campaign.capacity
    ? await prisma.registration.count({ where: { campaignId: id, status: 'APPROVED' } })
    : 0
  const overCapacity = Boolean(scope.campaign.capacity && campaignApprovedCount > scope.campaign.capacity)

  return (
    <div className="space-y-6">
      {overCapacity && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Sự kiện đã vượt số lượng tối đa: <strong>{campaignApprovedCount}/{scope.campaign.capacity}</strong> đã duyệt.
          Cân nhắc chuyển bớt sang danh sách chờ hoặc tăng chỉ tiêu ở Cài đặt.
        </div>
      )}

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
            {scope.canAnywhere(PERMISSIONS.DATA_EXPORT) && (
              <div className="ml-auto">
                <LinkButton href={`/admin/campaigns/${id}/members/export`} variant="outline" size="sm">
                  Xuất Excel
                </LinkButton>
              </div>
            )}
          </div>

          <form method="GET" className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <TextInput name="q" defaultValue={q ?? ''} placeholder="Tìm theo tên, email, MSSV…" className="w-56" />
            {groups.length > 0 && (
              <AutoSubmitSelect name="groupId" defaultValue={groupFilter ?? ''} className="w-48">
                <option value="">Tất cả nhóm</option>
                <option value="none">Chưa xếp nhóm</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-500">
              STT
              <TextInput name="from" type="number" min={1} defaultValue={from ?? ''} placeholder="1" className="w-16" />
              →
              <TextInput name="to" type="number" min={1} defaultValue={to ?? ''} placeholder="10" className="w-16" />
            </span>
            <SubmitButton variant="outline" size="sm" pendingLabel="Đang lọc…">
              Lọc
            </SubmitButton>
            {(search || groupFilter || fromRow !== undefined || toRow !== undefined) && (
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

      {scope.isCampaignWide && scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) && (
        <Card>
          <CardHeader
            title="Nhập danh sách thành viên từ Excel"
            description={`Cột "MSSV" dùng để khớp với tài khoản Google của TNV (ưu tiên hơn Email) — cần ít nhất 1 trong 2. Các cột khác (kỹ năng, size áo...) khớp theo tên cột đã cấu hình ở "Cột thông tin". Người mới sẽ ở trạng thái "Chờ duyệt".`}
          />
          <CardBody>
            <form action={importCampaignMembers.bind(null, id)} className="flex flex-wrap items-end gap-3">
              <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
              {groups.length > 0 && (
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

      {scope.isCampaignWide && canReviewAnywhere && (
        <Card>
          <CardHeader
            title="Nhập danh sách duyệt"
            description={`Tải lên danh sách MSSV/Email (VD kết quả từ vòng phỏng vấn/xét duyệt) để gộp thành trạng thái duyệt cuối cùng, rồi thông báo tới TNV trong danh sách ban đầu. Có cột "Kết quả" thì đọc theo đó (Duyệt/Từ chối/Chờ...), không có thì mặc định cả danh sách là "Đã duyệt".`}
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

      {canBulkAssign && bulkGroupOptions.length > 0 && (
        <div className="sticky top-16 z-10 space-y-2 rounded-xl border border-brand-200 bg-brand-50/80 px-4 py-2.5 backdrop-blur">
          <form id="bulk-group-form" action={bulkAssignGroup.bind(null, id)} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-brand-700">Đã tích chọn → xếp vào:</span>
            <SelectInput name="groupId" defaultValue={bulkGroupOptions.length === 1 ? bulkGroupOptions[0].id : ''} className="w-44">
              {scope.isCampaignWide && <option value="">Bỏ khỏi nhóm</option>}
              {bulkGroupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>
            <SubmitButton size="sm" pendingLabel="Đang xếp…">
              Xếp vào nhóm
            </SubmitButton>

            <details className="w-full">
              <summary className="cursor-pointer text-xs font-medium text-brand-700">
                Hoặc gửi thông báo tới người đã chọn
              </summary>
              <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-brand-100 pt-2">
                <TextInput name="notifyTitle" placeholder="Tiêu đề thông báo" className="w-56" />
                <TextInput name="notifyBody" placeholder="Nội dung (tuỳ chọn)" className="flex-1 min-w-[10rem]" />
                <label className="flex items-center gap-1.5 text-xs text-brand-700">
                  <input type="checkbox" name="notifyEmail" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                  Gửi kèm email
                </label>
                <SubmitButton size="sm" variant="outline" formAction={sendBulkNotification.bind(null, id)} pendingLabel="Đang gửi…">
                  Gửi thông báo
                </SubmitButton>
              </div>
            </details>
          </form>
        </div>
      )}

      {candidates.length > 0 && (
        <Card>
          <CardHeader
            title={`Danh sách chung — chưa xếp nhóm (${candidates.length})`}
            description="Tích chọn rồi dùng thanh xếp nhóm ở trên để thêm vào nhóm của bạn — thao tác này cũng đồng thời duyệt luôn."
          />
          <CardBody className="space-y-2 overflow-x-auto">
            <MemberTableHeader dynamicFields={dynamicFields} />
            {candidates.map((reg, i) => (
              <MemberRow
                key={reg.id}
                reg={reg}
                index={i + 1}
                groups={groups}
                trackingFields={trackingFields}
                regFields={regFields}
                canReview={false}
                canManage={false}
                canChangeGroup={true}
                canAttendance={false}
              />
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={
            scope.isCampaignWide
              ? `Thành viên (${rangedRegistrations.length}/${registrations.length})`
              : `Thành viên nhóm của tôi (${rangedRegistrations.length}/${registrations.length})`
          }
        />
        <CardBody className="space-y-2 overflow-x-auto">
          {rangedRegistrations.length === 0 ? (
            <EmptyState title="Không tìm thấy thành viên phù hợp" />
          ) : (
            <>
              <MemberTableHeader dynamicFields={dynamicFields} />
              {rangedRegistrations.map(({ reg, stt }) => (
                <MemberRow
                  key={reg.id}
                  reg={reg}
                  index={stt}
                  groups={groups}
                  trackingFields={trackingFields}
                  regFields={regFields}
                  canReview={scope.can(PERMISSIONS.REGISTRATION_REVIEW, reg.groupId)}
                  canManage={scope.can(PERMISSIONS.MEMBER_MANAGE, reg.groupId)}
                  canChangeGroup={scope.can(PERMISSIONS.MEMBER_MANAGE, reg.groupId)}
                  canAttendance={scope.can(PERMISSIONS.ATTENDANCE_MANAGE, reg.groupId)}
                />
              ))}
            </>
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
