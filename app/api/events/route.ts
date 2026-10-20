import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, run, get } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

// Promoter's own events, with paid-booking counts.
export async function GET() {
  const user = await requireRole("promoter", "admin")
  if (!user) return forbidden()
  const rows = all(
    `SELECT e.id, e.title, e.description, e.date, e.ticket_price, e.venue_id,
            (SELECT COALESCE(SUM(num_people),0) FROM audience_bookings b
              WHERE b.event_id = e.id AND b.payment_status = 'paid') AS total_bookings
       FROM events e
      WHERE (? = 'admin' OR e.created_by = ?)
      ORDER BY e.date DESC`,
    user.role, user.id,
  )
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const user = await requireRole("promoter", "admin")
  if (!user) return forbidden()
  const b = await req.json().catch(() => ({}))
  const title = String(b.title ?? "").trim()
  const date = new Date(b.date)
  const price = Number(b.ticket_price)
  const venueId = b.venue_id ? String(b.venue_id) : null

  if (!title || isNaN(date.getTime())) {
    return NextResponse.json({ error: "Title and a valid date are required." }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Enter a valid ticket price." }, { status: 400 })
  }
  if (venueId && !get("SELECT 1 FROM users WHERE id = ? AND role = 'venue'", venueId)) {
    return NextResponse.json({ error: "Selected venue not found." }, { status: 400 })
  }
  const id = crypto.randomUUID()
  run(
    "INSERT INTO events (id, title, description, date, venue_id, created_by, ticket_price) VALUES (?,?,?,?,?,?,?)",
    id, title, String(b.description ?? "").trim() || null, date.toISOString(), venueId, user.id, price,
  )
  return NextResponse.json({ id })
}
