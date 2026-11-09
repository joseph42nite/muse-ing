import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { ArrowUpRight, Mic2 } from "lucide-react"
import Footer from "@/components/monkey/footer"
import EventsExplorer from "./events-explorer"

export const metadata: Metadata = {
  title: "Explore Live Events | Muse-ing",
  description:
    "Browse live gigs across cities, filter by date and price, and book your table or tickets in a few taps.",
}

export const viewport: Viewport = { themeColor: "#070709" }

export default function EventsPage() {
  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#070709] text-[#F4EFE6] selection:bg-[#F4EFE6] selection:text-[#070709]">
        {/* A low red glow up top, the same light the footer is lit with */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(90%_70%_at_50%_0%,rgba(90,9,16,0.55)_0%,rgba(26,5,7,0.35)_45%,transparent_100%)]"
        />

        <header className="relative z-10 flex items-center justify-between px-5 pt-7 sm:px-8 sm:pt-10">
          <Link href="/" aria-label="Muse-ing home" className="logo-mark text-4xl leading-none text-[#F4EFE6] sm:text-5xl">
            m<span className="text-[#F4EFE6]/45">-</span>
          </Link>
          <p className="micro absolute left-1/2 -translate-x-1/2 text-[#F4EFE6]/55 max-md:hidden">Live music · Real-time setlists</p>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link href="/" className="pill-dark micro max-sm:hidden">
              Home
            </Link>
            <Link href="/login" className="pill-dark micro">
              Artist login <Mic2 className="h-3 w-3" />
            </Link>
          </nav>
        </header>

        <section aria-label="Gig index" className="relative z-10 px-5 pt-16 sm:px-8 sm:pt-24">
          <div className="dots"><i /></div>
          <h1 className="title-x mt-4 text-[17vw] leading-[0.82] sm:text-[12.5vw]">
            Gig index
          </h1>
          <div className="mt-5 h-px w-full bg-[#F4EFE6]/70 sm:mt-6" />
          <div className="mt-3 flex justify-between gap-6 sm:mt-4 sm:justify-start sm:gap-[18vw]">
            <p className="micro max-w-[170px] leading-[1.5]">
              Every night on the bill <span className="text-[#F4EFE6]/55">across cities and venues</span>
            </p>
            <p className="micro max-w-[170px] leading-[1.5]">
              Shape the setlist <span className="text-[#F4EFE6]/55">from your table and book in a few taps</span>
            </p>
            <Link href="/#book" className="micro ml-auto hidden items-center gap-1 self-start text-[#F4EFE6]/70 transition hover:text-white sm:flex">
              Host a night <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <Suspense fallback={<p className="micro relative z-10 px-5 pt-12 text-[#F4EFE6]/55 sm:px-8">Loading…</p>}>
          <EventsExplorer />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
