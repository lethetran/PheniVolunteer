'use client'

import { useActionState } from 'react'
import { ErrorText } from './field'

export type ActionState = { error?: string } | undefined

/**
 * Form dùng cho các action tự phục vụ (đăng ký, huỷ đăng ký, cập nhật hồ sơ...) nơi
 * người dùng cần thấy đúng lý do thất bại. Next.js ẩn message gốc của lỗi throw ra
 * từ Server Action trong bản production — nên các action này trả về { error } thay
 * vì throw, và form đọc lại qua useActionState để hiển thị đúng nội dung lỗi.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <div className="mt-3">
          <ErrorText>{state.error}</ErrorText>
        </div>
      )}
    </form>
  )
}
