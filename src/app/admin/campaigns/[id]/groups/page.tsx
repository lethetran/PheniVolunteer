import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS, PERMISSION_LABELS, MANAGER_GRANTABLE_PERMISSIONS, DEFAULT_GROUP_LEADER_PERMISSIONS } from '@/lib/permissions'
import { REGISTRATION_STATUS } from '@/lib/labels'
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Field, TextInput, TextArea, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Avatar } from '@/components/ui/avatar'
import {
  createGroup,
  updateGroup,
  deleteGroup,
  assignGroupLeader,
  removeGroupLeader,
} from '@/actions/groups'

export default async function CampaignGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  scope.assert(PERMISSIONS.GROUP_MANAGE)

  const groups = await prisma.campaignGroup.findMany({
    where: { campaignId: id },
    orderBy: { order: 'asc' },
    include: {
      assignments: { include: { user: true } },
      registrations: { include: { user: true }, orderBy: { appliedAt: 'asc' } },
      _count: { select: { registrations: { where: { status: 'APPROVED' } } } },
    },
  })

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <Card>
          <CardHeader title="Tổng quan nhóm" description="Bấm vào một nhóm để xem nhanh danh sách thành viên." />
          <CardBody className="space-y-2">
            {groups.map((g) => (
              <details key={g.id} className="rounded-lg border border-slate-100">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{g.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {g.registrations.length}
                    {g.quota ? `/${g.quota}` : ''} thành viên
                    <Badge tone="gray">{g._count.registrations} đã duyệt</Badge>
                  </span>
                </summary>
                <div className="space-y-1 border-t border-slate-100 p-3">
                  {g.registrations.length === 0 ? (
                    <p className="text-sm text-slate-400">Chưa có thành viên nào trong nhóm.</p>
                  ) : (
                    g.registrations.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Avatar name={r.user.name} email={r.user.email} image={r.user.image} size={24} />
                          <span className="text-sm text-slate-700">{r.user.name ?? r.user.email}</span>
                        </div>
                        <Badge tone={REGISTRATION_STATUS[r.status].tone}>{REGISTRATION_STATUS[r.status].label}</Badge>
                      </div>
                    ))
                  )}
                  <Link
                    href={`/admin/campaigns/${id}/members?groupId=${g.id}`}
                    className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    Xem & quản lý đầy đủ tại trang Thành viên →
                  </Link>
                </div>
              </details>
            ))}
          </CardBody>
        </Card>
      )}

      {groups.length === 0 ? (
        <EmptyState title="Chưa có nhóm nào" description="Tạo nhóm để phân chia tình nguyện viên và cử trưởng nhóm." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader
                title={g.name}
                description={`${g._count.registrations}${g.quota ? `/${g.quota}` : ''} thành viên${g.shift ? ` · Ca: ${g.shift}` : ''}`}
              />
              <CardBody className="space-y-4">
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">Sửa thông tin nhóm</summary>
                  <form action={updateGroup.bind(null, g.id)} className="mt-3 space-y-3">
                    <Field label="Tên nhóm" required>
                      <TextInput name="name" required defaultValue={g.name} />
                    </Field>
                    <Field label="Mô tả">
                      <TextArea name="description" rows={2} defaultValue={g.description ?? ''} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Chỉ tiêu">
                        <TextInput name="quota" type="number" min={0} defaultValue={g.quota ?? ''} />
                      </Field>
                      <Field label="Ca / khung giờ">
                        <TextInput name="shift" defaultValue={g.shift ?? ''} />
                      </Field>
                    </div>
                    <Field label="Điểm hẹn">
                      <TextInput name="meetingPoint" defaultValue={g.meetingPoint ?? ''} />
                    </Field>
                    <div className="flex gap-2">
                      <SubmitButton size="sm" pendingLabel="Đang lưu…">Lưu</SubmitButton>
                      <form action={deleteGroup.bind(null, g.id)}>
                        <ConfirmSubmitButton
                          variant="danger"
                          size="sm"
                          pendingLabel="Đang xoá…"
                          confirmMessage={`Xoá vĩnh viễn nhóm "${g.name}"? Thành viên trong nhóm sẽ về trạng thái chưa xếp nhóm.`}
                        >
                          Xoá nhóm
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </form>
                </details>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500">Trưởng / phó nhóm</p>
                  {g.assignments.length === 0 && <p className="text-sm text-slate-400">Chưa có ai phụ trách.</p>}
                  {g.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={a.user.name} email={a.user.email} image={a.user.image} size={26} />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{a.user.name ?? a.user.email}</p>
                          <p className="text-xs text-slate-500">{a.title || 'Thành viên phụ trách'}</p>
                        </div>
                      </div>
                      <form action={removeGroupLeader.bind(null, g.id, a.userId)}>
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Đang gỡ…">Gỡ</SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>

                <details className="border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">+ Cử trưởng nhóm</summary>
                  <form action={assignGroupLeader.bind(null, g.id)} className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email">
                        <TextInput name="email" type="email" required placeholder="ten@st.phenikaa-uni.edu.vn" />
                      </Field>
                      <Field label="Chức danh">
                        <TextInput name="title" placeholder="Trưởng nhóm" />
                      </Field>
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-slate-700">Quyền trong nhóm</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {MANAGER_GRANTABLE_PERMISSIONS.map((p) => (
                          <CheckboxInput
                            key={p}
                            name="permissions"
                            value={p}
                            defaultChecked={(DEFAULT_GROUP_LEADER_PERMISSIONS as string[]).includes(p)}
                            label={PERMISSION_LABELS[p]}
                          />
                        ))}
                      </div>
                    </div>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Đang cử…">Cử phụ trách</SubmitButton>
                  </form>
                </details>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Tạo nhóm mới" />
        <CardBody>
          <form action={createGroup.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên nhóm" required>
              <TextInput name="name" required placeholder="VD: Nhóm hậu cần" />
            </Field>
            <Field label="Chỉ tiêu">
              <TextInput name="quota" type="number" min={0} />
            </Field>
            <Field label="Ca / khung giờ">
              <TextInput name="shift" />
            </Field>
            <Field label="Điểm hẹn">
              <TextInput name="meetingPoint" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Mô tả">
                <TextArea name="description" rows={2} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Đang tạo…">Tạo nhóm</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
