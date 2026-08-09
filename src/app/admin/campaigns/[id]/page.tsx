import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { REGISTRATION_STATUS } from '@/lib/labels'
import { percent } from '@/lib/utils'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function CampaignOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  const where = scope.registrationWhere

  const [byStatus, groups, taskStats] = await Promise.all([
    prisma.registration.groupBy({ by: ['status'], where, _count: true }),
    prisma.campaignGroup.findMany({
      where: { campaignId: id },
      include: { _count: { select: { registrations: { where: scope.isCampaignWide ? {} : { status: 'APPROVED' } } } } },
      orderBy: { order: 'asc' },
    }),
    prisma.taskProgress.groupBy({
      by: ['status'],
      where: { task: { campaignId: id, ...(scope.visibleGroupIds ? { groupId: { in: [...scope.visibleGroupIds, null].filter(Boolean) as string[] } } : {}) } },
      _count: true,
    }),
  ])

  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Record<string, number>
  const total = byStatus.reduce((s, b) => s + b._count, 0)
  const doneTasks = taskStats.find((t) => t.status === 'DONE')?._count ?? 0
  const totalTaskProgress = taskStats.reduce((s, t) => s + t._count, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'APPROVED', 'WAITLIST', 'REJECTED'] as const).map((s) => (
          <Card key={s}>
            <CardBody>
              <p className="text-2xl font-bold text-slate-900">{counts[s] ?? 0}</p>
              <Badge tone={REGISTRATION_STATUS[s].tone} className="mt-1">
                {REGISTRATION_STATUS[s].label}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Nhóm" description={`Tổng ${groups.length} nhóm, ${total} lượt đăng ký`} />
          <CardBody className="space-y-2">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa tạo nhóm nào.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">{g.name}</span>
                  <span className="text-slate-500">
                    {g._count.registrations}
                    {g.quota ? `/${g.quota}` : ''} thành viên
                  </span>
                </div>
              ))
            )}
            <Link href={`/admin/campaigns/${id}/groups`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
              Quản lý nhóm →
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tiến độ nhiệm vụ" description={`${percent(doneTasks, totalTaskProgress)}% đã hoàn thành`} />
          <CardBody className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${percent(doneTasks, totalTaskProgress)}%` }}
              />
            </div>
            <p className="text-sm text-slate-500">
              {doneTasks}/{totalTaskProgress} lượt cập nhật nhiệm vụ đã hoàn thành.
            </p>
            <Link href={`/admin/campaigns/${id}/tasks`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
              Quản lý nhiệm vụ →
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
