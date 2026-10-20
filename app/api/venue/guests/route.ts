import { NextResponse } from "next/server"
import { all, get } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

// Paid bookings + check-ins for one of the venue's events.
export async function GET(req: Request) {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const eventId = new URL(req.url).searchParams.get("event_id") ?? ""
  const ev = get("SELECT 1 FROM events WHERE id = ? AND (? = 'admin' OR venue_id = ?)", eventId, user.role, user.id)
  if (!ev) return NextResponse.json({ error: "Event not found." }, { status: 404 })

  const bookings = all(
    `SELECT id, name, phone, num_people, total_amount, payment_status, created_at
       FROM audience_bookings WHERE event_id = ? AND payment_status = 'paid' ORDER BY name`,
    eventId,
  )
  const checkins = all("SELECT id, audience_phone, checkin_time FROM venue_checkins WHERE event_id = ?", eventId)
  return NextResponse.json({ bookings, checkins })
}
