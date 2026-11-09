"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Mic2 } from "lucide-react"

/**
 * The site menu: a Liquid Glass button that opens a glass panel. On the landing, pass `onPick` so
 * the film's links glide through the scroll story; anywhere else they link to the landing's sections.
 */
export type MenuTarget = "gigs" | "book" | "join"

const ITEMS: { label: string; target: MenuTarget; href: string; hint: string }[] = [
  { label: "Upcoming gigs", target: "gigs", href: "/#gigs", hint: "On the bill near you" },
  { label: "Book or host", target: "book", href: "/#book", hint: "A table, or your venue" },
  { label: "Join as artist", target: "join", href: "/#join", hint: "Play a Muse-ing night" },
]

export default function SiteMenu({ onPick, className = "" }: { onPick?: (t: MenuTarget) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    first.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  const item = "glass-item title-x flex items-baseline justify-between gap-4 whitespace-nowrap rounded-[18px] px-4 py-3 text-left text-[17px]"

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-menu"
        className="glass glass-button relative grid h-11 w-11 place-items-center rounded-full"
      >
        {/* Three lines that morph into an X */}
        <span aria-hidden className="relative block h-3 w-4">
          <span className={`glass-line top-0 ${open ? "translate-y-[5px] rotate-45" : ""}`} />
          <span className={`glass-line top-[5px] ${open ? "scale-x-0 opacity-0" : ""}`} />
          <span className={`glass-line top-[10px] ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
        </span>
      </button>

      <nav
        id="site-menu"
        aria-label="Primary"
        aria-hidden={!open}
        inert={!open}
        className={`glass glass-panel absolute right-0 top-[calc(100%+12px)] w-[min(340px,calc(100vw-56px))] origin-top-right rounded-[28px] p-2 ${
          open ? "glass-panel-open" : ""
        }`}
      >
        <p className="micro px-4 pb-1 pt-3 text-[#F4EFE6]/50">Menu</p>
        {ITEMS.map((it, i) =>
          onPick ? (
            <button
              key={it.target}
              ref={i === 0 ? (el) => void (first.current = el) : undefined}
              type="button"
              onClick={() => {
                setOpen(false)
                onPick(it.target)
              }}
              className={`${item} w-full`}
            >
              {it.label}
              <span className="micro shrink-0 font-normal text-[#F4EFE6]/45 max-sm:hidden">{it.hint}</span>
            </button>
          ) : (
            <Link
              key={it.target}
              ref={i === 0 ? (el) => void (first.current = el) : undefined}
              href={it.href}
              onClick={() => setOpen(false)}
              className={item}
            >
              {it.label}
              <span className="micro shrink-0 font-normal text-[#F4EFE6]/45 max-sm:hidden">{it.hint}</span>
            </Link>
          ),
        )}
        <div className="mx-4 my-1.5 h-px bg-white/15" />
        <Link href="/events" onClick={() => setOpen(false)} className={item}>
          All events <ArrowUpRight className="h-3.5 w-3.5 self-center opacity-60" />
        </Link>
        <Link href="/login" onClick={() => setOpen(false)} className={item}>
          Artist login <Mic2 className="h-3.5 w-3.5 self-center opacity-60" />
        </Link>
      </nav>
    </div>
  )
}
