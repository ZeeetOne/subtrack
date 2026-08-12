import Link from 'next/link'
import { CloudOff } from 'lucide-react'

/**
 * Last-resort offline fallback, served by the service worker when neither the
 * requested page nor /dashboard is in the cache.
 *
 * This route must stay fully static — no createClient, no auth, no database.
 * It is the one page guaranteed to render with zero connectivity, so anything
 * that could throw here removes the user's last way back into the app.
 */
export const dynamic = 'force-static'

export const metadata = {
  title: 'Offline — SubTrack',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] font-sans flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-6">
          <CloudOff className="w-7 h-7 text-[var(--muted-foreground)]" />
        </div>

        <h1 className="text-3xl font-heading font-bold text-[var(--foreground)] tracking-tight">
          You&apos;re offline
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm font-medium mt-2 leading-relaxed">
          SubTrack couldn&apos;t reach the network. Anything you&apos;ve already
          added is saved on this device and will sync once you&apos;re back
          online.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex w-full h-11 items-center justify-center rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold transition-opacity hover:opacity-80"
        >
          Try again
        </Link>
      </div>
    </div>
  )
}
