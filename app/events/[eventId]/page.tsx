import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, Mic2, Music } from "lucide-react"
import { get } from "@/lib/server/db"
import Footer from "@/components/monkey/footer"

export const dynamic = "force-dynamic"
export const viewport: Viewport = { themeColor: "#070709" }

interface EventDetail {
  id: string
  title: string
  description: string | null
  date: string
  event_date_only: string | null
  location_name: string | null
  location_slug: string | null
  ticket_price: number
  cancelled: number
  artist_name: string | null
  artist_bio: string | null
  artist_avatar: string | null
  artist_instagram: string | null
  artist_category: string | null
}

function load(eventId: string) {
  return get<EventDetail>(
    `SELECT e.id, e.title, e.description, e.date, e.event_date_only, e.location_name, e.location_slug,
            e.ticket_price, COALESCE(e.fee_status, '') = 'Cancelled' AS cancelled,
            u.name AS artist_name, u.bio AS artist_bio, u.avatar_url AS artist_avatar,
            u.instagram_handle AS artist_instagram, u.category AS artist_category
       FROM events e LEFT JOIN users u ON u.id = e.artist_id
      WHERE e.id = ?`,
    eventId,
  )
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params
  const ev = load(eventId)
  if (!ev) return { title: "Event not found | Muse-ing" }
  return {
    title: `${ev.title} | Muse-ing`,
    description: ev.description ?? `Live at ${ev.location_name ?? "a Muse-ing venue"}. Book your table.`,
  }
}

const IST = "Asia/Kolkata"
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-IN", { timeZone: IST, ...o })

/** Font size that fits the longest word of `s` across the viewport, so a name never breaks mid-word. */
function fitTitle(s: string, maxPx: number, share = 88) {
  const longest = Math.max(1, ...s.split(/\s+/).map((w) => w.length))
  // The expanded display face runs about 0.95em per uppercase glyph.
  const vw = (share / (longest * 0.95)).toFixed(2)
  return `clamp(30px, ${vw}vw, ${maxPx}px)`
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const ev = load(eventId)
  if (!ev) notFound()

  const when = new Date(ev.date)
  const valid = !isNaN(when.getTime())
  const day = valid ? fmt(when, { weekday: "long" }) : "Date"
  const date = valid ? fmt(when, { day: "numeric", month: "long", year: "numeric" }) : "To be announced"
  const time = valid ? fmt(when, { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase() : null
  const [venue, city] = (ev.location_name ?? "Venue to be announced").split("•").map((s) => s.trim())
  const past = valid && when.getTime() < Date.now() - 6 * 3600e3
  const paid = ev.ticket_price > 0
  const price = paid ? `₹${ev.ticket_price.toLocaleString("en-IN")}` : "Free"
  const handle = ev.artist_instagram?.replace(/^@+/, "")
  const liveHref = `/live/${encodeURIComponent(ev.id)}`
  const status = ev.cancelled ? "Cancelled" : past ? "Played" : null

  // The artist's name is the headline; the gig's own title shows above it only when it says more.
  const headline = ev.artist_name?.trim() || ev.title
  const showTitle = !!ev.artist_name && !ev.title.toLowerCase().startsWith(ev.artist_name.trim().toLowerCase())

  const cta = ev.cancelled ? (
    <Link href="/events" className="btn-light">
      See other gigs <ArrowRight className="h-4 w-4" />
    </Link>
  ) : past ? (
    <Link href={liveHref} className="btn-light">
      <Music className="h-4 w-4" /> See the setlist
    </Link>
  ) : (
    <>
      {paid ? (
        <Link href={`/book/${ev.id}`} className="btn-light">
          Book a table · {price} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <Link href={liveHref} className="btn-light">
          Free entry · Join the live room <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {paid && (
        <Link href={liveHref} className="btn-ghost">
          <Music className="h-4 w-4" /> Preview the setlist
        </Link>
      )}
    </>
  )

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#070709] text-[#F4EFE6] selection:bg-[#F4EFE6] selection:text-[#070709]">
        {/* Fold: the landing's red studio (its stops, centred lower, behind the name), fading into the page black */}
        <section aria-label="Gig" className="relative flex min-h-[92svh] flex-col">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_75%_at_45%_60%,#9e0a14_0%,#6b0510_40%,#170306_80%,#070709_100%)]"
          />
          {/* A floor glow, as in the studio, and a fade into the page below */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-[radial-gradient(60%_80%_at_50%_100%,rgba(217,35,35,0.18)_0%,transparent_70%),linear-gradient(180deg,transparent,#070709)]"
          />

          <header className="relative z-10 flex items-center justify-between px-5 pt-7 sm:px-8 sm:pt-10">
            <Link href="/" aria-label="Muse-ing home" className="title-x text-[30px] sm:text-[36px]">
              M-
            </Link>
            <p className="micro absolute left-1/2 -translate-x-1/2 text-[#F4EFE6]/60 max-md:hidden">Live music · Real-time setlists</p>
            <nav aria-label="Primary" className="flex items-center gap-2">
              <Link href="/events" className="pill-dark micro">
                <ArrowLeft className="h-3 w-3" /> All events
              </Link>
              <Link href="/login" className="pill-dark micro max-sm:hidden">
                Artist login <Mic2 className="h-3 w-3" />
              </Link>
            </nav>
          </header>

          <div className="relative z-10 mt-auto px-5 pb-12 pt-20 sm:px-8 sm:pb-16">
            <div className="rise flex items-center gap-4">
              <div className="dots">
                <i />
              </div>
              {status && (
                <span
                  className={`micro rounded-full border px-3 py-1 ${
                    ev.cancelled ? "border-[#ff7a7a]/60 text-[#ff9a9a]" : "border-[#F4EFE6]/30 text-[#F4EFE6]/75"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
            <p className="micro rise mt-5 text-[#F4EFE6]/70">
              {showTitle ? ev.title : ev.artist_category || "Live music"}
            </p>
            <h1
              className="title-x rise mt-3 leading-[0.86] [hyphens:none] [overflow-wrap:normal]"
              style={{ fontSize: fitTitle(headline, 168) }}
            >
              {headline}
            </h1>
            {/* Under the name, in ink and kept small like the landing's LIVE MUSIC */}
            <p
              className="title-x rise-late mt-3 text-[#0b0a0e]! leading-[1.2]! tracking-[0.18em]! [text-shadow:none]! [hyphens:none]"
              style={{ fontSize: "clamp(14px, 3.6vw, 30px)" }}
            >
              Live at {venue}
            </p>

            <div className="mt-8 h-px w-full bg-[#F4EFE6]/70" />
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:mt-4 sm:grid-cols-4">
              <p className="micro leading-[1.5]">
                {day} <span className="block text-[#F4EFE6]/60">{date}</span>
              </p>
              <p className="micro leading-[1.5]">
                Starts <span className="block text-[#F4EFE6]/60">{time ? `${time} IST` : "To be announced"}</span>
              </p>
              <p className="micro leading-[1.5]">
                {venue} <span className="block text-[#F4EFE6]/60">{city || "Venue"}</span>
              </p>
              <p className="micro leading-[1.5]">
                Entry <span className="block text-[#F4EFE6]/60">{paid ? `${price} per person` : "Free"}</span>
              </p>
            </div>

            <div className="rise-late mt-9 flex flex-wrap gap-3">{cta}</div>
          </div>
        </section>

        <article className="relative z-10">
          <div className="grid gap-6 px-5 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
            {/* Poster: the artist's photo if we have one, otherwise the date in the display face on studio red */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] border border-[#F4EFE6]/10 bg-[radial-gradient(120%_90%_at_50%_10%,#9e0a14_0%,#6b0510_45%,#170306_100%)] lg:max-h-[80vh] lg:w-full">
              {ev.artist_avatar ? (
                <>
                  {/* Artist photos come from anywhere, so a plain img rather than next/image. */}
                  <img src={ev.artist_avatar} alt={ev.artist_name ?? ev.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(7,7,9,0.75))]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 sm:p-8">
                    <span className="micro text-[#F4EFE6]/80">{ev.artist_name}</span>
                    <span className="title-x text-[28px] text-[#F4EFE6]/90">M-</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                  <div className="flex items-start justify-between">
                    <div className="dots">
                      <i />
                    </div>
                    <span className="micro text-[#F4EFE6]/70">{valid ? fmt(when, { weekday: "short" }) : "TBA"}</span>
                  </div>
                  <div>
                    <p className="title-x text-[clamp(96px,22vw,240px)] leading-[0.8] lg:text-[clamp(96px,14vw,240px)]">
                      {valid ? fmt(when, { day: "2-digit" }) : "—"}
                    </p>
                    <p className="title-x mt-2 text-[clamp(36px,8vw,84px)] leading-[0.9] text-[#0b0a0e]! [text-shadow:none]! lg:text-[clamp(36px,5vw,84px)]">
                      {valid ? fmt(when, { month: "short" }) : "Soon"}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <span className="micro text-[#F4EFE6]/75">
                      {time ? `${time} · ` : ""}
                      {venue}
                    </span>
                    <span className="title-x text-[28px] text-[#F4EFE6]/90">M-</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* The night at a glance, in the landing's micro / fine pairing */}
              <div className="card-noir p-6 sm:p-8">
                <p className="micro text-[#F4EFE6]/55">{paid ? "Tickets from" : "Entry"}</p>
                <p className="title-x mt-2 text-[44px] sm:text-[56px]">{price}</p>
                <p className="fine mt-3 max-w-sm text-[12.5px]!">
                  {ev.cancelled
                    ? "This night won't go ahead. Have a look at what else is on."
                    : past
                      ? "This night has been played. See what the room sang along to."
                      : paid
                        ? "Book your table, then shape the night: upvote songs, send requests and dedicate a track from your seat."
                        : "Walk in, scan your table's QR code and shape the night: upvote songs, send requests and dedicate a track."}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">{cta}</div>
              </div>

              <dl className="card-noir divide-y divide-[#F4EFE6]/10 px-6 sm:px-8">
                {[
                  { k: "Date", v: valid ? `${day}, ${date}` : date },
                  { k: "Starts", v: time ? `${time} IST` : "To be announced" },
                  { k: "Venue", v: city ? `${venue}, ${city}` : venue },
                  { k: "Artist", v: ev.artist_name ?? "To be announced" },
                ].map((row) => (
                  <div key={row.k} className="flex items-baseline justify-between gap-6 py-4">
                    <dt className="micro shrink-0 text-[#F4EFE6]/50">{row.k}</dt>
                    <dd className="text-right text-[14px] text-[#F4EFE6]/90">{row.v}</dd>
                  </div>
                ))}
                {handle && (
                  <div className="flex items-baseline justify-between gap-6 py-4">
                    <dt className="micro shrink-0 text-[#F4EFE6]/50">Follow</dt>
                    <dd>
                      <a
                        href={`https://instagram.com/${encodeURIComponent(handle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[14px] text-[#F4EFE6]/90 transition hover:text-white"
                      >
                        <Instagram className="h-3.5 w-3.5" /> @{handle} <ArrowUpRight className="h-3 w-3 opacity-60" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              {ev.description && (
                <div className="px-1">
                  <p className="micro text-[#F4EFE6]/55">The night</p>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#F4EFE6]/75">{ev.description}</p>
                </div>
              )}
            </div>
          </div>

          {ev.artist_bio && (
            <section aria-label="About the artist" className="px-5 pt-16 sm:px-8 sm:pt-24">
              <div className="dots">
                <i />
              </div>
              <h2 className="title-x mt-4 text-[30px] sm:text-[38px]">About {ev.artist_name ?? "the artist"}</h2>
              <div className="mt-5 h-px w-full bg-[#F4EFE6]/20" />
              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[#F4EFE6]/75 sm:text-[16px]">{ev.artist_bio}</p>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
            <Link href="/events" className="micro inline-flex items-center gap-1.5 text-[#F4EFE6]/70 transition hover:text-white">
              <ArrowLeft className="h-3 w-3" /> Gig index
            </Link>
            <Link href="/#book" className="micro inline-flex items-center gap-1.5 text-[#F4EFE6]/70 transition hover:text-white">
              Host a night <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
