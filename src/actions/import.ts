'use server'

import { revalidatePath } from 'next/cache'
import type { FieldDefinition } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermission } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { isAllowedEmail } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseSheet, pick, type SheetRow } from '@/lib/excel'
import { coerceImported, toJson } from '@/lib/fields'

type RowError = { row: number; email: string; message: string }

export async function importVolunteers(formData: FormData) {
  const actor = await assertPermission(PERMISSIONS.VOLUNTEER_IMPORT)
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('Chọn file Excel để nhập.')

  const { rows } = parseSheet(await file.arrayBuffer())
  if (rows.length === 0) throw new Error('File không có dữ liệu.')

  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { scope: 'VOLUNTEER_PROFILE', archived: false },
  })

  const job = await prisma.importJob.create({
    data: { kind: 'VOLUNTEERS', fileName: file.name, uploadedById: actor.id, totalRows: rows.length },
  })

  let created = 0
  let updated = 0
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = pick(row, 'Email', 'email', 'Email sinh viên').toLowerCase()
    try {
      if (!email) throw new Error('Thiếu email.')
      if (!isAllowedEmail(email)) throw new Error('Email không thuộc domain của trường.')

      const profileData = buildDynamicData(row, fieldDefs)
      const name = pick(row, 'Họ tên', 'Họ và tên', 'Tên', 'Name')
      const studentCode = pick(row, 'Mã sinh viên', 'MSSV', 'Student code')
      const phone = pick(row, 'Số điện thoại', 'SĐT', 'Phone')
      const faculty = pick(row, 'Khoa', 'Viện', 'Faculty')
      const className = pick(row, 'Lớp', 'Class')

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, profileData: true } })
      await prisma.user.upsert({
        where: { email },
        update: {
          ...(name ? { name } : {}),
          ...(studentCode ? { studentCode } : {}),
          ...(phone ? { phone } : {}),
          ...(faculty ? { faculty } : {}),
          ...(className ? { className } : {}),
          profileData: toJson({ ...(existing?.profileData as object), ...profileData }),
        },
        create: {
          email,
          name: name || email.split('@')[0],
          studentCode: studentCode || null,
          phone: phone || null,
          faculty: faculty || null,
          className: className || null,
          profileData: toJson(profileData),
        },
      })
      existing ? updated++ : created++
    } catch (e) {
      errors.push({ row: i + 2, email, message: e instanceof Error ? e.message : String(e) })
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length === 0 ? 'DONE' : errors.length === rows.length ? 'FAILED' : 'PARTIAL',
      createdRows: created,
      updatedRows: updated,
      errorRows: errors.length,
      errors,
    },
  })

  await logAudit(actor.id, 'import.run', {
    entityType: 'ImportJob',
    entityId: job.id,
    metadata: { kind: 'VOLUNTEERS', created, updated, errors: errors.length },
  })
  revalidatePath('/admin/volunteers')
}

export async function importCampaignMembers(campaignId: string, formData: FormData) {
  const groupId = String(formData.get('groupId') || '') || null
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.MEMBER_MANAGE, groupId)

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('Chọn file Excel để nhập.')

  const { rows } = parseSheet(await file.arrayBuffer())
  if (rows.length === 0) throw new Error('File không có dữ liệu.')

  const [regFields, trackingFields, groups] = await Promise.all([
    prisma.fieldDefinition.findMany({ where: { scope: 'REGISTRATION_FORM', campaignId, archived: false } }),
    prisma.fieldDefinition.findMany({ where: { scope: 'MEMBER_TRACKING', campaignId, archived: false } }),
    prisma.campaignGroup.findMany({ where: { campaignId }, select: { id: true, name: true } }),
  ])
  const groupByName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g.id]))

  const job = await prisma.importJob.create({
    data: {
      kind: 'CAMPAIGN_MEMBERS',
      fileName: file.name,
      uploadedById: scope.user.id,
      campaignId,
      totalRows: rows.length,
    },
  })

  let created = 0
  let updated = 0
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = pick(row, 'Email', 'email').toLowerCase()
    try {
      if (!email) throw new Error('Thiếu email.')
      if (!isAllowedEmail(email)) throw new Error('Email không thuộc domain của trường.')

      const name = pick(row, 'Họ tên', 'Họ và tên', 'Tên', 'Name')
      const user = await prisma.user.upsert({
        where: { email },
        update: name ? { name } : {},
        create: { email, name: name || email.split('@')[0] },
      })

      const groupName = pick(row, 'Nhóm', 'Group')
      const rowGroupId = groupId ?? (groupName ? groupByName.get(groupName.trim().toLowerCase()) ?? null : null)

      const existing = await prisma.registration.findUnique({
        where: { campaignId_userId: { campaignId, userId: user.id } },
      })
      const regData = buildDynamicData(row, regFields)
      const trackData = buildDynamicData(row, trackingFields)

      await prisma.registration.upsert({
        where: { campaignId_userId: { campaignId, userId: user.id } },
        update: {
          ...(rowGroupId ? { groupId: rowGroupId } : {}),
          status: existing?.status === 'PENDING' || !existing ? 'APPROVED' : existing.status,
          formData: toJson({ ...(existing?.formData as object), ...regData }),
          trackingData: toJson({ ...(existing?.trackingData as object), ...trackData }),
        },
        create: {
          campaignId,
          userId: user.id,
          groupId: rowGroupId,
          status: 'APPROVED',
          decidedAt: new Date(),
          decidedById: scope.user.id,
          formData: toJson(regData),
          trackingData: toJson(trackData),
        },
      })
      existing ? updated++ : created++
    } catch (e) {
      errors.push({ row: i + 2, email, message: e instanceof Error ? e.message : String(e) })
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length === 0 ? 'DONE' : errors.length === rows.length ? 'FAILED' : 'PARTIAL',
      createdRows: created,
      updatedRows: updated,
      errorRows: errors.length,
      errors,
    },
  })

  await logAudit(scope.user.id, 'import.run', {
    entityType: 'ImportJob',
    entityId: job.id,
    metadata: { kind: 'CAMPAIGN_MEMBERS', campaignId, created, updated, errors: errors.length },
  })
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
}

function buildDynamicData(row: SheetRow, defs: FieldDefinition[]) {
  const data: Record<string, unknown> = {}
  for (const def of defs) {
    const raw = pick(row, def.label, def.key)
    if (!raw) continue
    data[def.key] = coerceImported(def, raw)
  }
  return data
}
