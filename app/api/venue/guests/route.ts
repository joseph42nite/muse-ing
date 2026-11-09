import { NextResponse } from "next/server"
import { get } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"
import { listGuests, updateGuest } from "@/lib/server/guests"
import { readJson } from "@/lib/server/respond"

// The door list for one of the venue's gigs (admins see any gig). Used by the venue portal and the
// admin panel.
const ownsEvent = (eventId: string, user: { id: string; role: string }) =>
  !!get("SELECT 1 FROM events WHERE id = ? AND (? = 'admin' OR venue_id = ?)", eventId, user.role, user.id)

export async function GET(req: Request) {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const eventId = new URL(req.url).searchParams.get("event_id") ?? ""
  if (!ownsEvent(eventId, user)) return NextResponse.json({ error: "Event not found." }, { status: 404 })
  return NextResponse.json({ guests: listGuests(eventId) })
}

// Mark a booking arrived / not arrived, or paid at the door / not paid.
export async function PATCH(req: Request) {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const b = await readJson(req)
  const bookingId = String(b.booking_id ?? "")
  const booking = get<{ event_id: string }>("SELECT event_id FROM audience_bookings WHERE id = ?", bookingId)
  if (!booking || !ownsEvent(booking.event_id, user)) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  const r = updateGuest(bookingId, { arrived: b.arrived, paid: b.paid }, user.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ guest: r.guest })
}
