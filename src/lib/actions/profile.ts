'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { profileSchema, updateEmailSchema, updatePasswordSchema, feedbackSchema, type ProfileFormValues, type UpdateEmailValues, type UpdatePasswordValues, type FeedbackFormValues } from '@/lib/schemas/profile'

export async function updateProfile(data: ProfileFormValues) {
  const supabase = await createClient()

  const validatedFields = profileSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      ...(data.display_name && { display_name: data.display_name }),
      ...(data.base_currency && { base_currency: data.base_currency }),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/more')
  return { success: true }
}

export async function updateEmail(data: UpdateEmailValues) {
  const supabase = await createClient()

  const validatedFields = updateEmailSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.auth.updateUser({ email: data.email })

  if (error) {
    return { error: error.message }
  }

  // Optimistically sync profiles.email so it doesn't go stale while awaiting confirmation
  await supabase.from('profiles').update({ email: data.email }).eq('id', user.id)

  revalidatePath('/more')
  return { success: true, message: 'Check your new email address for confirmation' }
}

export async function updatePassword(data: UpdatePasswordValues) {
  const supabase = await createClient()

  const validatedFields = updatePasswordSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || 'Invalid fields' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { error: 'Unauthorized' }
  }

  // Verify current password before allowing change
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.currentPassword,
  })
  if (verifyError) {
    return { error: 'Current password is incorrect' }
  }

  const { error } = await supabase.auth.updateUser({ password: data.password })
  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Password updated successfully' }
}

export async function submitFeedback(data: FeedbackFormValues) {
  const supabase = await createClient()

  const validatedFields = feedbackSchema.safeParse(data)
  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      message: data.message,
      category: data.category || 'general'
    })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Thank you for your feedback!' }
}
