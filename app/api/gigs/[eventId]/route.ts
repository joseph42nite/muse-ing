import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run, transaction } from "@/lib/server/db"
import { createPaymentLink, CashfreeConfigError } from "@/lib/server/cashfree"
import { last10Digits } from "@/lib/server/format"
import { addUpvote, toggleUpvote } from "@/lib/server/songs"

const DEDICATION_PRICE = 50
const MAX_TIP = 100000
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const url = new URL(req.url)
  const voterToken = url.searchParams.get("voter_token")?.trim() || ""

  const event = get<any>(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.date,
       e.event_date_only,
       e.location_name,
       e.location_slug,
       e.ticket_price,
       e.artist_id,
       e.active_karaoke_Floor_video_id,
       e.active_song_request_id,
       e.playback_position,
       e.playback_playing,
       e.playback_updated_at,
       u.name AS artist_name,
       u.instagram_handle AS artist_instagram,
       u.avatar_url AS artist_avatar,
       u.bio AS artist_bio,
       u.upi_id AS artist_upi_id,
       COALESCE(u.payee_name, u.name, 'Live Artist') AS artist_payee_name,
       COALESCE(u.upipay_provider, 'upi_direct') AS artist_upipay_provider
     FROM events e
     LEFT JOIN users u ON u.id = e.artist_id
     WHERE e.id = ?`,
    eventId
  )

  if (!event) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 })
  }

  // Confirmed/playing songs that have PAID ₹50 for a Dedication & Shoutout -> Priority Section 1
  const priorityDedications = all(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
        AND dedication_payment_status = 'paid'
      ORDER BY CASE WHEN status = 'playing' THEN 0 ELSE 1 END, upvotes DESC, created_at ASC`,
    eventId
  )

  // Confirmed/playing songs (Artist Playlist + Confirmed Crowd Requests not yet paid as ₹50 dedication) -> Priority Section 2 (Upvoted Queue)
  const upvotedQueue = all(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
        AND dedication_payment_status != 'paid'
      ORDER BY CASE WHEN status = 'playing' THEN 0 ELSE 1 END, upvotes DESC, created_at ASC`,
    eventId
  )

  // All Confirmed/Playing songs (for unified Audience discovery & upvoting)
  const allConfirmedSongs = all(
    `SELECT *
       FROM song_requests
      WHERE event_id = ?
        AND status IN ('confirmed', 'playing')
      ORDER BY
        CASE WHEN status = 'playing' THEN 0 ELSE 1 END,
        CASE WHEN dedication_payment_status = 'paid' THEN 0 ELSE 1 END,
        upvotes DESC,
        created_at ASC`,
    eventId
  )

  // Audience member's own submitted 3-song batches (so they can see when the artist confirms 1 of their 3 songs and pay ₹50!)
  let myBatches: any[] = []
  let upvotedRequestIds: string[] = []

  if (voterToken) {
    const batches = all<any>(
      `SELECT * FROM song_batches WHERE event_id = ? AND voter_token = ? ORDER BY created_at DESC`,
      eventId,
      voterToken
    )
    myBatches = batches.map((b) => ({
      ...b,
      songs: all(
        `SELECT sr.*,
                EXISTS (SELECT 1 FROM artist_transactions t WHERE t.request_id = sr.id AND t.status = 'pending') AS payment_reported
           FROM song_requests sr WHERE sr.batch_id = ? ORDER BY sr.choice_index ASC`,
        b.id
      ),
    }))

    const voteRows = all<{ request_id: string }>(
      `SELECT su.request_id
         FROM song_upvotes su
         JOIN song_requests sr ON sr.id = su.request_id
        WHERE sr.event_id = ? AND su.voter_token = ?`,
      eventId,
      voterToken
    )
    upvotedRequestIds = voteRows.map((r) => r.request_id)
  }

  // Active playing song details (for LED screen & live banner)
  const nowPlaying =
    (event.active_song_request_id
      ? get(`SELECT * FROM song_requests WHERE id = ?`, event.active_song_request_id)
      : undefined) ||
    get(`SELECT * FROM song_requests WHERE event_id = ? AND status = 'playing' LIMIT 1`, eventId) ||
    null

  return NextResponse.json({
    event,
    priorityDedications,
    upvotedQueue,
    allConfirmedSongs,
    myBatches,
    upvotedRequestIds,
    nowPlaying,
    serverNow: Date.now(),
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const event = get<{ id: string; title: string; artist_id: string }>(
    "SELECT id, title, artist_id FROM events WHERE id = ?",
    eventId
  )
  if (!event) return NextResponse.json({ error: "Gig not found." }, { status: 404 })

  const action = String(body.action ?? "")

  // 1. Submit 3 Songs (Mandatory 3-Song Rule so Artist can confirm which one they can sing)
  if (action === "submit_3_songs") {
    const requesterName = clip(body.requester_name, 80)
    const requesterPhone = last10Digits(body.requester_phone) || null
    const voterToken = clip(body.voter_token, 100) || crypto.randomUUID()
    const wantsDedication = body.wants_dedication ? 1 : 0
    const dedicatedTo = clip(body.dedicated_to, 120) || null
    const dedicationMessage = clip(body.dedication_message, 500) || null
    const songs = Array.isArray(body.songs) ? body.songs : []

    if (!requesterName) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 })
    }
    if (songs.length !== 3 || songs.some((s: any) => !String(s?.song_title ?? "").trim())) {
      return NextResponse.json(
        { error: "Please enter all 3 song choices so the artist can confirm the one they can sing best!" },
        { status: 400 }
      )
    }
    if (wantsDedication && !dedicatedTo) {
      return NextResponse.json(
        { error: "Please enter the name of the person you want to dedicate the song to." },
        { status: 400 }
      )
    }

    const batchId = crypto.randomUUID()
    const upvotedPlaylistSongs: string[] = []
    transaction(() => {
      run(
        `INSERT INTO song_batches
          (id, event_id, requester_name, requester_phone, voter_token, wants_dedication, dedicated_to, dedication_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        batchId,
        eventId,
        requesterName,
        requesterPhone,
        voterToken,
        wantsDedication,
        dedicatedTo,
        dedicationMessage
      )

      songs.forEach((s: any, idx: number) => {
        const cleanTitle = clip(s.song_title, 200)
        const cleanArtist = clip(s.original_artist, 200) || null

        // Check if this song is already in the artist's playlist
        const existingPlaylistSong = get<any>(
          `SELECT id, song_title FROM song_requests
            WHERE event_id = ?
              AND source_type = 'artist_playlist'
              AND status != 'declined'
              AND LOWER(TRIM(song_title)) = LOWER(TRIM(?))
            LIMIT 1`,
          eventId,
          cleanTitle
        )

        if (existingPlaylistSong && !wantsDedication) {
          // Already on the artist's playlist: count it as an upvote instead of a new request
          addUpvote(existingPlaylistSong.id, voterToken)
          upvotedPlaylistSongs.push(existingPlaylistSong.song_title)
          return
        }

        const reqId = crypto.randomUUID()
        run(
          `INSERT INTO song_requests
            (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, status, upvotes, wants_dedication, dedicated_to, dedication_message, dedication_payment_status, requester_name)
           VALUES (?, ?, ?, 'audience_request', ?, ?, ?, 'pending_artist', 0, ?, ?, ?, 'none', ?)`,
          reqId,
          batchId,
          eventId,
          idx + 1,
          cleanTitle,
          cleanArtist,
          wantsDedication,
          dedicatedTo,
          dedicationMessage,
          requesterName
        )
      })
    })

    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      voter_token: voterToken,
      upvoted_playlist_songs: upvotedPlaylistSongs,
    })
  }

  // 2. Upvote ("Uptick") a Confirmed Song (works for both Artist Playlist songs and Confirmed Crowd Requests)
  if (action === "toggle_upvote") {
    const requestId = String(body.request_id ?? "").trim()
    const voterToken = String(body.voter_token ?? "").trim()
    if (!requestId || !voterToken) {
      return NextResponse.json({ error: "Missing song request ID or voter token." }, { status: 400 })
    }

    const song = get<{ id: string; status: string; upvotes: number }>(
      "SELECT id, status, upvotes FROM song_requests WHERE id = ? AND event_id = ?",
      requestId,
      eventId
    )
    if (!song || !["confirmed", "playing"].includes(song.status)) {
      return NextResponse.json({ error: "Only artist-confirmed songs can be upvoted." }, { status: 400 })
    }

    return NextResponse.json({ upvoted: toggleUpvote(requestId, voterToken) })
  }

  // 3. Pay ₹50 for Song Dedication & Name Callout (Option 2: Paid after artist confirms the song, or on an Artist Playlist song)
  if (action === "pay_dedication_50") {
    const requestId = String(body.request_id ?? "").trim()
    const dedicatedTo = clip(body.dedicated_to, 120)
    const dedicationMessage = clip(body.dedication_message, 500) || null
    const requesterName = clip(body.requester_name, 80)
    const requesterPhone = last10Digits(body.requester_phone)
    const paymentMode = String(body.payment_mode ?? "instant")

    const song = get<any>(
      "SELECT * FROM song_requests WHERE id = ? AND event_id = ?",
      requestId,
      eventId
    )
    if (!song) {
      return NextResponse.json({ error: "Song request not found." }, { status: 404 })
    }

    if (song.dedication_payment_status === "paid") {
      return NextResponse.json({ error: "This dedication is already paid." }, { status: 409 })
    }
    if (!["confirmed", "playing"].includes(song.status)) {
      return NextResponse.json(
        { error: "Wait for the artist to confirm they can sing this song before paying." },
        { status: 400 }
      )
    }

    const finalDedicatedTo = dedicatedTo || song.dedicated_to
    const finalRequesterName = requesterName || song.requester_name || "Audience Member"
    if (!finalDedicatedTo) {
      return NextResponse.json(
        { error: "Please enter the name of the person to call out for this dedication!" },
        { status: 400 }
      )
    }

    if (paymentMode === "cashfree") {
      if (requesterPhone.length !== 10) {
        return NextResponse.json({ error: "Enter a valid 10-digit phone number to pay online." }, { status: 400 })
      }
      const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
      const linkId = `ded_${requestId.slice(0, 12)}_${Date.now()}`
      try {
        const link = await createPaymentLink({
          linkId,
          amountInr: DEDICATION_PRICE,
          purpose: `Song Dedication (${song.song_title}) for ${finalDedicatedTo}`,
          customer: { name: finalRequesterName, phone: requesterPhone },
          returnUrl: `${origin}/live/${eventId}?dedication_paid=${requestId}`,
          notifyUrl: `${origin}/api/cashfree/webhook`,
        })
        run(
          `UPDATE song_requests
              SET wants_dedication = 1,
                  dedicated_to = ?,
                  dedication_message = COALESCE(?, dedication_message),
                  requester_name = ?,
                  dedication_payment_status = 'pending_gateway',
                  payment_link_id = ?,
                  payment_link_url = ?
            WHERE id = ?`,
          finalDedicatedTo,
          dedicationMessage,
          finalRequesterName,
          link.link_id,
          link.link_url,
          requestId
        )
        return NextResponse.json({ ok: true, payment_url: link.link_url })
      } catch (e: any) {
        if (!(e instanceof CashfreeConfigError)) {
          return NextResponse.json({ error: e.message || "Payment gateway error" }, { status: 502 })
        }
        // Without Cashfree keys, development falls through to the direct-UPI path below so the flow can be tested.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: e.message }, { status: 503 })
        }
      }
    }

    // Direct UPI to the artist sends us no confirmation, so the payment is recorded as reported
    // and the song only moves into Priority Dedications once the artist confirms it arrived.
    if (!event.artist_id) {
      return NextResponse.json({ error: "This gig has no artist to pay." }, { status: 400 })
    }
    if (get("SELECT 1 FROM artist_transactions WHERE request_id = ? AND status = 'pending'", requestId)) {
      return NextResponse.json(
        { error: "A payment for this dedication is already waiting for the artist to confirm." },
        { status: 409 }
      )
    }
    transaction(() => {
      run(
        `UPDATE song_requests
            SET wants_dedication = 1,
                dedicated_to = ?,
                dedication_message = COALESCE(?, dedication_message),
                requester_name = ?,
                dedication_payment_status = 'awaiting_payment'
          WHERE id = ?`,
        finalDedicatedTo,
        dedicationMessage,
        finalRequesterName,
        requestId
      )

      run(
        `INSERT INTO artist_transactions
          (id, artist_id, event_id, request_id, type, payer_name, payer_phone, amount, song_title, note, upi_order_id, upi_utr, provider, status)
         VALUES (?, ?, ?, ?, 'dedication', ?, ?, ?, ?, ?, ?, ?, 'upipay', 'pending')`,
        crypto.randomUUID(),
        event.artist_id,
        eventId,
        requestId,
        finalRequesterName,
        requesterPhone || null,
        DEDICATION_PRICE,
        song.song_title,
        `Dedicated to ${finalDedicatedTo}${dedicationMessage ? ` — "${dedicationMessage}"` : ""}`,
        clip(body.upi_order_id, 64) || null,
        clip(body.upi_utr, 64) || null
      )
    })

    return NextResponse.json({ ok: true, pending_confirmation: true })
  }

  // 4. Direct Tip to the Artist via UPIPay
  if (action === "tip_artist") {
    const amount = Math.round(Number(body.amount ?? 100) * 100) / 100
    const supporterName = clip(body.supporter_name, 80) || "Audience Member"
    const message = clip(body.message, 500) || "Direct Audience Tip"
    if (!Number.isFinite(amount) || amount < 10 || amount > MAX_TIP) {
      return NextResponse.json({ error: `Tips must be between ₹10 and ₹${MAX_TIP.toLocaleString("en-IN")}.` }, { status: 400 })
    }
    if (!event.artist_id) {
      return NextResponse.json({ error: "This gig has no artist to tip." }, { status: 400 })
    }

    run(
      `INSERT INTO artist_transactions
        (id, artist_id, event_id, request_id, type, payer_name, payer_phone, amount, song_title, note, upi_order_id, upi_utr, provider, status)
       VALUES (?, ?, ?, NULL, 'tip', ?, NULL, ?, NULL, ?, ?, ?, 'upipay', 'pending')`,
      crypto.randomUUID(),
      event.artist_id,
      eventId,
      supporterName,
      amount,
      message,
      clip(body.upi_order_id, 64) || null,
      clip(body.upi_utr, 64) || null
    )

    return NextResponse.json({
      ok: true,
      pending_confirmation: true,
      amount,
      supporter_name: supporterName,
    })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
