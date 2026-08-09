'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS, MANAGER_GRANTABLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, num } from '@/lib/utils'
import { notify } from '@/lib/notify'

function groupPath(campaignId: string) {
  revalidatePath(`/admin/campaigns/${campaignId}/groups`)
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
}

export async function createGroup(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.GROUP_MANAGE)
  const name = str(formData, 'name')
  if (!name) throw new Error('Tên nhóm là bắt buộc.')

  const group = await prisma.campaignGroup.create({
    data: {
      campaignId,
      name,
      description: str(formData, 'description') ?? null,
      quota: num(formData, 'quota') ?? null,
      meetingPoint: str(formData, 'meetingPoint') ?? null,
      shift: str(formData, 'shift') ?? null,
      order: num(formData, 'order') ?? 0,
    },
  })
  await logAudit(scope.user.id, 'group.create', {
    entityType: 'CampaignGroup',
    entityId: group.id,
    metadata: { campaignId },
  })
  groupPath(campaignId)
}

export async function updateGroup(groupId: string, formData: FormData) {
  const group = await prisma.campaignGroup.findUniqueOrThrow({ where: { id: groupId } })
  const scope = await assertCampaignScope(group.campaignId)
  scope.assert(PERMISSIONS.GROUP_MANAGE, groupId)
  const name = str(formData, 'name')
  if (!name) throw new Error('Tên nhóm là bắt buộc.')

  await prisma.campaignGroup.update({
    where: { id: groupId },
    data: {
      name,
      description: str(formData, 'description') ?? null,
      quota: num(formData, 'quota') ?? null,
      meetingPoint: str(formData, 'meetingPoint') ?? null,
      shift: str(formData, 'shift') ?? null,
      order: num(formData, 'order') ?? 0,
    },
  })
  await logAudit(scope.user.id, 'group.update', { entityType: 'CampaignGroup', entityId: groupId })
  groupPath(group.campaignId)
}

export async function deleteGroup(groupId: string) {
  const group = await prisma.campaignGroup.findUniqueOrThrow({ where: { id: groupId } })
  const scope = await assertCampaignScope(group.campaignId)
  scope.assert(PERMISSIONS.GROUP_MANAGE)
  await prisma.campaignGroup.delete({ where: { id: groupId } })
  await logAudit(scope.user.id, 'group.delete', { entityType: 'CampaignGroup', entityId: groupId })
  groupPath(group.campaignId)
}

const ASSIGNABLE = new Set<Permission>(MANAGER_GRANTABLE_PERMISSIONS)

export async function assignGroupLeader(groupId: string, formData: FormData) {
  const group = await prisma.campaignGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: { campaign: { select: { id: true, title: true, slug: true } } },
  })
  const scope = await assertCampaignScope(group.campaignId)
  scope.assert(PERMISSIONS.MANAGER_ASSIGN)

  const email = str(formData, 'email')?.toLowerCase()
  if (!email) throw new Error('Nhập email của người được cử làm trưởng nhóm.')
  const target = await prisma.user.findUnique({ where: { email } })
  if (!target) throw new Error('Không tìm thấy tài khoản với email này. Người dùng cần đăng nhập hệ thống ít nhất 1 lần.')

  const permissions = formData
    .getAll('permissions')
    .map(String)
    .filter((p): p is Permission => ASSIGNABLE.has(p as Permission))

  await prisma.groupAssignment.upsert({
    where: { groupId_userId: { groupId, userId: target.id } },
    update: { permissions, title: str(formData, 'title') ?? null },
    create: { groupId, userId: target.id, permissions, title: str(formData, 'title') ?? null },
  })

  if (target.role === 'VOLUNTEER') {
    await prisma.user.update({ where: { id: target.id }, data: { role: 'MANAGER' } })
  }

  await notify({
    userId: target.id,
    type: 'GROUP_LEADER_ASSIGNED',
    title: `Bạn được cử phụ trách nhóm "${group.name}"`,
    body: `Trong sự kiện "${group.campaign.title}", bạn vừa được cấp quyền quản lý nhóm "${group.name}".`,
    link: `/admin/campaigns/${group.campaign.id}/members`,
    email: { to: target.email, dedupeKey: `group-lead:${groupId}:${target.id}:${Date.now()}` },
  })

  await logAudit(scope.user.id, 'group.leader.assign', {
    entityType: 'CampaignGroup',
    entityId: groupId,
    metadata: { userId: target.id, permissions },
  })
  groupPath(group.campaignId)
}

export async function removeGroupLeader(groupId: string, userId: string) {
  const group = await prisma.campaignGroup.findUniqueOrThrow({ where: { id: groupId } })
  const scope = await assertCampaignScope(group.campaignId)
  scope.assert(PERMISSIONS.MANAGER_ASSIGN)
  await prisma.groupAssignment.delete({ where: { groupId_userId: { groupId, userId } } })
  await logAudit(scope.user.id, 'group.leader.remove', {
    entityType: 'CampaignGroup',
    entityId: groupId,
    metadata: { userId },
  })
  groupPath(group.campaignId)
}

export async function assignCampaignAdmin(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.MANAGER_ASSIGN)

  const email = str(formData, 'email')?.toLowerCase()
  if (!email) throw new Error('Nhập email của người được cử làm quản lý sự kiện.')
  const target = await prisma.user.findUnique({ where: { email } })
  if (!target) throw new Error('Không tìm thấy tài khoản với email này. Người dùng cần đăng nhập hệ thống ít nhất 1 lần.')

  const permissions = formData
    .getAll('permissions')
    .map(String)
    .filter((p): p is Permission => ASSIGNABLE.has(p as Permission))

  await prisma.campaignAdmin.upsert({
    where: { campaignId_userId: { campaignId, userId: target.id } },
    update: { permissions },
    create: { campaignId, userId: target.id, permissions },
  })
  if (target.role === 'VOLUNTEER') {
    await prisma.user.update({ where: { id: target.id }, data: { role: 'MANAGER' } })
  }
  await notify({
    userId: target.id,
    type: 'CAMPAIGN_ADMIN_ASSIGNED',
    title: `Bạn được cử phụ trách sự kiện "${scope.campaign.title}"`,
    link: `/admin/campaigns/${campaignId}`,
    email: { to: target.email, dedupeKey: `campaign-admin:${campaignId}:${target.id}:${Date.now()}` },
  })
  await logAudit(scope.user.id, 'campaignAdmin.assign', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { userId: target.id, permissions },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/settings`)
}

export async function removeCampaignAdmin(campaignId: string, userId: string) {
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.MANAGER_ASSIGN)
  await prisma.campaignAdmin.delete({ where: { campaignId_userId: { campaignId, userId } } })
  await logAudit(scope.user.id, 'campaignAdmin.remove', {
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { userId },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/settings`)
}
