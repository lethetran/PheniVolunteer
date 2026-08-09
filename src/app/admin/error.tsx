'use client'

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl">⚠️</div>
      <h1 className="text-base font-bold text-slate-900">Đã xảy ra lỗi</h1>
      <p className="mt-2 text-sm text-slate-600">{error.message || 'Có lỗi không xác định xảy ra.'}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Thử lại
      </button>
    </div>
  )
}
