import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from 'sonner'
import { ServiceWorkerRegistrar } from '@/components/ui/service-worker'

export const metadata: Metadata = {
  title: "SubTrack — Track Your Subscriptions",
  description: "See exactly what you're paying for, when you're paying for it, and how much it costs — all in one place.",
  icons: {
    icon: '/favicon.svg',
    apple: '/logo.png',
  },
  manifest: '/manifest.webmanifest',
  themeColor: '#1c3210',
  openGraph: {
    title: "SubTrack — Track Your Subscriptions",
    description: "See exactly what you're paying for, when you're paying for it, and how much it costs — all in one place.",
    url: "https://subtrack-ten-azure.vercel.app",
    siteName: "SubTrack",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SubTrack — Track Your Subscriptions",
    description: "See exactly what you're paying for, when you're paying for it, and how much it costs — all in one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
