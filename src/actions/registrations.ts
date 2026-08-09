'use server'

import { revalidatePath } from 'next/cache'
import type { AttendanceStatus, RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, num, bool, dateFrom } from '@/lib/utils'
import { collectFieldData, readData, toJson } from '@/lib/fields'
import { notify, notifyMany } from '@/lib/notify'
import { REGISTRATION_STATUS } from '@/lib/labels'

function memberPaths(campaignId: string, slug: string) {
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${slug}`)
  revalidatePath('/dashboard')
}

/**
 * Next.js ẩn message gốc của lỗi throw ra từ Server Action trong bản production
 * (chỉ còn digest chung chung) — nên hai action tự phục vụ này bắt lỗi và trả về
 * { error } thay vì throw, để form phía client (dùng ActionForm/useActionState)
 * hiển thị đúng lý do thất bại cho người dùng.
 */
export async function joinCampaign(
  campaignId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  try {
    const user = await assertUser()
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } })

    if (!campaign.allowSelfJoin) throw new Error('Sự kiện này không nhận đăng ký trực tiếp.')
    if (campaign.status !== 'OPEN') throw new Error('Sự kiện hiện không mở đăng ký.')
    const now = new Date()
    if (campaign.regOpenAt && now < campaign.regOpenAt) throw new Error('Chưa tới thời gian mở đăng ký.')
    if (campaign.regCloseAt && now > campaign.regCloseAt) throw new Error('Đã hết hạn đăng ký.')

    const existing = await prisma.registration.findUnique({
      where: { campaignId_userId: { campaignId, userId: user.id } },
    })
    if (existing && existing.status !== 'CANCELLED' && existing.status !== 'REJECTED') {
      throw new Error('Bạn đã đăng ký sự kiện này rồi.')
    }

    const fieldDefs = await prisma.fieldDefinition.findMany({
      where: { scope: 'REGISTRATION_FORM', campaignId, archived: false },
    })
    const { data, errors } = collectFieldData(fieldDefs, formData)
    if (errors.length) throw new Error(errors.join(' '))

    let status: RegistrationStatus = campaign.requireApproval ? 'PENDING' : 'APPROVED'
    if (campaign.capacity) {
      const approvedCount = await prisma.registration.count({
        where: { campaignId, status: 'APPROVED' },
      })
      if (approvedCount >= campaign.capacity) status = 'WAITLIST'
    }

    const registration = await prisma.registration.upsert({
      where: { campaignId_userId: { campaignId, userId: user.id } },
      update: {
        status,
        formData: toJson(data),
        motivation: str(formData, 'motivation') ?? null,
        appliedAt: new Date(),
        decidedAt: null,
        decidedById: null,
        rejectReason: null,
      },
      create: {
        campaignId,
        userId: user.id,
        status,
        formData: toJson(data),
        motivation: str(formData, 'motivation') ?? null,
      },
    })

    await logAudit(user.id, 'registration.apply', {
      entityType: 'Registration',
      entityId: registration.id,
      metadata: { campaignId, status },
    })

    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'ROOT_ADMIN' },
          { campaignAdmins: { some: { campaignId } } },
          { createdCampaigns: { some: { id: campaignId } } },
        ],
      },
      select: { id: true },
    })
    await notifyMany(
      admins.map((a) => ({
        userId: a.id,
        type: 'REGISTRATION_NEW',
        title: `Đơn đăng ký mới: ${user.name ?? user.email}`,
        body: `Sự kiện "${campaign.title}" vừa có người đăng ký tham gia.`,
        link: `/admin/campaigns/${campaignId}/members`,
        email: false,
      })),
    )

    if (status !== 'PENDING') {
      await notify({
        userId: user.id,
        type: 'REGISTRATION_CONFIRMED',
        title: status === 'WAITLIST' ? `Bạn đang trong danh sách chờ: ${campaign.title}` : `Đăng ký thành công: ${campaign.title}`,
        link: `/campaigns/${campaign.slug}`,
        email: { to: user.email },
      })
    }

    memberPaths(campaignId, campaign.slug)
    return undefined
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.' }
  }
}

export async function cancelRegistration(
  registrationId: string,
  _prevState: { error?: string } | undefined,
): Promise<{ error?: string } | undefined> {
  try {
    const user = await assertUser()
    const registration = await prisma.registration.findUniqueOrThrow({
      where: { id: registrationId },
      include: { campaign: true },
    })
    if (registration.userId !== user.id) throw new Error('Bạn không thể huỷ đăng ký của người khác.')
    if (!['PENDING', 'APPROVED', 'WAITLIST'].includes(registration.status)) {
      throw new Error('Không thể huỷ đăng ký ở trạng thái hiện tại.')
    }

    await prisma.registration.update({ where: { id: registrationId }, data: { status: 'CANCELLED' } })
    await logAudit(user.id, 'registration.cancel', { entityType: 'Registration', entityId: registrationId })
    memberPaths(registration.campaignId, registration.campaign.slug)
    return undefined
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.' }
  }
}

export async function decideRegistration(registrationId: string, formData: FormData) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { campaign: true, user: true },
  })
  const scope = await assertCampaignScope(registration.campaignId)
  scope.assert(PERMISSIONS.REGISTRATION_REVIEW, registration.groupId)

  const decision = str(formData, 'decision') as RegistrationStatus
  if (!['APPROVED', 'REJECTED', 'WAITLIST'].includes(decision)) throw new Error('Quyết định không hợp lệ.')
  const rejectReason = str(formData, 'rejectReason') ?? null

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: decision,
      decidedAt: new Date(),
      decidedById: scope.user.id,
      rejectReason: decision === 'REJECTED' ? rejectReason : null,
    },
  })

  await logAudit(scope.user.id, 'registration.decide', {
    entityType: 'Registration',
    entityId: registrationId,
    metadata: { decision },
  })

  await notify({
    userId: registration.userId,
    type: 'REGISTRATION_DECIDED',
    title: `${REGISTRATION_STATUS[decision].label}: ${registration.campaign.title}`,
    body: decision === 'REJECTED' && rejectReason ? `Lý do: ${rejectReason}` : undefined,
    link: `/campaigns/${registration.campaign.slug}`,
    email: { to: registration.user.email, dedupeKey: `reg-decide:${registrationId}:${decision}` },
  })

  memberPaths(registration.campaignId, registration.campaign.slug)
}

export async function updateRegistrationGroup(registrationId: string, formData: FormData) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { campaign: true },
  })
  const scope = await assertCampaignScope(registration.campaignId)
  scope.assert(PERMISSIONS.MEMBER_MANAGE)

  const groupId = str(formData, 'groupId') || null
  await prisma.registration.update({ where: { id: registrationId }, data: { groupId } })
  await logAudit(scope.user.id, 'registration.group', {
    entityType: 'Registration',
    entityId: registrationId,
    metadata: { groupId },
  })
  memberPaths(registration.campaignId, registration.campaign.slug)
}

/** Chọn nhiều thành viên từ danh sách có sẵn (tick chọn) rồi xếp cùng lúc vào 1 nhóm. */
export async function bulkAssignGroup(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.MEMBER_MANAGE)

  const groupId = str(formData, 'groupId') || null
  const ids = formData.getAll('registrationIds').map(String).filter(Boolean)
  if (ids.length === 0) throw new Error('Chưa chọn thành viên nào.')

  const { count } = await prisma.registration.updateMany({
    where: { id: { in: ids }, campaignId },
    data: { groupId },
  })

  await logAudit(scope.user.id, 'registration.group', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { bulk: true, count, groupId },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
}

export async function updateTracking(registrationId: string, formData: FormData) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { campaign: true },
  })
  const scope = await assertCampaignScope(registration.campaignId)
  scope.assert(PERMISSIONS.MEMBER_MANAGE, registration.groupId)

  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { scope: 'MEMBER_TRACKING', campaignId: registration.campaignId, archived: false },
  })
  const { data, errors } = collectFieldData(fieldDefs, formData)
  if (errors.length) throw new Error(errors.join(' '))

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      trackingData: toJson({ ...readData(registration.trackingData), ...data }),
      note: str(formData, 'note') ?? registration.note,
    },
  })
  await logAudit(scope.user.id, 'registration.update', {
    entityType: 'Registration',
    entityId: registrationId,
  })
  memberPaths(registration.campaignId, registration.campaign.slug)
}

export async function updateAttendance(registrationId: string, formData: FormData) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { campaign: true },
  })
  const scope = await assertCampaignScope(registration.campaignId)
  scope.assert(PERMISSIONS.ATTENDANCE_MANAGE, registration.groupId)

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      attendance: (str(formData, 'attendance') ?? registration.attendance) as AttendanceStatus,
      checkInAt: dateFrom(formData, 'checkInAt'),
      checkOutAt: dateFrom(formData, 'checkOutAt'),
      hoursAwarded: num(formData, 'hoursAwarded') ?? registration.hoursAwarded,
      pointsAwarded: num(formData, 'pointsAwarded') ?? registration.pointsAwarded,
      completed: bool(formData, 'completed'),
    },
  })
  await logAudit(scope.user.id, 'attendance.update', {
    entityType: 'Registration',
    entityId: registrationId,
  })
  memberPaths(registration.campaignId, registration.campaign.slug)
}

export async function removeMember(registrationId: string) {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { campaign: true },
  })
  const scope = await assertCampaignScope(registration.campaignId)
  scope.assert(PERMISSIONS.MEMBER_MANAGE, registration.groupId)

  await prisma.registration.update({ where: { id: registrationId }, data: { status: 'REMOVED' } })
  await logAudit(scope.user.id, 'registration.update', {
    entityType: 'Registration',
    entityId: registrationId,
    metadata: { action: 'remove' },
  })
  memberPaths(registration.campaignId, registration.campaign.slug)
}
