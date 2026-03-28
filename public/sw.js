const CACHE_NAME = 'subtrack-v1'

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/login',
  '/signup',
  '/logo.png',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
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

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache: authenticated app pages, API routes, auth routes, Supabase requests
  const PROTECTED = ['/dashboard', '/expenses', '/stats', '/more']
  if (
    PROTECTED.some(p => url.pathname.startsWith(p)) ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co') ||
    request.method !== 'GET'
  ) {
    return
  }

  // For navigation requests (HTML pages): network-first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // For static assets (JS, CSS, fonts, images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico|jpg|jpeg|webp)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
  }
})
