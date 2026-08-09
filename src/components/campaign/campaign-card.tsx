import Link from 'next/link'
import { MapPin, Users, CalendarRange } from 'lucide-react'
import type { Campaign } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { CAMPAIGN_STATUS } from '@/lib/labels'
import { formatRange } from '@/lib/utils'

export function CampaignCard({
  campaign,
  memberCount,
  href,
}: {
  campaign: Campaign
  memberCount?: number
  href?: string
}) {
  return (
    <Link
      href={href ?? `/campaigns/${campaign.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        {campaign.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm font-semibold opacity-90">{campaign.code}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={CAMPAIGN_STATUS[campaign.status].tone}>{CAMPAIGN_STATUS[campaign.status].label}</Badge>
          {typeof memberCount === 'number' && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {memberCount}
              {campaign.capacity ? `/${campaign.capacity}` : ''}
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-brand-700">
          {campaign.title}
        </h3>
        {campaign.summary && <p className="line-clamp-2 text-sm text-slate-500">{campaign.summary}</p>}
        <div className="mt-auto space-y-1 pt-2 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            {formatRange(campaign.startAt, campaign.endAt)}
          </p>
          {campaign.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {campaign.location}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
