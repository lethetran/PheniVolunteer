'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ShieldCheck,
  Mail,
  History,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

export function AdminSidebar({
  isRoot,
  canSeeVolunteers,
  canSeeEmails,
  canSeeAudit,
}: {
  isRoot: boolean
  canSeeVolunteers: boolean
  canSeeEmails: boolean
  canSeeAudit: boolean
}) {
  const pathname = usePathname()

  const items: Item[] = [
    { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/admin/campaigns', label: 'Sự kiện', icon: CalendarDays },
  ]
  if (canSeeVolunteers) items.push({ href: '/admin/volunteers', label: 'Tình nguyện viên', icon: Users })
  if (isRoot) items.push({ href: '/admin/users', label: 'Tài khoản quản trị', icon: ShieldCheck })
  if (canSeeEmails) items.push({ href: '/admin/emails', label: 'Hàng đợi email', icon: Mail })
  if (canSeeAudit) items.push({ href: '/admin/audit', label: 'Nhật ký hoạt động', icon: History })

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto py-4">
        <Link
          href="/"
          className="mx-3 mb-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Về trang chính
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
          {items.map((item) => {
            const active =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
