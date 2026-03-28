'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupFormValues } from '@/lib/schemas/auth'
import { signup, signInWithGoogle } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true)
    setError(null)
    const result = await signup(data)
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md font-sans">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-heading font-semibold text-[var(--foreground)] tracking-tight mb-3">Create Account</h1>
        <p className="text-[var(--muted-foreground)] font-medium">Join SubTrack to start managing your subscriptions elegantly.</p>
      </div>

      <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden p-2">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="email">
                Email Address
              </label>
              <Input id="email" type="email" placeholder="name@example.com" className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]" {...register('email')} />
              {errors.email && <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="password">
                Password
              </label>
              <Input id="password" type="password" placeholder="••••••••" className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]" {...register('password')} />
              {errors.password && <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] font-heading" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" className="bg-[var(--background)] border-none h-14 rounded-2xl px-6 font-bold text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-[10px] font-semibold uppercase text-[var(--destructive)] mt-1 ml-1">{errors.confirmPassword.message}</p>}
            </div>

            {error && <p className="text-xs font-semibold uppercase text-[var(--destructive)] bg-[var(--destructive-foreground)]/50 p-4 rounded-2xl border border-[var(--destructive)]/20">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 p-8 pt-0">
            <Button className="w-full h-14 rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20 font-sans font-semibold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>

            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--background)]"></span>
              </div>
              <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-[0.2em]">
                <span className="bg-[var(--card)] px-4 text-[var(--muted-foreground)]">Or</span>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline"
              onClick={() => signInWithGoogle()}
              className="w-full h-14 rounded-2xl border-2 border-[var(--background)] bg-[var(--card)] text-[var(--foreground)] font-sans font-semibold uppercase tracking-widest transition-all hover:bg-[var(--background)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <p className="text-sm text-center font-medium text-[var(--muted-foreground)]">
              Already have an account?{' '}
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
