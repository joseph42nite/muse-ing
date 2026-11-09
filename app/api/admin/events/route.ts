import { createEvent, listEvents } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson, respond } from "@/lib/server/respond"

export async function GET() {
  if (!(await requireRole("admin"))) return forbidden()
  return Response.json(listEvents())
}

export async function POST(req: Request) {
  const user = await requireRole("admin")
  if (!user) return forbidden()
  return respond(createEvent(await readJson(req), user.id))
}
