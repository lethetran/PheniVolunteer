import type { FieldDefinition } from '@prisma/client'
import { Field, TextInput, TextArea, SelectInput, CheckboxInput } from '@/components/ui/field'

const INPUT_TYPE: Partial<Record<FieldDefinition['type'], string>> = {
  NUMBER: 'number',
  DATE: 'date',
  EMAIL: 'email',
  PHONE: 'tel',
  URL: 'url',
}

export function FieldInput({
  def,
  defaultValue,
  prefix = 'f_',
  disabled,
}: {
  def: FieldDefinition
  defaultValue?: unknown
  prefix?: string
  disabled?: boolean
}) {
  const name = `${prefix}${def.key}`

  if (def.type === 'CHECKBOX') {
    return (
      <CheckboxInput
        name={name}
        defaultChecked={Boolean(defaultValue)}
        disabled={disabled}
        label={
          <span>
            {def.label}
            {def.required && <span className="ml-0.5 text-red-500">*</span>}
          </span>
        }
      />
    )
  }

  if (def.type === 'MULTISELECT') {
    const selected = Array.isArray(defaultValue) ? defaultValue.map(String) : []
    return (
      <Field label={def.label} required={def.required} hint={def.helpText ?? undefined}>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 p-3">
          {def.options.length === 0 && <p className="text-xs text-slate-400">Chưa có lựa chọn nào.</p>}
          {def.options.map((opt) => (
            <CheckboxInput
              key={opt}
              name={name}
              value={opt}
              defaultChecked={selected.includes(opt)}
              disabled={disabled}
              label={opt}
            />
          ))}
        </div>
      </Field>
    )
  }

  if (def.type === 'SELECT') {
    return (
      <Field label={def.label} required={def.required} hint={def.helpText ?? undefined} htmlFor={name}>
        <SelectInput id={name} name={name} defaultValue={String(defaultValue ?? '')} required={def.required} disabled={disabled}>
          <option value="">— Chọn —</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectInput>
      </Field>
    )
  }

  if (def.type === 'TEXTAREA') {
    return (
      <Field label={def.label} required={def.required} hint={def.helpText ?? undefined} htmlFor={name}>
        <TextArea
          id={name}
          name={name}
          required={def.required}
          disabled={disabled}
          placeholder={def.placeholder ?? undefined}
          defaultValue={String(defaultValue ?? '')}
        />
      </Field>
    )
  }

  return (
    <Field label={def.label} required={def.required} hint={def.helpText ?? undefined} htmlFor={name}>
      <TextInput
        id={name}
        name={name}
        type={INPUT_TYPE[def.type] ?? 'text'}
        required={def.required}
        disabled={disabled}
        placeholder={def.placeholder ?? undefined}
        defaultValue={String(defaultValue ?? '')}
      />
    </Field>
  )
}
