import { prisma } from '@/lib/prisma'
import { cn, relativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { TextArea } from '@/components/ui/field'
import { sendChatMessage } from '@/actions/chat'

export async function CampaignChat({ campaignId, currentUserId }: { campaignId: string; currentUserId: string }) {
  const messages = await prisma.chatMessage.findMany({
    where: { campaignId },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có tin nhắn nào. Hãy là người đầu tiên!</p>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === currentUserId
            return (
              <div key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
                <Avatar name={m.author?.name} email={m.author?.email} image={m.author?.image} size={28} />
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                    mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800',
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-medium text-slate-500">
                      {m.author?.name ?? m.author?.email ?? 'Người dùng đã xoá'}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn('mt-1 text-[10px]', mine ? 'text-brand-100' : 'text-slate-400')}>
                    {relativeTime(m.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
      <ActionForm action={sendChatMessage.bind(null, campaignId)} className="flex items-end gap-2 border-t border-slate-100 p-3">
        <TextArea name="body" rows={1} required placeholder="Nhắn gì đó…" className="flex-1 resize-none" />
        <SubmitButton size="sm" pendingLabel="Đang gửi…">
          Gửi
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
