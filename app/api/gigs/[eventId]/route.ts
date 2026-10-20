import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run } from "@/lib/server/db"
import { createPaymentLink, CashfreeConfigError } from "@/lib/server/cashfree"

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
       u.name AS artist_name,
       u.instagram_handle AS artist_instagram,
       u.avatar_url AS artist_avatar,
       u.bio AS artist_bio
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
        `SELECT * FROM song_requests WHERE batch_id = ? ORDER BY choice_index ASC`,
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
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const event = get<{ id: string; title: string }>("SELECT id, title FROM events WHERE id = ?", eventId)
  if (!event) return NextResponse.json({ error: "Gig not found." }, { status: 404 })

  const action = String(body.action ?? "")

  // 1. Submit 3 Songs (Mandatory 3-Song Rule so Artist can confirm which one they can sing)
  if (action === "submit_3_songs") {
    const requesterName = String(body.requester_name ?? "").trim()
    const requesterPhone = String(body.requester_phone ?? "").trim() || null
    const voterToken = String(body.voter_token ?? "").trim() || crypto.randomUUID()
    const wantsDedication = body.wants_dedication ? 1 : 0
    const dedicatedTo = String(body.dedicated_to ?? "").trim() || null
    const dedicationMessage = String(body.dedication_message ?? "").trim() || null
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
      const reqId = crypto.randomUUID()
      run(
        `INSERT INTO song_requests
          (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, status, upvotes, wants_dedication, dedicated_to, dedication_message, dedication_payment_status, requester_name)
         VALUES (?, ?, ?, 'audience_request', ?, ?, ?, 'pending_artist', 0, ?, ?, ?, 'none', ?)`,
        reqId,
        batchId,
        eventId,
        idx + 1,
        String(s.song_title).trim(),
        String(s.original_artist ?? "").trim() || null,
        wantsDedication,
        dedicatedTo,
        dedicationMessage,
        requesterName
      )
    })

    return NextResponse.json({ ok: true, batch_id: batchId, voter_token: voterToken })
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

    const existing = get(
      "SELECT 1 FROM song_upvotes WHERE request_id = ? AND voter_token = ?",
      requestId,
      voterToken
    )

    if (existing) {
      run("DELETE FROM song_upvotes WHERE request_id = ? AND voter_token = ?", requestId, voterToken)
      run("UPDATE song_requests SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", requestId)
      return NextResponse.json({ upvoted: false })
    } else {
      run("INSERT INTO song_upvotes (request_id, voter_token) VALUES (?, ?)", requestId, voterToken)
      run("UPDATE song_requests SET upvotes = upvotes + 1 WHERE id = ?", requestId)
      return NextResponse.json({ upvoted: true })
    }
  }

  // 3. Pay ₹50 for Song Dedication & Name Callout (Option 2: Paid after artist confirms the song, or on an Artist Playlist song)
  if (action === "pay_dedication_50") {
    const requestId = String(body.request_id ?? "").trim()
    const dedicatedTo = String(body.dedicated_to ?? "").trim()
    const dedicationMessage = String(body.dedication_message ?? "").trim() || null
    const requesterName = String(body.requester_name ?? "").trim()
    const requesterPhone = String(body.requester_phone ?? "").replace(/\D/g, "").slice(-10) || "9876543210"
    const paymentMode = String(body.payment_mode ?? "instant")

    const song = get<any>(
      "SELECT * FROM song_requests WHERE id = ? AND event_id = ?",
      requestId,
      eventId
    )
    if (!song) {
      return NextResponse.json({ error: "Song request not found." }, { status: 404 })
    }
    if (!["confirmed", "playing"].includes(song.status)) {
      return NextResponse.json(
        { error: "Wait for the artist to confirm they can sing this song before paying ₹50." },
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
      const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
      const linkId = `ded_${requestId.slice(0, 12)}_${Date.now()}`
      try {
        const link = await createPaymentLink({
          linkId,
          amountInr: 50,
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
        // If Cashfree isn't configured in .env.local, fall through to instant ₹50 settlement so the user can test seamlessly
      }
    }

    // Complete ₹50 payment & move song directly into Priority Dedications section
    run(
      `UPDATE song_requests
          SET wants_dedication = 1,
              dedicated_to = ?,
              dedication_message = COALESCE(?, dedication_message),
              requester_name = ?,
              dedication_payment_status = 'paid'
        WHERE id = ?`,
      finalDedicatedTo,
      dedicationMessage,
      finalRequesterName,
      requestId
    )

    return NextResponse.json({ ok: true, settled: true })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
