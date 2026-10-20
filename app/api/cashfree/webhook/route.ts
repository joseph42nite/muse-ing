import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { bookingStatusFor, verifyWebhook, CashfreeConfigError } from "@/lib/server/cashfree"

// Cashfree webhook: flips bookings to paid/failed/cancelled and logs the raw event.
// Enable Payment Link webhooks in the Cashfree dashboard -> {SITE_URL}/api/cashfree/webhook
export async function POST(req: Request) {
  const raw = await req.text()
  const signature = req.headers.get("x-webhook-signature") ?? ""
  const timestamp = req.headers.get("x-webhook-timestamp") ?? ""

  try {
    if (!verifyWebhook(raw, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 })
    }
  } catch (e) {
    if (e instanceof CashfreeConfigError) return NextResponse.json({ error: e.message }, { status: 503 })
    throw e
  }

  let evt: any
  try {
    evt = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 })
  }

  const data = evt.data ?? {}
  const linkId: string | undefined = data.link_id ?? data.order?.order_tags?.link_id
  const booking = linkId ? get<{ id: string }>("SELECT id FROM audience_bookings WHERE payment_link_id = ?", linkId) : undefined

  if (booking) {
    run("INSERT INTO payment_events (id, booking_id, event_type, payload) VALUES (?,?,?,?)",
      crypto.randomUUID(), booking.id, String(evt.type ?? "unknown"), raw)
    const next = bookingStatusFor(String(data.link_status ?? ""))
    if (next === "paid") {
      run("UPDATE audience_bookings SET payment_status = 'paid' WHERE id = ?", booking.id)
    } else if (next) {
      run("UPDATE audience_bookings SET payment_status = ? WHERE id = ? AND payment_status = 'pending'", next, booking.id)
    }
  }

  // Also check if this payment link is for a ₹50 Song Dedication
  const songDedication = linkId
    ? get<{ id: string }>("SELECT id FROM song_requests WHERE payment_link_id = ?", linkId)
    : undefined
  if (songDedication) {
    const next = bookingStatusFor(String(data.link_status ?? ""))
    if (next === "paid") {
      run("UPDATE song_requests SET dedication_payment_status = 'paid', wants_dedication = 1 WHERE id = ?", songDedication.id)
    }
  }
  return NextResponse.json({ ok: true })
}
