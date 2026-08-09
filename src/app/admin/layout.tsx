import { requireAdminArea } from '@/lib/session'
import { hasGlobalPermission, PERMISSIONS } from '@/lib/permissions'
import { Topbar } from '@/components/nav/topbar'
import { AdminSidebar } from '@/components/nav/admin-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminArea()
  const isRoot = user.role === 'ROOT_ADMIN'

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar />
      <div className="mx-auto flex max-w-[1400px]">
        <AdminSidebar
          isRoot={isRoot}
          canSeeVolunteers={hasGlobalPermission(user, PERMISSIONS.VOLUNTEER_VIEW)}
          canSeeEmails={isRoot || hasGlobalPermission(user, PERMISSIONS.MAIL_SEND)}
          canSeeAudit={isRoot || hasGlobalPermission(user, PERMISSIONS.AUDIT_VIEW)}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
