import { NextResponse } from "next/server"
import { get } from "@/lib/server/db"
import { settleGatewayPayment } from "@/lib/server/gateway-payments"

// Development only: stands in for the Cashfree checkout when no Cashfree keys are set, marking the
// payment paid and sending the audience back to the live page as Cashfree would.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found." }, { status: 404 })
  const { id } = await params
  const p = get<{ event_id: string | null }>("SELECT event_id FROM gateway_payments WHERE id = ?", id)
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 })
  settleGatewayPayment(id, "PAID")
  return NextResponse.redirect(`${new URL(req.url).origin}/live/${encodeURIComponent(p.event_id ?? "")}?payment=${id}`)
}
