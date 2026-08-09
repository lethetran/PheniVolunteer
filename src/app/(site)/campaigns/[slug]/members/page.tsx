import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { getCampaignScope } from '@/lib/scope'
import { REGISTRATION_STATUS } from '@/lib/labels'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody, PageHeader, EmptyState } from '@/components/ui/card'
import { TextInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { RegistrationStatus } from '@prisma/client'

export default async function CampaignRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { slug } = await params
  const { q, status } = await searchParams
  const user = await requireUser()

  const campaign = await prisma.campaign.findUnique({ where: { slug } })
  if (!campaign) notFound()

  const scope = await getCampaignScope(campaign.id)
  if (campaign.status === 'DRAFT' && !scope?.isStaff) notFound()

  const search = q?.trim()
  const showAll = status === 'all'
  const statusFilter: RegistrationStatus | undefined = showAll
    ? undefined
    : status && status in REGISTRATION_STATUS
      ? (status as RegistrationStatus)
      : 'APPROVED'

  const [admins, groups, members] = await Promise.all([
    prisma.campaignAdmin.findMany({ where: { campaignId: campaign.id }, include: { user: true } }),
    prisma.campaignGroup.findMany({
      where: { campaignId: campaign.id },
      orderBy: { order: 'asc' },
      include: { assignments: { include: { user: true } } },
    }),
    prisma.registration.findMany({
      where: {
        campaignId: campaign.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { studentCode: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: { user: true, group: true },
      orderBy: [{ appliedAt: 'asc' }],
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Danh sách sự kiện: ${campaign.title}`}
        description="Ban tổ chức và tình nguyện viên của sự kiện — dành cho mọi người tra cứu."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title={`Admin phụ trách (${admins.length})`} />
          <CardBody className="space-y-2">
            {admins.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có admin nào.</p>
            ) : (
              admins.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Avatar name={a.user.name} email={a.user.email} image={a.user.image} size={26} />
                  <span className="text-sm text-slate-700">{a.user.name ?? a.user.email}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`Trưởng nhóm (${groups.reduce((s, g) => s + g.assignments.length, 0)})`} />
          <CardBody className="space-y-3">
            {groups.every((g) => g.assignments.length === 0) ? (
              <p className="text-sm text-slate-400">Chưa có trưởng nhóm nào.</p>
            ) : (
              groups
                .filter((g) => g.assignments.length > 0)
                .map((g) => (
                  <div key={g.id}>
                    <p className="text-xs font-medium text-slate-500">{g.name}</p>
                    <div className="mt-1 space-y-1">
                      {g.assignments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <Avatar name={a.user.name} email={a.user.email} image={a.user.image} size={22} />
                          <span className="text-sm text-slate-700">{a.user.name ?? a.user.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Tình nguyện viên (${members.length})`}
          description={`Đang xem: ${showAll ? 'Tất cả' : REGISTRATION_STATUS[statusFilter!].label}`}
        />
        <CardBody className="space-y-3">
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <TextInput name="q" defaultValue={q ?? ''} placeholder="Tìm theo tên, email, MSSV…" className="w-56" />
            <select name="status" defaultValue={showAll ? 'all' : 'APPROVED'} className="rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600">
              <option value="APPROVED">Đã duyệt</option>
              <option value="all">Tất cả</option>
            </select>
            <SubmitButton variant="outline" size="sm" pendingLabel="Đang tìm…">
              Tìm
            </SubmitButton>
          </form>

          {members.length === 0 ? (
            <EmptyState title="Không tìm thấy ai phù hợp" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-2 font-medium">STT</th>
                    <th className="py-2 pr-2 font-medium">Họ tên</th>
                    <th className="py-2 pr-2 font-medium">MSSV</th>
                    <th className="py-2 pr-2 font-medium">Nhóm</th>
                    <th className="py-2 pr-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={m.user.name} email={m.user.email} image={m.user.image} size={24} />
                          <span className="text-slate-800">{m.user.name ?? m.user.email}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-slate-600">{m.user.studentCode ?? '—'}</td>
                      <td className="py-2 pr-2 text-slate-600">{m.group?.name ?? '—'}</td>
                      <td className="py-2 pr-2">
                        <Badge tone={REGISTRATION_STATUS[m.status].tone}>{REGISTRATION_STATUS[m.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Link href={`/campaigns/${slug}`} className="inline-block text-sm text-brand-600 hover:underline">
        ← Về trang sự kiện
      </Link>
    </div>
  )
}
