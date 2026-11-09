import { forbidden, requireRole } from "@/lib/server/auth"
import { deleteCoupon, updateCoupon } from "@/lib/server/coupons"
import { readJson, respond } from "@/lib/server/respond"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(updateCoupon((await params).id, await readJson(req)))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(deleteCoupon((await params).id))
}
