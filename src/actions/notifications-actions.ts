'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, bool } from '@/lib/utils'
import { notifyMany } from '@/lib/notify'

export async function markNotificationsRead() {
  const user = await assertUser()
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath('/notifications')
}

/** Gửi thông báo/email tuỳ chỉnh tới các thành viên đang được tick chọn trên trang Thành viên. */
export async function sendBulkNotification(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)

  const ids = formData.getAll('registrationIds').map(String).filter(Boolean)
  if (ids.length === 0) throw new Error('Chưa chọn thành viên nào để gửi thông báo.')
  const title = str(formData, 'notifyTitle')
  if (!title) throw new Error('Cần nhập tiêu đề thông báo.')
  const body = str(formData, 'notifyBody')
  const sendEmail = bool(formData, 'notifyEmail')

  const regs = await prisma.registration.findMany({
    where: {
      id: { in: ids },
      campaignId,
      ...(scope.isCampaignWide ? {} : { groupId: { in: scope.leadGroupIds } }),
    },
    include: { user: true },
  })
  if (regs.length === 0) throw new Error('Không có thành viên hợp lệ trong lựa chọn (ngoài phạm vi quản lý của bạn).')

  await notifyMany(
    regs.map((r) => ({
      userId: r.userId,
      type: 'CUSTOM_MESSAGE',
      title,
      body,
      link: `/campaigns/${scope.campaign.slug}`,
      email: sendEmail ? { to: r.user.email, dedupeKey: `custom:${r.id}:${title}:${Date.now()}` } : false,
    })),
  )

  await logAudit(scope.user.id, 'post.create', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { customNotification: true, count: regs.length, title },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
}
