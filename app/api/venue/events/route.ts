import { NextResponse } from "next/server"
import { all } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

interface EventRow {
  id: string
  title: string
  date: string
  description: string | null
  location_name: string | null
  ticket_price: number
  artist_id: string | null
  artist_name: string | null
  artist_category: string | null
  artist_instagram: string | null
}

interface SongRow {
  id: string
  event_id: string
  song_title: string
  original_artist: string | null
  status: string
}

// The venue's events with the artist booked and the playlist they'll sing.
export async function GET() {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const events = all<EventRow>(
    `SELECT e.id, e.title, e.date, e.description, e.location_name, e.ticket_price,
            e.artist_id, a.name AS artist_name, a.category AS artist_category, a.instagram_handle AS artist_instagram
       FROM events e LEFT JOIN users a ON a.id = e.artist_id
      WHERE (? = 'admin' OR e.venue_id = ?)
      ORDER BY e.date DESC`,
    user.role,
    user.id,
  )
  const songs = events.length
    ? all<SongRow>(
        `SELECT id, event_id, song_title, original_artist, status FROM song_requests
          WHERE source_type = 'artist_playlist' AND status <> 'declined'
            AND event_id IN (${events.map(() => "?").join(",")})
          ORDER BY created_at, choice_index`,
        ...events.map((e) => e.id),
      )
    : []
  return NextResponse.json({
    venue: { name: user.name, role: user.role },
    events: events.map((e) => ({
      ...e,
      playlist: songs
        .filter((s) => s.event_id === e.id)
        .map(({ id, song_title, original_artist, status }) => ({ id, song_title, original_artist, status })),
    })),
  })
}
