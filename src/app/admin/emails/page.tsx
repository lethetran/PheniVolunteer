import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { hasGlobalPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { mailConfigured } from '@/lib/mail'
import { PageHeader, Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Tone } from '@/lib/labels'

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'amber',
  SENT: 'green',
  FAILED: 'red',
  SKIPPED: 'gray',
}

export default async function EmailsPage() {
  const user = await requireUser()
  if (user.role !== 'ROOT_ADMIN' && !hasGlobalPermission(user, PERMISSIONS.MAIL_SEND)) redirect('/403')
  const emails = await prisma.emailMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng đợi email"
        description={
          mailConfigured()
            ? 'SMTP đã cấu hình. Email được gửi tự động qua cron hoặc lệnh `npm run mail:flush`.'
            : 'Chưa cấu hình SMTP — email chỉ được ghi lại, không gửi thật.'
        }
      />
      <Card>
        <CardHeader title={`${emails.length} email gần nhất`} />
        <CardBody className="space-y-2">
          {emails.length === 0 ? (
            <EmptyState title="Chưa có email nào" />
          ) : (
            emails.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{e.subject}</p>
                  <p className="text-xs text-slate-500">
                    Đến: {e.to} · {formatDateTime(e.createdAt)}
                  </p>
                  {e.lastError && <p className="text-xs text-red-500">{e.lastError}</p>}
                </div>
                <Badge tone={STATUS_TONE[e.status] ?? 'gray'}>{e.status}</Badge>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}
