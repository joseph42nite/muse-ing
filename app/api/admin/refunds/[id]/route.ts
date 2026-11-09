import { isRefundAction, updateRefund } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"

/** Body: { action: "approve" | "reject" | "refund", notes?: string } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return forbidden()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (!isRefundAction(body.action)) {
    return Response.json({ error: "action must be approve, reject or refund." }, { status: 400 })
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null
  const result = updateRefund(id, body.action, notes)
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ id, status: result.status })
}
