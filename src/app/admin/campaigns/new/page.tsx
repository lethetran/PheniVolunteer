import { requirePermission } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { PageHeader, Card, CardBody } from '@/components/ui/card'
import { Field, TextInput, TextArea, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Avatar } from '@/components/ui/avatar'
import { createCampaign } from '@/actions/campaigns'

export default async function NewCampaignPage() {
  const user = await requirePermission(PERMISSIONS.CAMPAIGN_CREATE)
  const otherAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN', id: { not: user.id } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, image: true },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Tạo sự kiện mới" />
      <Card>
        <CardBody>
          <form action={createCampaign} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên sự kiện" required htmlFor="title">
                <TextInput id="title" name="title" required placeholder="VD: Mùa hè xanh 2026" />
              </Field>
              <Field label="Mã sự kiện" htmlFor="code" hint="Bỏ trống để hệ thống tự sinh">
                <TextInput id="code" name="code" placeholder="TN2026-01" />
              </Field>
              <Field label="Đơn vị tổ chức" htmlFor="organizer">
                <TextInput id="organizer" name="organizer" />
              </Field>
              <Field label="Địa điểm" htmlFor="location">
                <TextInput id="location" name="location" />
              </Field>
              <Field label="Bắt đầu" htmlFor="startAt">
                <TextInput id="startAt" name="startAt" type="datetime-local" />
              </Field>
              <Field label="Kết thúc" htmlFor="endAt">
                <TextInput id="endAt" name="endAt" type="datetime-local" />
              </Field>
              <Field label="Mở đăng ký" htmlFor="regOpenAt">
                <TextInput id="regOpenAt" name="regOpenAt" type="datetime-local" />
              </Field>
              <Field label="Đóng đăng ký" htmlFor="regCloseAt">
                <TextInput id="regCloseAt" name="regCloseAt" type="datetime-local" />
              </Field>
              <Field label="Số lượng tối đa" htmlFor="capacity" hint="Bỏ trống nếu không giới hạn">
                <TextInput id="capacity" name="capacity" type="number" min={0} />
              </Field>
              <Field label="Giờ TNV mặc định" htmlFor="hoursDefault">
                <TextInput id="hoursDefault" name="hoursDefault" type="number" step="0.5" defaultValue={0} />
              </Field>
              <Field label="Điểm rèn luyện mặc định" htmlFor="pointsDefault">
                <TextInput id="pointsDefault" name="pointsDefault" type="number" defaultValue={0} />
              </Field>
            </div>
            <Field label="Mô tả ngắn" htmlFor="summary">
              <TextInput id="summary" name="summary" />
            </Field>
            <Field label="Mô tả chi tiết" htmlFor="description">
              <TextArea id="description" name="description" rows={6} />
            </Field>
            <div className="flex flex-wrap gap-4">
              <CheckboxInput name="allowSelfJoin" defaultChecked label="Cho phép tình nguyện viên tự đăng ký" />
              <CheckboxInput name="requireApproval" defaultChecked label="Cần admin duyệt đăng ký" />
            </div>

            {otherAdmins.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-1.5 text-sm font-medium text-slate-700">Admin cùng phụ trách sự kiện này</p>
                <p className="mb-2 text-xs text-slate-500">
                  Bạn (người tạo) mặc định có toàn quyền với sự kiện này. Admin nào KHÔNG được tích ở đây sẽ
                  không thao tác được gì trên sự kiện này, kể cả khi họ đang quản admin sự kiện khác.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {otherAdmins.map((a) => (
                    <CheckboxInput
                      key={a.id}
                      name="coAdminIds"
                      value={a.id}
                      label={
                        <span className="flex items-center gap-2">
                          <Avatar name={a.name} email={a.email} image={a.image} size={22} />
                          {a.name ?? a.email}
                        </span>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <SubmitButton pendingLabel="Đang tạo…">Tạo sự kiện</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
