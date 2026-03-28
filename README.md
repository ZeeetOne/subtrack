# SubTrack

A personal subscription expense tracker. See exactly what you're paying for, when you're paying for it, and how much it costs in your preferred currency.

## Features

- Landing page with app overview
- Track subscriptions across any billing cycle — weekly, monthly, quarterly, yearly, or one-time
- Multi-currency support with live exchange rates (refreshed hourly)
- Dashboard showing this month's spending: paid so far vs. remaining
- Stats page with monthly burn, yearly projection, and category breakdown chart
- Custom expense categories
- Data export (CSV or JSON)
- Secure auth — email/password and Google OAuth
- Password show/hide toggle on all auth forms

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repo

   ```bash
   git clone https://github.com/ZeeetOne/subtrack.git
   cd subtrack
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root with your Supabase credentials

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. Run the database migrations in your Supabase SQL editor — files are in `supabase/migrations/`, run them in order

5. Start the dev server

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deployed on [Vercel](https://vercel.com). Set the same three env vars in your Vercel project settings, and update the Supabase Auth URL configuration to match your production domain.
