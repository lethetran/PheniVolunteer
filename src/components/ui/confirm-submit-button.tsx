'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass } from './button'

/**
 * Nút submit hỏi xác nhận (window.confirm) trước khi thực sự gửi form — dùng cho
 * các hành động xoá/loại bỏ không thể hoàn tác nhưng không cần mức xác nhận nặng
 * như gõ lại tên (xem ConfirmDeleteForm cho trường hợp đó).
 */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel = 'Đang xử lý…',
  variant,
  size,
  className,
}: {
  children: React.ReactNode
  confirmMessage: string
  pendingLabel?: string
  variant?: Parameters<typeof buttonClass>[0]
  size?: Parameters<typeof buttonClass>[1]
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
      className={buttonClass(variant, size, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
