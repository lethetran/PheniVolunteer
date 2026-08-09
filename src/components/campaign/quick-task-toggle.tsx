'use client'

import { useTransition } from 'react'
import { reviewTaskProgress } from '@/actions/tasks'

export function QuickTaskToggle({ progressId, done }: { progressId: string; done: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={pending}
      aria-label="Đánh dấu hoàn thành"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const fd = new FormData()
        fd.set('status', e.target.checked ? 'DONE' : 'NOT_STARTED')
        startTransition(() => {
          reviewTaskProgress(progressId, fd)
        })
      }}
      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-600 disabled:opacity-50"
    />
  )
}
