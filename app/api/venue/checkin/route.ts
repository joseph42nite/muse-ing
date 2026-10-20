import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { all, get, run } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

const last10 = (p: string) => p.replace(/\D/g, "").slice(-10)

export async function POST(req: Request) {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const b = await req.json().catch(() => ({}))
  const eventId = String(b.event_id ?? "")
  const key = last10(String(b.phone ?? ""))
  if (key.length < 10) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 })

  if (!get("SELECT 1 FROM events WHERE id = ? AND (? = 'admin' OR venue_id = ?)", eventId, user.role, user.id)) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 })
  }

  const paid = all<{ name: string; phone: string; num_people: number }>(
    "SELECT name, phone, num_people FROM audience_bookings WHERE event_id = ? AND payment_status = 'paid'",
    eventId,
  ).filter((r) => last10(r.phone) === key)
  if (!paid.length) {
    return NextResponse.json({ error: "No paid booking found for that phone number." }, { status: 404 })
  }
  const guest = { name: paid[0].name, phone: paid[0].phone, people: paid.reduce((s, r) => s + r.num_people, 0) }

  const already = all<{ audience_phone: string }>("SELECT audience_phone FROM venue_checkins WHERE event_id = ?", eventId)
    .some((c) => last10(c.audience_phone) === key)
  if (already) {
    return NextResponse.json({ error: `${guest.name} is already checked in.` }, { status: 409 })
  }

  run(
    "INSERT INTO venue_checkins (id, event_id, audience_phone, checkin_time, verified_by) VALUES (?,?,?,?,?)",
    crypto.randomUUID(), eventId, guest.phone, new Date().toISOString(), user.id,
  )
  return NextResponse.json({ ok: true, guest })
}
