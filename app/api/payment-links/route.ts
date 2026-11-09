import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { get, run, transaction } from "@/lib/server/db"
import { checkCoupon, HOLD_MINUTES, normalizeCode } from "@/lib/server/coupons"
import { createPaymentLink, CashfreeConfigError } from "@/lib/server/cashfree"
import { last10Digits } from "@/lib/server/format"
import { platformFeeFor } from "@/lib/server/settings"

const MAX_PEOPLE = 20

// Creates a pending booking and a Cashfree payment link for it.
// The amount is always computed server-side from the event's ticket price. The buyer pays the ticket
// price; our platform fee (Admin → Settings) is recorded against the booking and comes out of the sale.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const eventId = String(body.event_id ?? "").trim()
  const name = String(body.name ?? "").trim()
  const phone = last10Digits(body.phone)
  const email = String(body.email ?? "").trim() || null
  const ref = String(body.ref ?? "").trim() // promoter code or id
  const numPeople = Number.parseInt(body.num_people, 10)
  const couponCode = normalizeCode(body.coupon_code)

  if (!eventId || !name || phone.length !== 10) {
    return NextResponse.json({ error: "Name and a valid 10-digit phone number are required." }, { status: 400 })
  }
  if (!Number.isInteger(numPeople) || numPeople < 1 || numPeople > MAX_PEOPLE) {
    return NextResponse.json({ error: `Number of people must be between 1 and ${MAX_PEOPLE}.` }, { status: 400 })
  }

  const event = get<{ id: string; title: string; ticket_price: number; created_by: string | null }>(
    "SELECT id, title, ticket_price, created_by FROM events WHERE id = ?",
    eventId,
  )
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 })
  if (event.ticket_price <= 0) {
    return NextResponse.json({ error: "This event has no ticket price set." }, { status: 400 })
  }

  let promoterId = event.created_by
  if (ref) {
    const p = get<{ id: string }>("SELECT id FROM users WHERE promoter_code = ? OR id = ?", ref.toUpperCase(), ref)
    if (p) promoterId = p.id
  }

  // The coupon check and the booking insert run together, so the seats it counts can't be taken
  // by another booking in between.
  const bookingId = crypto.randomUUID()
  const placed = transaction(() => {
    let total = Math.round(event.ticket_price * numPeople * 100) / 100
    const list = total
    let couponId: string | null = null
    let discount = 0
    if (couponCode) {
      const c = checkCoupon(couponCode, event.id, numPeople)
      if (!c.ok) return { error: c.error }
      couponId = c.coupon.id
      discount = c.discount_amount
      total = c.total
      if (c.coupon.owner_type === "promoter") promoterId = c.coupon.owner_id // the sale counts for the coupon's promoter
    }
    run(
      `INSERT INTO audience_bookings
        (id, event_id, promoter_id, name, phone, email, num_people, total_amount, platform_fee, coupon_id, list_amount, discount_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      bookingId, event.id, promoterId, name, phone, email, numPeople, total, platformFeeFor(total), couponId, list, discount,
    )
    return { total, discount, couponId }
  })
  if ("error" in placed) return NextResponse.json({ error: placed.error }, { status: 400 })
  const { total, couponId } = placed

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  // A 100% coupon: nothing to pay, so the booking is confirmed straight away.
  if (total <= 0) {
    run("UPDATE audience_bookings SET payment_status = 'paid' WHERE id = ?", bookingId)
    return NextResponse.json({
      booking_id: bookingId,
      payment_url: `/book/${event.id}/thanks?booking=${bookingId}`,
      amount: 0,
      num_people: numPeople,
    })
  }
  try {
    const link = await createPaymentLink({
      linkId: bookingId,
      amountInr: total,
      purpose: `${event.title} - ${numPeople} ticket${numPeople > 1 ? "s" : ""}`,
      customer: { name, phone, email: email ?? undefined },
      returnUrl: `${origin}/book/${event.id}/thanks?booking=${bookingId}`,
      notifyUrl: `${origin}/api/cashfree/webhook`,
      // A coupon holds its seats only for HOLD_MINUTES, so its link can't be paid after that.
      ...(couponId ? { expiresInMinutes: HOLD_MINUTES } : {}),
    })
    run("UPDATE audience_bookings SET payment_link_id = ?, payment_link_url = ? WHERE id = ?", link.link_id, link.link_url, bookingId)
    return NextResponse.json({ booking_id: bookingId, payment_url: link.link_url, amount: total, num_people: numPeople })
  } catch (e: any) {
    run("DELETE FROM audience_bookings WHERE id = ?", bookingId) // don't leave an orphaned pending booking
    return NextResponse.json({ error: e.message ?? "Could not create payment link." }, { status: e instanceof CashfreeConfigError ? 503 : 502 })
  }
}
