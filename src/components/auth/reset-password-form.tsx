'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas/auth'
import { resetPassword } from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onSubmit(data: ResetPasswordValues) {
    setIsLoading(true)
    setError(null)
    const result = await resetPassword(data)
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md font-sans">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight mb-3">Set New Password</h1>
        <p className="text-[var(--muted-foreground)] font-medium text-sm">Choose a new password for your account.</p>
      </div>

      <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden p-2">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="password">
                New Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.confirmPassword.message}</p>
              )}
            </div>
            {error && (
              <p className="text-xs font-semibold uppercase text-[var(--destructive)] bg-[var(--destructive-foreground)]/50 p-4 rounded-2xl border border-[var(--destructive)]/20">{error}</p>
            )}
          </CardContent>
          <CardFooter className="p-8 pt-0">
            <Button
              className="w-full h-14 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20 font-sans font-semibold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Updating…' : 'Update Password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
