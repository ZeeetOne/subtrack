'use client'

import { createContext, use, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Month navigation that reacts on click instead of after the server responds.
 *
 * A plain <Link> to ?month= gives no feedback: only the search param changes,
 * so the route's loading.tsx never shows, and the page sits still until the
 * new month's data arrives. Here the label moves to the target month
 * immediately (repeated clicks keep stepping), a spinner shows, and content
 * wrapped in <MonthPending> dims until the navigation lands. Rapid clicks
 * supersede each other — the router only commits the last one.
 */

interface MonthNavValue {
  label: string
  isPending: boolean
  step: (delta: number) => void
}

const MonthNavContext = createContext<MonthNavValue | null>(null)

// Months as a single integer (year * 12 + month) so stepping across years is plain arithmetic.
const toIndex = (year: number, month: number) => year * 12 + month
const toParam = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`

export function MonthNavProvider({
  basePath,
  year,
  month,
  monthLabel,
  children,
}: {
  basePath: string
  year: number
  month: number // 0-indexed
  /** Server-rendered label for the current month; reused so hydration matches. */
  monthLabel: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const current = toIndex(year, month)
  // Falls back to `current` on its own once the navigation transition settles.
  const [shown, setShown] = useOptimistic(current)

  const step = (delta: number) => {
    const target = shown + delta
    startTransition(() => {
      setShown(target)
      router.push(`${basePath}?month=${toParam(target)}`, { scroll: false })
    })
  }

  const label =
    shown === current
      ? monthLabel
      : new Date(Math.floor(shown / 12), shown % 12, 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })

  return <MonthNavContext value={{ label, isPending, step }}>{children}</MonthNavContext>
}

function useMonthNav() {
  const ctx = use(MonthNavContext)
  if (!ctx) throw new Error('Month navigation must be rendered inside <MonthNavProvider>')
  return ctx
}

export function MonthSwitcher({
  className,
  buttonClassName,
  labelClassName,
}: {
  className?: string
  buttonClassName?: string
  labelClassName?: string
}) {
  const { label, isPending, step } = useMonthNav()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => step(-1)}
        className={cn(
          'flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] active:scale-90 transition cursor-pointer',
          buttonClassName
        )}
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-bold text-[var(--foreground)] tabular-nums',
          labelClassName
        )}
        aria-live="polite"
      >
        {label}
        {isPending && (
          <Loader2 className="w-3 h-3 animate-spin text-[var(--muted-foreground)]" aria-label="Loading" />
        )}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        className={cn(
          'flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] active:scale-90 transition cursor-pointer',
          buttonClassName
        )}
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/** Dims its children while a month change is loading, so stale data doesn't read as the new month. */
export function MonthPending({ className, children }: { className?: string; children: React.ReactNode }) {
  const { isPending } = useMonthNav()
  return (
    <div
      aria-busy={isPending}
      className={cn('transition-opacity duration-200', isPending && 'opacity-50 pointer-events-none', className)}
    >
      {children}
    </div>
  )
}
