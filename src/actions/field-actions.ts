'use server'

import { revalidatePath } from 'next/cache'
import type { FieldScope, FieldType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermission } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, num, bool, csvList, toKey } from '@/lib/utils'

async function guard(scope: FieldScope, campaignId?: string | null) {
  if (scope === 'VOLUNTEER_PROFILE') {
    const user = await assertPermission(PERMISSIONS.FIELD_MANAGE)
    return { userId: user.id }
  }
  if (!campaignId) throw new Error('Thiếu sự kiện.')
  const campaignScope = await assertCampaignScope(campaignId)
  campaignScope.assert(PERMISSIONS.FIELD_MANAGE)
  return { userId: campaignScope.user.id }
}

function fieldsPath(scope: FieldScope, campaignId?: string | null) {
  if (scope === 'VOLUNTEER_PROFILE') {
    revalidatePath('/admin/volunteers')
    revalidatePath('/me')
    return
  }
  if (!campaignId) return
  revalidatePath(`/admin/campaigns/${campaignId}/form`)
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
  revalidatePath(`/campaigns/${campaignId}`)
}

export async function createField(formData: FormData) {
  const scope = str(formData, 'scope') as FieldScope
  const campaignId = str(formData, 'campaignId') ?? null
  const { userId } = await guard(scope, campaignId)

  const label = str(formData, 'label')
  if (!label) throw new Error('Tên cột là bắt buộc.')
  const type = (str(formData, 'type') ?? 'TEXT') as FieldType
  const key = toKey(str(formData, 'key') ?? label)

  const existing = await prisma.fieldDefinition.findFirst({
    where: { scope, campaignId, key },
  })
  if (existing) throw new Error(`Cột với khoá "${key}" đã tồn tại.`)

  const count = await prisma.fieldDefinition.count({ where: { scope, campaignId } })

  const field = await prisma.fieldDefinition.create({
    data: {
      scope,
      campaignId,
      key,
      label,
      type,
      options: csvList(str(formData, 'options')),
      placeholder: str(formData, 'placeholder') ?? null,
      helpText: str(formData, 'helpText') ?? null,
      required: bool(formData, 'required'),
      order: num(formData, 'order') ?? count,
      visibleToVolunteer: bool(formData, 'visibleToVolunteer'),
      editableByVolunteer: bool(formData, 'editableByVolunteer'),
      createdById: userId,
    },
  })

  await logAudit(userId, 'field.create', { entityType: 'FieldDefinition', entityId: field.id })
  fieldsPath(scope, campaignId)
}

export async function updateField(fieldId: string, formData: FormData) {
  const def = await prisma.fieldDefinition.findUniqueOrThrow({ where: { id: fieldId } })
  const { userId } = await guard(def.scope, def.campaignId)

  const label = str(formData, 'label')
  if (!label) throw new Error('Tên cột là bắt buộc.')

  await prisma.fieldDefinition.update({
    where: { id: fieldId },
    data: {
      label,
      type: (str(formData, 'type') ?? def.type) as FieldType,
      options: csvList(str(formData, 'options')),
      placeholder: str(formData, 'placeholder') ?? null,
      helpText: str(formData, 'helpText') ?? null,
      required: bool(formData, 'required'),
      order: num(formData, 'order') ?? def.order,
      visibleToVolunteer: bool(formData, 'visibleToVolunteer'),
      editableByVolunteer: bool(formData, 'editableByVolunteer'),
    },
  })

  await logAudit(userId, 'field.update', { entityType: 'FieldDefinition', entityId: fieldId })
  fieldsPath(def.scope, def.campaignId)
}

export async function toggleFieldArchived(fieldId: string) {
  const def = await prisma.fieldDefinition.findUniqueOrThrow({ where: { id: fieldId } })
  const { userId } = await guard(def.scope, def.campaignId)
  await prisma.fieldDefinition.update({
    where: { id: fieldId },
    data: { archived: !def.archived },
  })
  await logAudit(userId, def.archived ? 'field.update' : 'field.delete', {
    entityType: 'FieldDefinition',
    entityId: fieldId,
  })
  fieldsPath(def.scope, def.campaignId)
}
