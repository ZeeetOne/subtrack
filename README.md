<div align="center">
  <img src="public/logo.png" alt="SubTrack Logo" width="80" height="80" style="border-radius: 18px" />
  <h1>SubTrack</h1>
  <p>Know exactly what you're paying for — and when.</p>

  <a href="https://subtrack-ten-azure.vercel.app">
    <img src="https://img.shields.io/badge/Live%20App-subtrack--ten--azure.vercel.app-1c3210?style=for-the-badge&logo=vercel&logoColor=aee865" alt="Live App" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
  &nbsp;
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</div>

---

## What is SubTrack?

Most people underestimate how much they spend on subscriptions by **40%**. SubTrack gives you a clear, honest picture — every service, every billing date, every charge — converted to your currency using live exchange rates.

## Features

| | |
|---|---|
| 📅 **All billing cycles** | Weekly, monthly, quarterly, yearly, one-time |
| 💱 **Multi-currency** | Live exchange rates via open.er-api.com + Frankfurter fallback |
| 📊 **Dashboard** | Monthly burn, paid vs. remaining, upcoming bills |
| 📈 **Stats** | Yearly projection and category breakdown chart |
| 🗂️ **Categories** | Custom categories to organize your expenses |
| 📤 **Data export** | Download your data as CSV or JSON |
| 🔐 **Auth** | Email/password and Google OAuth via Supabase |
| 🔒 **Secure** | Row-level security, rate limiting, current password verification |

## Tech Stack

- **Framework** — [Next.js 15](https://nextjs.org) App Router (Server Components, Server Actions)
- **Database & Auth** — [Supabase](https://supabase.com) with RLS policies
- **Styling** — [Tailwind CSS v4](https://tailwindcss.com) with CSS custom properties
- **Language** — TypeScript (strict)
- **Forms** — React Hook Form + Zod validation
- **Charts** — Chart.js / react-chartjs-2

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/ZeeetOne/subtrack.git
cd subtrack

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Fill in your Supabase credentials
```

**.env.local**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
# 4. Run migrations in Supabase SQL editor
# Files are in supabase/migrations/ — run them in order

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deployed on Vercel. Set the three env vars above in your Vercel project settings, and configure your Supabase Auth **Site URL** and **Redirect URLs** to match your production domain.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ZeeetOne/subtrack)

---

<div align="center">
  <sub>Built with Next.js · Supabase · Tailwind CSS</sub>
</div>
