import { requireAdminArea } from '@/lib/session'
import { listManagedCampaigns } from '@/lib/scope'
import { hasGlobalPermission, PERMISSIONS } from '@/lib/permissions'
import { PageHeader, EmptyState } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/button'
import { CampaignCard } from '@/components/campaign/campaign-card'
import { prisma } from '@/lib/prisma'

export default async function AdminCampaignsPage() {
  const user = await requireAdminArea()
  const campaigns = await listManagedCampaigns(user)
  const counts = await prisma.registration.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: campaigns.map((c) => c.id) }, status: 'APPROVED' },
    _count: true,
  })
  const countMap = new Map(counts.map((c) => [c.campaignId, c._count]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sự kiện"
        description="Danh sách sự kiện bạn đang phụ trách."
        action={
          hasGlobalPermission(user, PERMISSIONS.CAMPAIGN_CREATE) && (
            <LinkButton href="/admin/campaigns/new">+ Tạo sự kiện</LinkButton>
          )
        }
      />
      {campaigns.length === 0 ? (
        <EmptyState title="Chưa có sự kiện nào" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              memberCount={countMap.get(c.id) ?? 0}
              href={`/admin/campaigns/${c.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
