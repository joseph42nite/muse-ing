import type React from "react"
import type { Metadata, Viewport } from "next"
import { Figtree, Inter, Instrument_Serif } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
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
      <head />
      <body className={`${figtree.variable} ${inter.variable} ${instrumentSerif.variable}`}>
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
