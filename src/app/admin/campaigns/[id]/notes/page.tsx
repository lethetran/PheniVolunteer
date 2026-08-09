import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { NOTE_SEVERITY, NOTE_STATUS } from '@/lib/labels'
import { formatDateTime } from '@/lib/utils'
import { Card, CardHeader, CardBody, EmptyState } from '@/components/ui/card'
import { Field, TextArea, SelectInput, CheckboxInput } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { createNote, updateNoteStatus, deleteNote } from '@/actions/notes'
import type { NoteStatus } from '@prisma/client'

export default async function CampaignNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  if (!scope.canAnywhere(PERMISSIONS.NOTE_MANAGE)) scope.assert(PERMISSIONS.NOTE_MANAGE)

  const registrations = await prisma.registration.findMany({
    where: scope.registrationWhere,
    select: { id: true, userId: true, user: { select: { name: true, email: true } }, group: { select: { name: true } } },
  })
  const registrationIds = registrations.map((r) => r.id)
  const userIds = registrations.map((r) => r.userId)

  const notes = await prisma.note.findMany({
    where: {
      campaignId: id,
      ...(scope.isCampaignWide
        ? {}
        : { OR: [{ registrationId: { in: registrationIds } }, { subjectId: { in: userIds } }] }),
    },
    include: { author: true, registration: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Thêm ghi chú" />
        <CardBody>
          <form action={createNote.bind(null, id)} className="space-y-3">
            <Field label="Liên quan đến thành viên" hint="Bỏ trống nếu là ghi chú chung">
              <SelectInput name="registrationId" defaultValue="">
                <option value="">— Ghi chú chung —</option>
                {registrations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.user.name ?? r.user.email}
                    {r.group ? ` (${r.group.name})` : ''}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Nội dung" required>
              <TextArea name="body" required rows={3} />
            </Field>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Mức độ">
                <SelectInput name="severity" defaultValue="INFO">
                  {Object.entries(NOTE_SEVERITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <CheckboxInput name="sharedWithVolunteer" label="Chia sẻ với tình nguyện viên" />
            </div>
            <SubmitButton pendingLabel="Đang thêm…">Thêm ghi chú</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Danh sách ghi chú (${notes.length})`} />
        <CardBody className="space-y-2">
          {notes.length === 0 ? (
            <EmptyState title="Chưa có ghi chú nào" />
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={NOTE_SEVERITY[note.severity].tone}>{NOTE_SEVERITY[note.severity].label}</Badge>
                    <Badge tone={NOTE_STATUS[note.status].tone}>{NOTE_STATUS[note.status].label}</Badge>
                    {note.registration && (
                      <span className="text-xs text-slate-500">
                        {note.registration.user.name ?? note.registration.user.email}
                      </span>
                    )}
                    {note.sharedWithVolunteer && <Badge tone="violet">Chia sẻ với TNV</Badge>}
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(note.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{note.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {note.status !== 'RESOLVED' && (
                    <form action={updateNoteStatus.bind(null, note.id, 'RESOLVED' as NoteStatus)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Đang lưu…">
                        Đánh dấu đã xong
                      </SubmitButton>
                    </form>
                  )}
                  {note.status === 'OPEN' && (
                    <form action={updateNoteStatus.bind(null, note.id, 'IN_PROGRESS' as NoteStatus)}>
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Đang lưu…">
                        Đang xử lý
                      </SubmitButton>
                    </form>
                  )}
                  <form action={deleteNote.bind(null, note.id)}>
                    <SubmitButton variant="ghost" size="sm" pendingLabel="Đang xoá…">
                      Xoá
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}
