'use server'

import { revalidatePath } from 'next/cache'
import type { ChatAccess } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'
import { assertCampaignScope, getCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { chatAllowed } from '@/lib/chat'
import { logAudit } from '@/lib/audit'
import { str } from '@/lib/utils'

/**
 * Trả về { error } thay vì throw (xem ghi chú ở joinCampaign) vì đây là action tự
 * phục vụ — người dùng cần thấy đúng lý do khi không được phép nhắn tin.
 */
export async function sendChatMessage(
  campaignId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  try {
    const user = await assertUser()
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })
    const scope = await getCampaignScope(campaignId)
    const registration = await prisma.registration.findUnique({
      where: { campaignId_userId: { campaignId, userId: user.id } },
      select: { status: true },
    })

    const allowed = chatAllowed(campaign.chatAccess, {
      isCampaignWide: scope?.isCampaignWide ?? false,
      isGroupLead: scope?.isGroupLead ?? false,
      isApprovedMember: registration?.status === 'APPROVED',
    })
    if (!allowed) throw new Error('Bạn không có quyền nhắn tin trong nhóm chat này.')

    const body = str(formData, 'body')
    if (!body) throw new Error('Nội dung không được để trống.')

    await prisma.chatMessage.create({ data: { campaignId, authorId: user.id, body } })

    revalidatePath(`/admin/campaigns/${campaignId}/chat`)
    revalidatePath(`/campaigns/${campaign.slug}`)
    return undefined
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.' }
  }
}

export async function updateChatAccess(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.CAMPAIGN_EDIT)

  const access = str(formData, 'chatAccess') as ChatAccess
  if (!['ADMIN_ONLY', 'ADMIN_AND_LEADS', 'EVERYONE'].includes(access)) {
    throw new Error('Lựa chọn không hợp lệ.')
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { chatAccess: access } })
  await logAudit(scope.user.id, 'campaign.update', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { chatAccess: access },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/settings`)
  revalidatePath(`/admin/campaigns/${campaignId}/chat`)
}
