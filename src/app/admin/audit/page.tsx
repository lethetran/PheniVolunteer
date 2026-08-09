import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { hasGlobalPermission, PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { AUDIT_LABELS } from '@/lib/audit'
import { formatDateTime } from '@/lib/utils'
import { PageHeader, Card, CardBody, EmptyState } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'

export default async function AuditPage() {
  const user = await requireUser()
  if (user.role !== 'ROOT_ADMIN' && !hasGlobalPermission(user, PERMISSIONS.AUDIT_VIEW)) redirect('/403')

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: true },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Nhật ký hoạt động" description="Lịch sử thao tác quan trọng trong hệ thống." />
      <Card>
        <CardBody className="space-y-2">
          {logs.length === 0 ? (
            <EmptyState title="Chưa có hoạt động nào" />
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                <Avatar name={log.actor?.name} email={log.actor?.email} image={log.actor?.image} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{log.actor?.name ?? log.actor?.email ?? 'Hệ thống'}</span>{' '}
                    {AUDIT_LABELS[log.action] ?? log.action}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}
