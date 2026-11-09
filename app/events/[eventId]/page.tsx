import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, MapPin, Music } from "lucide-react"
import { get } from "@/lib/server/db"

export const dynamic = "force-dynamic"

interface EventDetail {
  id: string
  title: string
  description: string | null
  date: string
  event_date_only: string | null
  location_name: string | null
  location_slug: string | null
  ticket_price: number
  artist_name: string | null
  artist_bio: string | null
  artist_avatar: string | null
  artist_instagram: string | null
}

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80"

function load(eventId: string) {
  return get<EventDetail>(
    `SELECT e.id, e.title, e.description, e.date, e.event_date_only, e.location_name, e.location_slug,
            e.ticket_price, u.name AS artist_name, u.bio AS artist_bio, u.avatar_url AS artist_avatar,
            u.instagram_handle AS artist_instagram
       FROM events e LEFT JOIN users u ON u.id = e.artist_id
      WHERE e.id = ?`,
    eventId
  )
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params
  const ev = load(eventId)
  if (!ev) return { title: "Event not found — Muse-ing" }
  return {
    title: `${ev.title} — Muse-ing`,
    description: ev.description ?? `Live at ${ev.location_name ?? "a Muse-ing venue"}. Book your table.`,
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const ev = load(eventId)
  if (!ev) notFound()

  const when = new Date(ev.date)
  const dateLabel = isNaN(when.getTime())
    ? "Date to be announced"
    : when.toLocaleString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
  const liveHref = `/live?location=${encodeURIComponent(ev.location_slug ?? "")}&date=${encodeURIComponent(
    ev.event_date_only ?? ""
  )}`

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#181615] selection:bg-[#D92323] selection:text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-8 sm:px-12 pt-6 sm:pt-8">
        <Link href="/" aria-label="Muse-ing home" className="logo-mark text-5xl sm:text-6xl leading-none tracking-tight">
          <span>m</span>
          <span className="text-[#D92323]">-</span>
        </Link>
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#181615]/75 hover:text-[#D92323] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All events
        </Link>
      </header>

      <article className="mx-auto w-full max-w-5xl px-8 sm:px-12 pt-10 sm:pt-14 pb-24">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-14">
          <div className="self-start overflow-hidden rounded-2xl bg-[#121110] shadow-[0_24px_60px_-8px_rgba(24,22,21,0.32)]">
            { }
            <img
              src={ev.artist_avatar || FALLBACK_COVER}
              alt={ev.artist_name ?? ev.title}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>

          <div className="flex flex-col">
            {ev.artist_name && (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D92323]">{ev.artist_name}</p>
            )}
            <h1 className="instrument mt-2 text-5xl sm:text-6xl leading-[0.95] tracking-[-0.02em]">{ev.title}</h1>

            <dl className="mt-8 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#D92323]" />
                <dd>{dateLabel}</dd>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D92323]" />
                <dd>{ev.location_name ?? "Venue to be announced"}</dd>
              </div>
            </dl>

            {ev.description && (
              <p className="mt-8 text-base leading-relaxed text-[#181615]/80">{ev.description}</p>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-[#181615]/15 pt-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#181615]/55">From</p>
                <p className="text-3xl font-semibold">{ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"}</p>
              </div>
              <Link
                href={`/book/${ev.id}`}
                className="ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-[#D92323] px-8 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#b81b1b]"
              >
                Book now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Link
              href={liveHref}
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#181615] hover:text-[#D92323] transition-colors"
            >
              <Music className="h-4 w-4" /> Preview the live setlist
            </Link>
          </div>
        </div>

        {ev.artist_bio && (
          <section className="mt-16 max-w-2xl border-t border-[#181615]/15 pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#181615]/55">About the artist</h2>
            <p className="mt-3 text-base leading-relaxed text-[#181615]/80">{ev.artist_bio}</p>
          </section>
        )}
      </article>
    </main>
  )
}
