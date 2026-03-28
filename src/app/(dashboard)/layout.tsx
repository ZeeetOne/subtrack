import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { FAB } from '@/components/layout/fab'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] flex font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen relative pb-24 md:pb-0 font-sans">
        <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-12">
          {children}
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav />
        
        {/* Add Expense Button */}
        <FAB />
      </div>
    </div>
  )
}
