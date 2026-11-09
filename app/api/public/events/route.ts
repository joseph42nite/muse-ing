import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run } from "@/lib/server/db"
import { escapeLike } from "@/lib/server/format"

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
    FROM (SELECT * FROM events WHERE is_listed = 1) e
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
        `${baseSelect} WHERE LOWER(e.location_slug) = ? OR LOWER(e.location_name) LIKE ? ESCAPE '\\' ORDER BY e.date ASC LIMIT 1`,
        locationSlug,
        `%${escapeLike(locationSlug)}%`
      )
    }

    return NextResponse.json({ matchedEvent: matched ?? null })
  }

  // Optional cap (landing page): soonest upcoming events, falling back to all dates.
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "", 10) || 0, 50)
  let events: any[]
  if (limit > 0) {
    const today = new Date().toISOString().slice(0, 10)
    events = all(`${baseSelect} WHERE e.event_date_only >= ? ORDER BY e.date ASC LIMIT ?`, today, limit)
    if (events.length === 0) events = all(`${baseSelect} ORDER BY e.date ASC LIMIT ?`, limit)
  } else {
    events = all(`${baseSelect} ORDER BY e.date ASC`)
  }
  const artists = all(`
    SELECT
      u.id,
      u.name,
      u.instagram_handle,
      u.avatar_url,
      u.bio,
      (SELECT e.id FROM events e WHERE e.artist_id = u.id AND e.is_listed = 1 ORDER BY e.date ASC LIMIT 1) AS next_event_id,
      (SELECT e.title FROM events e WHERE e.artist_id = u.id AND e.is_listed = 1 ORDER BY e.date ASC LIMIT 1) AS next_event_title,
      (SELECT e.location_name FROM events e WHERE e.artist_id = u.id AND e.is_listed = 1 ORDER BY e.date ASC LIMIT 1) AS next_event_location,
      (SELECT e.location_slug FROM events e WHERE e.artist_id = u.id AND e.is_listed = 1 ORDER BY e.date ASC LIMIT 1) AS next_event_slug,
      (SELECT e.event_date_only FROM events e WHERE e.artist_id = u.id AND e.is_listed = 1 ORDER BY e.date ASC LIMIT 1) AS next_event_date
    FROM users u
    WHERE u.role = 'artist'
    ORDER BY u.created_at ASC
  `)
  return NextResponse.json({ events, artists })
}

// Contact / booking inquiries from the landing page, stored for the team to follow up.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
  const name = clip(body.name, 120)
  const email = clip(body.email, 200).toLowerCase()
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 })
  }
  run(
    "INSERT INTO inquiries (id, name, email, phone, inquiry_type, event_id, message) VALUES (?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    name,
    email,
    clip(body.phone, 30) || null,
    clip(body.inquiryType, 40) || "general",
    clip(body.eventId, 100) || null,
    clip(body.message, 4000) || null
  )
  return NextResponse.json({ ok: true })
}
