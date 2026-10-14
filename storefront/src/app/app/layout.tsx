import type { Metadata, Viewport } from "next"

/**
 * Owner PWA shell (/app) — deliberately hidden, not secret:
 * - Unlinked everywhere (see docs/hiding-audit: no nav/footer/sitemap entry).
 * - robots disallow + noindex/nofollow here, so crawlers stay out.
 * - Login-gated: without an admin session this renders only the sign-in
 *   form, and every data call needs the admin JWT.
 */
export const metadata: Metadata = {
  title: "Lollies Shop",
  description: "Private owner app — shop status, moderation, alerts.",
  robots: { index: false, follow: false },
  manifest: "/app/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lollies",
  },
}

export const viewport: Viewport = {
  themeColor: "#17130e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="lollies-app">{children}</div>
}
