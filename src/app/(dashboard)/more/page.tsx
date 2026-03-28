import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import {
  User,
  Tag,
  MessageSquare,
  CreditCard,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Download,
} from 'lucide-react'

const menuItems = [
  {
    title: 'Account',
    items: [
      { name: 'Profile Settings', href: '/more/profile', icon: User, color: 'text-[var(--primary)]', bg: 'bg-[var(--accent)]' },
      { name: 'Security & Password', href: '/more/security', icon: ShieldCheck, color: 'text-[var(--secondary)]', bg: 'bg-[var(--secondary-container)]' },
      { name: 'Base Currency', href: '/more/currency', icon: CreditCard, color: 'text-[var(--primary)]', bg: 'bg-[var(--accent)]' },
    ]
  },
  {
    title: 'Customization',
    items: [
      { name: 'Categories', href: '/more/categories', icon: Tag, color: 'text-[var(--tertiary)]', bg: 'bg-[var(--tertiary-container)]/30' },
    ]
  },
  {
    title: 'Support',
    items: [
      { name: 'Give Feedback', href: '/more/feedback', icon: MessageSquare, color: 'text-[var(--secondary)]', bg: 'bg-[var(--secondary-container)]' },
    ]
  },
  {
    title: 'Data',
    items: [
      { name: 'Export as CSV', href: '/api/export?format=csv', icon: Download, color: 'text-[var(--tertiary)]', bg: 'bg-[var(--tertiary-container)]/30' },
      { name: 'Export as JSON', href: '/api/export?format=json', icon: Download, color: 'text-[var(--tertiary)]', bg: 'bg-[var(--tertiary-container)]/30' },
    ]
  }
]

export default async function MorePage() {
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
      <div className="mb-10 px-1 text-center sm:text-left">
        <h1 className="text-4xl font-heading font-bold text-[var(--foreground)] tracking-tight">More</h1>
        <p className="text-[var(--muted-foreground)] mt-2 font-medium text-sm">Settings, customization, and support.</p>
      </div>

      <div className="space-y-8">
        {/* User Quick Info */}
        <div className="flex items-center space-x-4 p-6 bg-[var(--card)] rounded-[2rem] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] flex items-center justify-center text-[var(--primary-foreground)] font-heading font-semibold text-xl shadow-lg shadow-[var(--primary)]/30">
            {(profile?.display_name || user.email || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-heading font-semibold text-[var(--foreground)] tracking-tight leading-tight">
              {profile?.display_name || 'User'}
            </h2>
            <p className="text-[var(--muted-foreground)] font-medium text-xs">{user.email}</p>
          </div>
        </div>

        {/* Menu Sections */}
        {menuItems.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="px-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {section.items.map((item) => (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className="flex items-center justify-between p-4 bg-[var(--card)] rounded-2xl group transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
                >
                  <div className="flex items-center">
                    <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mr-4 transition-transform group-hover:scale-110`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{item.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] opacity-50 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="pt-4">
          <form action={signOut}>
            <button className="w-full flex items-center justify-between p-4 bg-[var(--destructive)]/5 text-[var(--destructive)] rounded-2xl group transition-all hover:bg-[var(--destructive)]/10">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-[var(--destructive)]/10 rounded-xl flex items-center justify-center mr-4">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold uppercase tracking-widest">Sign Out</span>
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
