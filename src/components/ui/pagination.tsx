import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Phân trang đơn giản dùng query param — giữ nguyên các param khác (VD tìm kiếm). */
export function Pagination({
  basePath,
  page,
  totalPages,
  searchParams,
}: {
  basePath: string
  page: number
  totalPages: number
  searchParams?: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  function hrefFor(p: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams ?? {})) if (v) params.set(k, v)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `${basePath}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
        ← Trước
      </PageLink>
      <span className="text-slate-500">
        Trang {page}/{totalPages}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages}>
        Sau →
      </PageLink>
    </div>
  )
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return <span className="cursor-not-allowed text-slate-300">{children}</span>
  }
  return (
    <Link href={href} className={cn('font-medium text-brand-600 hover:underline')}>
      {children}
    </Link>
  )
}
