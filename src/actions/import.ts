'use server'

import { revalidatePath } from 'next/cache'
import type { FieldDefinition, RegistrationStatus, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermission } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { isAllowedEmail, allowedDomains } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseSheet, pick, type SheetRow } from '@/lib/excel'
import { coerceImported, toJson } from '@/lib/fields'
import { notify } from '@/lib/notify'
import { REGISTRATION_STATUS } from '@/lib/labels'

type RowError = { row: number; identifier: string; message: string }

const STUDENT_CODE_HEADERS = ['MSSV', 'Mã sinh viên', 'Ma sinh vien', 'Student code']
const EMAIL_HEADERS = ['Email', 'email', 'Email sinh viên']

/**
 * Xác định tài khoản theo MSSV trước (khớp với thông tin đăng nhập Google —
 * MSSV chính là phần trước @ trong email trường), rồi mới tới email tường minh
 * trong file nếu có. Nếu không tìm thấy và `createIfMissing`, tạo tài khoản mới
 * với email suy ra từ MSSV để khi TNV đăng nhập Google lần đầu sẽ khớp đúng.
 */
async function findUserByStudentOrEmail(
  studentCode: string,
  email: string,
  opts: { createIfMissing?: boolean; name?: string } = {},
): Promise<User | null> {
  if (studentCode) {
    const byCode = await prisma.user.findFirst({ where: { studentCode } })
    if (byCode) return byCode
  }
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } })
    if (byEmail) return byEmail
  }
  if (!opts.createIfMissing) return null

  const finalEmail = email || (studentCode ? `${studentCode}@${allowedDomains()[0]}` : '')
  if (!finalEmail) return null
  return prisma.user.create({
    data: { email: finalEmail, name: opts.name || finalEmail.split('@')[0], studentCode: studentCode || null },
  })
}

const DECISION_MAP: Record<RegistrationStatus, string[]> = {
  APPROVED: ['duyệt', 'duyet', 'đạt', 'dat', 'approve', 'approved', 'x', 'có', 'co', 'yes', 'y', '1', 'pass', 'ok', 'đồng ý', 'dong y', 'accept', 'accepted'],
  REJECTED: ['từ chối', 'tu choi', 'không đạt', 'khong dat', 'reject', 'rejected', 'fail', 'trượt', 'truot', 'no', '0', 'huỷ', 'huy'],
  WAITLIST: ['chờ', 'cho', 'danh sách chờ', 'waitlist', 'dự bị', 'du bi', 'wait'],
  PENDING: ['chờ duyệt', 'cho duyet', 'pending'],
  CANCELLED: [],
  REMOVED: [],
}

function mapDecision(raw: string): RegistrationStatus | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  for (const [status, words] of Object.entries(DECISION_MAP)) {
    if (words.includes(v)) return status as RegistrationStatus
  }
  return null
}

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
    const studentCode = pick(row, ...STUDENT_CODE_HEADERS)
    const email = pick(row, ...EMAIL_HEADERS).toLowerCase()
    const identifier = studentCode || email
    try {
      if (!studentCode && !email) throw new Error('Thiếu MSSV hoặc Email.')
      if (email && !isAllowedEmail(email)) throw new Error('Email không thuộc domain của trường.')

      const profileData = buildDynamicData(row, fieldDefs)
      const name = pick(row, 'Họ tên', 'Họ và tên', 'Tên', 'Name')
      const phone = pick(row, 'Số điện thoại', 'SĐT', 'Phone')
      const faculty = pick(row, 'Khoa', 'Viện', 'Faculty')
      const className = pick(row, 'Lớp', 'Class')

      const matched = await findUserByStudentOrEmail(studentCode, email, { createIfMissing: false })
      const targetEmail = matched?.email ?? email
      if (!targetEmail) throw new Error('Không xác định được email (thiếu email và tài khoản chưa từng đăng nhập).')
      if (!isAllowedEmail(targetEmail)) throw new Error('Email không thuộc domain của trường.')

      const existing = await prisma.user.findUnique({ where: { email: targetEmail }, select: { id: true, profileData: true } })
      await prisma.user.upsert({
        where: { email: targetEmail },
        update: {
          ...(name ? { name } : {}),
          ...(studentCode ? { studentCode } : {}),
          ...(phone ? { phone } : {}),
          ...(faculty ? { faculty } : {}),
          ...(className ? { className } : {}),
          profileData: toJson({ ...(existing?.profileData as object), ...profileData }),
        },
        create: {
          email: targetEmail,
          name: name || targetEmail.split('@')[0],
          studentCode: studentCode || null,
          phone: phone || null,
          faculty: faculty || null,
          className: className || null,
          profileData: toJson(profileData),
        },
      })
      existing ? updated++ : created++
    } catch (e) {
      errors.push({ row: i + 2, identifier, message: e instanceof Error ? e.message : String(e) })
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
    const studentCode = pick(row, ...STUDENT_CODE_HEADERS)
    const email = pick(row, ...EMAIL_HEADERS).toLowerCase()
    const identifier = studentCode || email
    try {
      if (!studentCode && !email) throw new Error('Thiếu MSSV hoặc Email.')
      if (email && !isAllowedEmail(email)) throw new Error('Email không thuộc domain của trường.')

      const name = pick(row, 'Họ tên', 'Họ và tên', 'Tên', 'Name')
      // Ưu tiên khớp theo MSSV (trùng với tài khoản TNV đăng nhập Google), tạo mới nếu chưa có.
      const user = await findUserByStudentOrEmail(studentCode, email, { createIfMissing: true, name })
      if (!user) throw new Error('Không xác định được tài khoản (thiếu MSSV/Email hợp lệ).')
      if (name && name !== user.name) await prisma.user.update({ where: { id: user.id }, data: { name } })
      if (studentCode && !user.studentCode) {
        await prisma.user.update({ where: { id: user.id }, data: { studentCode } })
      }

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
          // Chỉ đồng bộ nhóm/dữ liệu — KHÔNG đổi trạng thái duyệt ở đây.
          ...(rowGroupId ? { groupId: rowGroupId } : {}),
          formData: toJson({ ...(existing?.formData as object), ...regData }),
          trackingData: toJson({ ...(existing?.trackingData as object), ...trackData }),
        },
        create: {
          campaignId,
          userId: user.id,
          groupId: rowGroupId,
          // Mặc định "chờ duyệt" — duyệt qua tay hoặc qua danh sách duyệt riêng.
          status: 'PENDING',
          formData: toJson(regData),
          trackingData: toJson(trackData),
        },
      })
      existing ? updated++ : created++
    } catch (e) {
      errors.push({ row: i + 2, identifier, message: e instanceof Error ? e.message : String(e) })
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

/**
 * Nhập "danh sách duyệt" (thường từ một vòng xét duyệt riêng, VD hội đồng
 * xét CV) rồi khớp theo MSSV/Email với danh sách thành viên đã có, gộp lại
 * thành trạng thái duyệt cuối cùng cho từng TNV. Không tạo mới thành viên —
 * người trong file phải đã có trong danh sách đăng ký của sự kiện.
 */
export async function importApprovalDecisions(campaignId: string, formData: FormData) {
  const scope = await assertCampaignScope(campaignId)
  if (!scope.canAnywhere(PERMISSIONS.REGISTRATION_REVIEW)) scope.assert(PERMISSIONS.REGISTRATION_REVIEW)

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('Chọn file Excel để nhập.')

  const { headers, rows } = parseSheet(await file.arrayBuffer())
  if (rows.length === 0) throw new Error('File không có dữ liệu.')

  const DECISION_HEADERS = ['Kết quả', 'Duyệt', 'Trạng thái', 'Status', 'Quyết định']
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const decisionHeaderSet = new Set(DECISION_HEADERS.map(normalize))
  const hasDecisionColumn = headers.some((h) => decisionHeaderSet.has(normalize(h)))

  const job = await prisma.importJob.create({
    data: {
      kind: 'APPROVAL_LIST',
      fileName: file.name,
      uploadedById: scope.user.id,
      campaignId,
      totalRows: rows.length,
    },
  })

  let updated = 0
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const studentCode = pick(row, ...STUDENT_CODE_HEADERS)
    const email = pick(row, ...EMAIL_HEADERS).toLowerCase()
    const identifier = studentCode || email
    try {
      if (!studentCode && !email) throw new Error('Thiếu MSSV hoặc Email.')

      const user = await findUserByStudentOrEmail(studentCode, email, { createIfMissing: false })
      if (!user) throw new Error('Không tìm thấy tài khoản tình nguyện viên này trong hệ thống.')

      const registration = await prisma.registration.findUnique({
        where: { campaignId_userId: { campaignId, userId: user.id } },
      })
      if (!registration) throw new Error('Người này chưa có trong danh sách thành viên của sự kiện.')
      if (!scope.can(PERMISSIONS.REGISTRATION_REVIEW, registration.groupId)) {
        throw new Error('Bạn không có quyền duyệt nhóm của thành viên này.')
      }

      let decision: RegistrationStatus = 'APPROVED'
      if (hasDecisionColumn) {
        const raw = pick(row, ...DECISION_HEADERS)
        const mapped = mapDecision(raw)
        if (!mapped) throw new Error(`Không hiểu giá trị kết quả "${raw}".`)
        decision = mapped
      }

      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          status: decision,
          decidedAt: new Date(),
          decidedById: scope.user.id,
          rejectReason: decision === 'REJECTED' ? (registration.rejectReason ?? 'Theo danh sách duyệt') : null,
        },
      })

      await notify({
        userId: user.id,
        type: 'REGISTRATION_DECIDED',
        title: `${REGISTRATION_STATUS[decision].label}: ${scope.campaign.title}`,
        link: `/campaigns/${scope.campaign.slug}`,
        email: { to: user.email, dedupeKey: `reg-decide-bulk:${registration.id}:${decision}:${job.id}` },
      })

      updated++
    } catch (e) {
      errors.push({ row: i + 2, identifier, message: e instanceof Error ? e.message : String(e) })
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length === 0 ? 'DONE' : errors.length === rows.length ? 'FAILED' : 'PARTIAL',
      createdRows: 0,
      updatedRows: updated,
      errorRows: errors.length,
      errors,
    },
  })

  await logAudit(scope.user.id, 'registration.decide', {
    entityType: 'ImportJob',
    entityId: job.id,
    metadata: { kind: 'APPROVAL_LIST', campaignId, updated, errors: errors.length },
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
