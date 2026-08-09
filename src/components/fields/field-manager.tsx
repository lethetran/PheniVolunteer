import type { FieldDefinition, FieldScope } from '@prisma/client'
import { FIELD_TYPE_LABELS, FIELD_TYPES } from '@/lib/fields'
import { Field, TextInput, SelectInput, CheckboxInput } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Badge } from '@/components/ui/badge'
import { createField, updateField, toggleFieldArchived } from '@/actions/field-actions'

export function FieldManager({
  scope,
  campaignId,
  defs,
  title,
  description,
}: {
  scope: FieldScope
  campaignId?: string
  defs: FieldDefinition[]
  title: string
  description?: string
}) {
  const active = defs.filter((d) => !d.archived)
  const archived = defs.filter((d) => d.archived)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>

      <div className="space-y-2">
        {active.length === 0 && <p className="text-sm text-slate-500">Chưa có cột nào.</p>}
        {active.map((def) => (
          <details key={def.id} className="rounded-lg border border-slate-100">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">
                {def.label} <span className="text-xs text-slate-400">({def.key})</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone="blue">{FIELD_TYPE_LABELS[def.type]}</Badge>
                {def.required && <Badge tone="amber">Bắt buộc</Badge>}
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              <form action={updateField.bind(null, def.id)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nhãn hiển thị" required>
                    <TextInput name="label" required defaultValue={def.label} />
                  </Field>
                  <Field label="Loại dữ liệu">
                    <SelectInput name="type" defaultValue={def.type}>
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <Field label="Lựa chọn" hint="Cách nhau bởi dấu phẩy, dùng cho loại Chọn 1 / Chọn nhiều">
                  <TextInput name="options" defaultValue={def.options.join(', ')} />
                </Field>
                <Field label="Gợi ý / placeholder">
                  <TextInput name="placeholder" defaultValue={def.placeholder ?? ''} />
                </Field>
                <Field label="Mô tả thêm">
                  <TextInput name="helpText" defaultValue={def.helpText ?? ''} />
                </Field>
                <Field label="Thứ tự hiển thị">
                  <TextInput name="order" type="number" defaultValue={def.order} />
                </Field>
                <div className="flex flex-wrap gap-4">
                  <CheckboxInput name="required" defaultChecked={def.required} label="Bắt buộc" />
                  <CheckboxInput name="visibleToVolunteer" defaultChecked={def.visibleToVolunteer} label="TNV nhìn thấy" />
                  <CheckboxInput name="editableByVolunteer" defaultChecked={def.editableByVolunteer} label="TNV tự sửa được" />
                </div>
                <div className="flex gap-2">
                  <SubmitButton size="sm" pendingLabel="Đang lưu…">
                    Lưu
                  </SubmitButton>
                </div>
              </form>
              <form action={toggleFieldArchived.bind(null, def.id)}>
                <SubmitButton variant="ghost" size="sm" pendingLabel="Đang ẩn…">
                  Ẩn / lưu trữ cột này
                </SubmitButton>
              </form>
            </div>
          </details>
        ))}
      </div>

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-500">
            {archived.length} cột đã lưu trữ
          </summary>
          <div className="mt-2 space-y-2">
            {archived.map((def) => (
              <div key={def.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm text-slate-400">
                <span>{def.label}</span>
                <form action={toggleFieldArchived.bind(null, def.id)}>
                  <SubmitButton variant="ghost" size="sm" pendingLabel="Đang khôi phục…">
                    Khôi phục
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 p-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-600">+ Thêm cột mới</summary>
        <form action={createField} className="mt-3 space-y-3">
          <input type="hidden" name="scope" value={scope} />
          {campaignId && <input type="hidden" name="campaignId" value={campaignId} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nhãn hiển thị" required>
              <TextInput name="label" required placeholder="VD: Size áo" />
            </Field>
            <Field label="Loại dữ liệu">
              <SelectInput name="type" defaultValue="TEXT">
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field label="Lựa chọn" hint="Cách nhau bởi dấu phẩy, dùng cho loại Chọn 1 / Chọn nhiều">
            <TextInput name="options" placeholder="S, M, L, XL" />
          </Field>
          <div className="flex flex-wrap gap-4">
            <CheckboxInput name="required" label="Bắt buộc" />
            <CheckboxInput name="visibleToVolunteer" defaultChecked label="TNV nhìn thấy" />
            <CheckboxInput name="editableByVolunteer" label="TNV tự sửa được" />
          </div>
          <SubmitButton size="sm" pendingLabel="Đang thêm…">
            Thêm cột
          </SubmitButton>
        </form>
      </details>
    </div>
  )
}
