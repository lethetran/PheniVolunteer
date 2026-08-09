'use client'

import { useId, useState } from 'react'
import { SubmitButton } from './submit-button'

/**
 * Form cho hành động phá huỷ không thể hoàn tác — nút xoá chỉ bật khi gõ đúng
 * `expectedText` (thường là tên sự kiện/mục cần xoá), tránh bấm nhầm.
 */
export function ConfirmDeleteForm({
  action,
  expectedText,
  fieldName = 'confirmTitle',
  submitLabel = 'Xoá vĩnh viễn',
  pendingLabel = 'Đang xoá…',
}: {
  action: (formData: FormData) => Promise<void>
  expectedText: string
  fieldName?: string
  submitLabel?: string
  pendingLabel?: string
}) {
  const [value, setValue] = useState('')
  const inputId = useId()
  const matched = value.trim().length > 0 && value.trim() === expectedText.trim()

  return (
    <form action={action} className="space-y-2">
      <label htmlFor={inputId} className="block text-sm text-slate-600">
        Gõ lại <span className="font-semibold text-slate-800">{expectedText}</span> để xác nhận
      </label>
      <input
        id={inputId}
        name={fieldName}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        placeholder={expectedText}
        className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-red-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-red-600"
      />
      <SubmitButton variant="danger" disabled={!matched} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  )
}
