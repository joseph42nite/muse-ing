import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { bookingStatusFor, fetchPaymentLink } from "@/lib/server/cashfree"

// Used by the post-payment page. If the webhook hasn't landed yet, ask Cashfree directly
// so the guest sees the right state and the booking becomes check-in-able immediately.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = get<{ payment_status: string; payment_link_id: string | null }>(
    "SELECT payment_status, payment_link_id FROM audience_bookings WHERE id = ?",
    id,
  )
  if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 })

  let status = b.payment_status
  if (status === "pending" && b.payment_link_id) {
    try {
      const next = bookingStatusFor((await fetchPaymentLink(b.payment_link_id)).link_status)
      if (next) {
        run("UPDATE audience_bookings SET payment_status = ? WHERE id = ? AND payment_status = 'pending'", next, id)
        status = next
      }
    } catch {
      /* keep pending; webhook will settle it */
    }
  }
  return NextResponse.json({ status })
}
