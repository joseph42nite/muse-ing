import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { createPaymentLink, CashfreeConfigError } from "@/lib/server/cashfree"

const MAX_PEOPLE = 20

// Creates a pending booking and a Cashfree payment link for it.
// The amount is always computed server-side from the event's ticket price.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })

  const eventId = String(body.event_id ?? "").trim()
  const name = String(body.name ?? "").trim()
  const phone = String(body.phone ?? "").replace(/\D/g, "").slice(-10)
  const email = String(body.email ?? "").trim() || null
  const ref = String(body.ref ?? "").trim() // promoter code or id
  const numPeople = Number.parseInt(body.num_people, 10)

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

  const total = event.ticket_price * numPeople
  const bookingId = crypto.randomUUID()
  run(
    `INSERT INTO audience_bookings (id, event_id, promoter_id, name, phone, email, num_people, total_amount)
     VALUES (?,?,?,?,?,?,?,?)`,
    bookingId, event.id, promoterId, name, phone, email, numPeople, total,
  )

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  try {
    const link = await createPaymentLink({
      linkId: bookingId,
      amountInr: total,
      purpose: `${event.title} - ${numPeople} ticket${numPeople > 1 ? "s" : ""}`,
      customer: { name, phone, email: email ?? undefined },
      returnUrl: `${origin}/book/${event.id}/thanks?booking=${bookingId}`,
      notifyUrl: `${origin}/api/cashfree/webhook`,
    })
    run("UPDATE audience_bookings SET payment_link_id = ?, payment_link_url = ? WHERE id = ?", link.link_id, link.link_url, bookingId)
    return NextResponse.json({ booking_id: bookingId, payment_url: link.link_url, amount: total, num_people: numPeople })
  } catch (e: any) {
    run("DELETE FROM audience_bookings WHERE id = ?", bookingId) // don't leave an orphaned pending booking
    return NextResponse.json({ error: e.message ?? "Could not create payment link." }, { status: e instanceof CashfreeConfigError ? 503 : 502 })
  }
}
