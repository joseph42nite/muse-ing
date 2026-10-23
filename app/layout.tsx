import type React from "react"
import type { Metadata } from "next"
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

export const metadata: Metadata = {
  title: "Muse-ing — Interactive Live Artists, Hosted Events & Real-Time Setlists",
  description:
    "Discover live performing artists, explore events hosted currently across venues, scan table QR codes to shape the setlist, or book & host an experience.",
  generator: "muse-ing",
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
