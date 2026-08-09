import { requirePermission } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { PageHeader, Card, CardBody } from '@/components/ui/card'
import { FormSection } from '@/components/ui/form-section'
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
          <form action={createCampaign} className="space-y-5">
            <FormSection title="Thông tin cơ bản">
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
              </div>
              <Field label="Mô tả ngắn" htmlFor="summary">
                <TextInput id="summary" name="summary" />
              </Field>
              <Field label="Mô tả chi tiết" htmlFor="description">
                <TextArea id="description" name="description" rows={6} />
              </Field>
            </FormSection>

            <FormSection title="Thời gian">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </FormSection>

            <FormSection title="Đăng ký">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số lượng tối đa" htmlFor="capacity" hint="Bỏ trống nếu không giới hạn">
                  <TextInput id="capacity" name="capacity" type="number" min={0} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <CheckboxInput name="allowSelfJoin" defaultChecked label="Cho phép tình nguyện viên tự đăng ký" />
                <CheckboxInput name="requireApproval" defaultChecked label="Cần admin duyệt đăng ký" />
              </div>
            </FormSection>

            <FormSection title="Nâng cao" description="Giá trị mặc định gán cho mỗi thành viên khi hoàn thành sự kiện.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Giờ TNV mặc định" htmlFor="hoursDefault">
                  <TextInput id="hoursDefault" name="hoursDefault" type="number" step="0.5" defaultValue={0} />
                </Field>
                <Field label="Điểm rèn luyện mặc định" htmlFor="pointsDefault">
                  <TextInput id="pointsDefault" name="pointsDefault" type="number" defaultValue={0} />
                </Field>
              </div>
            </FormSection>

            {otherAdmins.length > 0 && (
              <FormSection
                title="Admin cùng phụ trách sự kiện này"
                description="Bạn (người tạo) mặc định có toàn quyền với sự kiện này. Admin nào KHÔNG được tích ở đây sẽ không thao tác được gì trên sự kiện này, kể cả khi họ đang quản admin sự kiện khác."
              >
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
              </FormSection>
            )}

            <SubmitButton pendingLabel="Đang tạo…">Tạo sự kiện</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
