import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
  }
}

/** Danh sách domain email được phép đăng nhập. */
export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? 'st.phenikaa-uni.edu.vn,phenikaa-uni.edu.vn')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false
  const domain = email.toLowerCase().split('@')[1]
  if (!domain) return false
  return allowedDomains().includes(domain)
}

export function rootAdminEmails(): string[] {
  return (process.env.ROOT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

const devLoginEnabled = process.env.ALLOW_DEV_LOGIN === 'true'

const providers = []

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'select_account',
          // Không giới hạn "hd" ở đây vì Root Admin có thể dùng Gmail cá nhân —
          // việc chặn theo domain trường (trừ Root Admin) được xử lý ở callback signIn bên dưới.
        },
      },
    }),
  )
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Email nội bộ (chế độ thử nghiệm)',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu chung', type: 'password' },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? '').trim().toLowerCase()
        const password = String(raw?.password ?? '')
        const isRoot = rootAdminEmails().includes(email)
        if (!isAllowedEmail(email) && !isRoot) return null
        if (password !== (process.env.DEV_LOGIN_PASSWORD ?? 'phenikaa-dev')) return null
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            name: email.split('@')[0],
            role: isRoot ? 'ROOT_ADMIN' : 'VOLUNTEER',
            emailVerified: new Date(),
          },
        })
        if (user.status === 'LOCKED') return null
        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase()
      // Chỉ cho phép email thuộc domain trường — trừ Root Admin (được khai báo trong
      // ROOT_ADMIN_EMAILS) có thể dùng Gmail cá nhân hoặc email khác.
      if (!isAllowedEmail(email) && !rootAdminEmails().includes(email ?? '')) {
        return `/login?error=domain`
      }

      if (account?.provider === 'google') {
        const existing = await prisma.user.findUnique({
          where: { email: user.email!.toLowerCase() },
          select: { status: true },
        })
        if (existing?.status === 'LOCKED') return `/login?error=locked`
      }
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      // Bảo đảm token luôn trỏ tới user thật trong DB (kể cả khi DB bị reset)
      if (!token.sub && token.email) {
        const found = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { id: true },
        })
        if (found) token.sub = found.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.email) return
      const email = user.email.toLowerCase()
      const isRoot = rootAdminEmails().includes(email)
      await prisma.user.update({
        where: { email },
        data: {
          lastLoginAt: new Date(),
          emailVerified: new Date(),
          ...(isRoot ? { role: 'ROOT_ADMIN' as const, status: 'ACTIVE' as const } : {}),
        },
      }).catch(() => {})
    },
    async createUser({ user }) {
      if (!user.email) return
      const email = user.email.toLowerCase()
      // Chuẩn hoá email về chữ thường + đoán mã sinh viên từ email dạng 21010xxx@st...
      const studentCode = /^\d{6,12}$/.test(email.split('@')[0]) ? email.split('@')[0] : null
      await prisma.user
        .update({ where: { id: user.id }, data: { email, studentCode } })
        .catch(() => {})
    },
  },
})

export const hasGoogleProvider = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
)
export const hasDevLogin = devLoginEnabled
