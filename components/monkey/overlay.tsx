"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight, MapPin, Menu, Mic2, X } from "lucide-react"
import { scroll, smooth, SMASH, win } from "./store"

interface OverlayEvent {
  id: string
  title: string
  location_name: string | null
  ticket_price: number
  event_date_only: string | null
  artist_name: string | null
}

type Inquiry = "reserve" | "host" | "artist"

const SCENES = ["The grin", "The exhale", "The strut", "The gigs", "The smash"]
const sceneIndex = (t: number) => (t < 0.12 ? 0 : t < 0.3 ? 1 : t < 0.58 ? 2 : t < 0.78 ? 3 : 4)

// Scroll windows for each block of copy, matched to the camera path in store.ts
const STRUT = [0.37, 0.41, 0.52, 0.56] as const
const GIGS = [0.6, 0.65, 0.75, 0.79] as const

const dateLabel = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Soon"

/** How visible each section is (0..1), written by the scroll loop and read by the decoding titles. */
const shown: Record<string, number> = {}

const GLYPHS = "█▓▒░▀▄▌▐#%&$@ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const escapeHtml = (c: string) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c)

/**
 * A title that decodes in, after the reference: as its section arrives, letters appear as
 * flickering block glyphs at low opacity and resolve left to right into solid type. Once the
 * section has gone it resets, ready to play again.
 */
function Decode({ lines, section }: { lines: string[]; section: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const text = lines.join("\n")
    const render = (p: number) => {
      let html = ""
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (ch === "\n") html += "<br/>"
        else if (ch === " ") html += " "
        else {
          const at = (i / text.length) * 0.75
          if (p >= at + 0.22) html += escapeHtml(ch)
          else if (p >= at) html += `<span style="opacity:.4">${escapeHtml(GLYPHS[Math.floor(Math.random() * GLYPHS.length)])}</span>`
          else html += `<span style="opacity:0">${escapeHtml(ch)}</span>`
        }
      }
      el.innerHTML = html
    }
    let raf = 0
    let start = -1
    let done = false
    render(0)
    const tick = () => {
      const v = shown[section] ?? 0
      if (start < 0 && v > 0.35) start = performance.now()
      if (start >= 0 && v < 0.02) {
        start = -1
        done = false
        render(0)
      }
      if (start >= 0 && !done) {
        const p = (performance.now() - start) / 900
        render(p)
        if (p > 1.1) done = true
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lines, section])
  return (
    <>
      <span className="sr-only">{lines.join(" ")}</span>
      <span ref={ref} aria-hidden="true" />
    </>
  )
}

/** Who Muse-ing is for, in scene 2. */
const ABOUT = [
  ["For the crowd", "Find live gigs near you and shape the setlist from your table."],
  ["For artists", "Run your setlist live, see requests as they land, and get paid for priority shoutouts."],
  ["For venues", "Host crowd-setlist nights and fill tables through direct booking."],
] as const

const TITLES = {
  s2: ["A live music", "experience"],
  s3: ["Your night,", "your call"],
  s4: ["Upcoming", "gigs"],
  form: ["Book or", "host with us"],
}

export default function Overlay({ jump }: { jump: (p: number) => void }) {
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const [events, setEvents] = useState<OverlayEvent[]>([])
  const [inquiry, setInquiry] = useState<Inquiry>("reserve")
  const [form, setForm] = useState({ name: "", email: "", phone: "", eventId: "", message: "" })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    let off = false
    const load = async (when: string) => {
      const r = await fetch(`/api/public/events/search?limit=24&when=${when}`)
      return r.ok ? ((await r.json()) as { events: OverlayEvent[] }).events : []
    }
    load("upcoming")
      .then((e) => (e.length ? e : load("all")))
      .then((e) => {
        if (off) return
        setEvents(e)
        if (e[0]) setForm((f) => ({ ...f, eventId: f.eventId || e[0].id }))
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let rowAt = -1
    const set = (key: string, v: number) => {
      shown[key] = v
      const el = refs.current[key]
      if (!el) return
      el.style.opacity = String(v)
      el.style.setProperty("--p", String(v))
      el.style.visibility = v < 0.01 ? "hidden" : "visible"
      el.style.pointerEvents = v > 0.5 ? "auto" : "none"
    }
    const loop = () => {
      const t = scroll.value
      set("hero", 1 - smooth(0.04, 0.1, t))
      set("s2", win(t, 0.13, 0.17, 0.25, 0.29))
      set("s3", win(t, ...STRUT))
      set("s4", win(t, ...GIGS))
      set("flash", win(t, SMASH.crack[0], SMASH.crack[1], SMASH.crack[1], SMASH.form[0] + 0.01) * 0.85)
      set("form", smooth(SMASH.form[0], SMASH.form[1], t))
      set("chrome", 1 - smooth(SMASH.windUp[0], SMASH.strike[0], t))
      const label = refs.current.label
      if (label) {
        const i = sceneIndex(t)
        const txt = `0${i + 1} / 0${SCENES.length} · ${SCENES[i]}`
        if (label.textContent !== txt) label.textContent = txt
      }
      // While the gigs hold, scrolling slides the whole row past so every gig gets seen
      const row = refs.current.row
      const along = smooth(GIGS[1] - 0.01, GIGS[2], t)
      if (row && Math.abs(along - rowAt) > 1e-4) {
        row.scrollLeft = along * (row.scrollWidth - row.clientWidth)
        rowAt = along
      }
      const bar = refs.current.bar
      if (bar) bar.style.transform = `scaleX(${Math.max(0.01, t)})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const reg = (key: string) => (el: HTMLElement | null) => {
    refs.current[key] = el
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !form.email.trim()) {
      setError("Enter your name and email.")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/public/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inquiryType: inquiry }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not send that.")
      setSent(form.name.trim())
    } catch (err: any) {
      setError(err.message || "Something went wrong.")
    } finally {
      setSending(false)
    }
  }

  const go = (p: number, then?: () => void) => {
    setMenu(false)
    then?.()
    jump(p)
  }

  const field = "field-noir"
  const tab = (k: Inquiry, label: string) => (
    <button
      type="button"
      onClick={() => setInquiry(k)}
      className={`micro rounded-full px-4 py-2 transition ${
        inquiry === k ? "bg-[#F4EFE6] text-[#0b0a0e]" : "text-[#F4EFE6]/60 hover:text-[#F4EFE6]"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="pointer-events-none absolute inset-0 text-[#F4EFE6]">
      <h1 className="sr-only">Muse-ing: a live music experience. Discover live events, book a table, or join as an artist.</h1>

      {/* Header: a quiet tag in the middle and the menu right (artist login lives in the menu) */}
      <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center justify-end px-7 pt-7 sm:px-12 sm:pt-10">
        <p className="micro absolute left-1/2 -translate-x-1/2 text-[#F4EFE6]/55 max-md:hidden">Live music · Real-time setlists</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#F4EFE6] text-[#0b0a0e] transition hover:bg-white"
          >
            {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {menu && (
          <nav
            aria-label="Primary"
            className="absolute right-7 top-[84px] flex w-56 flex-col rounded-2xl border border-white/10 bg-[#0b0a0e]/92 p-2 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md sm:right-12 sm:top-[104px]"
          >
            {[
              ["Upcoming gigs", () => go(0.68)],
              ["Book or host", () => go(1, () => setInquiry("reserve"))],
              ["Join as artist", () => go(1, () => setInquiry("artist"))],
            ].map(([l, f]) => (
              <button key={l as string} type="button" onClick={f as () => void} className="title-x rounded-xl px-3 py-2.5 text-left text-[15px] transition hover:bg-white/5 hover:text-white">
                {l as string}
              </button>
            ))}
            <Link href="/events" className="title-x rounded-xl px-3 py-2.5 text-[15px] transition hover:bg-white/5 hover:text-white">
              All events
            </Link>
            <Link href="/login" className="title-x flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] text-[#F4EFE6] transition hover:bg-white/5">
              Artist login <Mic2 className="h-3.5 w-3.5" />
            </Link>
          </nav>
        )}
      </header>

      {/* Scene 1: the giant title hangs in the 3D scene behind his head (studio.tsx); here, the
          hairline just under it and two fine columns */}
      <section
        ref={reg("hero")}
        aria-label="Muse-ing"
        className="absolute inset-x-0 top-[calc(9vh+26vw)] px-5 sm:px-8"
      >
        <div className="mx-auto h-px w-full bg-[#F4EFE6]/70" />
        <div className="mt-3 flex justify-between gap-6 sm:mt-4 sm:justify-start sm:gap-[18vw]">
          <p className="micro max-w-[150px] leading-[1.5] text-[#F4EFE6]">
            Fully live and ready <span className="text-[#F4EFE6]/55">to redefine your night out</span>
          </p>
          <p className="micro max-w-[150px] leading-[1.5] text-[#F4EFE6]">
            Discover <span className="text-[#F4EFE6]">{events.length || "new"} upcoming gigs</span>{" "}
            <span className="text-[#F4EFE6]/55">from artists near you</span>
          </p>
        </div>
      </section>

      {/* Scene 2: what Muse-ing is, in the open space in front of his profile as he exhales */}
      <section
        ref={reg("s2")}
        aria-label="About"
        className="absolute inset-x-5 bottom-16 max-w-[600px] sm:inset-x-auto sm:bottom-auto sm:left-[7vw] sm:top-1/2 sm:-translate-y-1/2"
        style={{ opacity: 0 }}
      >
        <div className="rise">
          <div className="dots"><i /></div>
          <h2 className="title-x mt-4 text-[38px] sm:text-[58px]">
            <Decode lines={TITLES.s2} section="s2" />
          </h2>
          <p className="fine mt-4 max-w-[520px] text-[15px]! sm:text-[18px]!">
            Muse-ing connects independent artists with live venue crowds. The room requests, the artist plays, and no two
            nights turn out the same.
          </p>
        </div>
        <ul className="rise-late mt-6 space-y-4 border-t border-white/15 pt-5">
          {ABOUT.map(([who, what]) => (
            <li key={who} className="grid grid-cols-[110px_1fr] items-baseline gap-4 sm:grid-cols-[150px_1fr]">
              <span className="micro text-[11px]! text-[#F4EFE6] sm:text-[13px]!">{who}</span>
              <span className="fine text-[14px]! sm:text-[16px]!">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Scene 3: the strut, copy on the left while he walks right of centre */}
      <section
        ref={reg("s3")}
        aria-label="At your table"
        className="absolute left-5 top-1/2 max-w-[400px] -translate-y-1/2 max-sm:bottom-32 max-sm:top-auto max-sm:translate-y-0 sm:left-[7vw]"
        style={{ opacity: 0 }}
      >
        <div className="rise">
          <div className="dots"><i /></div>
          <h2 className="title-x mt-4 text-[30px] sm:text-[38px]">
            <Decode lines={TITLES.s3} section="s3" />
          </h2>
        </div>
        <div className="rise-late">
          <p className="fine mt-3 max-w-[260px]">
            Upvote the songs you want next, send a shoutout from your table, and book tables and tickets with no middlemen.
          </p>
        </div>
      </section>

      {/* Scene 4: he walks up out of frame and the gigs line up under his feet */}
      <section ref={reg("s4")} aria-label="Upcoming gigs" className="absolute inset-x-0 bottom-20 px-5 sm:bottom-24 sm:px-8" style={{ opacity: 0 }}>
        <div className="rise flex items-end justify-between gap-4">
          <div>
            <div className="dots"><i /></div>
            <h2 className="title-x mt-4 text-[30px] sm:text-[38px]">
              <Decode lines={TITLES.s4} section="s4" />
            </h2>
          </div>
          <Link href="/events" className="pill-dark micro shrink-0">
            All events <ArrowUpRight className="h-3 w-3 text-[#F4EFE6]" />
          </Link>
        </div>
        <ul ref={reg("row")} className="no-scrollbar rise-late mt-5 flex gap-2 overflow-x-auto sm:gap-3">
          {events.map((ev, i) => (
            <li key={ev.id} className="w-[40vw] shrink-0 sm:w-[calc((100%-3.75rem)/6)] sm:min-w-[150px]">
              <Link
                href={`/events/${ev.id}`}
                className="group flex aspect-[4/5] flex-col justify-between rounded-md border border-white/10 bg-[#0b0a0e]/80 p-3 backdrop-blur-sm transition hover:border-white/50"
              >
                <div className="flex items-start justify-between">
                  <span className="micro text-[#F4EFE6]">{dateLabel(ev.event_date_only)}</span>
                  <span className="micro text-[#F4EFE6]/50">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <p className="title-x line-clamp-3 text-[13px] leading-[1.05] group-hover:text-white">{ev.title}</p>
                  <p className="micro mt-2 truncate text-[#F4EFE6]/50">{ev.artist_name || "Live"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                    <span className="flex min-w-0 items-center gap-1 text-[10px] text-[#F4EFE6]/60">
                      <MapPin className="h-3 w-3 shrink-0 text-[#F4EFE6]" />
                      <span className="truncate">{ev.location_name || "TBA"}</span>
                    </span>
                    <span className="micro shrink-0">{ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Scene 5: impact flash, then the form behind the glass */}
      <div ref={reg("flash")} className="absolute inset-0 bg-white" style={{ opacity: 0 }} />
      <section ref={reg("form")} aria-label="Book or host" className="absolute inset-0 z-10 flex items-center justify-center bg-[#05050a]/55 p-4 pt-16 backdrop-blur-[2px]" style={{ opacity: 0 }}>
        <div className="max-h-[86vh] w-full max-w-[640px] overflow-y-auto card-noir px-6 py-9 text-[#F4EFE6] sm:px-14 sm:py-12">
          <div className="dots mx-auto w-fit"><i /></div>
          <h2 className="title-x mt-4 text-center text-[32px] sm:text-[44px]">
            <Decode lines={TITLES.form} section="form" />
          </h2>
          <p className="fine mx-auto mt-3 max-w-sm text-center">
            Reserve a table, host a crowd-setlist night at your venue, or join the roster as a performer.
          </p>
          <div className="mx-auto mt-7 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
            {tab("reserve", "Reserve")}
            {tab("host", "Host")}
            {tab("artist", "Join as artist")}
          </div>

          {sent ? (
            <div className="py-10 text-center">
              <p className="title-x text-3xl">Thanks, {sent}</p>
              <p className="mt-2 text-sm text-white/90">We&apos;ve got your request and will be in touch shortly.</p>
              <button type="button" onClick={() => setSent(null)} className="btn-ghost mt-6">
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-5">
              <input aria-label="Name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} required />
              <div className="grid gap-5 sm:grid-cols-2">
                <input type="email" aria-label="Email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} required />
                <input type="tel" aria-label="Phone" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
              </div>
              {inquiry === "reserve" && events.length > 0 && (
                <select aria-label="Event" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} className={`${field} bg-transparent`}>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-[#14131a] text-white">
                      {ev.title} ({ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"})
                    </option>
                  ))}
                </select>
              )}
              <input
                aria-label="Message"
                placeholder={inquiry === "reserve" ? "Table for 4, a song dedication, anything else" : inquiry === "host" ? "Venue name, city and preferred nights" : "Instagram or Spotify link and genre"}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={field}
              />
              {error && <p className="text-center text-xs font-medium text-[#F4EFE6]">{error}</p>}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button type="submit" disabled={sending} className="btn-light px-10 disabled:opacity-60">
                  {sending ? "Sending…" : "Send"}
                </button>
                {inquiry === "reserve" && form.eventId && (
                  <Link href={`/book/${form.eventId}`} className="btn-ghost">
                    Direct ticket checkout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Bottom bar: scene label left, the index right */}
      <div ref={reg("chrome")} className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 pb-5 sm:px-8 sm:pb-6">
        <div className="flex items-center gap-3">
          <span ref={reg("label")} className="micro text-[#F4EFE6]/60 max-sm:hidden" />
          <div className="h-px w-12 overflow-hidden bg-white/15 max-sm:hidden">
            <div ref={reg("bar")} className="h-full w-full origin-left bg-[#F4EFE6]" />
          </div>
        </div>
        <Link href="/events" className="micro pointer-events-auto flex items-center gap-1 text-[#F4EFE6]/70 transition hover:text-white max-sm:hidden">
          Gig index <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
