import Image from 'next/image'
import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function Avatar({
  name,
  email,
  image,
  size = 32,
  className,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: number
  className?: string
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? email ?? ''}
        width={size}
        height={size}
        className={cn('rounded-full object-cover ring-1 ring-slate-200', className)}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        className,
      )}
    >
      {initials(name, email)}
    </div>
  )
}
