"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, MapPin, Mic2 } from "lucide-react"
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

const SCENES = ["The grin", "The exhale", "The other side", "The outfit", "The guitar", "The smash"]
const sceneIndex = (t: number) => (t < 0.15 ? 0 : t < 0.3 ? 1 : t < 0.5 ? 2 : t < 0.68 ? 3 : t < 0.84 ? 4 : 5)

const glass =
  "rounded-2xl border border-white/10 bg-[#14131a]/75 backdrop-blur-md shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)]"

export default function Overlay({ jump }: { jump: (p: number) => void }) {
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const [events, setEvents] = useState<OverlayEvent[]>([])
  const [inquiry, setInquiry] = useState<Inquiry>("reserve")
  const [form, setForm] = useState({ name: "", email: "", phone: "", eventId: "", message: "" })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    const load = async (when: string) => {
      const r = await fetch(`/api/public/events/search?limit=12&when=${when}`)
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
    const set = (key: string, v: number) => {
      const el = refs.current[key]
      if (!el) return
      el.style.opacity = String(v)
      el.style.visibility = v < 0.01 ? "hidden" : "visible"
      el.style.pointerEvents = v > 0.5 ? "auto" : "none"
    }
    const loop = () => {
      const t = scroll.value
      set("cue", 1 - smooth(0.02, 0.07, t))
      set("s2", win(t, 0.16, 0.2, 0.3, 0.34))
      set("s3", win(t, 0.43, 0.48, 0.56, 0.6))
      set("s4", win(t, 0.61, 0.65, 0.68, 0.72))
      set("s5", win(t, 0.75, 0.79, 0.86, 0.9))
      set("flash", win(t, SMASH.crack[0], SMASH.crack[1], SMASH.crack[1], 0.975) * 0.85)
      set("form", smooth(SMASH.form[0], SMASH.form[1], t))
      const label = refs.current.label
      if (label) {
        const i = sceneIndex(t)
        const txt = `0${i + 1} / 06 · ${SCENES[i]}`
        if (label.textContent !== txt) label.textContent = txt
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

  const field =
    "w-full bg-transparent border-b border-white/60 py-2.5 text-sm text-white placeholder:text-white/80 focus:outline-none focus:border-white"
  const tab = (k: Inquiry, label: string) => (
    <button
      type="button"
      onClick={() => setInquiry(k)}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        inquiry === k ? "bg-white text-[#D92323]" : "text-white/85 hover:text-white"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="pointer-events-none absolute inset-0 text-[#F4EFE6]">
      <h1 className="sr-only">Muse-ing: a live music experience. Discover live events, book a table, or join as an artist.</h1>
      <span className="instrument pointer-events-none absolute opacity-0" aria-hidden="true">
        muse-ing
      </span>

      {/* Header */}
      <header className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between px-8 pt-6 sm:px-12 sm:pt-8 md:px-16">
        <button type="button" onClick={() => jump(0)} aria-label="Back to start" className="logo-mark text-5xl leading-none sm:text-6xl">
          <span>m</span>
          <span className="text-[#F2A33A]">-</span>
        </button>
        <nav aria-label="Primary" className="flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <Link href="/events" className="text-[#F4EFE6]/80 transition-colors hover:text-[#F2A33A]">
            Events
          </Link>
          <button type="button" onClick={() => jump(0.79)} className="text-[#F4EFE6]/80 transition-colors hover:text-[#F2A33A]">
            Artists
          </button>
          <button type="button" onClick={() => jump(1)} className="text-[#F4EFE6]/80 transition-colors hover:text-[#F2A33A]">
            Book / Host
          </button>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[#F2A33A] transition-opacity hover:opacity-80">
            <Mic2 className="h-3.5 w-3.5" /> Artist login
          </Link>
        </nav>
      </header>

      {/* Scroll cue */}
      <div ref={reg("cue")} className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-[11px] font-semibold uppercase tracking-[0.2em]">
        Scroll
        <div className="mx-auto mt-2 h-8 w-px bg-[#F2A33A]" />
      </div>

      {/* Scene 2: tagline */}
      <div ref={reg("s2")} className="absolute bottom-16 left-8 max-w-sm sm:left-12 md:left-16" style={{ opacity: 0 }}>
        <p className="text-sm text-[#F4EFE6]/80">Hey, we&apos;re Muse-ing</p>
        <p className="mt-1 text-2xl font-medium tracking-tight">A live music experience</p>
        <p className="mt-3 text-[13px] leading-relaxed text-[#F4EFE6]/70">
          Connecting independent artists with live venue crowds through real-time setlists, requests, and dedications.
        </p>
      </div>

      {/* Scene 3: events */}
      <section ref={reg("s3")} aria-label="Live events" className="absolute inset-0" style={{ opacity: 0 }}>
        <div className="absolute bottom-16 left-8 max-w-md sm:left-12 md:left-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F2A33A]">Currently hosted gigs</p>
          <h2 className="mt-2 text-3xl font-medium leading-tight tracking-tight">Live events across venues</h2>
          <p className="mt-2 text-[13px] text-[#F4EFE6]/70">Shape the setlist from your table, then book in a few taps.</p>
          <Link
            href="/events"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#F2A33A] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10122e] transition hover:bg-[#d98a22]"
          >
            Browse all events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="absolute right-8 top-28 flex w-[min(340px,34vw)] flex-col gap-3 sm:right-12 md:right-16">
          {events.slice(0, 3).map((ev, i) => (
            <li key={ev.id} style={{ transform: `rotate(${[-1.5, 1, -0.8][i]}deg)` }}>
              <Link href={`/events/${ev.id}`} className={`${glass} block p-4 transition hover:border-[#F2A33A]/60`}>
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F4EFE6]/60">{ev.artist_name || "Live"}</p>
                <p className="mt-1 truncate text-base font-medium">{ev.title}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#F4EFE6]/70">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F2A33A]" />
                    <span className="truncate">{ev.location_name || "Venue to be announced"}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-[#F4EFE6]">{ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Scene 4: outfit callouts */}
      <div ref={reg("s4")} aria-hidden="true" className="absolute inset-0" style={{ opacity: 0 }}>
        {[
          { cls: "left-8 top-[28%] sm:left-[9vw]", t: "Live setlists", d: "Upvote the songs you want next" },
          { cls: "right-8 top-[38%] text-right sm:right-[9vw]", t: "Dedications", d: "Send a shoutout from your table" },
          { cls: "left-8 bottom-[22%] sm:left-[12vw]", t: "Direct booking", d: "Tables and tickets, no middlemen" },
        ].map((c) => (
          <div key={c.t} className={`absolute max-w-[220px] ${c.cls}`}>
            <div className="mb-2 h-px w-12 bg-[#F2A33A] [margin-left:inherit]" />
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#F2A33A]">{c.t}</p>
            <p className="mt-1 text-[13px] text-[#F4EFE6]/75">{c.d}</p>
          </div>
        ))}
      </div>

      {/* Scene 5: artist login */}
      <section ref={reg("s5")} aria-label="For artists" className="absolute right-8 top-1/2 w-[min(380px,86vw)] -translate-y-1/2 sm:right-12 md:right-16" style={{ opacity: 0 }}>
        <div className={`${glass} border-[#F2A33A]/50 p-6`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F2A33A]">For artists</p>
          <h2 className="mt-2 text-2xl font-medium leading-tight tracking-tight">This is your stage</h2>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[#F4EFE6]/75">
            <li>Build and run your live setlist</li>
            <li>See crowd requests and dedications in real time</li>
            <li>Get paid for priority shoutouts</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#F2A33A] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10122e] transition hover:bg-[#d98a22]">
              <Mic2 className="h-4 w-4" /> Artist login
            </Link>
            <button
              type="button"
              onClick={() => {
                setInquiry("artist")
                jump(1)
              }}
              className="inline-flex h-11 items-center rounded-full border border-white/30 px-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:bg-white/10"
            >
              Join the roster
            </button>
          </div>
        </div>
      </section>

      {/* Scene 6: impact flash, then the form behind the glass */}
      <div ref={reg("flash")} className="absolute inset-0 bg-[#F2A33A]" style={{ opacity: 0 }} />
      <section ref={reg("form")} aria-label="Book or host" className="absolute inset-0 flex items-center justify-center bg-[#0a0b24]/65 p-4" style={{ opacity: 0 }}>
        <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-3xl bg-[#D92323] px-6 py-8 text-white shadow-[0_30px_80px_-15px_rgba(228,38,44,0.55)] sm:px-14 sm:py-10">
          <h2 className="text-center text-xl font-semibold uppercase tracking-[0.14em] sm:text-2xl">Book or host with us</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-white/85">
            Reserve a table, host a crowd-setlist night at your venue, or join the roster as a performer.
          </p>
          <div className="mx-auto mt-4 flex w-fit items-center gap-1 rounded-full border border-white/15 bg-black/20 p-1">
            {tab("reserve", "Reserve event")}
            {tab("host", "Host at venue")}
            {tab("artist", "Join as artist")}
          </div>

          {sent ? (
            <div className="py-10 text-center">
              <p className="text-lg font-semibold uppercase tracking-wider">Thanks, {sent}</p>
              <p className="mt-2 text-sm text-white/90">We&apos;ve got your request and will be in touch shortly.</p>
              <button type="button" onClick={() => setSent(null)} className="mt-5 rounded-full border border-white/40 px-5 py-2 text-xs uppercase tracking-wider hover:bg-white/10">
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
                <select aria-label="Event" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} className={`${field} bg-[#D92323]`}>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-[#181615] text-white">
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
              {error && <p className="text-center text-xs font-medium text-amber-200">{error}</p>}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button type="submit" disabled={sending} className="h-11 bg-[#181615] px-10 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-black disabled:opacity-60">
                  {sending ? "Sending…" : "Send"}
                </button>
                {inquiry === "reserve" && form.eventId && (
                  <Link href={`/book/${form.eventId}`} className="inline-flex h-11 items-center gap-1.5 border border-white/45 px-4 text-[11px] font-medium uppercase tracking-wider transition hover:bg-white/15">
                    Direct ticket checkout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </form>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-4 text-[11px] text-white/80">
            <span>hello@museing.live</span>
            <span>Copyright © Muse-ing 2026</span>
            <Link href="/venue-checkin" className="hover:text-white">
              Venue check-in
            </Link>
          </div>
        </div>
      </section>

      {/* Scene label and progress */}
      <div className="absolute bottom-6 right-8 flex items-center gap-3 sm:right-12 md:right-16">
        <span ref={reg("label")} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F4EFE6]/60" />
        <div className="h-[2px] w-16 overflow-hidden bg-white/15">
          <div ref={reg("bar")} className="h-full w-full origin-left bg-[#F2A33A]" />
        </div>
      </div>
    </div>
  )
}
