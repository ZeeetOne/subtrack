const CACHE_NAME = 'subtrack-v2'

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/login',
  '/signup',
  '/offline',
  '/logo.png',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Individually, so one failure doesn't abort the whole install.
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Sign-out purge: authenticated HTML lives in this cache, so it must be
// dropped when the session ends or the next user can read it offline.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PURGE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true })
      })
    )
  }
})

/**
 * Caching an RSC flight payload under an HTML URL poisons the offline
 * navigation fallback — the browser would render serialized React, not a page.
 * Next sends these for client-side navigations and Server Action calls.
 */
function isReactPayload(request, url) {
  return (
    request.headers.get('RSC') === '1' ||
    request.headers.has('Next-Action') ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    url.searchParams.has('_rsc')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never touch: API routes, auth routes, Supabase, mutations, RSC/action traffic.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co') ||
    request.method !== 'GET' ||
    isReactPayload(request, url)
  ) {
    return
  }

  // Full-page navigations: network-first, fall back to cache so the app still
  // opens offline. This deliberately includes the authenticated routes —
  // without it an offline launch gets the browser's network-error page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a real, same-origin, non-redirected 200. A middleware
          // redirect to /login must never be stored under /dashboard: replaying
          // a redirected response to a navigation throws, and it would also
          // pin the wrong page for the next launch.
          if (response.ok && !response.redirected && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (
            (await cache.match(request)) ||
            (await cache.match('/dashboard')) ||
            (await cache.match('/offline')) ||
            Response.error()
          )
        })
    )
    return
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico|jpg|jpeg|webp)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      )
    )
  }
})
