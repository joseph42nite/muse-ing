import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run } from "@/lib/server/db"
import { getSessionUser } from "@/lib/server/auth"
import { extractYouTubeId, matchCatalogForSong } from "@/lib/youtube"
import { resolveAndCacheKaraoke } from "@/lib/server/karaoke-resolver"

function slugifyLocation(loc: string): string {
  return loc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function enrichSongWithCandidates(song: any) {
  let candidates: any[] = []
  if (song.karaoke_candidates_json) {
    try {
      candidates = JSON.parse(song.karaoke_candidates_json)
    } catch {
      candidates = []
    }
  }
  if (!candidates || candidates.length === 0) {
    const matched = matchCatalogForSong(song.song_title, song.original_artist)
    candidates = matched.candidates
  }
  const resolvedVideoId = song.youtube_video_id || candidates[0]?.videoId || "sFMRqxCexDk"
  return {
    ...song,
    youtube_video_id: resolvedVideoId,
    youtube_url: song.youtube_url || `https://www.youtube.com/watch?v=${resolvedVideoId}`,
    youtube_title: song.youtube_title || candidates[0]?.title || `${song.song_title} (Karaoke)`,
    karaoke_candidates: candidates,
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestedEventId = url.searchParams.get("eventId")?.trim()

  const sessionUser = await getSessionUser()
  const artist =
    sessionUser && (sessionUser.role === "artist" || sessionUser.role === "admin")
      ? get<any>(
          "SELECT id, name, email, phone, role, instagram_handle, avatar_url, bio FROM users WHERE id = ?",
          sessionUser.id
        )
      : null

  if (!artist) {
    return NextResponse.json({ error: "Please sign in with your Artist account.", needsAuth: true }, { status: 401 })
  }

  const gigs = all<any>(
    `SELECT * FROM events WHERE (? = 'admin' OR artist_id = ?) ORDER BY date ASC`,
    artist.role,
    artist.id
  )

  const activeGig =
    (requestedEventId ? gigs.find((g) => g.id === requestedEventId) : null) ||
    gigs[0] ||
    null

  if (!activeGig) {
    return NextResponse.json({
      artist,
      gigs: [],
      activeGig: null,
      priorityDedications: [],
      upvotedQueue: [],
      artistPlaylist: [],
      pendingBatches: [],
      playedSongs: [],
    })
  }

  // Section 1: Priority Song Dedications (₹50 Paid Shoutouts)
  const priorityDedications = all<any>(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
        AND dedication_payment_status = 'paid'
      ORDER BY CASE WHEN status = 'playing' THEN 0 ELSE 1 END, upvotes DESC, created_at ASC`,
    activeGig.id
  ).map(enrichSongWithCandidates)

  // Section 2: Upvoted Crowd & Playlist Queue (Confirmed songs ranked by Upvotes)
  const upvotedQueue = all<any>(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
        AND dedication_payment_status != 'paid'
      ORDER BY
        CASE WHEN status = 'playing' THEN 0 ELSE 1 END,
        CASE WHEN dedication_payment_status = 'awaiting_payment' THEN 0 ELSE 1 END,
        upvotes DESC,
        created_at ASC`,
    activeGig.id
  ).map(enrichSongWithCandidates)

  // Pre-Gig / Live Artist Prepared Playlist (with YouTube links)
  const artistPlaylist = all<any>(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND source_type = 'artist_playlist'
        AND status != 'declined'
      ORDER BY upvotes DESC, created_at ASC`,
    activeGig.id
  ).map(enrichSongWithCandidates)

  // Section 3: Incoming 3-Song Audience Batches
  const allBatches = all<any>(
    `SELECT * FROM song_batches WHERE event_id = ? ORDER BY wants_dedication DESC, created_at DESC`,
    activeGig.id
  )

  const pendingBatches = allBatches
    .map((batch) => {
      const songs = all<any>(
        `SELECT * FROM song_requests WHERE batch_id = ? ORDER BY choice_index ASC`,
        batch.id
      ).map(enrichSongWithCandidates)
      return { ...batch, songs }
    })
    .filter((b) => b.songs.some((s: any) => s.status === "pending_artist"))

  const playedSongs = all<any>(
    `SELECT * FROM song_requests WHERE event_id = ? AND status = 'played' ORDER BY created_at DESC`,
    activeGig.id
  )

  return NextResponse.json({
    artist,
    gigs,
    activeGig,
    priorityDedications,
    upvotedQueue,
    artistPlaylist,
    pendingBatches,
    playedSongs,
  })
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !["artist", "admin"].includes(sessionUser.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const action = String(body.action ?? "")

  // 1. Pre-add a song to the Artist's Playlist (Auto-resolves YouTube Karaoke if link is omitted!)
  if (action === "add_playlist_song") {
    const eventId = String(body.event_id ?? "").trim()
    const songTitle = String(body.song_title ?? "").trim()
    const originalArtist = String(body.original_artist ?? "").trim() || null
    const explicitYoutubeUrl = String(body.youtube_url ?? "").trim() || null

    if (!eventId || !songTitle) {
      return NextResponse.json({ error: "Song title and event are required." }, { status: 400 })
    }

    const resolved = await resolveAndCacheKaraoke(songTitle, originalArtist, explicitYoutubeUrl)
    const id = crypto.randomUUID()

    run(
      `INSERT INTO song_requests
        (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, youtube_url, youtube_video_id, youtube_title, karaoke_candidates_json, status, upvotes, requester_name)
       VALUES (?, NULL, ?, 'artist_playlist', 1, ?, ?, ?, ?, ?, ?, 'confirmed', 0, 'Artist Playlist')`,
      id,
      eventId,
      songTitle,
      originalArtist,
      resolved.youtubeUrl,
      resolved.youtubeVideoId,
      resolved.youtubeTitle,
      resolved.candidatesJson
    )

    return NextResponse.json({
      ok: true,
      id,
      youtube_video_id: resolved.youtubeVideoId,
      candidates: resolved.candidates,
    })
  }

  // 2. Schedule a new Gig at a Location + Date
  if (action === "create_gig") {
    const title = String(body.title ?? "").trim()
    const locationName = String(body.location_name ?? "").trim()
    const dateInput = String(body.date ?? "").trim()
    const description = String(body.description ?? "").trim() || null
    const ticketPrice = Number(body.ticket_price ?? 0) || 0

    if (!title || !locationName || !dateInput) {
      return NextResponse.json({ error: "Gig title, location, and date are required." }, { status: 400 })
    }

    const parsedDate = new Date(dateInput)
    const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString()
    const dateOnly = dateInput.slice(0, 10)
    const locationSlug = slugifyLocation(locationName.split(",")[0] || locationName)
    const id = crypto.randomUUID()

    run(
      `INSERT INTO events
        (id, title, description, date, event_date_only, location_name, location_slug, artist_id, created_by, ticket_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      title,
      description,
      isoDate,
      dateOnly,
      locationName,
      locationSlug,
      sessionUser.id,
      sessionUser.id,
      ticketPrice
    )

    return NextResponse.json({ ok: true, id, location_slug: locationSlug, event_date_only: dateOnly })
  }

  // 3. Update Artist Profile
  if (action === "update_profile") {
    const name = String(body.name ?? "").trim()
    const instagramHandle = String(body.instagram_handle ?? "").trim()
    const avatarUrl = String(body.avatar_url ?? "").trim()
    const bio = String(body.bio ?? "").trim()

    if (!name) {
      return NextResponse.json({ error: "Artist name cannot be empty." }, { status: 400 })
    }

    const formattedInsta =
      instagramHandle && !instagramHandle.startsWith("@") && !instagramHandle.startsWith("http")
        ? `@${instagramHandle}`
        : instagramHandle || null

    run(
      `UPDATE users SET name = ?, instagram_handle = ?, avatar_url = ?, bio = ? WHERE id = ?`,
      name,
      formattedInsta,
      avatarUrl || null,
      bio || null,
      sessionUser.id
    )

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}

export async function PATCH(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !["artist", "admin"].includes(sessionUser.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const action = String(body.action ?? "")
  const requestId = String(body.request_id ?? "").trim()

  // 1. Artist Confirms a Song -> Automatically Finds & Caches Best YouTube Karaoke + Top Candidates!
  if (action === "confirm_song") {
    const song = get<any>("SELECT * FROM song_requests WHERE id = ?", requestId)
    if (!song) return NextResponse.json({ error: "Song request not found." }, { status: 404 })

    const explicitYt = body.youtube_url ? String(body.youtube_url).trim() : song.youtube_url
    const resolved = await resolveAndCacheKaraoke(song.song_title, song.original_artist, explicitYt)

    const nextPaymentStatus =
      song.wants_dedication && song.dedication_payment_status === "none"
        ? "awaiting_payment"
        : song.dedication_payment_status

    run(
      `UPDATE song_requests
          SET status = 'confirmed',
              youtube_url = ?,
              youtube_video_id = ?,
              youtube_title = ?,
              karaoke_candidates_json = ?,
              dedication_payment_status = ?
        WHERE id = ?`,
      resolved.youtubeUrl,
      resolved.youtubeVideoId,
      resolved.youtubeTitle,
      resolved.candidatesJson,
      nextPaymentStatus,
      requestId
    )

    if (body.decline_others !== false && song.batch_id) {
      run(
        `UPDATE song_requests
            SET status = 'declined'
          WHERE batch_id = ? AND id != ? AND status = 'pending_artist'`,
        song.batch_id,
        requestId
      )
    }

    return NextResponse.json({
      ok: true,
      youtube_video_id: resolved.youtubeVideoId,
      youtube_title: resolved.youtubeTitle,
      candidates: resolved.candidates,
    })
  }

  // 2. Switch between the Auto-Matched Karaoke Candidate Versions (e.g., Original vs Acoustic vs Alt Key)
  if (action === "select_karaoke_candidate") {
    const videoId = String(body.video_id ?? "").trim()
    const title = String(body.title ?? "").trim() || null
    if (!requestId || !videoId) {
      return NextResponse.json({ error: "Missing request_id or video_id." }, { status: 400 })
    }
    run(
      `UPDATE song_requests
          SET youtube_video_id = ?,
              youtube_url = ?,
              youtube_title = COALESCE(?, youtube_title)
        WHERE id = ?`,
      videoId,
      `https://www.youtube.com/watch?v=${videoId}`,
      title,
      requestId
    )
    return NextResponse.json({ ok: true, youtube_video_id: videoId })
  }

  if (action === "decline_song") {
    run("UPDATE song_requests SET status = 'declined' WHERE id = ?", requestId)
    return NextResponse.json({ ok: true })
  }

  if (action === "decline_batch") {
    const batchId = String(body.batch_id ?? "").trim()
    run("UPDATE song_requests SET status = 'declined' WHERE batch_id = ? AND status = 'pending_artist'", batchId)
    return NextResponse.json({ ok: true })
  }

  if (action === "set_now_playing") {
    const song = get<any>("SELECT * FROM song_requests WHERE id = ?", requestId)
    if (!song) return NextResponse.json({ error: "Song not found." }, { status: 404 })

    run(
      "UPDATE song_requests SET status = 'confirmed' WHERE event_id = ? AND status = 'playing' AND id != ?",
      song.event_id,
      requestId
    )
    run("UPDATE song_requests SET status = 'playing' WHERE id = ?", requestId)
    run(
      "UPDATE events SET active_song_request_id = ?, active_karaoke_Floor_video_id = COALESCE(?, active_karaoke_Floor_video_id) WHERE id = ?",
      requestId,
      song.youtube_video_id,
      song.event_id
    )
    return NextResponse.json({ ok: true })
  }

  if (action === "mark_played") {
    const song = get<any>("SELECT * FROM song_requests WHERE id = ?", requestId)
    if (!song) return NextResponse.json({ error: "Song not found." }, { status: 404 })

    run("UPDATE song_requests SET status = 'played' WHERE id = ?", requestId)
    run(
      "UPDATE events SET active_song_request_id = CASE WHEN active_song_request_id = ? THEN NULL ELSE active_song_request_id END WHERE id = ?",
      requestId,
      song.event_id
    )
    return NextResponse.json({ ok: true })
  }

  if (action === "attach_youtube") {
    const youtubeUrl = String(body.youtube_url ?? "").trim() || null
    const youtubeVideoId = extractYouTubeId(youtubeUrl)
    run(
      "UPDATE song_requests SET youtube_url = ?, youtube_video_id = ? WHERE id = ?",
      youtubeUrl,
      youtubeVideoId,
      requestId
    )
    return NextResponse.json({ ok: true, youtube_video_id: youtubeVideoId })
  }

  if (action === "delete_song") {
    run("DELETE FROM song_requests WHERE id = ?", requestId)
    return NextResponse.json({ ok: true })
  }

  if (action === "mark_dedication_paid") {
    run(
      "UPDATE song_requests SET wants_dedication = 1, dedication_payment_status = 'paid' WHERE id = ?",
      requestId
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
