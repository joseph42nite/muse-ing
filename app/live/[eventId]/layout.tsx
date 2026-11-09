import type { Metadata } from "next"
import { get } from "@/lib/server/db"

type Props = { params: Promise<{ eventId: string }> }

type GigMeta = {
  title: string | null
  date: string | null
  event_date_only: string | null
  location_name: string | null
  artist_name: string | null
}

const formatDate = (raw: string | null) => {
  if (!raw) return ""
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

// Names the gig in link previews (WhatsApp, Instagram, X) when someone shares the page.
// The share image is the sitewide app/opengraph-image.jpg, named explicitly here because this
// segment's own openGraph/twitter objects otherwise drop the inherited file-based image.
const shareImage = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "A suited monkey in glowing red visor glasses, cigarette in mouth, playing an electric guitar in a leather armchair under the words MUSE-ING, LIVE MUSIC.",
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params
  let gig: GigMeta | undefined
  try {
    gig = get<GigMeta>(
      `SELECT e.title, e.date, e.event_date_only, e.location_name, u.name AS artist_name
         FROM events e
         LEFT JOIN users u ON u.id = e.artist_id
        WHERE e.id = ?`,
      eventId
    )
  } catch {
    gig = undefined
  }

  if (!gig) {
    return { title: "Gig not found · Muse-ing", robots: { index: false } }
  }

  const artist = gig.artist_name?.trim() || "Live artist"
  const venue = gig.location_name?.trim()
  const when = formatDate(gig.event_date_only || gig.date)
  const title = `${artist}${venue ? ` live at ${venue}` : " live"} · Muse-ing`
  const description = [
    `${gig.title?.trim() || `${artist} live`}${when ? `, ${when}` : ""}${venue ? ` at ${venue}` : ""}.`,
    `Request songs, vote the setlist, and send ${artist} a dedication from your table.`,
  ].join(" ")

  return {
    title,
    description,
    alternates: { canonical: `/live/${eventId}` },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Muse-ing",
      locale: "en_IN",
      url: `/live/${eventId}`,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [shareImage] },
  }
}

export default function GigLayout({ children }: { children: React.ReactNode }) {
  return children
}
