'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas/auth'
import { requestPasswordReset } from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordValues) {
    setIsLoading(true)
    await requestPasswordReset(data)
    setSubmitted(true)
    setIsLoading(false)
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md font-sans text-center">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="SubTrack Logo" width={64} height={64} className="rounded-2xl shadow-xl shadow-[var(--primary)]/10" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">📬</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-[var(--foreground)] tracking-tight mb-3">Check your email</h1>
        <p className="text-[var(--muted-foreground)] font-medium text-sm mb-8">
          If an account exists for that email, we've sent a password reset link. Check your inbox.
        </p>
        <Link href="/login" className="text-[var(--primary)] font-semibold text-sm hover:opacity-80 transition-opacity">
          ← Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md font-sans">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="SubTrack Logo" width={64} height={64} className="rounded-2xl shadow-xl shadow-[var(--primary)]/10" />
        </div>
        <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight mb-3">Forgot Password</h1>
        <p className="text-[var(--muted-foreground)] font-medium text-sm">Enter your email and we'll send a reset link.</p>
      </div>

      <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden p-2">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="email">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.email.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 p-8 pt-0">
            <Button
              className="w-full h-14 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20 font-sans font-semibold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Sending…' : 'Send Reset Link'}
            </Button>
            <p className="text-sm text-center font-medium text-[var(--muted-foreground)]">
              Remember it?{' '}
              <Link href="/login" className="text-[var(--primary)] font-semibold uppercase tracking-widest text-xs hover:opacity-80 transition-opacity ml-1">
                Log In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
