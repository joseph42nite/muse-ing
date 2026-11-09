import { createAccount, listVenues } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson, respond } from "@/lib/server/respond"

export async function GET() {
  if (!(await requireRole("admin"))) return forbidden()
  return Response.json(listVenues())
}

export async function POST(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(createAccount("venue", await readJson(req)))
}
