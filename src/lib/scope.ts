import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Campaign } from '@prisma/client'
import { prisma } from './prisma'
import { getCurrentUser, type CurrentUser } from './session'
import { PERMISSIONS, type Permission } from './permissions'

/**
 * Phạm vi quyền của một người dùng bên trong MỘT sự kiện.
 *
 * Ba nguồn quyền được cộng dồn:
 *   1. User.permissions            -> toàn hệ thống, áp dụng cho mọi sự kiện
 *   2. CampaignAdmin.permissions   -> toàn bộ sự kiện này
 *   3. GroupAssignment.permissions -> CHỈ trong nhóm được giao
 *
 * Root Admin luôn có tất cả.
 */
export class CampaignScope {
  constructor(
    readonly user: CurrentUser,
    readonly campaign: Campaign,
    private readonly globalPerms: Set<string>,
    private readonly campaignPerms: Set<string>,
    private readonly groupPerms: Map<string, Set<string>>,
    readonly leadGroups: { id: string; name: string }[],
    readonly registrationId: string | null,
  ) {}

  get isRoot() {
    return this.user.role === 'ROOT_ADMIN'
  }

  /** Người này làm việc trên toàn sự kiện (admin), hay chỉ trong nhóm của mình (lead)? */
  get isCampaignWide() {
    return this.isRoot || this.globalPerms.size > 0 || this.campaignPerms.size > 0
  }

  get isGroupLead() {
    return this.groupPerms.size > 0
  }

  /** Có được vào khu quản trị của sự kiện này không. */
  get isStaff() {
    return this.isCampaignWide || this.isGroupLead
  }

  get leadGroupIds() {
    return this.leadGroups.map((g) => g.id)
  }

  /**
   * @param groupId nhóm đang thao tác. Bỏ trống = thao tác cấp sự kiện
   *                (chỉ admin/campaign-admin được phép).
   */
  can(permission: Permission, groupId?: string | null): boolean {
    if (this.isRoot) return true
    if (this.globalPerms.has(permission)) return true
    if (this.campaignPerms.has(permission)) return true
    if (groupId) return this.groupPerms.get(groupId)?.has(permission) ?? false
    return false
  }

  /** Có quyền này ở cấp sự kiện hoặc ở ít nhất một nhóm. */
  canAnywhere(permission: Permission): boolean {
    if (this.can(permission)) return true
    for (const perms of this.groupPerms.values()) if (perms.has(permission)) return true
    return false
  }

  /** Danh sách nhóm người này được xem. `null` = xem tất cả. */
  get visibleGroupIds(): string[] | null {
    if (this.isCampaignWide) return null
    return this.leadGroupIds
  }

  /** Điều kiện Prisma lọc thành viên theo phạm vi. */
  get registrationWhere() {
    const ids = this.visibleGroupIds
    if (ids === null) return { campaignId: this.campaign.id }
    return { campaignId: this.campaign.id, groupId: { in: ids } }
  }

  assert(permission: Permission, groupId?: string | null) {
    if (!this.can(permission, groupId)) {
      throw new Error('Bạn không có quyền thực hiện thao tác này trong sự kiện.')
    }
  }
}

async function buildScope(campaign: Campaign, user: CurrentUser) {
  const [campaignAdmin, assignments, registration] = await Promise.all([
    prisma.campaignAdmin.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
      select: { permissions: true },
    }),
    prisma.groupAssignment.findMany({
      where: { userId: user.id, group: { campaignId: campaign.id } },
      select: { permissions: true, group: { select: { id: true, name: true } } },
    }),
    prisma.registration.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
      select: { id: true },
    }),
  ])

  const globalPerms = new Set<string>(user.role === 'ROOT_ADMIN' ? [] : user.permissions)
  const campaignPerms = new Set<string>(campaignAdmin?.permissions ?? [])
  const groupPerms = new Map<string, Set<string>>()
  for (const a of assignments) groupPerms.set(a.group.id, new Set(a.permissions))

  return new CampaignScope(
    user,
    campaign,
    globalPerms,
    campaignPerms,
    groupPerms,
    assignments.map((a) => a.group),
    registration?.id ?? null,
  )
}

/** Lấy phạm vi theo id hoặc slug sự kiện. Trả về null nếu không tìm thấy / chưa đăng nhập. */
export const getCampaignScope = cache(async (idOrSlug: string): Promise<CampaignScope | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }, { code: idOrSlug }] },
  })
  if (!campaign) return null
  return buildScope(campaign, user)
})

/** Dùng trong page quản trị: bắt buộc đăng nhập + có vai trò trong sự kiện. */
export async function requireCampaignScope(idOrSlug: string): Promise<CampaignScope> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const scope = await getCampaignScope(idOrSlug)
  if (!scope) notFound()
  if (!scope.isStaff) redirect('/403')
  return scope
}

/** Dùng trong server action: ném lỗi thay vì redirect. */
export async function assertCampaignScope(idOrSlug: string): Promise<CampaignScope> {
  const scope = await getCampaignScope(idOrSlug)
  if (!scope) throw new Error('Không tìm thấy sự kiện hoặc bạn chưa đăng nhập.')
  if (!scope.isStaff) throw new Error('Bạn không phụ trách sự kiện này.')
  return scope
}

/**
 * Các sự kiện mà người dùng có vai trò quản trị (admin toàn hệ thống thấy tất cả).
 */
export async function listManagedCampaigns(user: CurrentUser) {
  if (user.role === 'ROOT_ADMIN' || user.permissions.length > 0) {
    return prisma.campaign.findMany({ orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }] })
  }
  return prisma.campaign.findMany({
    where: {
      OR: [
        { admins: { some: { userId: user.id } } },
        { groups: { some: { assignments: { some: { userId: user.id } } } } },
      ],
    },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
  })
}

/** Người dùng có thấy khu quản trị không (kể cả trưởng nhóm). */
export async function hasAnyStaffRole(user: CurrentUser) {
  if (user.role === 'ROOT_ADMIN' || user.permissions.length > 0) return true
  const [a, g] = await Promise.all([
    prisma.campaignAdmin.count({ where: { userId: user.id } }),
    prisma.groupAssignment.count({ where: { userId: user.id } }),
  ])
  return a + g > 0
}

export { PERMISSIONS }
