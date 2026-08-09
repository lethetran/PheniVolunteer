import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { TASK_STATUS } from '@/lib/labels'
import { formatDateTime, toDateTimeLocal, percent } from '@/lib/utils'
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Field, TextInput, TextArea, SelectInput, CheckboxInput } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Avatar } from '@/components/ui/avatar'
import { QuickTaskToggle } from '@/components/campaign/quick-task-toggle'
import { createTask, updateTask, deleteTask, reviewTaskProgress } from '@/actions/tasks'

export default async function CampaignTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  if (!scope.canAnywhere(PERMISSIONS.TASK_MANAGE)) scope.assert(PERMISSIONS.TASK_MANAGE)

  const allGroups = await prisma.campaignGroup.findMany({ where: { campaignId: id }, orderBy: { order: 'asc' } })
  const groupIds = scope.visibleGroupIds
  const creatableGroups = scope.isCampaignWide ? allGroups : allGroups.filter((g) => scope.can(PERMISSIONS.TASK_MANAGE, g.id))

  const tasks = await prisma.task.findMany({
    where: {
      campaignId: id,
      ...(groupIds ? { OR: [{ groupId: null }, { groupId: { in: groupIds } }] } : {}),
    },
    orderBy: { order: 'asc' },
    include: {
      group: true,
      progress: { include: { user: true }, orderBy: { updatedAt: 'desc' } },
    },
  })

  return (
    <div className="space-y-6">
      {tasks.length === 0 ? (
        <EmptyState title="Chưa có nhiệm vụ nào" />
      ) : (
        tasks.map((task) => {
          const done = task.progress.filter((p) => p.status === 'DONE').length
          return (
            <Card key={task.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {task.title}
                    {task.group && <Badge tone="gray">{task.group.name}</Badge>}
                    {task.required && <Badge tone="amber">Bắt buộc</Badge>}
                  </span>
                }
                description={task.dueAt ? `Hạn: ${formatDateTime(task.dueAt)} · ${percent(done, task.progress.length)}% hoàn thành` : undefined}
              />
              <CardBody className="space-y-4">
                {task.description && <p className="text-sm text-slate-600">{task.description}</p>}

                {task.progress.length > 0 && (
                  <div className="space-y-2">
                    {task.progress.map((p) => (
                      <details key={p.id} className="rounded-lg border border-slate-100">
                        <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            {scope.can(PERMISSIONS.TASK_REVIEW, task.groupId) && (
                              <QuickTaskToggle progressId={p.id} done={p.status === 'DONE'} />
                            )}
                            <Avatar name={p.user.name} email={p.user.email} image={p.user.image} size={24} />
                            {p.user.name ?? p.user.email}
                          </span>
                          <Badge tone={TASK_STATUS[p.status].tone}>{TASK_STATUS[p.status].label}</Badge>
                        </summary>
                        <div className="space-y-2 border-t border-slate-100 p-3 text-sm">
                          {p.report && <p className="text-slate-600">Báo cáo: {p.report}</p>}
                          {p.evidenceUrl && (
                            <p className="text-slate-600">
                              Minh chứng:{' '}
                              <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                                {p.evidenceUrl}
                              </a>
                            </p>
                          )}
                          {scope.can(PERMISSIONS.TASK_REVIEW, task.groupId) && (
                            <form action={reviewTaskProgress.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
                              <SelectInput name="status" defaultValue={p.status} className="w-40">
                                {Object.entries(TASK_STATUS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </SelectInput>
                              <TextInput name="reviewNote" placeholder="Nhận xét" defaultValue={p.reviewNote ?? ''} className="flex-1" />
                              <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
                                Xác nhận
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {scope.can(PERMISSIONS.TASK_MANAGE) && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-brand-600">Sửa / xoá nhiệm vụ</summary>
                    <form action={updateTask.bind(null, task.id)} className="mt-3 space-y-3">
                      <Field label="Tên nhiệm vụ" required>
                        <TextInput name="title" required defaultValue={task.title} />
                      </Field>
                      <Field label="Mô tả">
                        <TextArea name="description" rows={2} defaultValue={task.description ?? ''} />
                      </Field>
                      <Field label="Hạn hoàn thành">
                        <TextInput name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(task.dueAt)} />
                      </Field>
                      <div className="flex gap-4">
                        <CheckboxInput name="required" defaultChecked={task.required} label="Bắt buộc" />
                        <CheckboxInput name="requireEvidence" defaultChecked={task.requireEvidence} label="Yêu cầu minh chứng" />
                      </div>
                      <div className="flex gap-2">
                        <SubmitButton size="sm" pendingLabel="Đang lưu…">Lưu</SubmitButton>
                      </div>
                    </form>
                    <form action={deleteTask.bind(null, task.id)} className="mt-2">
                      <ConfirmSubmitButton
                        variant="danger"
                        size="sm"
                        pendingLabel="Đang xoá…"
                        confirmMessage={`Xoá nhiệm vụ "${task.title}"? Tiến độ các TNV đã báo cáo cho nhiệm vụ này cũng sẽ mất.`}
                      >
                        Xoá nhiệm vụ
                      </ConfirmSubmitButton>
                    </form>
                  </details>
                )}
              </CardBody>
            </Card>
          )
        })
      )}

      {creatableGroups.length >= 0 && (
        <Card>
          <CardHeader title="Tạo nhiệm vụ mới" />
          <CardBody>
            <form action={createTask.bind(null, id)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tên nhiệm vụ" required>
                  <TextInput name="title" required />
                </Field>
                <Field label="Áp dụng cho nhóm" hint="Bỏ trống = áp dụng toàn sự kiện">
                  <SelectInput name="groupId" defaultValue="">
                    {scope.isCampaignWide && <option value="">Toàn bộ sự kiện</option>}
                    {creatableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Mô tả">
                <TextArea name="description" rows={2} />
              </Field>
              <Field label="Hạn hoàn thành">
                <TextInput name="dueAt" type="datetime-local" />
              </Field>
              <div className="flex gap-4">
                <CheckboxInput name="required" defaultChecked label="Bắt buộc" />
                <CheckboxInput name="requireEvidence" label="Yêu cầu minh chứng" />
              </div>
              <SubmitButton pendingLabel="Đang tạo…">Tạo nhiệm vụ</SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
