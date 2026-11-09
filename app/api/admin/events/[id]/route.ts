import { deleteEvent, getEvent, updateEvent } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson, respond } from "@/lib/server/respond"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await requireRole("admin"))) return forbidden()
  const event = getEvent((await params).id)
  return event ? Response.json(event) : Response.json({ error: "Event not found." }, { status: 404 })
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(updateEvent((await params).id, await readJson(req)))
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(deleteEvent((await params).id))
}
