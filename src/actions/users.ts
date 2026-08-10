'use server'

import { revalidatePath } from 'next/cache'
import type { Role, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertRoot } from '@/lib/session'
import { isAllowedEmail, provisionUserByEmail } from '@/lib/auth'
import { GLOBAL_GRANTABLE_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS, type Permission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str } from '@/lib/utils'
import { notify } from '@/lib/notify'

const GRANTABLE = new Set<Permission>(GLOBAL_GRANTABLE_PERMISSIONS)

export async function createAdmin(formData: FormData) {
  const actor = await assertRoot()
  const email = str(formData, 'email')?.toLowerCase()
  if (!email) throw new Error('Nhập email cần cấp quyền admin.')
  if (!isAllowedEmail(email)) throw new Error('Email phải thuộc domain của trường.')

  // Đảm bảo tài khoản tồn tại (tạo sẵn nếu người này chưa từng đăng nhập), rồi nâng quyền.
  await provisionUserByEmail(email)
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', permissions: DEFAULT_ADMIN_PERMISSIONS, status: 'ACTIVE' },
  })

  await notify({
    userId: user.id,
    type: 'ADMIN_GRANTED',
    title: 'Bạn được cấp quyền Admin',
    body: 'Tài khoản của bạn vừa được nâng cấp thành Admin trong hệ thống quản lý tình nguyện viên.',
    link: '/admin',
    email: { to: user.email },
  })

  await logAudit(actor.id, 'user.role', { entityType: 'User', entityId: user.id, metadata: { role: 'ADMIN' } })
  revalidatePath('/admin/users')
}

export async function setUserRole(userId: string, formData: FormData) {
  const actor = await assertRoot()
  const role = str(formData, 'role') as Role
  if (userId === actor.id && role !== 'ROOT_ADMIN') {
    throw new Error('Bạn không thể tự hạ quyền của chính mình.')
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role, ...(role === 'VOLUNTEER' ? { permissions: [] } : {}) },
  })
  await logAudit(actor.id, 'user.role', { entityType: 'User', entityId: userId, metadata: { role } })
  revalidatePath('/admin/users')
}

export async function setUserPermissions(userId: string, formData: FormData) {
  const actor = await assertRoot()
  const permissions = formData
    .getAll('permissions')
    .map(String)
    .filter((p): p is Permission => GRANTABLE.has(p as Permission))

  await prisma.user.update({ where: { id: userId }, data: { permissions } })
  await logAudit(actor.id, 'user.permissions', {
    entityType: 'User',
    entityId: userId,
    metadata: { permissions },
  })
  revalidatePath('/admin/users')
}

export async function setUserStatus(userId: string, status: UserStatus) {
  const actor = await assertRoot()
  if (userId === actor.id) throw new Error('Bạn không thể tự khoá tài khoản của mình.')
  await prisma.user.update({ where: { id: userId }, data: { status } })
  await logAudit(actor.id, 'user.status', { entityType: 'User', entityId: userId, metadata: { status } })
  revalidatePath('/admin/users')
  revalidatePath('/admin/volunteers')
}
