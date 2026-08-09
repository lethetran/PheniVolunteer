'use server'

import { revalidatePath } from 'next/cache'
import type { NoteSeverity, NoteStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, bool } from '@/lib/utils'

function notesPath(campaignId: string) {
  revalidatePath(`/admin/campaigns/${campaignId}/notes`)
  revalidatePath(`/admin/campaigns/${campaignId}/members`)
}

async function resolveGroupId(registrationId?: string | null, subjectId?: string | null, campaignId?: string) {
  if (registrationId) {
    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { groupId: true },
    })
    return reg?.groupId ?? null
  }
  if (subjectId && campaignId) {
    const reg = await prisma.registration.findUnique({
      where: { campaignId_userId: { campaignId, userId: subjectId } },
      select: { groupId: true },
    })
    return reg?.groupId ?? null
  }
  return null
}

export async function createNote(campaignId: string, formData: FormData) {
  const registrationId = str(formData, 'registrationId') ?? null
  const subjectId = str(formData, 'subjectId') ?? null
  const groupId = await resolveGroupId(registrationId, subjectId, campaignId)

  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.NOTE_MANAGE, groupId)

  const body = str(formData, 'body')
  if (!body) throw new Error('Nội dung ghi chú là bắt buộc.')

  const note = await prisma.note.create({
    data: {
      campaignId,
      registrationId,
      taskProgressId: str(formData, 'taskProgressId') ?? null,
      subjectId,
      body,
      severity: (str(formData, 'severity') ?? 'INFO') as NoteSeverity,
      sharedWithVolunteer: bool(formData, 'sharedWithVolunteer'),
      authorId: scope.user.id,
    },
  })
  await logAudit(scope.user.id, 'note.create', { entityType: 'Note', entityId: note.id })
  notesPath(campaignId)
}

export async function updateNoteStatus(noteId: string, status: NoteStatus) {
  const note = await prisma.note.findUniqueOrThrow({ where: { id: noteId } })
  if (!note.campaignId) throw new Error('Ghi chú không hợp lệ.')
  const groupId = await resolveGroupId(note.registrationId, note.subjectId, note.campaignId)
  const scope = await assertCampaignScope(note.campaignId)
  scope.assert(PERMISSIONS.NOTE_MANAGE, groupId)

  await prisma.note.update({
    where: { id: noteId },
    data: {
      status,
      resolvedAt: status === 'RESOLVED' ? new Date() : null,
      resolvedById: status === 'RESOLVED' ? scope.user.id : null,
    },
  })
  await logAudit(scope.user.id, 'note.update', { entityType: 'Note', entityId: noteId, metadata: { status } })
  notesPath(note.campaignId)
}

export async function deleteNote(noteId: string) {
  const note = await prisma.note.findUniqueOrThrow({ where: { id: noteId } })
  if (!note.campaignId) throw new Error('Ghi chú không hợp lệ.')
  const groupId = await resolveGroupId(note.registrationId, note.subjectId, note.campaignId)
  const scope = await assertCampaignScope(note.campaignId)
  scope.assert(PERMISSIONS.NOTE_MANAGE, groupId)

  await prisma.note.delete({ where: { id: noteId } })
  await logAudit(scope.user.id, 'note.delete', { entityType: 'Note', entityId: noteId })
  notesPath(note.campaignId)
}
