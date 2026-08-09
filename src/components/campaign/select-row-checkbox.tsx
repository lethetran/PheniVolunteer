'use client'

export function SelectRowCheckbox({
  registrationId,
  label,
  formId,
}: {
  registrationId: string
  label: string
  formId: string
}) {
  return (
    <input
      type="checkbox"
      name="registrationIds"
      value={registrationId}
      form={formId}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
    />
  )
}
