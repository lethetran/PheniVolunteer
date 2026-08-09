import { notFound } from 'next/navigation'
import { CalendarRange, MapPin, Users2, Building2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { getCampaignScope } from '@/lib/scope'
import { CAMPAIGN_STATUS, REGISTRATION_STATUS, TASK_STATUS, NOTE_SEVERITY } from '@/lib/labels'
import { formatRange, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { ActionForm } from '@/components/ui/action-form'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { TextArea } from '@/components/ui/field'
import { FieldInput } from '@/components/fields/field-input'
import { LinkButton } from '@/components/ui/button'
import { CampaignChat } from '@/components/campaign/campaign-chat'
import { chatAllowed } from '@/lib/chat'
import { joinCampaign, cancelRegistration } from '@/actions/registrations'
import { updateTaskProgress } from '@/actions/tasks'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const campaign = await prisma.campaign.findUnique({ where: { slug } })
  if (!campaign) notFound()

  const user = await getCurrentUser()
  const scope = user ? await getCampaignScope(campaign.id) : null
  if (campaign.status === 'DRAFT' && !scope?.isStaff) notFound()

  const [registration, regFieldDefs, groups, memberCount, posts] = await Promise.all([
    user
      ? prisma.registration.findUnique({
          where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
        })
      : null,
    prisma.fieldDefinition.findMany({
      where: { scope: 'REGISTRATION_FORM', campaignId: campaign.id, archived: false },
      orderBy: { order: 'asc' },
    }),
    prisma.campaignGroup.findMany({ where: { campaignId: campaign.id }, orderBy: { order: 'asc' } }),
    prisma.registration.count({ where: { campaignId: campaign.id, status: 'APPROVED' } }),
    prisma.post.findMany({
      where: { campaignId: campaign.id, published: true },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  const isApproved = registration?.status === 'APPROVED'
  const [tasks, notes] = await Promise.all([
    isApproved
      ? prisma.task.findMany({
          where: {
            campaignId: campaign.id,
            OR: [{ groupId: null }, { groupId: registration!.groupId }],
          },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId: user!.id } } },
        })
      : Promise.resolve([]),
    registration
      ? prisma.note.findMany({
          where: {
            campaignId: campaign.id,
            sharedWithVolunteer: true,
            OR: [{ registrationId: registration.id }, { subjectId: user!.id }],
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  const group = groups.find((g) => g.id === registration?.groupId)
  const canJoin =
    campaign.allowSelfJoin &&
    campaign.status === 'OPEN' &&
    (!registration || ['CANCELLED', 'REJECTED'].includes(registration.status))

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {campaign.title}
            <Badge tone={CAMPAIGN_STATUS[campaign.status].tone}>{CAMPAIGN_STATUS[campaign.status].label}</Badge>
          </span>
        }
        description={campaign.summary}
        action={
          user && (
            <LinkButton href={`/campaigns/${slug}/members`} variant="outline" size="sm">
              Danh sách ban tổ chức & TNV
            </LinkButton>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Info icon={CalendarRange} label="Thời gian" value={formatRange(campaign.startAt, campaign.endAt)} />
                {campaign.location && <Info icon={MapPin} label="Địa điểm" value={campaign.location} />}
                {campaign.organizer && <Info icon={Building2} label="Đơn vị tổ chức" value={campaign.organizer} />}
                <Info
                  icon={Users2}
                  label="Số lượng"
                  value={`${memberCount}${campaign.capacity ? `/${campaign.capacity}` : ''} tình nguyện viên`}
                />
              </dl>
              {campaign.description && (
                <div className="whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
                  {campaign.description}
                </div>
              )}
            </CardBody>
          </Card>

          {posts.length > 0 && (
            <Card>
              <CardHeader title="Thông báo" />
              <CardBody className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-lg border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-slate-900">{post.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{post.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(post.createdAt)}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {isApproved && (
            <Card>
              <CardHeader
                title="Nhiệm vụ của bạn"
                description={group ? `Nhóm: ${group.name}` : undefined}
              />
              <CardBody className="space-y-4">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có nhiệm vụ nào được giao.</p>
                ) : (
                  tasks.map((task) => (
                    <TaskRow key={task.id} task={task} progress={task.progress[0]} />
                  ))
                )}
              </CardBody>
            </Card>
          )}

          {notes.length > 0 && (
            <Card>
              <CardHeader title="Ghi chú từ ban tổ chức" />
              <CardBody className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-2 rounded-lg border border-slate-100 p-3 text-sm">
                    <Badge tone={NOTE_SEVERITY[note.severity].tone}>{NOTE_SEVERITY[note.severity].label}</Badge>
                    <p className="text-slate-700">{note.body}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {user &&
            chatAllowed(campaign.chatAccess, {
              isCampaignWide: scope?.isCampaignWide ?? false,
              isGroupLead: scope?.isGroupLead ?? false,
              isApprovedMember: isApproved,
            }) && (
              <Card>
                <CardHeader title="Nhóm chat chung" />
                <CardBody>
                  <CampaignChat campaignId={campaign.id} currentUserId={user.id} />
                </CardBody>
              </Card>
            )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Đăng ký tham gia" />
            <CardBody>
              {!user ? (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Đăng nhập bằng email trường để đăng ký tham gia sự kiện này.</p>
                  <LinkButton href={`/login?callbackUrl=/campaigns/${slug}`} className="w-full">
                    Đăng nhập
                  </LinkButton>
                </div>
              ) : scope?.isCampaignWide ? (
                <div className="space-y-2">
                  <Badge tone="violet" className="text-sm">
                    Quản trị viên sự kiện
                  </Badge>
                  <p className="text-sm text-slate-500">
                    Bạn phụ trách sự kiện này nên mặc định là thành viên, không cần đăng ký.
                  </p>
                </div>
              ) : registration && !canJoin ? (
                <div className="space-y-3">
                  <Badge tone={REGISTRATION_STATUS[registration.status].tone} className="text-sm">
                    {REGISTRATION_STATUS[registration.status].label}
                  </Badge>
                  {registration.status === 'REJECTED' && registration.rejectReason && (
                    <p className="text-sm text-slate-500">Lý do: {registration.rejectReason}</p>
                  )}
                  {group && <p className="text-sm text-slate-500">Nhóm: {group.name}</p>}
                  {['PENDING', 'APPROVED', 'WAITLIST'].includes(registration.status) && (
                    <ActionForm action={cancelRegistration.bind(null, registration.id)}>
                      <ConfirmSubmitButton
                        variant="outline"
                        className="w-full"
                        pendingLabel="Đang huỷ…"
                        confirmMessage="Huỷ đăng ký sự kiện này? Bạn có thể đăng ký lại sau nếu sự kiện còn nhận."
                      >
                        Huỷ đăng ký
                      </ConfirmSubmitButton>
                    </ActionForm>
                  )}
                </div>
              ) : canJoin ? (
                <ActionForm action={joinCampaign.bind(null, campaign.id)} className="space-y-4">
                  {regFieldDefs.map((def) => (
                    <FieldInput key={def.id} def={def} />
                  ))}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Lý do tham gia</label>
                    <TextArea name="motivation" placeholder="Chia sẻ ngắn gọn lý do bạn muốn tham gia…" />
                  </div>
                  <SubmitButton className="w-full" pendingLabel="Đang gửi…">
                    Đăng ký ngay
                  </SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm text-slate-500">Sự kiện hiện không nhận đăng ký.</p>
              )}
            </CardBody>
          </Card>

          {groups.length > 0 && (
            <Card>
              <CardHeader title="Các nhóm" />
              <CardBody className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <p className="font-medium text-slate-800">{g.name}</p>
                    {g.shift && <p className="text-xs text-slate-500">Ca: {g.shift}</p>}
                    {g.meetingPoint && <p className="text-xs text-slate-500">Điểm hẹn: {g.meetingPoint}</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <dt className="text-xs text-slate-400">{label}</dt>
        <dd className="font-medium text-slate-700">{value}</dd>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  progress,
}: {
  task: { id: string; title: string; description: string | null; dueAt: Date | null; required: boolean; requireEvidence: boolean }
  progress?: { status: keyof typeof TASK_STATUS; evidenceUrl: string | null; report: string | null; reviewNote: string | null }
}) {
  const status = progress?.status ?? 'NOT_STARTED'
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {task.title} {task.required && <span className="text-red-500">*</span>}
        </p>
        <Badge tone={TASK_STATUS[status].tone}>{TASK_STATUS[status].label}</Badge>
      </div>
      {task.description && <p className="mt-1 text-sm text-slate-500">{task.description}</p>}
      {task.dueAt && <p className="mt-1 text-xs text-slate-400">Hạn: {formatDateTime(task.dueAt)}</p>}
      {progress?.reviewNote && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          Nhận xét: {progress.reviewNote}
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-brand-600">Cập nhật tiến độ</summary>
        <form action={updateTaskProgress.bind(null, task.id)} className="mt-2 space-y-2">
          <select
            name="status"
            defaultValue={status}
            className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
          >
            <option value="NOT_STARTED">Chưa làm</option>
            <option value="IN_PROGRESS">Đang làm</option>
            <option value="SUBMITTED">Nộp báo cáo / chờ duyệt</option>
          </select>
          {task.requireEvidence && (
            <input
              name="evidenceUrl"
              placeholder="Đường dẫn minh chứng (ảnh, drive,...)"
              defaultValue={progress?.evidenceUrl ?? ''}
              className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
            />
          )}
          <textarea
            name="report"
            rows={2}
            placeholder="Mô tả kết quả thực hiện…"
            defaultValue={progress?.report ?? ''}
            className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
          />
          <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
            Lưu tiến độ
          </SubmitButton>
        </form>
      </details>
    </div>
  )
}
