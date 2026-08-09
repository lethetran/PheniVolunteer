import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign/campaign-card'
import { EmptyState } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ['OPEN', 'ONGOING', 'CLOSED'] } },
    orderBy: [{ status: 'asc' }, { startAt: 'asc' }],
    include: { _count: { select: { registrations: { where: { status: 'APPROVED' } } } } },
    take: 30,
  })

  const posts = await prisma.post.findMany({
    where: { campaignId: null, published: true },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 3,
  })

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 text-center text-white sm:py-16">
        <h1 className="text-2xl font-bold sm:text-3xl">Cùng lan toả tinh thần tình nguyện Phenikaa</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-brand-100 sm:text-base">
          Đăng ký tham gia các chiến dịch tình nguyện, theo dõi nhiệm vụ và đóng góp của bạn — tất
          cả trong một nơi.
        </p>
      </section>

      {posts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Thông báo</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{post.title}</p>
                <p className="mt-1 line-clamp-3 text-xs text-slate-500">{post.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Sự kiện đang diễn ra</h2>
        {campaigns.length === 0 ? (
          <EmptyState title="Chưa có sự kiện nào" description="Hãy quay lại sau nhé." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} memberCount={c._count.registrations} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
