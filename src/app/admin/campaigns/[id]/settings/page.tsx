import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import {
  PERMISSIONS,
  ROLE_LABELS,
  MANAGER_GRANTABLE_PERMISSIONS,
  PERMISSION_LABELS,
} from '@/lib/permissions'
import { CAMPAIGN_STATUS } from '@/lib/labels'
import { CHAT_ACCESS_LABELS } from '@/lib/chat'
import { toDateTimeLocal } from '@/lib/utils'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { FormSection } from '@/components/ui/form-section'
import { Field, TextInput, TextArea, SelectInput, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmDeleteForm } from '@/components/ui/confirm-delete-form'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { updateCampaign, updateCampaignStatus, deleteCampaign } from '@/actions/campaigns'
import { assignCampaignAdmin, removeCampaignAdmin } from '@/actions/groups'
import { updateChatAccess } from '@/actions/chat'
import type { CampaignStatus } from '@prisma/client'

const STATUS_FLOW: CampaignStatus[] = ['DRAFT', 'OPEN', 'CLOSED', 'ONGOING', 'FINISHED', 'ARCHIVED']

export default async function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  scope.assert(PERMISSIONS.CAMPAIGN_EDIT)
  const c = scope.campaign

  const admins = await prisma.campaignAdmin.findMany({
    where: { campaignId: id },
    include: { user: true },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Trạng thái sự kiện"
          description={`Sự kiện đã xong việc? Chuyển sang "${CAMPAIGN_STATUS.ARCHIVED.label}" thay vì xoá — dữ liệu vẫn được giữ lại đầy đủ.`}
        />
        <CardBody className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => (
            <form key={s} action={updateCampaignStatus.bind(null, id, s)}>
              <SubmitButton
                variant={s === c.status ? 'primary' : 'outline'}
                size="sm"
                pendingLabel="Đang đổi…"
              >
                {CAMPAIGN_STATUS[s].label}
              </SubmitButton>
            </form>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Thông tin sự kiện" />
        <CardBody>
          <form action={updateCampaign.bind(null, id)} className="space-y-5">
            <FormSection title="Thông tin cơ bản">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên sự kiện" required htmlFor="title">
                  <TextInput id="title" name="title" required defaultValue={c.title} />
                </Field>
                <Field label="Đơn vị tổ chức" htmlFor="organizer">
                  <TextInput id="organizer" name="organizer" defaultValue={c.organizer ?? ''} />
                </Field>
                <Field label="Địa điểm" htmlFor="location">
                  <TextInput id="location" name="location" defaultValue={c.location ?? ''} />
                </Field>
                <Field label="Ảnh bìa (URL)" htmlFor="coverImage">
                  <TextInput id="coverImage" name="coverImage" defaultValue={c.coverImage ?? ''} />
                </Field>
              </div>
              <Field label="Mô tả ngắn" htmlFor="summary">
                <TextInput id="summary" name="summary" defaultValue={c.summary ?? ''} />
              </Field>
              <Field label="Mô tả chi tiết" htmlFor="description">
                <TextArea id="description" name="description" rows={6} defaultValue={c.description ?? ''} />
              </Field>
            </FormSection>

            <FormSection title="Thời gian">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bắt đầu" htmlFor="startAt">
                  <TextInput id="startAt" name="startAt" type="datetime-local" defaultValue={toDateTimeLocal(c.startAt)} />
                </Field>
                <Field label="Kết thúc" htmlFor="endAt">
                  <TextInput id="endAt" name="endAt" type="datetime-local" defaultValue={toDateTimeLocal(c.endAt)} />
                </Field>
                <Field label="Mở đăng ký" htmlFor="regOpenAt">
                  <TextInput id="regOpenAt" name="regOpenAt" type="datetime-local" defaultValue={toDateTimeLocal(c.regOpenAt)} />
                </Field>
                <Field label="Đóng đăng ký" htmlFor="regCloseAt">
                  <TextInput id="regCloseAt" name="regCloseAt" type="datetime-local" defaultValue={toDateTimeLocal(c.regCloseAt)} />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Đăng ký">
              <Field label="Số lượng tối đa" htmlFor="capacity" hint="Bỏ trống nếu không giới hạn">
                <TextInput id="capacity" name="capacity" type="number" min={0} defaultValue={c.capacity ?? ''} className="sm:max-w-xs" />
              </Field>
              <div className="flex flex-wrap gap-4">
                <CheckboxInput name="allowSelfJoin" defaultChecked={c.allowSelfJoin} label="Cho phép tình nguyện viên tự đăng ký" />
                <CheckboxInput name="requireApproval" defaultChecked={c.requireApproval} label="Cần admin duyệt đăng ký" />
              </div>
            </FormSection>

            <FormSection title="Nâng cao" description="Giá trị mặc định gán cho mỗi thành viên khi hoàn thành sự kiện.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Giờ TNV mặc định" htmlFor="hoursDefault">
                  <TextInput id="hoursDefault" name="hoursDefault" type="number" step="0.5" defaultValue={c.hoursDefault ?? 0} />
                </Field>
                <Field label="Điểm rèn luyện mặc định" htmlFor="pointsDefault">
                  <TextInput id="pointsDefault" name="pointsDefault" type="number" defaultValue={c.pointsDefault ?? 0} />
                </Field>
              </div>
            </FormSection>

            <SubmitButton pendingLabel="Đang lưu…">Lưu thay đổi</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Nhóm chat chung" description="Chọn ai được nhắn tin trong nhóm chat của sự kiện này." />
        <CardBody>
          <form action={updateChatAccess.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <SelectInput name="chatAccess" defaultValue={c.chatAccess} className="w-64">
              {(Object.entries(CHAT_ACCESS_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
            <SubmitButton size="sm" pendingLabel="Đang lưu…">
              Lưu
            </SubmitButton>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Admin phụ trách sự kiện" description="Đồng quản lý toàn bộ sự kiện này." />
        <CardBody className="space-y-4">
          <div className="space-y-2">
            {admins.length === 0 && <p className="text-sm text-slate-500">Chưa có admin phụ trách riêng.</p>}
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={a.user.name} email={a.user.email} image={a.user.image} size={28} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.user.name ?? a.user.email}</p>
                    <p className="text-xs text-slate-500">{a.user.email} · {ROLE_LABELS[a.user.role]}</p>
                  </div>
                </div>
                <form action={removeCampaignAdmin.bind(null, id, a.userId)}>
                  <SubmitButton variant="ghost" size="sm" pendingLabel="Đang gỡ…">
                    Gỡ
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
          <form action={assignCampaignAdmin.bind(null, id)} className="space-y-3 border-t border-slate-100 pt-4">
            <Field label="Email quản lý" htmlFor="admin-email">
              <TextInput id="admin-email" name="email" type="email" required placeholder="ten@st.phenikaa-uni.edu.vn" />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Quyền được cấp</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {MANAGER_GRANTABLE_PERMISSIONS.map((p) => (
                  <CheckboxInput key={p} name="permissions" value={p} label={PERMISSION_LABELS[p]} />
                ))}
              </div>
            </div>
            <SubmitButton variant="outline" pendingLabel="Đang thêm…">
              Thêm admin
            </SubmitButton>
          </form>
        </CardBody>
      </Card>

      {scope.user.role === 'ROOT_ADMIN' && (
        <Card className="border-red-200">
          <CardHeader
            title="Vùng nguy hiểm"
            description="Xoá vĩnh viễn xoá luôn toàn bộ đăng ký, giờ/điểm đã ghi, nhiệm vụ, ghi chú, chat của sự kiện — không thể hoàn tác. Chỉ Root Admin thấy mục này."
          />
          <CardBody>
            <ConfirmDeleteForm action={deleteCampaign.bind(null, id)} expectedText={c.title} submitLabel="Xoá sự kiện vĩnh viễn" />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
