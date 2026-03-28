'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema, type LoginFormValues, type SignupFormValues, type ForgotPasswordValues, type ResetPasswordValues } from '@/lib/schemas/auth'

export async function login(data: LoginFormValues) {
  const supabase = await createClient()

  const validatedFields = loginSchema.safeParse(data)

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(data: SignupFormValues) {
  const supabase = await createClient()

  const validatedFields = signupSchema.safeParse(data)

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Check your email to confirm your account')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(data: ForgotPasswordValues) {
  const supabase = await createClient()

  const validatedFields = forgotPasswordSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: 'Invalid email address' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })

  // Always return success to avoid email enumeration
  if (error) console.error('Password reset error:', error.message)
  return { success: true }
}

export async function resetPassword(data: ResetPasswordValues) {
  const supabase = await createClient()

  const validatedFields = resetPasswordSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || 'Invalid fields' }
  }

  const { error } = await supabase.auth.updateUser({ password: data.password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
