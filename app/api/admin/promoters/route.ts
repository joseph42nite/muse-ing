import { createAccount, listPromoters } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson, respond } from "@/lib/server/respond"

export async function GET() {
  if (!(await requireRole("admin"))) return forbidden()
  return Response.json(listPromoters())
}

export async function POST(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(createAccount("promoter", await readJson(req)))
}
