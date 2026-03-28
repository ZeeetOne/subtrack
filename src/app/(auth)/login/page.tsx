import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)]">
      {message && (
        <div className="p-4 mb-4 text-sm font-semibold text-[var(--primary)] bg-[var(--accent)] rounded-2xl border border-[var(--primary)]/20">
          {message}
        </div>
      )}
      <LoginForm />
    </div>
  )
}
