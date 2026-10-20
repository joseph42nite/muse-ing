import { NextResponse } from "next/server"
import { all, get } from "@/lib/server/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const locationSlug = url.searchParams.get("location")?.trim().toLowerCase()
  const dateOnly = url.searchParams.get("date")?.trim()

  const baseSelect = `
    SELECT
      e.id,
      e.title,
      e.description,
      e.date,
      e.event_date_only,
      e.location_name,
      e.location_slug,
      e.ticket_price,
      e.artist_id,
      u.name AS artist_name,
      u.instagram_handle AS artist_instagram,
      u.avatar_url AS artist_avatar,
      u.bio AS artist_bio,
      (SELECT COUNT(*) FROM song_requests sr WHERE sr.event_id = e.id AND sr.status IN ('confirmed', 'playing')) AS confirmed_songs_count,
      (SELECT COUNT(*) FROM song_requests sr WHERE sr.event_id = e.id AND sr.source_type = 'artist_playlist' AND sr.status IN ('confirmed', 'playing')) AS playlist_songs_count,
      (SELECT COALESCE(SUM(sr.upvotes), 0) FROM song_requests sr WHERE sr.event_id = e.id AND sr.status IN ('confirmed', 'playing')) AS total_upvotes,
      (SELECT COUNT(*) FROM song_requests sr WHERE sr.event_id = e.id AND sr.dedication_payment_status = 'paid' AND sr.status IN ('confirmed', 'playing')) AS priority_dedications_count
    FROM events e
    LEFT JOIN users u ON u.id = e.artist_id
  `

  if (locationSlug) {
    // First try exact location_slug + date match
    let matched = dateOnly
      ? get(
          `${baseSelect} WHERE LOWER(e.location_slug) = ? AND e.event_date_only = ? LIMIT 1`,
          locationSlug,
          dateOnly
        )
      : undefined

    // Fallback: match by location_slug (most recent/upcoming)
    if (!matched) {
      matched = get(
        `${baseSelect} WHERE LOWER(e.location_slug) = ? OR LOWER(e.location_name) LIKE ? ORDER BY e.date ASC LIMIT 1`,
        locationSlug,
        `%${locationSlug}%`
      )
    }

    return NextResponse.json({ matchedEvent: matched ?? null })
  }

  const events = all(`${baseSelect} ORDER BY e.date ASC`)
  return NextResponse.json({ events })
}
