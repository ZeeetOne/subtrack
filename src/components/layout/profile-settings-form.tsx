'use client'

import { useState } from 'react'
import { updateProfile } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface ProfileSettingsInitialData {
  display_name: string
}

export function ProfileSettingsForm({ initialData }: { initialData: ProfileSettingsInitialData }) {
  const [displayName, setDisplayName] = useState(initialData.display_name)
  const [isLoading, setIsLoading] = useState(false)

  async function handleUpdateProfile() {
    setIsLoading(true)
    const result = await updateProfile({ display_name: displayName })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Profile updated!')
    }
    setIsLoading(false)
  }

  return (
    <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="p-8 pt-0 space-y-6">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0"
          />
        </div>

        <Button
          className="w-full h-11 rounded-xl bg-[var(--primary)] text-white font-sans font-semibold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
          onClick={handleUpdateProfile}
          disabled={isLoading || displayName === initialData.display_name}
        >
          {isLoading ? 'Saving…' : 'Save Profile'}
        </Button>
      </CardContent>
    </Card>
  )
}
