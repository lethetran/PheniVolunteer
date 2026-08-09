import type { CampaignGroup, FieldDefinition, Registration, User } from '@prisma/client'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { SelectInput, TextInput, TextArea } from '@/components/ui/field'
import { FieldInput } from '@/components/fields/field-input'
import { REGISTRATION_STATUS, ATTENDANCE_STATUS } from '@/lib/labels'
import { readData, displayValue } from '@/lib/fields'
import { formatDateTime, toDateTimeLocal } from '@/lib/utils'
import {
  decideRegistration,
  updateRegistrationGroup,
  updateTracking,
  updateAttendance,
  removeMember,
} from '@/actions/registrations'

type Reg = Registration & { user: User; group: CampaignGroup | null }

export function MemberRow({
  reg,
  groups,
  trackingFields,
  regFields,
  canReview,
  canManage,
  canChangeGroup,
  canAttendance,
}: {
  reg: Reg
  groups: CampaignGroup[]
  trackingFields: FieldDefinition[]
  regFields: FieldDefinition[]
  canReview: boolean
  canManage: boolean
  canChangeGroup: boolean
  canAttendance: boolean
}) {
  const formData = readData(reg.formData)
  const trackingData = readData(reg.trackingData)

  return (
    <details className="rounded-xl border border-slate-100">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={reg.user.name} email={reg.user.email} image={reg.user.image} size={32} />
          <div>
            <p className="text-sm font-medium text-slate-900">{reg.user.name ?? reg.user.email}</p>
            <p className="text-xs text-slate-500">{reg.user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {reg.group && <Badge tone="gray">{reg.group.name}</Badge>}
          <Badge tone={REGISTRATION_STATUS[reg.status].tone}>{REGISTRATION_STATUS[reg.status].label}</Badge>
          <Badge tone={ATTENDANCE_STATUS[reg.attendance].tone}>{ATTENDANCE_STATUS[reg.attendance].label}</Badge>
          {reg.completed && <Badge tone="green">Đã hoàn thành</Badge>}
        </div>
      </summary>

      <div className="space-y-4 border-t border-slate-100 p-4">
        {regFields.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Câu trả lời đăng ký</p>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              {regFields.map((f) => (
                <div key={f.id} className="flex gap-1">
                  <dt className="text-slate-400">{f.label}:</dt>
                  <dd className="text-slate-700">{displayValue(f, formData[f.key]) || '—'}</dd>
                </div>
              ))}
            </dl>
            {reg.motivation && <p className="mt-1 text-sm text-slate-600">Lý do: {reg.motivation}</p>}
          </div>
        )}

        {canReview && reg.status === 'PENDING' && (
          <form action={decideRegistration.bind(null, reg.id)} className="flex flex-wrap items-end gap-2 rounded-lg bg-amber-50 p-3">
            <div className="flex-1">
              <TextInput name="rejectReason" placeholder="Lý do (nếu từ chối)" />
            </div>
            <button
              type="submit"
              name="decision"
              value="APPROVED"
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
            >
              Duyệt
            </button>
            <button
              type="submit"
              name="decision"
              value="WAITLIST"
              className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Danh sách chờ
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECTED"
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
            >
              Từ chối
            </button>
          </form>
        )}

        {canChangeGroup && (
          <form action={updateRegistrationGroup.bind(null, reg.id)} className="flex items-end gap-2">
            <div className="w-48">
              <SelectInput name="groupId" defaultValue={reg.groupId ?? ''}>
                <option value="">— Chưa xếp nhóm —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
              Đổi nhóm
            </SubmitButton>
          </form>
        )}

        {canAttendance && (
          <form action={updateAttendance.bind(null, reg.id)} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-2">
            <SelectInput name="attendance" defaultValue={reg.attendance}>
              {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </SelectInput>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="completed" id={`completed-${reg.id}`} defaultChecked={reg.completed} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              <label htmlFor={`completed-${reg.id}`} className="text-sm text-slate-700">
                Hoàn thành
              </label>
            </div>
            <TextInput name="checkInAt" type="datetime-local" defaultValue={toDateTimeLocal(reg.checkInAt)} placeholder="Check-in" />
            <TextInput name="checkOutAt" type="datetime-local" defaultValue={toDateTimeLocal(reg.checkOutAt)} placeholder="Check-out" />
            <TextInput name="hoursAwarded" type="number" step="0.5" defaultValue={reg.hoursAwarded} placeholder="Số giờ" />
            <TextInput name="pointsAwarded" type="number" defaultValue={reg.pointsAwarded} placeholder="Điểm" />
            <div className="sm:col-span-2">
              <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
                Lưu điểm danh
              </SubmitButton>
            </div>
          </form>
        )}

        {canManage && trackingFields.length > 0 && (
          <form action={updateTracking.bind(null, reg.id)} className="space-y-3 rounded-lg border border-slate-100 p-3">
            <p className="text-xs font-semibold text-slate-500">Cột theo dõi</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {trackingFields.map((f) => (
                <FieldInput key={f.id} def={f} defaultValue={trackingData[f.key]} />
              ))}
            </div>
            <TextArea name="note" rows={2} placeholder="Ghi chú nhanh…" defaultValue={reg.note ?? ''} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Đang lưu…">
              Lưu theo dõi
            </SubmitButton>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Đăng ký lúc {formatDateTime(reg.appliedAt)}</span>
          {canManage && reg.status !== 'REMOVED' && (
            <form action={removeMember.bind(null, reg.id)}>
              <SubmitButton variant="ghost" size="sm" pendingLabel="Đang loại…">
                Loại khỏi sự kiện
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </details>
  )
}
