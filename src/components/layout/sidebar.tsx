'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, BarChart2, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Expenses', href: '/expenses', icon: CreditCard },
  { name: 'Stats', href: '/stats', icon: BarChart2 },
  { name: 'More', href: '/more', icon: Settings2 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 bg-[var(--card)] border-r border-[var(--border)] h-screen sticky top-0 py-7 font-sans">
      {/* Logo */}
      <div className="mb-8 px-5 flex items-center gap-2.5">
        <Image src="/logo.png" alt="SubTrack Logo" width={24} height={24} className="rounded-md" />
        <span className="text-[15px] font-heading font-bold text-[var(--foreground)] tracking-tight">SubTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-lg transition-colors duration-150",
                isActive
                  ? "bg-[var(--accent)] text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
