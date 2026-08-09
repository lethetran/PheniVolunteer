'use server'

import { revalidatePath } from 'next/cache'
import type { TaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, num, bool, dateFrom } from '@/lib/utils'
import { notify, notifyMany } from '@/lib/notify'

function taskPaths(campaignId: string) {
  revalidatePath(`/admin/campaigns/${campaignId}/tasks`)
  revalidatePath(`/admin/campaigns/${campaignId}`)
}

export async function createTask(campaignId: string, formData: FormData) {
  const groupId = str(formData, 'groupId') || null
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.TASK_MANAGE, groupId)

  const title = str(formData, 'title')
  if (!title) throw new Error('Tên nhiệm vụ là bắt buộc.')

  const task = await prisma.task.create({
    data: {
      campaignId,
      groupId,
      title,
      description: str(formData, 'description') ?? null,
      dueAt: dateFrom(formData, 'dueAt'),
      required: bool(formData, 'required'),
      requireEvidence: bool(formData, 'requireEvidence'),
      order: num(formData, 'order') ?? 0,
      createdById: scope.user.id,
    },
  })
  await logAudit(scope.user.id, 'task.create', { entityType: 'Task', entityId: task.id })

  const recipients = await prisma.registration.findMany({
    where: { campaignId, status: 'APPROVED', ...(groupId ? { groupId } : {}) },
    select: { userId: true },
  })
  await notifyMany(
    recipients.map((r) => ({
      userId: r.userId,
      type: 'TASK_ASSIGNED',
      title: `Nhiệm vụ mới: ${title}`,
      body: task.dueAt ? `Hạn hoàn thành: ${task.dueAt.toLocaleDateString('vi-VN')}` : undefined,
      link: `/campaigns/${scope.campaign.slug}`,
      email: false,
    })),
  )

  taskPaths(campaignId)
}

/**
 * Chỉ Admin/quản lý toàn sự kiện được sửa hoặc xoá nhiệm vụ (kể cả nhiệm vụ do
 * chính trưởng nhóm tạo) — trưởng nhóm chỉ tạo nhiệm vụ và tích tiến độ, không
 * được đổi nội dung nhiệm vụ sau khi đã giao cho nhóm.
 */
export async function updateTask(taskId: string, formData: FormData) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  const scope = await assertCampaignScope(task.campaignId)
  scope.assert(PERMISSIONS.TASK_MANAGE)

  const title = str(formData, 'title')
  if (!title) throw new Error('Tên nhiệm vụ là bắt buộc.')

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: str(formData, 'description') ?? null,
      dueAt: dateFrom(formData, 'dueAt'),
      required: bool(formData, 'required'),
      requireEvidence: bool(formData, 'requireEvidence'),
      order: num(formData, 'order') ?? task.order,
    },
  })
  await logAudit(scope.user.id, 'task.update', { entityType: 'Task', entityId: taskId })
  taskPaths(task.campaignId)
}

export async function deleteTask(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  const scope = await assertCampaignScope(task.campaignId)
  scope.assert(PERMISSIONS.TASK_MANAGE)
  await prisma.task.delete({ where: { id: taskId } })
  await logAudit(scope.user.id, 'task.delete', { entityType: 'Task', entityId: taskId })
  taskPaths(task.campaignId)
}

/** Tình nguyện viên tự cập nhật tiến độ nhiệm vụ của mình. */
export async function updateTaskProgress(taskId: string, formData: FormData) {
  const user = await assertUser()
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } })
  const registration = await prisma.registration.findUnique({
    where: { campaignId_userId: { campaignId: task.campaignId, userId: user.id } },
  })
  if (!registration || registration.status !== 'APPROVED') {
    throw new Error('Bạn cần được duyệt tham gia sự kiện trước khi cập nhật nhiệm vụ.')
  }
  if (task.groupId && task.groupId !== registration.groupId) {
    throw new Error('Nhiệm vụ này không thuộc nhóm của bạn.')
  }

  const status = str(formData, 'status') as TaskStatus
  const evidenceUrl = str(formData, 'evidenceUrl') ?? null
  if (task.requireEvidence && (status === 'SUBMITTED' || status === 'DONE') && !evidenceUrl) {
    throw new Error('Nhiệm vụ này yêu cầu nộp minh chứng (đường dẫn).')
  }

  await prisma.taskProgress.upsert({
    where: { taskId_userId: { taskId, userId: user.id } },
    update: {
      status,
      evidenceUrl,
      report: str(formData, 'report') ?? null,
      registrationId: registration.id,
      submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
    },
    create: {
      taskId,
      userId: user.id,
      registrationId: registration.id,
      status,
      evidenceUrl,
      report: str(formData, 'report') ?? null,
      submittedAt: status === 'SUBMITTED' ? new Date() : null,
    },
  })

  await logAudit(user.id, 'task.progress', { entityType: 'Task', entityId: taskId, metadata: { status } })
  const campaign = await prisma.campaign.findUnique({ where: { id: task.campaignId }, select: { slug: true } })
  if (campaign) revalidatePath(`/campaigns/${campaign.slug}`)
  taskPaths(task.campaignId)
}

export async function reviewTaskProgress(progressId: string, formData: FormData) {
  const progress = await prisma.taskProgress.findUniqueOrThrow({
    where: { id: progressId },
    include: { task: true, user: true },
  })
  const scope = await assertCampaignScope(progress.task.campaignId)
  scope.assert(PERMISSIONS.TASK_REVIEW, progress.task.groupId)

  const status = str(formData, 'status') as TaskStatus
  await prisma.taskProgress.update({
    where: { id: progressId },
    data: {
      status,
      // Nút tích nhanh không gửi kèm reviewNote — giữ nguyên nhận xét cũ trong trường hợp đó.
      ...(formData.has('reviewNote') ? { reviewNote: str(formData, 'reviewNote') ?? null } : {}),
      completedAt: status === 'DONE' ? new Date() : null,
    },
  })

  await notify({
    userId: progress.userId,
    type: 'TASK_REVIEWED',
    title: `Nhiệm vụ "${progress.task.title}" ${status === 'DONE' ? 'đã được xác nhận hoàn thành' : 'cần xem lại'}`,
    body: str(formData, 'reviewNote'),
    link: `/campaigns/${progress.task.campaignId}`,
    email: false,
  })

  await logAudit(scope.user.id, 'task.review', {
    entityType: 'TaskProgress',
    entityId: progressId,
    metadata: { status },
  })
  taskPaths(progress.task.campaignId)
}
