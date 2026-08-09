import type { ImportJob } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { IMPORT_STATUS, IMPORT_KIND_LABELS } from '@/lib/labels'
import { relativeTime } from '@/lib/utils'

type RowError = { row: number; identifier: string; message: string }

export function ImportJobList({ jobs }: { jobs: ImportJob[] }) {
  if (jobs.length === 0) return null

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const errors = Array.isArray(job.errors) ? (job.errors as unknown as RowError[]) : []
        return (
          <details key={job.id} className="rounded-lg border border-slate-100 text-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{IMPORT_KIND_LABELS[job.kind] ?? job.kind}</span>
                <span className="text-xs text-slate-400">{job.fileName}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{relativeTime(job.createdAt)}</span>
                <Badge tone={IMPORT_STATUS[job.status].tone}>{IMPORT_STATUS[job.status].label}</Badge>
              </span>
            </summary>
            <div className="space-y-2 border-t border-slate-100 p-3">
              <p className="text-xs text-slate-500">
                Tổng {job.totalRows} dòng · Tạo mới {job.createdRows} · Cập nhật {job.updatedRows} · Lỗi{' '}
                {job.errorRows}
              </p>
              {errors.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg bg-red-50 p-2">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700">
                      Dòng {err.row} ({err.identifier || '—'}): {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}
