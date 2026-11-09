import type React from "react"
import type { Viewport } from "next"
import Link from "next/link"
import Footer from "@/components/monkey/footer"
import { LEGAL, POLICY_LINKS } from "@/lib/legal"

export const viewport: Viewport = { themeColor: "#070709" }

/** Shared frame for the policy pages: the site header, a policy switcher and the footer. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#070709] text-[#F4EFE6] selection:bg-[#F4EFE6] selection:text-[#070709]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(90%_70%_at_50%_0%,rgba(90,9,16,0.45)_0%,rgba(26,5,7,0.3)_45%,transparent_100%)]"
        />

        <header className="relative z-10 flex items-center justify-between px-5 pt-7 sm:px-8 sm:pt-10">
          <Link href="/" aria-label="Muse-ing home" className="logo-mark text-4xl leading-none text-[#F4EFE6] sm:text-5xl">
            m<span className="text-[#F4EFE6]/45">-</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link href="/" className="pill-dark micro">Home</Link>
            <Link href="/events" className="pill-dark micro max-sm:hidden">Gigs</Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
            {POLICY_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="micro text-[#F4EFE6]/55 transition hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <article className="legal mt-10">{children}</article>
          <p className="mt-14 border-t border-white/10 pt-5 text-xs text-[#F4EFE6]/45">
            Last updated {LEGAL.updated}. {LEGAL.brand} is operated by {LEGAL.legalName}.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
