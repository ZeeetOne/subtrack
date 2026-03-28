import Link from 'next/link'
import Image from 'next/image'
import { DM_Serif_Display } from 'next/font/google'
import {
  ArrowRight, BarChart3, RefreshCw, Globe2,
  CalendarDays, ShieldCheck, Zap,
} from 'lucide-react'

const serif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})

const MARQUEE_ITEMS = [
  'Netflix', 'Spotify', 'Adobe CC', 'AWS', 'GitHub', 'Notion',
  'Figma', 'ChatGPT Plus', 'iCloud', 'YouTube Premium', 'Slack',
  'Dropbox', 'Linear', 'Vercel', 'Loom', 'Zoom', 'Canva', '1Password',
]

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Every billing cycle',
    body: 'Weekly, monthly, quarterly, yearly, one-time — tracked precisely. Never be surprised by a charge again.',
    accent: '#aee865',
  },
  {
    icon: Globe2,
    title: 'Any currency, live rates',
    body: 'Pay in USD, EUR, JPY, IDR? SubTrack converts everything to your base currency using live exchange rates.',
    accent: '#c89e2a',
  },
  {
    icon: BarChart3,
    title: 'Real spending picture',
    body: 'See your true monthly burn, yearly projection, and a visual breakdown by category. No guessing.',
    accent: '#6da030',
  },
]

export default function LandingPage() {
  const marqueeItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  return (
    <div className={`${serif.variable} min-h-screen bg-[#f3f6ec] font-sans`}>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 sm:px-10 h-16 bg-[#f3f6ec]/80 backdrop-blur-md border-b border-[#d8e8c0]">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="SubTrack" width={32} height={32} className="rounded-lg" />
          <span className="text-[15px] font-bold text-[#182010] tracking-tight">SubTrack</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[#5a6e45] hover:text-[#182010] transition-colors px-4 py-2"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="text-[13px] font-semibold text-white bg-[#1c3210] hover:bg-[#2a4a18] px-5 py-2.5 rounded-full transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-[#141e0c] via-[#1a2a10] to-[#213510]">

        {/* Decorative rings */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full border border-[#aee865]/8 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-[380px] h-[380px] rounded-full border border-[#aee865]/6 pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#aee865]/[0.03] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div
              className="inline-flex items-center gap-2 bg-[#aee865]/10 border border-[#aee865]/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in"
              style={{ animationDelay: '0ms' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#aee865]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#aee865]">Subscription tracker</span>
            </div>

            <h1
              className="animate-fade-in-up"
              style={{ animationDelay: '80ms' }}
            >
              <span className="block text-white/30 text-[15px] font-semibold uppercase tracking-[0.2em] mb-3">
                You&apos;re probably paying for
              </span>
              <span
                className="block text-5xl sm:text-6xl lg:text-[4.5rem] leading-[1.05] text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                more than you
              </span>
              <span
                className="block text-5xl sm:text-6xl lg:text-[4.5rem] leading-[1.05]"
                style={{ fontFamily: 'var(--font-display)', color: '#aee865' }}
              >
                think.
              </span>
            </h1>

            <p
              className="mt-7 text-white/55 text-[17px] leading-relaxed max-w-md animate-fade-in-up"
              style={{ animationDelay: '180ms' }}
            >
              SubTrack shows you every subscription, every billing date, and your true monthly cost — converted to your currency, in real time.
            </p>

            <div
              className="mt-10 flex items-center gap-4 animate-fade-in-up"
              style={{ animationDelay: '260ms' }}
            >
              <Link
                href="/signup"
                className="group flex items-center gap-2.5 bg-[#aee865] text-[#141e0c] font-bold text-[14px] uppercase tracking-widest px-7 py-4 rounded-full hover:bg-white transition-colors"
              >
                Start for free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="text-white/50 font-semibold text-[13px] hover:text-white/80 transition-colors"
              >
                Already have an account →
              </Link>
            </div>
          </div>

          {/* Right — dashboard preview card */}
          <div className="flex justify-center lg:justify-end animate-float" style={{ animationDelay: '400ms' }}>
            <div className="w-full max-w-sm bg-gradient-to-br from-[#0e1608] to-[#1a2a10] rounded-[1.75rem] border border-white/10 p-7 shadow-2xl shadow-black/40">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.22em] mb-1">Total spending</p>
                  <p className="text-sm font-bold text-white/55">March 2026</p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#aee865]/15 rounded-full px-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#aee865]" />
                  <span className="text-[10px] font-bold text-[#aee865]">68% paid</span>
                </div>
              </div>
              <div className="text-[2.6rem] font-bold text-[#aee865] tracking-tighter leading-none mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                $247.50
              </div>
              <div className="w-full h-[3px] rounded-full bg-white/10 mb-5 overflow-hidden">
                <div className="h-full w-[68%] rounded-full bg-[#aee865]/75" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.06] rounded-xl p-3.5">
                  <p className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.2em] mb-1.5">Paid</p>
                  <p className="text-base font-bold text-white/50 tabular-nums">$168.30</p>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3.5">
                  <p className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.2em] mb-1.5">Remaining</p>
                  <p className="text-base font-bold text-white/85 tabular-nums">$79.20</p>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                {[
                  { name: 'Netflix', amount: '$15.99', cycle: 'Monthly' },
                  { name: 'Adobe CC', amount: '$54.99', cycle: 'Monthly' },
                  { name: 'AWS', amount: '$89.00', cycle: 'Monthly' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#aee865]/15 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-[#aee865]">{item.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-white/75">{item.name}</p>
                        <p className="text-[10px] text-white/30">{item.cycle}</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-white/60 tabular-nums">{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="bg-[#1c3210] py-4 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {marqueeItems.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-3 px-6">
              <span className="w-1 h-1 rounded-full bg-[#aee865]/60" />
              <span className="text-[12px] font-semibold uppercase tracking-widest text-white/40">{name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="bg-[#f3f6ec] py-24 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-[#5a6e45] mb-16">The reality of subscription spending</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#d8e8c0] rounded-2xl overflow-hidden">
            {[
              { number: '12+', label: 'Average subscriptions per person', note: 'Most people underestimate by 40%' },
              { number: '$273', label: 'Average monthly spend', note: 'That\'s $3,276 a year' },
              { number: '30%', label: 'Forgotten or unused', note: 'Still being charged every month' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-10 text-center">
                <div
                  className="text-6xl font-bold text-[#1c3210] mb-3 tracking-tighter"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {stat.number}
                </div>
                <p className="text-[13px] font-semibold text-[#182010] mb-1">{stat.label}</p>
                <p className="text-[11px] text-[#5a6e45]">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white py-24 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#5a6e45] mb-4">What you get</p>
            <h2
              className="text-4xl sm:text-5xl text-[#182010] leading-tight max-w-lg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Everything you need,{' '}
              <span className="text-[#6da030]">nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="group relative bg-[#f3f6ec] rounded-2xl p-8 hover:bg-[#1c3210] transition-colors duration-300 cursor-default"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300"
                  style={{ backgroundColor: `${f.accent}20` }}
                >
                  <f.icon className="w-5 h-5 transition-colors duration-300" style={{ color: f.accent }} />
                </div>
                <h3 className="text-[17px] font-bold text-[#182010] group-hover:text-white mb-3 transition-colors duration-300">
                  {f.title}
                </h3>
                <p className="text-[13px] text-[#5a6e45] group-hover:text-white/50 leading-relaxed transition-colors duration-300">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#f3f6ec] py-24 px-6 sm:px-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#5a6e45] mb-4">Simple by design</p>
            <h2
              className="text-4xl sm:text-5xl text-[#182010]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Up and running in minutes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Add your subscriptions', body: 'Name, amount, currency, billing date. Takes 30 seconds per entry.' },
              { step: '02', title: 'Set your base currency', body: 'Pick your home currency. All conversions happen automatically using live rates.' },
              { step: '03', title: 'See the full picture', body: 'Your dashboard shows monthly burn, upcoming bills, and exactly where your money goes.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0">
                  <span
                    className="text-5xl font-bold text-[#d8e8c0] leading-none"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {item.step}
                  </span>
                </div>
                <div className="pt-2">
                  <h3 className="text-[16px] font-bold text-[#182010] mb-2">{item.title}</h3>
                  <p className="text-[13px] text-[#5a6e45] leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative bg-gradient-to-br from-[#141e0c] via-[#1a2a10] to-[#213510] py-32 px-6 sm:px-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-[#aee865]/8 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#aee865]/[0.03] pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2
            className="text-5xl sm:text-6xl text-white mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ready to see the{' '}
            <span style={{ color: '#aee865' }}>full picture?</span>
          </h2>
          <p className="text-white/45 text-[16px] mb-10 leading-relaxed">
            Free to use. No credit card required. Start tracking in under 2 minutes.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-3 bg-[#aee865] text-[#141e0c] font-bold text-[14px] uppercase tracking-widest px-9 py-5 rounded-full hover:bg-white transition-colors"
          >
            Create your free account
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0e1608] px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="SubTrack" width={24} height={24} className="rounded-md opacity-70" />
          <span className="text-[12px] font-semibold text-white/30">SubTrack</span>
        </div>
        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} SubTrack. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Log In</Link>
          <Link href="/signup" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Sign Up</Link>
        </div>
      </footer>

    </div>
  )
}
