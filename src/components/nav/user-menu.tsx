'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ROLE_TONE } from '@/lib/labels'
import { ROLE_LABELS } from '@/lib/permissions'
import { signOutAction } from '@/actions/auth-actions'
import type { CurrentUser } from '@/lib/session'

export function UserMenu({ user, isStaff }: { user: CurrentUser; isStaff: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100"
      >
        <Avatar name={user.name} email={user.email} image={user.image} size={30} />
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">
          {user.name ?? user.email.split('@')[0]}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.name ?? 'Chưa đặt tên'}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <Badge tone={ROLE_TONE[user.role]} className="mt-2">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <nav className="py-1 text-sm">
            <Link
              href="/me"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Hồ sơ của tôi
            </Link>
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Sự kiện của tôi
            </Link>
            {isStaff && (
              <Link
                href="/admin"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Khu vực quản trị
              </Link>
            )}
          </nav>
          <form action={signOutAction} className="border-t border-slate-100 py-1">
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
