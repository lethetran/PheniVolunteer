import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { CAMPAIGN_STATUS } from '@/lib/labels'
import { chatAllowed } from '@/lib/chat'
import { Badge } from '@/components/ui/badge'
import { CampaignTabs } from '@/components/nav/campaign-tabs'

export default async function CampaignAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const scope = await requireCampaignScope(id)

  const tabs = [{ key: '', label: 'Tổng quan' }]
  if (scope.isCampaignWide) tabs.push({ key: 'settings', label: 'Cài đặt' })
  if (scope.isCampaignWide) tabs.push({ key: 'form', label: 'Cột thông tin' })
  if (scope.isCampaignWide) tabs.push({ key: 'groups', label: 'Nhóm' })
  if (scope.canAnywhere(PERMISSIONS.MEMBER_MANAGE) || scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW))
    tabs.push({ key: 'members', label: 'Thành viên' })
  if (scope.canAnywhere(PERMISSIONS.TASK_MANAGE)) tabs.push({ key: 'tasks', label: 'Nhiệm vụ' })
  if (scope.canAnywhere(PERMISSIONS.NOTE_MANAGE)) tabs.push({ key: 'notes', label: 'Ghi chú' })
  if (scope.isCampaignWide) tabs.push({ key: 'posts', label: 'Thông báo' })
  if (chatAllowed(scope.campaign.chatAccess, { isCampaignWide: scope.isCampaignWide, isGroupLead: scope.isGroupLead, isApprovedMember: false }))
    tabs.push({ key: 'chat', label: 'Trò chuyện' })

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900">{scope.campaign.title}</h1>
          <Badge tone={CAMPAIGN_STATUS[scope.campaign.status].tone}>
            {CAMPAIGN_STATUS[scope.campaign.status].label}
          </Badge>
          {!scope.isCampaignWide && (
            <Badge tone="blue">Trưởng nhóm: {scope.leadGroups.map((g) => g.name).join(', ')}</Badge>
          )}
        </div>
        <p className="text-sm text-slate-500">Mã: {scope.campaign.code}</p>
      </div>
      <CampaignTabs campaignId={id} tabs={tabs} />
      <div>{children}</div>
    </div>
  )
}
