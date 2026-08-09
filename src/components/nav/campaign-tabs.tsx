'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function CampaignTabs({
  campaignId,
  tabs,
}: {
  campaignId: string
  tabs: { key: string; label: string }[]
}) {
  const pathname = usePathname()
  const base = `/admin/campaigns/${campaignId}`

  return (
    <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {tabs.map((tab) => {
        const href = tab.key ? `${base}/${tab.key}` : base
        const active = tab.key ? pathname.startsWith(href) : pathname === base
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium',
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
