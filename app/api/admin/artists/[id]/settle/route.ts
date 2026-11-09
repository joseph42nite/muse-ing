import { settleArtist } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { respond } from "@/lib/server/respond"

// Mark every played, unpaid gig of this artist as Paid.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(settleArtist((await params).id))
}
