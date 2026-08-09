import { redirect } from 'next/navigation'
import { requireCampaignScope } from '@/lib/scope'
import { chatAllowed, CHAT_ACCESS_LABELS } from '@/lib/chat'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { CampaignChat } from '@/components/campaign/campaign-chat'

export default async function CampaignChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)

  const allowed = chatAllowed(scope.campaign.chatAccess, {
    isCampaignWide: scope.isCampaignWide,
    isGroupLead: scope.isGroupLead,
    isApprovedMember: false,
  })
  if (!allowed) redirect(`/admin/campaigns/${id}`)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Nhóm chat chung"
          description={`Đang cho phép: ${CHAT_ACCESS_LABELS[scope.campaign.chatAccess]}${scope.isCampaignWide ? ' — đổi ở tab Cài đặt.' : ''}`}
        />
        <CardBody>
          <CampaignChat campaignId={id} currentUserId={scope.user.id} />
        </CardBody>
      </Card>
    </div>
  )
}
