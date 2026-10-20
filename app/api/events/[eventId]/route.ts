import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

// Public, read-only event summary used by the clean booking page.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const e = get<any>(
    `SELECT e.id, e.title, e.description, e.date, e.ticket_price, v.name AS venue_name
       FROM events e LEFT JOIN users v ON v.id = e.venue_id WHERE e.id = ?`,
    eventId,
  )
  if (!e) return NextResponse.json({ error: "Event not found." }, { status: 404 })
  return NextResponse.json(e)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await requireRole("promoter", "admin")
  if (!user) return forbidden()
  const { eventId } = await params
  const res = run("DELETE FROM events WHERE id = ? AND (? = 'admin' OR created_by = ?)", eventId, user.role, user.id)
  if (!res.changes) return NextResponse.json({ error: "Event not found." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
