"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ListMusic, LogOut, MapPin, Mic2 } from "lucide-react"

interface Song {
  id: string
  song_title: string
  original_artist: string | null
  status: string
}
interface VenueEvent {
  id: string
  title: string
  date: string
  description: string | null
  location_name: string | null
  ticket_price: number
  artist_name: string | null
  artist_category: string | null
  artist_instagram: string | null
  playlist: Song[]
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

export default function VenuePage() {
  const router = useRouter()
  const [venue, setVenue] = useState<string>("")
  const [events, setEvents] = useState<VenueEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming")
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/venue/events", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) return router.replace("/login")
      if (!res.ok) return setError("Couldn't load your events. Refresh to try again.")
      const body = await res.json()
      setVenue(body.venue?.name ?? "")
      setEvents(body.events)
    })()
  }, [router])

  const { upcoming, past } = useMemo(() => {
    const today = dayKey(new Date().toISOString())
    const list = events ?? []
    return {
      upcoming: list.filter((e) => dayKey(e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)),
      past: list.filter((e) => dayKey(e.date) < today),
    }
  }, [events])
  const shown = tab === "upcoming" ? upcoming : past
  const today = dayKey(new Date().toISOString())

  // With nothing coming up, start on past gigs. Open the first gig's playlist by default.
  useEffect(() => {
    if (!events || openId !== null) return
    if (!upcoming.length && past.length) setTab("past")
    const first = upcoming[0] ?? past[0]
    if (first) setOpenId(first.id)
  }, [events, upcoming, past, openId])

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-[#0b0a0e] text-[#F4EFE6]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0a0e]/90 px-5 py-3.5 backdrop-blur-md sm:px-10">
        <Link href="/" aria-label="Muse-ing home" className="title-x text-[26px] sm:text-[30px]">
          M-
        </Link>
        <button onClick={signOut} className="btn-ghost btn-sm">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </header>

      <section className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#5a0910_0%,#1a0507_60%,#0b0a0e_100%)] px-5 pb-12 pt-10 sm:px-10">
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="dots">
            <i />
          </div>
          <span className="micro block pt-1 text-white/65">Venue</span>
          <h1 className="title-x text-[36px] leading-[0.95] sm:text-[56px]">{venue || "Your venue"}</h1>
          <p className="fine max-w-md pt-1">Your booked gigs, who&apos;s performing and the songs they&apos;ll sing.</p>
        </div>
      </section>

      <main className="mx-auto -mt-5 max-w-4xl rounded-t-[28px] bg-[#0b0a0e] px-5 pb-16 pt-6 sm:px-10">
        <div className="mb-6 flex gap-2">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`micro rounded-full border px-4 py-2 transition ${
                tab === t ? "border-[#F4EFE6] bg-[#F4EFE6] text-[#0b0a0e]" : "border-white/15 text-[#F4EFE6]/70 hover:border-white/35"
              }`}
            >
              {t === "upcoming" ? `Upcoming${events ? ` · ${upcoming.length}` : ""}` : `Past${events ? ` · ${past.length}` : ""}`}
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl border border-[#ff9a9a]/25 bg-[#ff9a9a]/10 p-3 text-sm text-[#ff9a9a]">{error}</p>}
        {!events && !error && <p className="fine">Loading your events…</p>}
        {events && shown.length === 0 && (
          <div className="card-noir px-6 py-10 text-center">
            <CalendarDays className="mx-auto mb-3 h-6 w-6 text-[#F4EFE6]/50" />
            <p className="title-x text-[18px]">{tab === "upcoming" ? "No gigs booked yet" : "No past gigs"}</p>
            <p className="fine mt-2">Gigs the Muse-ing team books at your venue show up here.</p>
          </div>
        )}

        <ul className="space-y-3">
          {shown.map((e) => {
            const open = openId === e.id
            const isToday = dayKey(e.date) === today
            return (
              <li key={e.id} className="card-noir overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="micro flex items-center gap-2 text-[#F4EFE6]/60">
                      {isToday && <span className="rounded-full bg-[#D92323] px-2 py-0.5 text-[#F4EFE6]">Tonight</span>}
                      {when(e.date)}
                    </p>
                    <h2 className="title-x mt-1.5 text-[18px] leading-tight sm:truncate sm:text-[22px]">{e.title}</h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#F4EFE6]/70">
                      <span className="flex items-center gap-1.5">
                        <Mic2 className="h-3.5 w-3.5" />
                        {e.artist_name ?? "Artist to be confirmed"}
                        {e.artist_category && <span className="text-[#F4EFE6]/45">· {e.artist_category}</span>}
                      </span>
                      {e.location_name && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {e.location_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="micro mt-1 flex shrink-0 items-center gap-1.5 text-[#F4EFE6]/60">
                    <ListMusic className="h-3.5 w-3.5" />
                    {e.playlist.length} {e.playlist.length === 1 ? "song" : "songs"}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-6">
                    <p className="micro mb-3 text-[#F4EFE6]/55">Playlist</p>
                    {e.playlist.length === 0 ? (
                      <p className="fine">{e.artist_name ? `${e.artist_name} hasn't added songs yet.` : "No artist booked yet."}</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {e.playlist.map((s, i) => (
                          <li key={s.id} className="flex items-baseline gap-3 rounded-xl px-3 py-2 odd:bg-white/[0.03]">
                            <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-[#F4EFE6]/40">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px]">{s.song_title}</span>
                              {s.original_artist && (
                                <span className="block truncate text-[12px] text-[#F4EFE6]/50">{s.original_artist}</span>
                              )}
                            </span>
                            {s.status === "played" && <span className="micro text-[#F4EFE6]/40">Played</span>}
                            {s.status === "playing" && <span className="micro text-[#ff7a7a]">Now</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    {e.description && <p className="fine mt-4 whitespace-pre-line">{e.description}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
