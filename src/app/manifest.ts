import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SubTrack',
    short_name: 'SubTrack',
    description: 'Track your subscriptions and see your true monthly cost.',
    // Land on a route the service worker caches, so a cold offline launch of
    // the installed app opens the dashboard instead of the network-error page.
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f3f6ec',
    theme_color: '#1c3210',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
