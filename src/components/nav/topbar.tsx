import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { hasAnyStaffRole } from '@/lib/scope'
import { UserMenu } from './user-menu'
import { LinkButton } from '@/components/ui/button'
import { unreadCount } from '@/lib/notify'

export async function Topbar() {
  const user = await getCurrentUser()
  const [isStaff, unread] = user
    ? await Promise.all([hasAnyStaffRole(user), unreadCount(user.id)])
    : [false, 0]

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            PV
          </span>
          <span className="hidden text-sm font-bold text-slate-900 sm:inline">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer'}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Trang chủ
          </Link>
          {user && (
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sự kiện của tôi
            </Link>
          )}
          {isStaff && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Quản trị
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Thông báo"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <UserMenu user={user} isStaff={isStaff} />
            </>
          ) : (
            <LinkButton href="/login" variant="primary" size="sm">
              Đăng nhập
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  )
}
