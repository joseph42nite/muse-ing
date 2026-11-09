import { artistGigs } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"

// One artist's paid gigs with the live payment summary, for the payments dialog.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  const data = artistGigs((await params).id)
  if (!data) return Response.json({ error: "Artist not found." }, { status: 404 })
  return Response.json(data)
}
