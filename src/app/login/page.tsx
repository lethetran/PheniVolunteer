import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { getCurrentUser } from '@/lib/session'
import { signIn, hasGoogleProvider, hasDevLogin, allowedDomains } from '@/lib/auth'
import { TextInput, Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'Chỉ tài khoản email sinh viên/trường mới đăng nhập được.',
  locked: 'Tài khoản của bạn đã bị khoá. Liên hệ quản trị viên để được hỗ trợ.',
  invalid: 'Email hoặc mật khẩu không đúng.',
  default: 'Đăng nhập thất bại, vui lòng thử lại.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  const { error, callbackUrl } = await searchParams
  const redirectTo = callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/dashboard'
  const domains = allowedDomains()

  async function googleLogin() {
    'use server'
    await signIn('google', { redirectTo })
  }

  async function devLogin(formData: FormData) {
    'use server'
    try {
      await signIn('dev', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo,
      })
    } catch (e) {
      if (e instanceof AuthError) redirect('/login?error=invalid')
      throw e
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
            PV
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Hệ thống quản lý tình nguyện viên</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}
            </p>
          )}

          {hasGoogleProvider && (
            <form action={googleLogin}>
              <SubmitButton variant="outline" className="w-full" pendingLabel="Đang chuyển hướng…">
                <GoogleIcon />
                Đăng nhập bằng Google
              </SubmitButton>
            </form>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Chỉ áp dụng cho email {domains.map((d) => `@${d}`).join(', ')}
          </p>

          {hasDevLogin && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                Chế độ thử nghiệm
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <form action={devLogin} className="space-y-3">
                <Field label="Email trường">
                  <TextInput type="email" name="email" required placeholder="21010001@st.phenikaa-uni.edu.vn" />
                </Field>
                <Field label="Mật khẩu chung">
                  <TextInput type="password" name="password" required />
                </Field>
                <SubmitButton variant="secondary" className="w-full">
                  Đăng nhập thử nghiệm
                </SubmitButton>
              </form>
            </>
          )}

          {!hasGoogleProvider && !hasDevLogin && (
            <p className="text-sm text-slate-500">
              Chưa cấu hình phương thức đăng nhập nào. Vui lòng khai báo AUTH_GOOGLE_ID/SECRET
              trong biến môi trường.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.2-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.6 19 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.4 0-13.8 4.1-17.1 10.1z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.5-4.7 2.7-7.7 2.7-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.9 40.6 16.4 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.6 5.6C41.5 36.6 45 31.5 45 24c0-1.4-.2-2.7-.4-3.5z"
      />
    </svg>
  )
}
