import Link from 'next/link'
import { requireAdminArea } from '@/lib/session'
import { listManagedCampaigns } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { CAMPAIGN_STATUS } from '@/lib/labels'
import { formatDateTime } from '@/lib/utils'
import { AUDIT_LABELS } from '@/lib/audit'
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function AdminHomePage() {
  const user = await requireAdminArea()
  const campaigns = await listManagedCampaigns(user)
  const campaignIds = campaigns.map((c) => c.id)

  const [pending, registered, volunteerCount, recentLogs] = await Promise.all([
    prisma.registration.count({ where: { campaignId: { in: campaignIds }, status: 'PENDING' } }),
    prisma.registration.count({ where: { campaignId: { in: campaignIds }, status: 'APPROVED' } }),
    prisma.user.count({ where: { role: 'VOLUNTEER' } }),
    user.role === 'ROOT_ADMIN'
      ? prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { actor: true } })
      : Promise.resolve([]),
  ])

  const statusCounts = new Map<string, number>()
  for (const c of campaigns) statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1)

  return (
    <div className="space-y-6">
      <PageHeader title={`Chào ${user.name ?? user.email.split('@')[0]} 👋`} description="Tổng quan hoạt động tình nguyện." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sự kiện phụ trách" value={campaigns.length} />
        <Stat label="Đơn chờ duyệt" value={pending} tone={pending > 0 ? 'amber' : 'gray'} />
        <Stat label="Thành viên đã duyệt" value={registered} />
        <Stat label="Tổng tình nguyện viên" value={volunteerCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sự kiện gần đây" />
          <CardBody className="space-y-2">
            {campaigns.length === 0 ? (
              <EmptyState title="Chưa phụ trách sự kiện nào" />
            ) : (
              campaigns.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/campaigns/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="font-medium text-slate-800">{c.title}</span>
                  <Badge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</Badge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        {user.role === 'ROOT_ADMIN' ? (
          <Card>
            <CardHeader title="Nhật ký gần đây" />
            <CardBody className="space-y-2">
              {recentLogs.length === 0 ? (
                <EmptyState title="Chưa có hoạt động nào" />
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium">{log.actor?.name ?? log.actor?.email ?? 'Hệ thống'}</span>{' '}
                      {AUDIT_LABELS[log.action] ?? log.action}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Theo trạng thái" />
            <CardBody className="space-y-2">
              {Object.entries(CAMPAIGN_STATUS).map(([status, meta]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-slate-500">{statusCounts.get(status) ?? 0}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'gray' }) {
  return (
    <Card>
      <CardBody>
        <p className={`text-2xl font-bold ${tone === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
        <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      </CardBody>
    </Card>
  )
}
