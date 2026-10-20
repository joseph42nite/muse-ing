import { NextResponse } from "next/server"
import { all } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

export async function GET() {
  const user = await requireRole("venue", "admin")
  if (!user) return forbidden()
  const rows = all(
    `SELECT id, title, date FROM events WHERE (? = 'admin' OR venue_id = ?) ORDER BY date DESC`,
    user.role, user.id,
  )
  return NextResponse.json(rows)
}
