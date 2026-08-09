import Link from 'next/link'
import { LinkButton } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
        🚫
      </div>
      <h1 className="text-lg font-bold text-slate-900">Bạn không có quyền truy cập</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Trang này yêu cầu quyền quản trị mà tài khoản của bạn hiện chưa có. Liên hệ quản trị viên
        nếu bạn cho rằng đây là nhầm lẫn.
      </p>
      <div className="mt-2 flex gap-2">
        <LinkButton href="/dashboard" variant="primary">
          Về trang chính
        </LinkButton>
        <Link href="/" className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:underline">
          Trang chủ
        </Link>
      </div>
    </main>
  )
}
