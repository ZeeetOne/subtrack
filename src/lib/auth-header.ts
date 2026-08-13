/**
 * Request header carrying the user id that middleware already verified.
 *
 * Lives in its own module with no imports so that middleware and Server
 * Components can share it without dragging each other's dependencies along —
 * middleware cannot use `next/headers`, and pages should not pull in
 * `@supabase/ssr`'s middleware client.
 */
export const USER_ID_HEADER = 'x-user-id'
