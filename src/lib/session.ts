import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { Role, User } from '@prisma/client'
import { auth } from './auth'
import { prisma } from './prisma'
import {
  PERMISSIONS,
  type Permission,
  canAccessAdminArea,
  hasGlobalPermission,
} from './permissions'

export type CurrentUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'image'
  | 'role'
  | 'status'
  | 'permissions'
  | 'studentCode'
  | 'phone'
  | 'faculty'
  | 'className'
>

/**
 * Người dùng hiện tại, đọc trực tiếp từ DB nên quyền vừa bị thay đổi là có
 * hiệu lực ngay (không phải chờ token hết hạn). `cache` gộp các lần gọi trong
 * cùng một request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      status: true,
      permissions: true,
      studentCode: true,
      phone: true,
      faculty: true,
      className: true,
    },
  })
  if (!user || user.status === 'LOCKED') return null
  return user
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) redirect('/403')
  return user
}

export async function requireAdminArea(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canAccessAdminArea(user)) redirect('/403')
  return user
}

/** Chặn cứng theo quyền toàn hệ thống (dùng cho trang admin). */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser()
  if (!hasGlobalPermission(user, permission)) redirect('/403')
  return user
}

export async function requireRoot(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== 'ROOT_ADMIN') redirect('/403')
  return user
}

/** Dùng trong server action: ném lỗi thay vì redirect. */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Bạn cần đăng nhập lại.')
  return user
}

export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await assertUser()
  if (!hasGlobalPermission(user, permission)) {
    throw new Error('Bạn không có quyền thực hiện việc này.')
  }
  return user
}

export async function assertRoot(): Promise<CurrentUser> {
  const user = await assertUser()
  if (user.role !== 'ROOT_ADMIN') throw new Error('Chỉ Root Admin được phép.')
  return user
}

export { PERMISSIONS }
