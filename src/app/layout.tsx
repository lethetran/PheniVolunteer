import type { Metadata } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer'

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: 'Hệ thống quản lý tình nguyện viên Phenikaa',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
