import 'server-only'
import { prisma } from './prisma'
import { appUrl, queueEmail, renderEmail } from './mail'

export type NotifyInput = {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  /** Gửi kèm email (mặc định có). */
  email?: { to: string; subject?: string; ctaLabel?: string; dedupeKey?: string } | false
}

/** Tạo thông báo trong app + (tuỳ chọn) đẩy email vào hàng đợi. */
export async function notify(input: NotifyInput) {
  await prisma.notification
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })
    .catch(() => {})

  if (input.email) {
    await queueEmail({
      to: input.email.to,
      subject: input.email.subject ?? input.title,
      dedupeKey: input.email.dedupeKey,
      html: renderEmail({
        title: input.title,
        intro: input.body,
        ctaLabel: input.link ? (input.email.ctaLabel ?? 'Xem chi tiết') : undefined,
        ctaHref: input.link ? appUrl(input.link) : undefined,
      }),
    })
  }
}

export async function notifyMany(inputs: NotifyInput[]) {
  for (const i of inputs) await notify(i)
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } })
}
