import { updateAccount } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson, respond } from "@/lib/server/respond"

// Edit an artist, venue or promoter account (not admins).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(updateAccount((await params).id, await readJson(req)))
}
