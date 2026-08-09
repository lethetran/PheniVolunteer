'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass } from './button'

export function SubmitButton({
  children,
  pendingLabel = 'Đang lưu…',
  variant,
  size,
  className,
  disabled,
  formAction,
}: {
  children: React.ReactNode
  pendingLabel?: string
  variant?: Parameters<typeof buttonClass>[0]
  size?: Parameters<typeof buttonClass>[1]
  className?: string
  /** Điều kiện vô hiệu hoá bổ sung ngoài trạng thái đang gửi (VD: chưa gõ đúng xác nhận). */
  disabled?: boolean
  /** Ghi đè action của form cha — dùng khi 1 form có nhiều nút submit cho nhiều action khác nhau. */
  formAction?: (formData: FormData) => void | Promise<void>
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending || disabled}
      className={buttonClass(variant, size, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
