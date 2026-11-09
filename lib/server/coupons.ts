// Ticket coupons. Each code belongs to an artist or a promoter, takes a percentage off the ticket
// price and covers a set number of seats. Seats count once a booking is paid, and are held for
// HOLD_MINUTES while someone is at the checkout, so two people can't both take the last seat.
// A booking that needs more seats than are left gets no discount at all.
import crypto from "node:crypto"
import { all, get, run } from "./db"
import { round2 } from "./settings"

export const HOLD_MINUTES = 30
const CODE_RE = /^[A-Z0-9]{3,20}$/

export interface Coupon {
  id: string
  code: string
  owner_type: "artist" | "promoter"
  owner_id: string
  event_id: string | null
  discount_percent: number
  seat_limit: number
  active: number
  created_at: string
}

export const normalizeCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, "")

/** Seats taken on a coupon: paid bookings plus checkouts still inside the hold window. */
export function seatsUsed(couponId: string): number {
  const since = new Date(Date.now() - HOLD_MINUTES * 60e3).toISOString()
  return (
    get<{ n: number }>(
      `SELECT COALESCE(SUM(num_people), 0) AS n FROM audience_bookings
        WHERE coupon_id = ? AND (payment_status = 'paid' OR (payment_status = 'pending' AND created_at >= ?))`,
      couponId,
      since,
    )?.n ?? 0
  )
}

export type CouponCheck =
  | {
      ok: true
      coupon: Coupon
      seats_left: number
      list_amount: number
      discount_amount: number
      total: number
    }
  | { ok: false; error: string }

/** Whether a code gives a discount on this many tickets for this event, and how much. */
export function checkCoupon(codeIn: unknown, eventId: string, numPeople: number): CouponCheck {
  const code = normalizeCode(codeIn)
  if (!code) return { ok: false, error: "Enter a coupon code." }
  const c = get<Coupon>("SELECT * FROM coupons WHERE code = ?", code)
  if (!c || !c.active) return { ok: false, error: "That coupon code isn't valid." }

  const ev = get<{ id: string; ticket_price: number; artist_id: string | null }>(
    "SELECT id, ticket_price, artist_id FROM events WHERE id = ?",
    eventId,
  )
  if (!ev) return { ok: false, error: "Event not found." }
  if (c.event_id && c.event_id !== ev.id) return { ok: false, error: "That coupon is for a different gig." }
  if (!c.event_id && c.owner_type === "artist" && c.owner_id !== ev.artist_id) {
    return { ok: false, error: "That coupon is for a different artist's gigs." }
  }

  const left = Math.max(0, c.seat_limit - seatsUsed(c.id))
  if (left === 0) return { ok: false, error: "That coupon has been used up." }
  if (numPeople > left) {
    return {
      ok: false,
      error: `Only ${left} discounted ${left === 1 ? "ticket is" : "tickets are"} left on this coupon. Book ${left} or fewer to use it.`,
    }
  }

  const list = round2(ev.ticket_price * numPeople)
  const discount = round2((list * c.discount_percent) / 100)
  return { ok: true, coupon: c, seats_left: left, list_amount: list, discount_amount: discount, total: round2(list - discount) }
}

// ---------------------------------------------------------------------------
// Admin

export interface CouponInput {
  code?: unknown
  owner_type?: unknown
  owner_id?: unknown
  event_id?: unknown
  discount_percent?: unknown
  seat_limit?: unknown
  active?: unknown
}

type Result<T> = ({ ok: true } & T) | { ok: false; status: 400 | 404 | 409; error: string }

export function listCoupons() {
  const since = new Date(Date.now() - HOLD_MINUTES * 60e3).toISOString()
  return all(
    `SELECT c.*, u.name AS owner_name, e.title AS event_title, e.date AS event_date,
            COALESCE((SELECT SUM(b.num_people) FROM audience_bookings b
                       WHERE b.coupon_id = c.id AND (b.payment_status = 'paid' OR (b.payment_status = 'pending' AND b.created_at >= ?))), 0) AS seats_used,
            COALESCE((SELECT SUM(b.num_people) FROM audience_bookings b WHERE b.coupon_id = c.id AND b.payment_status = 'paid'), 0) AS seats_sold,
            COALESCE((SELECT SUM(b.total_amount) FROM audience_bookings b WHERE b.coupon_id = c.id AND b.payment_status = 'paid'), 0) AS revenue,
            COALESCE((SELECT SUM(b.discount_amount) FROM audience_bookings b WHERE b.coupon_id = c.id AND b.payment_status = 'paid'), 0) AS discount_given
       FROM coupons c
       LEFT JOIN users u ON u.id = c.owner_id
       LEFT JOIN events e ON e.id = c.event_id
      ORDER BY c.active DESC, c.created_at DESC`,
    since,
  )
}

function validate(b: CouponInput, partial: boolean): Result<{ values: Partial<Coupon> }> {
  const out: Partial<Coupon> = {}
  const bad = (error: string) => ({ ok: false as const, status: 400 as const, error })
  const has = (k: keyof CouponInput) => !partial || b[k] !== undefined

  if (has("code")) {
    const code = normalizeCode(b.code)
    if (!CODE_RE.test(code)) return bad("Codes are 3–20 letters and numbers, no spaces.")
    out.code = code
  }
  if (has("owner_type")) {
    if (b.owner_type !== "artist" && b.owner_type !== "promoter") return bad("Choose whether the coupon is for an artist or a promoter.")
    out.owner_type = b.owner_type
  }
  if (has("owner_id")) {
    const id = String(b.owner_id ?? "")
    const role = out.owner_type
    if (!get("SELECT 1 FROM users WHERE id = ? AND role = ?", id, role ?? "")) return bad(`Choose the ${role ?? "owner"} this coupon belongs to.`)
    out.owner_id = id
  }
  if (has("event_id")) {
    const id = String(b.event_id ?? "").trim()
    if (id && !get("SELECT 1 FROM events WHERE id = ?", id)) return bad("That gig doesn't exist.")
    out.event_id = id || null
  }
  if (has("discount_percent")) {
    const n = Number(b.discount_percent)
    if (!Number.isFinite(n) || n <= 0 || n > 100) return bad("The discount must be between 1 and 100%.")
    out.discount_percent = round2(n)
  }
  if (has("seat_limit")) {
    const n = Number(b.seat_limit)
    if (!Number.isInteger(n) || n < 1 || n > 100000) return bad("Enter how many tickets the coupon covers (1 or more).")
    out.seat_limit = n
  }
  if (b.active !== undefined) out.active = b.active ? 1 : 0
  return { ok: true, values: out }
}

export function createCoupon(b: CouponInput): Result<{ id: string; code: string }> {
  const v = validate(b, false)
  if (!v.ok) return v
  const c = v.values
  if (get("SELECT 1 FROM coupons WHERE code = ?", c.code)) return { ok: false, status: 409, error: `${c.code} is already taken.` }
  const id = crypto.randomUUID()
  run(
    `INSERT INTO coupons (id, code, owner_type, owner_id, event_id, discount_percent, seat_limit, active)
     VALUES (?,?,?,?,?,?,?,?)`,
    id, c.code, c.owner_type, c.owner_id, c.event_id ?? null, c.discount_percent, c.seat_limit, c.active ?? 1,
  )
  return { ok: true, id, code: c.code! }
}

/** Changes the discount, seats or on/off switch. The code and owner stay fixed once made. */
export function updateCoupon(id: string, b: CouponInput): Result<{ id: string }> {
  if (!get("SELECT 1 FROM coupons WHERE id = ?", id)) return { ok: false, status: 404, error: "Coupon not found." }
  const v = validate({ discount_percent: b.discount_percent, seat_limit: b.seat_limit, active: b.active }, true)
  if (!v.ok) return v
  const entries = Object.entries(v.values)
  if (entries.length) {
    run(`UPDATE coupons SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, ...entries.map(([, val]) => val), id)
  }
  return { ok: true, id }
}

/** Deletes a coupon nobody has booked with; used ones can only be switched off. */
export function deleteCoupon(id: string): Result<{ id: string }> {
  if (!get("SELECT 1 FROM coupons WHERE id = ?", id)) return { ok: false, status: 404, error: "Coupon not found." }
  if (get("SELECT 1 FROM audience_bookings WHERE coupon_id = ?", id)) {
    return { ok: false, status: 409, error: "This coupon has bookings. Switch it off instead." }
  }
  run("DELETE FROM coupons WHERE id = ?", id)
  return { ok: true, id }
}

/** Code ideas built from the owner's name, the discount and the gig, leaving out codes already taken. */
export function suggestCodes(ownerName: string, discount: number, gigWords: string[] = []): string[] {
  const word = (s: string) => (s.toUpperCase().match(/[A-Z0-9]+/g) ?? []).find((w) => w.length >= 3) ?? ""
  const first = word(ownerName)
  const pct = Number.isFinite(discount) && discount > 0 ? String(Math.round(discount)) : ""
  const venue = gigWords.map(word).find(Boolean) ?? ""
  const ideas = [
    first && pct && `${first}${pct}`,
    first && `${first}LIVE`,
    first && `${first}FAM`,
    first && `${first}VIP`,
    first && `MUSE${first}`,
    venue && pct && `${venue}${pct}`,
    first && venue && `${first}${venue}`,
    pct && `MUSE${pct}`,
    "FIRSTROW",
    "GIGNIGHT",
  ]
    .filter((c): c is string => !!c && CODE_RE.test(c))
    .map((c) => c.slice(0, 20))
  const taken = new Set(all<{ code: string }>("SELECT code FROM coupons").map((r) => r.code))
  return [...new Set(ideas)].filter((c) => !taken.has(c)).slice(0, 6)
}
