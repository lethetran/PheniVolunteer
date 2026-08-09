'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertPermission } from '@/lib/session'
import { assertCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { str, bool } from '@/lib/utils'
import { queueEmail, renderEmail, appUrl } from '@/lib/mail'

async function guard(campaignId: string | null) {
  if (!campaignId) return assertPermission(PERMISSIONS.POST_MANAGE)
  const scope = await assertCampaignScope(campaignId)
  scope.assert(PERMISSIONS.POST_MANAGE)
  return scope.user
}

function postsPath(campaignId: string | null) {
  revalidatePath('/')
  if (campaignId) {
    revalidatePath(`/admin/campaigns/${campaignId}/posts`)
  } else {
    revalidatePath('/admin')
  }
}

async function broadcastEmail(campaignId: string | null, title: string, body: string) {
  const recipients = campaignId
    ? await prisma.registration.findMany({
        where: { campaignId, status: 'APPROVED' },
        select: { user: { select: { email: true } } },
      }).then((rows) => rows.map((r) => r.user.email))
    : await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { email: true } }).then((rows) =>
        rows.map((r) => r.email),
      )

  const html = renderEmail({ title, intro: body, ctaLabel: 'Xem chi tiết', ctaHref: appUrl('/') })
  for (const to of recipients) await queueEmail({ to, subject: title, html })
}

export async function createPost(formData: FormData) {
  const campaignId = str(formData, 'campaignId') ?? null
  const user = await guard(campaignId)

  const title = str(formData, 'title')
  const body = str(formData, 'body')
  if (!title || !body) throw new Error('Tiêu đề và nội dung là bắt buộc.')
  const sendEmail = bool(formData, 'sendEmail')

  const post = await prisma.post.create({
    data: {
      campaignId,
      title,
      body,
      pinned: bool(formData, 'pinned'),
      published: bool(formData, 'published'),
      authorId: user.id,
      emailSentAt: sendEmail ? new Date() : null,
    },
  })

  if (sendEmail) await broadcastEmail(campaignId, title, body)

  await logAudit(user.id, 'post.create', { entityType: 'Post', entityId: post.id })
  postsPath(campaignId)
}

export async function updatePost(postId: string, formData: FormData) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
  const user = await guard(post.campaignId)

  const title = str(formData, 'title')
  const body = str(formData, 'body')
  if (!title || !body) throw new Error('Tiêu đề và nội dung là bắt buộc.')

  await prisma.post.update({
    where: { id: postId },
    data: {
      title,
      body,
      pinned: bool(formData, 'pinned'),
      published: bool(formData, 'published'),
    },
  })
  await logAudit(user.id, 'post.update', { entityType: 'Post', entityId: postId })
  postsPath(post.campaignId)
}

export async function deletePost(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
  const user = await guard(post.campaignId)
  await prisma.post.delete({ where: { id: postId } })
  await logAudit(user.id, 'post.delete', { entityType: 'Post', entityId: postId })
  postsPath(post.campaignId)
}
