import { requirePermission } from '@/lib/session'
import { PERMISSIONS } from '@/lib/permissions'
import { PageHeader, Card, CardBody } from '@/components/ui/card'
import { Field, TextInput, TextArea, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { createCampaign } from '@/actions/campaigns'

export default async function NewCampaignPage() {
  await requirePermission(PERMISSIONS.CAMPAIGN_CREATE)

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
            <SubmitButton pendingLabel="Đang tạo…">Tạo sự kiện</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
