'use client'

import { useState } from 'react'
import { updateEmail, updatePassword } from '@/lib/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface SecurityInitialData {
  email: string
}

const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5"
const inputClass = "h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-0"
const btnClass = "w-full h-11 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-colors disabled:opacity-50 cursor-pointer"

export function SecurityForm({ initialData }: { initialData: SecurityInitialData }) {
  const [email, setEmail] = useState(initialData.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleUpdateEmail() {
    if (email === initialData.email) return
    setIsLoading(true)
    const result = await updateEmail({ email })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(result.message || 'Check your new email address for confirmation')
    }
    setIsLoading(false)
  }

  async function handleUpdatePassword() {
    if (!currentPassword) { toast.error('Current password is required'); return }
    if (!password) { toast.error('New password is required'); return }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return }
    if (currentPassword === password) { toast.error('New password must be different from current password'); return }
    setIsLoading(true)
    const result = await updatePassword({ currentPassword, password, confirmPassword })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Password updated!')
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Email Address</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            className={btnClass}
            onClick={handleUpdateEmail}
            disabled={isLoading || email === initialData.email}
          >
            Update Email
          </button>
        </CardContent>
      </Card>

      <Card className="border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-4">
          <div>
            <label className={labelClass}>Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>New Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <button
            className={btnClass}
            onClick={handleUpdatePassword}
            disabled={isLoading || !currentPassword || !password}
          >
            Update Password
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
