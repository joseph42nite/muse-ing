import { NextResponse } from "next/server"
import { all } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

export async function GET() {
  const user = await requireRole("promoter", "admin")
  if (!user) return forbidden()
  const rows = all(
    `SELECT r.id, r.user_email, r.reason, r.status, r.created_at,
            b.event_id, b.total_amount AS amount, e.title AS event_title
       FROM refund_requests r
       JOIN audience_bookings b ON b.id = r.booking_id
       JOIN events e ON e.id = b.event_id
      WHERE (? = 'admin' OR e.created_by = ?)
      ORDER BY r.created_at DESC`,
    user.role, user.id,
  )
  return NextResponse.json(rows)
}
