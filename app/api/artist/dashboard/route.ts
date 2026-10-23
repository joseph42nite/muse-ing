import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run } from "@/lib/server/db"
import { getSessionUser } from "@/lib/server/auth"
import { extractYouTubeId } from "@/lib/youtube"

function slugifyLocation(loc: string): string {
  return loc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function cleanSongRecord(song: any) {
  const vidId = song.youtube_video_id || extractYouTubeId(song.youtube_url) || null
  return {
    ...song,
    youtube_video_id: vidId,
    youtube_url: vidId ? `https://www.youtube.com/watch?v=${vidId}` : (song.youtube_url || null),
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestedEventId = url.searchParams.get("eventId")?.trim()

  const sessionUser = await getSessionUser()
  const artist =
    sessionUser && (sessionUser.role === "artist" || sessionUser.role === "admin")
      ? get<any>(
          `SELECT id, name, email, phone, role, instagram_handle, avatar_url, bio,
                  upi_id, payee_name, bank_name, account_number, ifsc_code,
                  upipay_provider, upipay_merchant_id
             FROM users WHERE id = ?`,
          sessionUser.id
        )
      : null

  if (!artist) {
    return NextResponse.json({ error: "Please sign in with your Artist account.", needsAuth: true }, { status: 401 })
  }

  const transactions = all<any>(
    `SELECT * FROM artist_transactions WHERE artist_id = ? ORDER BY created_at DESC`,
    artist.id
  )

  const totalRevenue = transactions
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const dedicationRevenue = transactions
    .filter((t) => t.status === "paid" && t.type === "dedication")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const tipRevenue = transactions
    .filter((t) => t.status === "paid" && t.type === "tip")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const earningsSummary = {
    totalRevenue,
    dedicationRevenue,
    tipRevenue,
    totalTransactions: transactions.length,
  }

  const gigsRaw = all<any>(
    `SELECT e.*,
            COALESCE((SELECT SUM(upvotes) FROM song_requests WHERE event_id = e.id), 0) AS total_upvotes,
            COALESCE((SELECT COUNT(*) FROM song_requests WHERE event_id = e.id AND (dedication_payment_status = 'paid' OR wants_dedication = 1)), 0) AS dedications_count,
            COALESCE((SELECT COUNT(*) FROM artist_transactions WHERE event_id = e.id AND type = 'tip' AND status = 'paid'), 0) AS tips_count,
            COALESCE((SELECT SUM(amount) FROM artist_transactions WHERE event_id = e.id AND type = 'tip' AND status = 'paid'), 0) AS tips_amount,
            COALESCE((SELECT SUM(amount) FROM artist_transactions WHERE event_id = e.id AND type = 'dedication' AND status = 'paid'), 0) AS dedications_amount
       FROM events e
      WHERE (? = 'admin' OR e.artist_id = ?)
      ORDER BY e.date ASC`,
    artist.role,
    artist.id
  )

  const gigs = gigsRaw.map((g) => ({
    ...g,
    total_upvotes: Number(g.total_upvotes || 0),
    dedications_count: Number(g.dedications_count || 0),
    tips_count: Number(g.tips_count || 0),
    tips_amount: Number(g.tips_amount || 0),
    dedications_amount: Number(g.dedications_amount || 0),
  }))

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
  ).map(cleanSongRecord)

  // Section 2: Upvoted Audience Requests (Exclude songs already present in artist playlist or already paid dedications)
  const upvotedQueue = all<any>(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
        AND source_type = 'audience_request'
        AND dedication_payment_status != 'paid'
        AND LOWER(TRIM(song_title)) NOT IN (
          SELECT LOWER(TRIM(song_title))
            FROM song_requests
           WHERE event_id = ?
             AND source_type = 'artist_playlist'
             AND status != 'declined'
        )
      ORDER BY
        CASE WHEN status = 'playing' THEN 0 ELSE 1 END,
        CASE WHEN dedication_payment_status = 'awaiting_payment' THEN 0 ELSE 1 END,
        upvotes DESC,
        created_at ASC`,
    activeGig.id,
    activeGig.id
  ).map(cleanSongRecord)

  // Pre-Gig / Live Artist Prepared Playlist (with YouTube links)
  // Ordered: playing first, custom choice_index next, upvotes next, played songs last
  const artistPlaylist = all<any>(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND source_type = 'artist_playlist'
        AND status != 'declined'
      ORDER BY
        CASE WHEN status = 'playing' THEN 0 WHEN status = 'played' THEN 2 ELSE 1 END,
        choice_index ASC,
        upvotes DESC,
        created_at ASC`,
    activeGig.id
  ).map(cleanSongRecord)

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
      ).map(cleanSongRecord)
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
    transactions,
    earningsSummary,
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

  // 1. Pre-add a song to the Artist's Playlist
  if (action === "add_playlist_song") {
    const eventId = String(body.event_id ?? "").trim()
    const songTitle = String(body.song_title ?? "").trim()
    const originalArtist = String(body.original_artist ?? "").trim() || null
    const explicitYoutubeUrl = String(body.youtube_url ?? "").trim() || null

    if (!eventId || !songTitle) {
      return NextResponse.json({ error: "Song title and event are required." }, { status: 400 })
    }

    const explicitVideoId = extractYouTubeId(explicitYoutubeUrl)
    const normalizedYoutubeUrl = explicitVideoId
      ? `https://www.youtube.com/watch?v=${explicitVideoId}`
      : explicitYoutubeUrl
    const id = crypto.randomUUID()

    run(
      `INSERT INTO song_requests
        (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, youtube_url, youtube_video_id, youtube_title, karaoke_candidates_json, status, upvotes, requester_name)
       VALUES (?, NULL, ?, 'artist_playlist', 1, ?, ?, ?, ?, ?, NULL, 'confirmed', 0, 'Artist Playlist')`,
      id,
      eventId,
      songTitle,
      originalArtist,
      normalizedYoutubeUrl,
      explicitVideoId,
      explicitVideoId ? songTitle : null
    )

    return NextResponse.json({
      ok: true,
      id,
      youtube_video_id: explicitVideoId,
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

  // 4. Update Artist Bank & UPIPay Payout Details
  if (action === "update_bank_details") {
    const upiId = String(body.upi_id ?? "").trim()
    const payeeName = String(body.payee_name ?? "").trim()
    const bankName = String(body.bank_name ?? "").trim()
    const accountNumber = String(body.account_number ?? "").trim()
    const ifscCode = String(body.ifsc_code ?? "").trim().toUpperCase()
    const upipayProvider = String(body.upipay_provider ?? "upi_direct").trim()
    const upipayMerchantId = String(body.upipay_merchant_id ?? "").trim()

    if (!upiId || !upiId.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid UPI ID / VPA (e.g. yourname@ybl or merchant@paytm)." },
        { status: 400 }
      )
    }

    run(
      `UPDATE users
          SET upi_id = ?,
              payee_name = ?,
              bank_name = ?,
              account_number = ?,
              ifsc_code = ?,
              upipay_provider = ?,
              upipay_merchant_id = ?
        WHERE id = ?`,
      upiId,
      payeeName || null,
      bankName || null,
      accountNumber || null,
      ifscCode || null,
      upipayProvider || "upi_direct",
      upipayMerchantId || null,
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

  // 1. Artist Confirms a Song
  if (action === "confirm_song") {
    const song = get<any>("SELECT * FROM song_requests WHERE id = ?", requestId)
    if (!song) return NextResponse.json({ error: "Song request not found." }, { status: 404 })

    const explicitYt = body.youtube_url ? String(body.youtube_url).trim() : song.youtube_url
    const explicitVideoId = extractYouTubeId(explicitYt) || song.youtube_video_id || null
    const normalizedYoutubeUrl = explicitVideoId
      ? `https://www.youtube.com/watch?v=${explicitVideoId}`
      : explicitYt || null

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
              karaoke_candidates_json = NULL,
              dedication_payment_status = ?
        WHERE id = ?`,
      normalizedYoutubeUrl,
      explicitVideoId,
      explicitVideoId ? song.song_title : null,
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

    // Check if this song already exists in the artist's playlist for this event
    const existingPlaylistSong = get<any>(
      `SELECT * FROM song_requests
        WHERE event_id = ?
          AND source_type = 'artist_playlist'
          AND status != 'declined'
          AND LOWER(TRIM(song_title)) = LOWER(TRIM(?))
        LIMIT 1`,
      song.event_id,
      song.song_title
    )

    if (existingPlaylistSong) {
      // Re-link individual user upvotes so each user has only 1 vote per song
      run(
        `INSERT OR IGNORE INTO song_upvotes (request_id, voter_token, created_at)
         SELECT ?, voter_token, created_at FROM song_upvotes WHERE request_id = ?`,
        existingPlaylistSong.id,
        requestId
      )
      run("DELETE FROM song_upvotes WHERE request_id = ?", requestId)
      // Accurately synchronize total unique upvotes from the song_upvotes table
      run(
        `UPDATE song_requests
            SET upvotes = (SELECT COUNT(*) FROM song_upvotes WHERE request_id = ?)
          WHERE id = ?`,
        existingPlaylistSong.id,
        existingPlaylistSong.id
      )
      // If this audience request had a paid dedication, transfer it as well
      if (song.dedication_payment_status === "paid") {
        run(
          `UPDATE song_requests
              SET wants_dedication = 1,
                  dedicated_to = COALESCE(?, dedicated_to),
                  dedication_message = COALESCE(?, dedication_message),
                  dedication_payment_status = 'paid'
            WHERE id = ?`,
          song.dedicated_to,
          song.dedication_message,
          existingPlaylistSong.id
        )
      }
      // Mark the duplicate audience request as merged/played so it doesn't duplicate in Audience Requests
      run(
        "UPDATE song_requests SET status = 'played' WHERE id = ?",
        requestId
      )

      return NextResponse.json({
        ok: true,
        merged_with_playlist_id: existingPlaylistSong.id,
        message: `"${song.song_title}" is already in your playlist! Transferred audience upvotes directly to your playlist.`,
      })
    }

    return NextResponse.json({
      ok: true,
      youtube_video_id: explicitVideoId,
      youtube_title: explicitVideoId ? song.song_title : null,
    })
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

  if (action === "reorder_entire_playlist" || action === "reorder_setlist_queue") {
    const orderedIds: string[] = Array.isArray(body.ordered_ids) ? body.ordered_ids : []
    for (let i = 0; i < orderedIds.length; i++) {
      run("UPDATE song_requests SET choice_index = ? WHERE id = ?", i + 1, orderedIds[i])
    }
    return NextResponse.json({ ok: true })
  }

  if (action === "reorder_songs") {
    const songId = String(body.song_id ?? "").trim()
    const targetSongId = String(body.target_song_id ?? "").trim()
    const songA = get<any>("SELECT id, choice_index, upvotes, created_at FROM song_requests WHERE id = ?", songId)
    const songB = get<any>("SELECT id, choice_index, upvotes, created_at FROM song_requests WHERE id = ?", targetSongId)
    if (songA && songB) {
      const idxA = songA.choice_index || 1
      const idxB = songB.choice_index || 1
      const newIdxA = idxA === idxB ? idxB + 1 : idxB
      const newIdxB = idxA === idxB ? idxA : idxA
      run("UPDATE song_requests SET choice_index = ? WHERE id = ?", newIdxA, songA.id)
      run("UPDATE song_requests SET choice_index = ? WHERE id = ?", newIdxB, songB.id)
      run(
        "UPDATE song_requests SET upvotes = ?, created_at = ? WHERE id = ?",
        songB.upvotes,
        songB.created_at,
        songA.id
      )
      run(
        "UPDATE song_requests SET upvotes = ?, created_at = ? WHERE id = ?",
        songA.upvotes,
        songA.created_at,
        songB.id
      )
    }
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

  if (action === "toggle_upvote") {
    const voterToken = String(body.voter_token ?? "").trim() || "artist_stage"
    if (!requestId) {
      return NextResponse.json({ error: "Missing song request ID." }, { status: 400 })
    }
    const song = get<any>("SELECT id, upvotes FROM song_requests WHERE id = ?", requestId)
    if (!song) return NextResponse.json({ error: "Song not found." }, { status: 404 })

    const existing = get(
      "SELECT 1 FROM song_upvotes WHERE request_id = ? AND voter_token = ?",
      requestId,
      voterToken
    )
    if (existing) {
      run("DELETE FROM song_upvotes WHERE request_id = ? AND voter_token = ?", requestId, voterToken)
      run("UPDATE song_requests SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", requestId)
      return NextResponse.json({ ok: true, upvoted: false })
    } else {
      run("INSERT INTO song_upvotes (request_id, voter_token) VALUES (?, ?)", requestId, voterToken)
      run("UPDATE song_requests SET upvotes = upvotes + 1 WHERE id = ?", requestId)
      return NextResponse.json({ ok: true, upvoted: true })
    }
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
