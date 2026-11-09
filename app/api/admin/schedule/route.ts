import { listSchedule } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"

// ?from=ISO date (default today, India time) &artist=user id
export async function GET(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  const q = req?.url ? new URL(req.url).searchParams : new URLSearchParams()
  return Response.json(listSchedule(q.get("from") ?? undefined, q.get("artist") ?? undefined))
}
