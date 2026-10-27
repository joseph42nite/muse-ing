import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"

const figtree = localFont({
  src: "../public/fonts/Figtree-Variable.ttf",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
})

const instrumentSerif = localFont({
  src: [
    { path: "../public/fonts/InstrumentSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  fallback: ["Georgia", "serif"],
})

const newsreader = localFont({
  src: "../public/fonts/Newsreader-Variable.ttf",
  weight: "200 800",
  variable: "--font-logo",
  display: "swap",
  fallback: ["Georgia", "serif"],
})

export const viewport: Viewport = {
  themeColor: "#F4EFE6",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Muse-ing — Interactive Live Artists, Hosted Events & Real-Time Setlists",
  description:
    "Discover live performing artists, explore events hosted currently across venues, scan table QR codes to shape the setlist, or book & host an experience.",
  keywords: [
    "live music",
    "artist booking",
    "gig discovery",
    "crowd song request",
    "interactive setlist",
    "table voting",
  ],
  openGraph: {
    title: "Muse-ing — Interactive Live Music Experience",
    description:
      "Connecting independent artists with live venue crowds through real-time setlists, requests, and dedications.",
    type: "website",
    locale: "en_US",
    siteName: "Muse-ing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Muse-ing — Interactive Live Music Experience",
    description:
      "Connecting independent artists with live venue crowds through real-time setlists, requests, and dedications.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${figtree.variable} ${instrumentSerif.variable} ${newsreader.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
