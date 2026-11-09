"use client"

import Link from "next/link"
import { ArrowUp, ArrowUpRight } from "lucide-react"

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { label: "Upcoming gigs", href: "/events" },
      { label: "Book a table", to: 1 },
      { label: "Venue login", href: "/login" },
    ],
  },
  {
    title: "Artists",
    links: [
      { label: "Artist login", href: "/login" },
      { label: "Join as artist", to: 1 },
    ],
  },
  {
    title: "Venues",
    links: [{ label: "Host with us", to: 1 }],
  },
] as const

/** The page footer, after the scroll story: the wordmark, the site links and the fine print. */
export default function Footer({ jump }: { jump: (p: number) => void }) {
  const link = "text-[15px] text-[#F4EFE6]/70 transition hover:text-white"
  return (
    <footer className="relative overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#5a0910_0%,#1a0507_55%,#070709_100%)] px-5 pb-8 pt-16 text-[#F4EFE6] sm:px-8 sm:pt-24">
      <div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[1.3fr_2fr]">
        <div>
          <div className="dots"><i /></div>
          <p className="title-x mt-4 text-[30px] sm:text-[40px]">
            Live music,
            <br />
            shaped by the room
          </p>
          <a href="mailto:hello@museing.live" className="pill-dark micro mt-6">
            hello@museing.live <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <p className="micro text-[#F4EFE6]/45">{c.title}</p>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {"href" in l ? (
                      <Link href={l.href} className={link}>
                        {l.label}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => jump(l.to)} className={link}>
                        {l.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <p aria-hidden className="title-x pointer-events-none mt-16 select-none whitespace-nowrap text-center text-[14.5vw] leading-[0.8] text-[#F4EFE6]/90 sm:mt-20">
        MUSE-ING
      </p>

      <div className="mx-auto mt-8 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[11px] text-[#F4EFE6]/50">
        <span>© 2026 Muse-ing. Live music, real-time setlists.</span>
        <button type="button" onClick={() => jump(0)} className="micro flex items-center gap-1.5 transition hover:text-white">
          Back to top <ArrowUp className="h-3 w-3" />
        </button>
      </div>
    </footer>
  )
}
