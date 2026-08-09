'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'

export async function markNotificationsRead() {
  const user = await assertUser()
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath('/notifications')
}
