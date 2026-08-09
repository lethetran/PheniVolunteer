import 'server-only'
import nodemailer from 'nodemailer'
import { prisma } from './prisma'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer'

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_ENABLED !== 'false')
}

export function appUrl(path = '') {
  const base = (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!mailConfigured()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  }
  return transporter
}

/** Khung HTML chung cho mọi email của hệ thống. */
export function renderEmail(opts: {
  title: string
  intro?: string
  lines?: string[]
  ctaLabel?: string
  ctaHref?: string
  footer?: string
}) {
  const lines = (opts.lines ?? [])
    .map((l) => `<p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.6">${l}</p>`)
    .join('')
  const cta =
    opts.ctaLabel && opts.ctaHref
      ? `<p style="margin:24px 0 0"><a href="${opts.ctaHref}" style="background:#1c6df0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block">${opts.ctaLabel}</a></p>`
      : ''
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#1c6df0;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">${APP_NAME}</div>
    <div style="padding:24px">
      <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a">${opts.title}</h1>
      ${opts.intro ? `<p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6">${opts.intro}</p>` : ''}
      ${lines}
      ${cta}
    </div>
    <div style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
      ${opts.footer ?? 'Email tự động từ hệ thống quản lý tình nguyện viên Phenikaa. Vui lòng không trả lời email này.'}
    </div>
  </div>
</body></html>`
}

function toPlain(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Đưa email vào hàng đợi trong DB. Không gửi ngay để request không bị chậm —
 * worker (`/api/cron/emails` hoặc `npm run mail:flush`) sẽ gửi sau.
 */
export async function queueEmail(input: {
  to: string
  subject: string
  html: string
  dedupeKey?: string
}) {
  const data = {
    to: input.to.toLowerCase(),
    subject: input.subject,
    html: input.html,
    text: toPlain(input.html),
    dedupeKey: input.dedupeKey ?? null,
    status: mailConfigured() ? ('PENDING' as const) : ('SKIPPED' as const),
  }
  try {
    if (data.dedupeKey) {
      await prisma.emailMessage.upsert({
        where: { dedupeKey: data.dedupeKey },
        update: {},
        create: data,
      })
    } else {
      await prisma.emailMessage.create({ data })
    }
  } catch {
    // hàng đợi lỗi không được làm hỏng nghiệp vụ
  }
}

export async function queueEmails(items: Parameters<typeof queueEmail>[0][]) {
  for (const item of items) await queueEmail(item)
}

/** Gửi các email đang chờ. Trả về số lượng đã gửi / lỗi. */
export async function flushEmailQueue(limit = 30) {
  const tx = getTransporter()
  if (!tx) return { sent: 0, failed: 0, skipped: true }

  const pending = await prisma.emailMessage.findMany({
    where: { status: 'PENDING', attempts: { lt: 5 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let sent = 0
  let failed = 0
  for (const msg of pending) {
    try {
      await tx.sendMail({
        from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? undefined,
      })
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      })
      sent++
    } catch (e) {
      failed++
      const attempts = msg.attempts + 1
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          attempts,
          status: attempts >= 5 ? 'FAILED' : 'PENDING',
          lastError: e instanceof Error ? e.message : String(e),
        },
      })
    }
  }
  return { sent, failed, skipped: false }
}
