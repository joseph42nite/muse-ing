import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { bookingStatusFor, verifyWebhook, CashfreeConfigError } from "@/lib/server/cashfree"
import { settleGatewayPayment } from "@/lib/server/gateway-payments"

// Cashfree webhook: flips bookings to paid/failed/cancelled and logs the raw event, and settles
// tips and dedications (lib/server/gateway-payments.ts).
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
  if (!linkId) return NextResponse.json({ ok: true })
  const next = bookingStatusFor(String(data.link_status ?? ""))

  const booking = get<{ id: string }>("SELECT id FROM audience_bookings WHERE payment_link_id = ?", linkId)
  if (booking) {
    run("INSERT INTO payment_events (id, booking_id, event_type, payload) VALUES (?,?,?,?)",
      crypto.randomUUID(), booking.id, String(evt.type ?? "unknown"), raw)
    if (next === "paid") {
      run("UPDATE audience_bookings SET payment_status = 'paid' WHERE id = ?", booking.id)
    } else if (next) {
      run("UPDATE audience_bookings SET payment_status = ? WHERE id = ? AND payment_status = 'pending'", next, booking.id)
    }
  }

  // Tips and dedications (logged with no booking)
  if (!booking && get("SELECT 1 FROM gateway_payments WHERE id = ?", linkId)) {
    run("INSERT INTO payment_events (id, booking_id, event_type, payload) VALUES (?,NULL,?,?)",
      crypto.randomUUID(), String(evt.type ?? "unknown"), raw)
  }
  if (settleGatewayPayment(linkId, String(data.link_status ?? "")) === null && next === "paid") {
    // Dedication links made before gateway_payments existed
    run(
      "UPDATE song_requests SET dedication_payment_status = 'paid', wants_dedication = 1 WHERE payment_link_id = ?",
      linkId
    )
  }
  return NextResponse.json({ ok: true })
}
