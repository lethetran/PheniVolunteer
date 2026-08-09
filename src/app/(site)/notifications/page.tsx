import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { relativeTime, cn } from '@/lib/utils'
import { Card, CardBody, EmptyState, PageHeader } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { markNotificationsRead } from '@/actions/notifications-actions'

export default async function NotificationsPage() {
  const user = await requireUser()
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo"
        action={
          notifications.some((n) => !n.readAt) && (
            <form action={markNotificationsRead}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Đang cập nhật…">
                Đánh dấu đã đọc tất cả
              </SubmitButton>
            </form>
          )
        }
      />
      <Card>
        <CardBody className="space-y-1">
          {notifications.length === 0 ? (
            <EmptyState title="Chưa có thông báo nào" />
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    'rounded-xl p-3',
                    n.readAt ? 'bg-white' : 'bg-brand-50/60',
                  )}
                >
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">{relativeTime(n.createdAt)}</p>
                </div>
              )
              return n.link ? (
                <Link key={n.id} href={n.link}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              )
            })
          )}
        </CardBody>
      </Card>
    </div>
  )
}
