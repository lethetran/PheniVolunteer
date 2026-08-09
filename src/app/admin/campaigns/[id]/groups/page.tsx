import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS, PERMISSION_LABELS, MANAGER_GRANTABLE_PERMISSIONS, DEFAULT_GROUP_LEADER_PERMISSIONS } from '@/lib/permissions'
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card'
import { Field, TextInput, TextArea, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
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
      _count: { select: { registrations: { where: { status: 'APPROVED' } } } },
    },
  })

  return (
    <div className="space-y-6">
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
                        <SubmitButton variant="danger" size="sm" pendingLabel="Đang xoá…">Xoá nhóm</SubmitButton>
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
