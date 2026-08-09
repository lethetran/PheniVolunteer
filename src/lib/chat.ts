import type { ChatAccess } from '@prisma/client'

export const CHAT_ACCESS_LABELS: Record<ChatAccess, string> = {
  ADMIN_ONLY: 'Chỉ admin phụ trách sự kiện',
  ADMIN_AND_LEADS: 'Admin và trưởng nhóm',
  EVERYONE: 'Toàn bộ tình nguyện viên đã duyệt',
}

/** Người này có được đọc/nhắn trong nhóm chat chung của sự kiện không. */
export function chatAllowed(
  access: ChatAccess,
  ctx: { isCampaignWide: boolean; isGroupLead: boolean; isApprovedMember: boolean },
): boolean {
  if (ctx.isCampaignWide) return true
  if (access === 'ADMIN_ONLY') return false
  if (ctx.isGroupLead) return true
  if (access === 'ADMIN_AND_LEADS') return false
  return ctx.isApprovedMember
}
