'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { signOut } from '@/lib/actions/auth'
import { purgeLocalData } from '@/lib/offline/purge'

/**
 * Sign-out has to clear this device's cached pages and local data before it
 * ends the session — the service worker caches authenticated HTML so the app
 * opens offline, and that would otherwise outlive the session on a shared
 * device. Hence a client component rather than a bare `<form action={signOut}>`.
 */
export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await purgeLocalData()
    } catch {
      // A failed purge must not strand the user in a signed-in session.
    }
    await signOut()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="w-full flex items-center justify-between p-4 bg-[var(--destructive)]/5 text-[var(--destructive)] rounded-2xl group transition-all hover:bg-[var(--destructive)]/10 disabled:opacity-60 cursor-pointer"
    >
      <div className="flex items-center">
        <div className="w-10 h-10 bg-[var(--destructive)]/10 rounded-xl flex items-center justify-center mr-4">
          {isSigningOut
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <LogOut className="w-5 h-5" />}
        </div>
        <span className="text-sm font-semibold uppercase tracking-widest">
          {isSigningOut ? 'Signing Out…' : 'Sign Out'}
        </span>
      </div>
    </button>
  )
}
