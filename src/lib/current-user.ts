import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { USER_ID_HEADER } from '@/lib/auth-header'

/**
 * The signed-in user's id, without paying for a second auth round trip.
 *
 * Middleware already called `getUser()` — a real network call to Supabase Auth,
 * not a local cookie read — and passed the verified id down as a request
 * header. Calling `getUser()` again in every page duplicated that hop on the
 * critical path of each page load.
 *
 * The header is safe to trust because middleware deletes any inbound value
 * before setting its own, so a client cannot supply it. RLS backs this up: a
 * forged id would simply match no rows, since policies filter on `auth.uid()`
 * from the session cookie rather than on anything we pass here.
 *
 * Falls back to a direct check when the header is absent — that happens when
 * Supabase Auth timed out in middleware and the request was let through on an
 * optimistic cookie check.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const headerUserId = (await headers()).get(USER_ID_HEADER)
  if (headerUserId) return headerUserId

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
