import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { REGISTRATION_STATUS, CAMPAIGN_STATUS } from '@/lib/labels'
import { formatRange } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, EmptyState, PageHeader } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/button'

export default async function DashboardPage() {
  const user = await requireUser()

  const registrations = await prisma.registration.findMany({
    where: { userId: user.id },
    include: { campaign: true, group: true },
    orderBy: { appliedAt: 'desc' },
  })

  const totalHours = registrations.reduce((sum, r) => sum + r.hoursAwarded, 0)
  const totalPoints = registrations.reduce((sum, r) => sum + r.pointsAwarded, 0)
  const completedCount = registrations.filter((r) => r.completed).length

  return (
    <div className="space-y-6">
      <PageHeader title="Sự kiện của tôi" description="Theo dõi các sự kiện bạn đã đăng ký và kết quả tham gia." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sự kiện đã tham gia" value={registrations.length} />
        <StatCard label="Tổng giờ tình nguyện" value={totalHours} />
        <StatCard label="Tổng điểm rèn luyện" value={totalPoints} />
      </div>

      <Card>
        <CardBody className="space-y-3">
          {registrations.length === 0 ? (
            <EmptyState
              title="Bạn chưa đăng ký sự kiện nào"
              description="Khám phá các sự kiện đang mở đăng ký và tham gia ngay."
              action={
                <LinkButton href="/" variant="primary" className="mt-2">
                  Xem sự kiện
                </LinkButton>
              }
            />
          ) : (
            registrations.map((r) => (
              <Link
                key={r.id}
                href={`/campaigns/${r.campaign.slug}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-4 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div>
                  <p className="font-medium text-slate-900">{r.campaign.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatRange(r.campaign.startAt, r.campaign.endAt)}
                    {r.group ? ` · Nhóm ${r.group.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={CAMPAIGN_STATUS[r.campaign.status].tone}>
                    {CAMPAIGN_STATUS[r.campaign.status].label}
                  </Badge>
                  <Badge tone={REGISTRATION_STATUS[r.status].tone}>{REGISTRATION_STATUS[r.status].label}</Badge>
                </div>
              </Link>
            ))
          )}
        </CardBody>
      </Card>

      {completedCount > 0 && (
        <p className="text-sm text-slate-500">
          Bạn đã hoàn thành {completedCount}/{registrations.length} sự kiện đã tham gia.
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      </CardBody>
    </Card>
  )
}
