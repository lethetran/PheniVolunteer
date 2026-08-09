'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass } from './button'

export function SubmitButton({
  children,
  pendingLabel = 'Đang lưu…',
  variant,
  size,
  className,
}: {
  children: React.ReactNode
  pendingLabel?: string
  variant?: Parameters<typeof buttonClass>[0]
  size?: Parameters<typeof buttonClass>[1]
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? pendingLabel : children}
    </button>
  )
}
