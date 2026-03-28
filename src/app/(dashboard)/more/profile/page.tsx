import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileSettingsForm } from '@/components/layout/profile-settings-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="pb-24 font-sans">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/more" className="p-2 bg-[var(--card)] rounded-xl shadow-sm hover:bg-[var(--accent)] transition-colors">
          <ChevronLeft className="w-5 h-5 text-[var(--foreground)]" />
        </Link>
        <div>
          <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">Profile Settings</h1>
          <p className="text-[var(--muted-foreground)] text-sm font-medium">Manage your public identity.</p>
        </div>
      </div>

      <ProfileSettingsForm 
        initialData={{
          display_name: profile?.display_name || '',
        }} 
      />
    </div>
  )
}
