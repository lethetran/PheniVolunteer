'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertUser } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { str, dateFrom } from '@/lib/utils'
import { collectFieldData, readData, toJson } from '@/lib/fields'

export async function updateProfile(formData: FormData) {
  const user = await assertUser()

  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { scope: 'VOLUNTEER_PROFILE', archived: false },
    orderBy: { order: 'asc' },
  })
  const { data, errors } = collectFieldData(fieldDefs.filter((f) => f.editableByVolunteer), formData)
  if (errors.length) throw new Error(errors.join(' '))

  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { profileData: true },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: str(formData, 'name'),
      phone: str(formData, 'phone'),
      faculty: str(formData, 'faculty'),
      className: str(formData, 'className'),
      dob: dateFrom(formData, 'dob'),
      gender: str(formData, 'gender'),
      address: str(formData, 'address'),
      bio: str(formData, 'bio'),
      studentCode: str(formData, 'studentCode'),
      profileData: toJson({ ...readData(existing.profileData), ...data }),
    },
  })

  await logAudit(user.id, 'profile.update', { entityType: 'User', entityId: user.id })
  revalidatePath('/me')
}
