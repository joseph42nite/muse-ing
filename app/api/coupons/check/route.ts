import { NextResponse } from "next/server"
import { checkCoupon } from "@/lib/server/coupons"

// The booking page's "Apply" button: does this code give a discount on this many tickets?
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const numPeople = Number.parseInt(q.get("num_people") ?? "1", 10)
  if (!Number.isInteger(numPeople) || numPeople < 1 || numPeople > 20) {
    return NextResponse.json({ error: "Number of tickets must be between 1 and 20." }, { status: 400 })
  }
  const c = checkCoupon(q.get("code"), q.get("event_id") ?? "", numPeople)
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 })
  return NextResponse.json({
    code: c.coupon.code,
    discount_percent: c.coupon.discount_percent,
    seats_left: c.seats_left,
    list_amount: c.list_amount,
    discount_amount: c.discount_amount,
    total: c.total,
  })
}
