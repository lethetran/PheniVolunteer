import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Field, TextInput, TextArea, CheckboxInput } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { createPost, updatePost, deletePost } from '@/actions/posts'

export default async function CampaignPostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  scope.assert(PERMISSIONS.POST_MANAGE)

  const posts = await prisma.post.findMany({
    where: { campaignId: id },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Đăng thông báo mới" />
        <CardBody>
          <form action={createPost} className="space-y-3">
            <input type="hidden" name="campaignId" value={id} />
            <Field label="Tiêu đề" required>
              <TextInput name="title" required />
            </Field>
            <Field label="Nội dung" required>
              <TextArea name="body" required rows={4} />
            </Field>
            <div className="flex flex-wrap gap-4">
              <CheckboxInput name="pinned" label="Ghim lên đầu" />
              <CheckboxInput name="published" defaultChecked label="Hiển thị công khai" />
              <CheckboxInput name="sendEmail" label="Gửi email cho thành viên đã duyệt" />
            </div>
            <SubmitButton pendingLabel="Đang đăng…">Đăng thông báo</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Danh sách thông báo (${posts.length})`} />
        <CardBody className="space-y-2">
          {posts.length === 0 ? (
            <EmptyState title="Chưa có thông báo nào" />
          ) : (
            posts.map((post) => (
              <details key={post.id} className="rounded-lg border border-slate-100">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    {post.pinned && <Badge tone="amber">Ghim</Badge>}
                    {post.title}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(post.createdAt)}</span>
                </summary>
                <div className="space-y-3 border-t border-slate-100 p-3">
                  <form action={updatePost.bind(null, post.id)} className="space-y-3">
                    <Field label="Tiêu đề" required>
                      <TextInput name="title" required defaultValue={post.title} />
                    </Field>
                    <Field label="Nội dung" required>
                      <TextArea name="body" required rows={3} defaultValue={post.body} />
                    </Field>
                    <div className="flex flex-wrap gap-4">
                      <CheckboxInput name="pinned" defaultChecked={post.pinned} label="Ghim lên đầu" />
                      <CheckboxInput name="published" defaultChecked={post.published} label="Hiển thị công khai" />
                    </div>
                    <SubmitButton size="sm" pendingLabel="Đang lưu…">Lưu</SubmitButton>
                  </form>
                  <form action={deletePost.bind(null, post.id)}>
                    <SubmitButton variant="danger" size="sm" pendingLabel="Đang xoá…">Xoá thông báo</SubmitButton>
                  </form>
                </div>
              </details>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}
