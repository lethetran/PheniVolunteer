import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { ROLE_LABELS } from '@/lib/permissions'
import { readData } from '@/lib/fields'
import { toDateInput } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui/card'
import { Field, TextInput, TextArea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { FieldInput } from '@/components/fields/field-input'
import { ROLE_TONE } from '@/lib/labels'
import { updateProfile } from '@/actions/profile'

export default async function ProfilePage() {
  const user = await requireUser()
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  const profileData = readData(full.profileData)

  const [fieldDefs, registrations] = await Promise.all([
    prisma.fieldDefinition.findMany({
      where: { scope: 'VOLUNTEER_PROFILE', archived: false, visibleToVolunteer: true },
      orderBy: { order: 'asc' },
    }),
    prisma.registration.findMany({
      where: { userId: user.id, status: 'APPROVED' },
      select: { hoursAwarded: true, pointsAwarded: true, completed: true },
    }),
  ])
  const totalHours = registrations.reduce((s, r) => s + r.hoursAwarded, 0)
  const totalPoints = registrations.reduce((s, r) => s + r.pointsAwarded, 0)
  const completedCount = registrations.filter((r) => r.completed).length

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ của tôi" description="Thông tin này được dùng khi bạn đăng ký tham gia sự kiện." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center gap-3 text-center">
            <Avatar name={full.name} email={full.email} image={full.image} size={72} />
            <div>
              <p className="font-semibold text-slate-900">{full.name ?? 'Chưa đặt tên'}</p>
              <p className="text-sm text-slate-500">{full.email}</p>
            </div>
            <Badge tone={ROLE_TONE[full.role]}>{ROLE_LABELS[full.role]}</Badge>

            <div className="mt-2 grid w-full grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
              <div>
                <p className="text-lg font-bold text-slate-900">{totalHours}</p>
                <p className="text-[11px] text-slate-500">Giờ CTXH</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{totalPoints}</p>
                <p className="text-[11px] text-slate-500">Điểm rèn luyện</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{completedCount}</p>
                <p className="text-[11px] text-slate-500">Sự kiện hoàn thành</p>
              </div>
            </div>
            <Link href="/dashboard" className="text-xs font-medium text-brand-600 hover:underline">
              Xem chi tiết từng sự kiện →
            </Link>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Cập nhật thông tin" />
          <CardBody>
            <form action={updateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Họ và tên" htmlFor="name">
                  <TextInput id="name" name="name" defaultValue={full.name ?? ''} />
                </Field>
                <Field label="Mã sinh viên" htmlFor="studentCode">
                  <TextInput id="studentCode" name="studentCode" defaultValue={full.studentCode ?? ''} />
                </Field>
                <Field label="Số điện thoại" htmlFor="phone">
                  <TextInput id="phone" name="phone" defaultValue={full.phone ?? ''} />
                </Field>
                <Field label="Ngày sinh" htmlFor="dob">
                  <TextInput id="dob" name="dob" type="date" defaultValue={toDateInput(full.dob)} />
                </Field>
                <Field label="Khoa / Viện" htmlFor="faculty">
                  <TextInput id="faculty" name="faculty" defaultValue={full.faculty ?? ''} />
                </Field>
                <Field label="Lớp" htmlFor="className">
                  <TextInput id="className" name="className" defaultValue={full.className ?? ''} />
                </Field>
                <Field label="Giới tính" htmlFor="gender">
                  <TextInput id="gender" name="gender" defaultValue={full.gender ?? ''} />
                </Field>
                <Field label="Địa chỉ" htmlFor="address">
                  <TextInput id="address" name="address" defaultValue={full.address ?? ''} />
                </Field>
              </div>
              <Field label="Giới thiệu bản thân" htmlFor="bio">
                <TextArea id="bio" name="bio" defaultValue={full.bio ?? ''} />
              </Field>

              {fieldDefs.length > 0 && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {fieldDefs.map((def) => (
                    <FieldInput
                      key={def.id}
                      def={def}
                      defaultValue={profileData[def.key]}
                      disabled={!def.editableByVolunteer}
                    />
                  ))}
                </div>
              )}

              <SubmitButton pendingLabel="Đang lưu…">Lưu thay đổi</SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
