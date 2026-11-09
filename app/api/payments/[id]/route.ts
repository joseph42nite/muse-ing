import { NextResponse } from "next/server"
import { refreshGatewayPayment } from "@/lib/server/gateway-payments"

// The live page calls this when the audience comes back from Cashfree, so a tip or dedication
// shows as paid straight away even if the webhook is late.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await refreshGatewayPayment((await params).id)
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 })
  return NextResponse.json({
    id: p.id,
    kind: p.kind,
    status: p.status,
    amount: p.amount,
    request_id: p.request_id,
    song_title: p.song_title,
  })
}
