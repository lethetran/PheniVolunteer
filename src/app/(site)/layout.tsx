import { Topbar } from '@/components/nav/topbar'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer'}
      </footer>
    </div>
  )
}
