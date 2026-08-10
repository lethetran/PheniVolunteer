import { requireRoot } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  ROLE_LABELS,
  ROLE_ORDER,
  GLOBAL_GRANTABLE_PERMISSIONS,
  PERMISSION_LABELS,
} from '@/lib/permissions'
import { ROLE_TONE, USER_STATUS } from '@/lib/labels'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/card'
import { Field, TextInput, SelectInput, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { createAdmin, setUserRole, setUserPermissions, setUserStatus } from '@/actions/users'
import type { Role, UserStatus } from '@prisma/client'

export default async function AdminUsersPage() {
  const actor = await requireRoot()
  const users = await prisma.user.findMany({
    where: { role: { not: 'VOLUNTEER' } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
  const sorted = users.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])

  return (
    <div className="space-y-6">
      <PageHeader title="Tài khoản quản trị" description="Cấp quyền Admin và quản lý trưởng nhóm trong hệ thống." />

      <Card>
        <CardHeader title="Cấp quyền Admin mới" />
        <CardBody>
          <form action={createAdmin} className="flex flex-wrap items-end gap-3">
            <Field label="Email" htmlFor="new-admin-email">
              <TextInput id="new-admin-email" name="email" type="email" required placeholder="ten@phenikaa-uni.edu.vn" className="w-72" />
            </Field>
            <SubmitButton pendingLabel="Đang cấp quyền…">Cấp quyền Admin</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {sorted.map((u) => (
          <Card key={u.id}>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} email={u.email} image={u.image} size={36} />
                  <div>
                    <p className="font-medium text-slate-900">{u.name ?? u.email}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  <Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge>
                </div>
              </div>

              {u.id !== actor.id && u.role !== 'ROOT_ADMIN' && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={setUserRole.bind(null, u.id)} className="flex items-center gap-2">
                      <SelectInput name="role" defaultValue={u.role} className="w-40">
                        {(['ADMIN', 'MANAGER', 'VOLUNTEER'] as Role[])
                          .filter((r) => r !== 'MANAGER' || u.role === 'MANAGER')
                          .map((r) => (
                            <option key={r} value={r} disabled={r === 'MANAGER'}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                      </SelectInput>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Đang đổi…">
                        Đổi vai trò
                      </SubmitButton>
                    </form>

                    <form action={setUserStatus.bind(null, u.id, (u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE') as UserStatus)}>
                      <SubmitButton variant={u.status === 'ACTIVE' ? 'danger' : 'outline'} size="sm" pendingLabel="Đang lưu…">
                        {u.status === 'ACTIVE' ? 'Khoá tài khoản' : 'Mở khoá'}
                      </SubmitButton>
                    </form>
                  </div>
                  {u.role === 'MANAGER' && (
                    <p className="mt-2 text-xs text-slate-500">
                      Vai trò <strong>Quản lý nhóm</strong> được hệ thống tự gán khi {u.name ?? u.email} được cử
                      làm trưởng nhóm/admin phụ trách 1 sự kiện, và tự gỡ khi không còn phụ trách nhóm/sự kiện
                      nào — không gán tay được ở đây. Muốn gỡ hẳn quyền của họ, vào Cài đặt của từng sự kiện/nhóm
                      liên quan.
                    </p>
                  )}
                </div>
              )}

              {u.role === 'ADMIN' && (
                <details className="border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">Cấp quyền chi tiết</summary>
                  <p className="mt-2 text-xs text-slate-500">
                    Đây là quyền <strong>toàn hệ thống</strong>, không liên quan tới sự kiện cụ thể nào. Muốn{' '}
                    {u.name ?? u.email} phụ trách 1 sự kiện, vào trang <em>Cài đặt</em> của sự kiện đó và thêm họ làm
                    admin phụ trách riêng.
                  </p>
                  <form action={setUserPermissions.bind(null, u.id)} className="mt-3 space-y-3">
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {GLOBAL_GRANTABLE_PERMISSIONS.map((p) => (
                        <CheckboxInput
                          key={p}
                          name="permissions"
                          value={p}
                          defaultChecked={u.permissions.includes(p)}
                          label={PERMISSION_LABELS[p]}
                        />
                      ))}
                    </div>
                    <SubmitButton size="sm" pendingLabel="Đang lưu…">Lưu quyền</SubmitButton>
                  </form>
                </details>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
