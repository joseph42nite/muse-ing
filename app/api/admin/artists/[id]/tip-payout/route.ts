import { payOutArtistTips } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"
import { respond } from "@/lib/server/respond"

// Mark the artist's share of every Cashfree-collected tip and dedication as paid out.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(payOutArtistTips((await params).id))
}
