'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CampaignStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermission, assertRoot } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS, CAMPAIGN_ADMIN_PERMISSIONS, MANAGER_GRANTABLE_PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, num, bool, dateFrom, slugify } from '@/lib/utils'

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || 'su-kien'
  let slug = root
  let i = 1
  while (
    await prisma.campaign.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${root}-${++i}`
  }
  return slug
}

async function uniqueCode(base?: string) {
  const year = new Date().getFullYear()
  const root = base && base.length ? base.toUpperCase() : `TN${year}`
  let code = root
  let i = 1
  while (await prisma.campaign.findUnique({ where: { code }, select: { id: true } })) {
    code = `${root}-${++i}`
  }
  return code
}

function campaignFields(formData: FormData) {
  const title = str(formData, 'title')
  if (!title) throw new Error('Tên sự kiện là bắt buộc.')
  return {
    title,
    summary: str(formData, 'summary') ?? null,
    description: str(formData, 'description') ?? null,
    coverImage: str(formData, 'coverImage') ?? null,
    location: str(formData, 'location') ?? null,
    organizer: str(formData, 'organizer') ?? null,
    startAt: dateFrom(formData, 'startAt'),
    endAt: dateFrom(formData, 'endAt'),
    regOpenAt: dateFrom(formData, 'regOpenAt'),
    regCloseAt: dateFrom(formData, 'regCloseAt'),
    capacity: num(formData, 'capacity') ?? null,
    hoursDefault: num(formData, 'hoursDefault') ?? 0,
    pointsDefault: num(formData, 'pointsDefault') ?? 0,
    requireApproval: bool(formData, 'requireApproval'),
    allowSelfJoin: bool(formData, 'allowSelfJoin'),
  }
}

/**
 * Thêm 1 người làm admin phụ trách sự kiện. Admin không tự động có quyền với sự
 * kiện nào ngoài sự kiện được thêm — và một khi được thêm, họ mặc định luôn là
 * thành viên đã duyệt của sự kiện đó (không cần bấm "Tham gia").
 */
export async function grantCampaignAdmin(campaignId: string, userId: string, permissions: string[]) {
  await prisma.campaignAdmin.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    update: { permissions },
    create: { campaignId, userId, permissions },
  })
  await prisma.registration.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    update: { status: 'APPROVED' },
    create: { campaignId, userId, status: 'APPROVED', decidedAt: new Date() },
  })
}

export async function createCampaign(formData: FormData) {
  const user = await assertPermission(PERMISSIONS.CAMPAIGN_CREATE)
  const fields = campaignFields(formData)
  const slug = await uniqueSlug(fields.title)
  const code = await uniqueCode(str(formData, 'code'))

  const campaign = await prisma.campaign.create({
    data: { ...fields, slug, code, createdById: user.id },
  })

  // Người tạo mặc định là admin toàn quyền của sự kiện này (và chỉ sự kiện này).
  await grantCampaignAdmin(campaign.id, user.id, CAMPAIGN_ADMIN_PERMISSIONS)

  const coAdminIds = formData.getAll('coAdminIds').map(String).filter((id) => id && id !== user.id)
  for (const id of coAdminIds) {
    await grantCampaignAdmin(campaign.id, id, MANAGER_GRANTABLE_PERMISSIONS)
  }

  await logAudit(user.id, 'campaign.create', { entityType: 'Campaign', entityId: campaign.id })
  revalidatePath('/admin/campaigns')
  redirect(`/admin/campaigns/${campaign.id}`)
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.CAMPAIGN_EDIT)
  const fields = campaignFields(formData)
  const slug = await uniqueSlug(fields.title, campaignId)

  await prisma.campaign.update({ where: { id: campaignId }, data: { ...fields, slug } })
  await logAudit(scope.user.id, 'campaign.update', { entityType: 'Campaign', entityId: campaignId })
  revalidatePath(`/admin/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${slug}`)
}

export async function updateCampaignStatus(campaignId: string, status: CampaignStatus) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.CAMPAIGN_PUBLISH)
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } })
  await logAudit(scope.user.id, 'campaign.status', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { status },
  })
  revalidatePath(`/admin/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${scope.campaign.slug}`)
}

/**
 * Xoá vĩnh viễn — xoá cascade toàn bộ đăng ký, giờ/điểm đã ghi, nhiệm vụ, ghi chú,
 * chat... của sự kiện. Chỉ Root Admin được phép, và phải gõ đúng tên sự kiện để
 * xác nhận (kiểm tra lại ở server, không chỉ dựa vào việc khoá nút ở client).
 * Với hầu hết trường hợp nên dùng "Lưu trữ" (đổi trạng thái ARCHIVED) thay vì xoá.
 */
export async function deleteCampaign(campaignId: string, formData: FormData) {
  const user = await assertRoot()
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { title: true } })
  const confirmTitle = str(formData, 'confirmTitle')
  if (confirmTitle !== campaign.title) {
    throw new Error('Tên sự kiện xác nhận không khớp — huỷ thao tác xoá.')
  }

  await prisma.campaign.delete({ where: { id: campaignId } })
  await logAudit(user.id, 'campaign.delete', { entityType: 'Campaign', entityId: campaignId })
  revalidatePath('/admin/campaigns')
  redirect('/admin/campaigns')
}
