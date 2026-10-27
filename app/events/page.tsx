import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import EventsExplorer from "./events-explorer"

export const metadata: Metadata = {
  title: "Explore Live Events — Muse-ing",
  description:
    "Browse live gigs across cities, filter by date and price, and book your table or tickets in a few taps.",
}

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#181615] selection:bg-[#D92323] selection:text-white">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 sm:px-12 md:px-16 pt-6 sm:pt-8">
        <Link href="/" aria-label="Muse-ing home" className="logo-mark text-5xl sm:text-6xl leading-none tracking-tight">
          <span>m</span>
          <span className="text-[#D92323]">-</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.16em]">
          <Link href="/" className="text-[#181615]/75 hover:text-[#181615] transition-colors">
            Home
          </Link>
          <Link href="/events" className="text-[#D92323]">
            Events
          </Link>
          <Link href="/login" className="hidden sm:inline text-[#181615]/55 hover:text-[#D92323] transition-colors">
            Artist login
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-7xl px-8 sm:px-12 md:px-16 pt-12 sm:pt-16 pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D92323]">Currently hosted gigs</p>
        <h1 className="instrument mt-2 text-[22vw] sm:text-[14vw] md:text-[12vw] leading-[0.85] tracking-[-0.04em] text-[#D92323]">
          events
        </h1>
        <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-[#181615]/75">
          Find a night near you, shape the setlist from your table, and book in a few taps.
        </p>
      </section>

      <Suspense fallback={<p className="px-8 sm:px-12 md:px-16 text-xs uppercase tracking-[0.16em] text-[#181615]/55">Loading…</p>}>
        <EventsExplorer />
      </Suspense>
    </main>
  )
}
