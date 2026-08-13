import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { USER_ID_HEADER } from '@/lib/auth-header'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/offline']
const AUTH_PAGES = ['/', '/login', '/signup', '/forgot-password', '/reset-password']

/** Supabase Auth is a network hop; don't let a slow one hold the whole page. */
const AUTH_TIMEOUT_MS = 3000

type AuthOutcome =
  | { status: 'authenticated'; userId: string }
  | { status: 'anonymous' }
  /** Auth was unreachable in time — fall back to an optimistic cookie check. */
  | { status: 'unknown' }

async function resolveUser(
  supabase: ReturnType<typeof createServerClient>,
  hasSessionCookie: boolean
): Promise<AuthOutcome> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auth timeout')), AUTH_TIMEOUT_MS)
      ),
    ])
    const user = result.data.user
    return user ? { status: 'authenticated', userId: user.id } : { status: 'anonymous' }
  } catch {
    // Optimistic check, exactly as the Next 16 proxy docs recommend: let the
    // request through if a session cookie exists and let the page do the real
    // verification. Pages still call redirect('/login') on their own.
    return hasSessionCookie ? { status: 'unknown' } : { status: 'anonymous' }
  }
}

export async function middleware(request: NextRequest) {
  // Start from the incoming headers with our own header stripped. This must be
  // unconditional — if a client could smuggle in x-user-id, pages downstream
  // would trust it. RLS is the second line of defence, not the first.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(USER_ID_HEADER)

  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  const refreshedCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Applied to whichever response we end up returning.
          refreshedCookies.push(...cookiesToSet)
        },
      },
    }
  )

  // Kept here rather than in each page: this is also what refreshes an expired
  // session and writes the new cookie, and Server Components cannot set cookies.
  const auth = await resolveUser(supabase, hasSessionCookie)
  const isLoggedIn = auth.status === 'authenticated' || auth.status === 'unknown'

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  const withCookies = <T extends NextResponse>(response: T): T => {
    refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  // Already logged in — skip landing/auth pages and go straight to dashboard
  if (isLoggedIn && AUTH_PAGES.some((p) => pathname === p)) {
    return withCookies(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return withCookies(NextResponse.redirect(loginUrl))
  }

  // Only set when genuinely verified. On 'unknown' the header stays absent and
  // the page falls back to its own getUser() — see getCurrentUserId().
  if (auth.status === 'authenticated') {
    requestHeaders.set(USER_ID_HEADER, auth.userId)
  }

  return withCookies(NextResponse.next({ request: { headers: requestHeaders } }))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
