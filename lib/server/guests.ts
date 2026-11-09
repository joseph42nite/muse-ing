// The door list for a gig: every booking with its name and phone, whether the guest has arrived,
// and whether they've paid (online through Cashfree, or at the door on the night).
import crypto from "node:crypto"
import { all, get, run, transaction } from "./db"
import { last10Digits } from "./format"

export interface Guest {
  id: string
  name: string
  phone: string
  email: string | null
  num_people: number
  total_amount: number
  discount_amount: number
  coupon_code: string | null
  payment_status: string
  paid: boolean
  paid_at_door: boolean
  arrived: boolean
  arrived_at: string | null
  created_at: string
}

/** Bookings that can show up at the door: paid ones, and unpaid ones that might pay on the night. */
export function listGuests(eventId: string): Guest[] {
  const rows = all<any>(
    `SELECT b.id, b.name, b.phone, b.email, b.num_people, b.total_amount, b.discount_amount, b.payment_status,
            b.door_paid_at, b.arrived_at, b.created_at, c.code AS coupon_code
       FROM audience_bookings b LEFT JOIN coupons c ON c.id = b.coupon_id
      WHERE b.event_id = ? AND b.payment_status IN ('paid', 'pending', 'failed')
      ORDER BY b.name COLLATE NOCASE, b.created_at`,
    eventId,
  )
  // Phone check-ins from before bookings carried arrived_at still count as arrived.
  const checkedIn = new Set(
    all<{ audience_phone: string }>("SELECT audience_phone FROM venue_checkins WHERE event_id = ?", eventId).map((c) =>
      last10Digits(c.audience_phone),
    ),
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    num_people: r.num_people,
    total_amount: r.total_amount,
    discount_amount: r.discount_amount ?? 0,
    coupon_code: r.coupon_code,
    payment_status: r.payment_status,
    paid: r.payment_status === "paid",
    paid_at_door: !!r.door_paid_at,
    arrived: !!r.arrived_at || (r.payment_status === "paid" && checkedIn.has(last10Digits(r.phone))),
    arrived_at: r.arrived_at,
    created_at: r.created_at,
  }))
}

type Result = { ok: true; guest: Guest } | { ok: false; status: 400 | 404 | 409; error: string }

/**
 * Marks a guest arrived (or not) and/or paid at the door (or not). Only bookings that weren't paid
 * online can be marked paid at the door, and only door payments can be undone here.
 */
export function updateGuest(
  bookingId: string,
  change: { arrived?: unknown; paid?: unknown },
  by: string,
): Result {
  const b = get<{ id: string; event_id: string; phone: string; payment_status: string; door_paid_at: string | null }>(
    "SELECT id, event_id, phone, payment_status, door_paid_at FROM audience_bookings WHERE id = ?",
    bookingId,
  )
  if (!b) return { ok: false, status: 404, error: "Booking not found." }
  const now = new Date().toISOString()

  transaction(() => {
    if (change.paid !== undefined) {
      if (change.paid && b.payment_status !== "paid") {
        run("UPDATE audience_bookings SET payment_status = 'paid', door_paid_at = ? WHERE id = ?", now, b.id)
      } else if (!change.paid && b.door_paid_at) {
        run("UPDATE audience_bookings SET payment_status = 'pending', door_paid_at = NULL WHERE id = ?", b.id)
      }
    }
    if (change.arrived !== undefined) {
      if (change.arrived) {
        run("UPDATE audience_bookings SET arrived_at = COALESCE(arrived_at, ?) WHERE id = ?", now, b.id)
        if (!get("SELECT 1 FROM venue_checkins WHERE event_id = ? AND audience_phone = ?", b.event_id, b.phone)) {
          run(
            "INSERT INTO venue_checkins (id, event_id, audience_phone, checkin_time, verified_by) VALUES (?,?,?,?,?)",
            crypto.randomUUID(), b.event_id, b.phone, now, by,
          )
        }
      } else {
        run("UPDATE audience_bookings SET arrived_at = NULL WHERE id = ?", b.id)
        // Clear the phone check-in too, unless another arrived booking shares the number.
        const others = get(
          "SELECT 1 FROM audience_bookings WHERE event_id = ? AND phone = ? AND id <> ? AND arrived_at IS NOT NULL",
          b.event_id, b.phone, b.id,
        )
        if (!others) run("DELETE FROM venue_checkins WHERE event_id = ? AND audience_phone = ?", b.event_id, b.phone)
      }
    }
  })
  const guest = listGuests(b.event_id).find((g) => g.id === b.id)
  return guest ? { ok: true, guest } : { ok: false, status: 404, error: "Booking not found." }
}
