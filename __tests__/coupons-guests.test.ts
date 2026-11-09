/**
 * @jest-environment node
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it, expect, afterAll, beforeAll, jest } from "@jest/globals"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muse-coupon-test-"))
process.env.DATABASE_PATH = path.join(dir, "test.db")
process.env.SEED_DEMO_DATA = "true"
process.env.CASHFREE_APP_ID = "test"
process.env.CASHFREE_SECRET_KEY = "test"

jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

const { get, run } = require("../lib/server/db") as typeof import("../lib/server/db")
const coupons = require("../lib/server/coupons") as typeof import("../lib/server/coupons")
const guests = require("../lib/server/guests") as typeof import("../lib/server/guests")
const bookingRoute = require("../app/api/payment-links/route")
const r2 = (n: number) => Math.round(n * 100) / 100
const staff = () => get<{ id: string }>("SELECT id FROM users LIMIT 1")!.id

// Stand in for Cashfree so payment links can be made.
beforeAll(() => {
  jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
    const linkId = JSON.parse(String((init as RequestInit).body)).link_id
    return new Response(JSON.stringify({ link_id: linkId, link_url: "https://pay.example/x", link_status: "ACTIVE" }))
  })
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const gig = () =>
  get<{ id: string; ticket_price: number; artist_id: string }>(
    "SELECT id, ticket_price, artist_id FROM events WHERE ticket_price > 0 AND artist_id IS NOT NULL LIMIT 1",
  )!
const book = (eventId: string, people: number, coupon = "", phone = "9876543210") =>
  bookingRoute.POST(
    new Request("http://x/api/payment-links", {
      method: "POST",
      body: JSON.stringify({ event_id: eventId, name: "Asha", phone, num_people: people, coupon_code: coupon }),
    }),
  )

describe("coupons", () => {
  it("rejects bad codes and owners", () => {
    const g = gig()
    expect(coupons.createCoupon({ code: "a b", owner_type: "artist", owner_id: g.artist_id, discount_percent: 10, seat_limit: 5 })).toMatchObject({ ok: false })
    expect(coupons.createCoupon({ code: "OKAY10", owner_type: "promoter", owner_id: g.artist_id, discount_percent: 10, seat_limit: 5 })).toMatchObject({ ok: false })
    expect(coupons.createCoupon({ code: "OKAY10", owner_type: "artist", owner_id: g.artist_id, discount_percent: 0, seat_limit: 5 })).toMatchObject({ ok: false })
  })

  it("takes the discount off and stops once its tickets are gone", async () => {
    const g = gig()
    const made = coupons.createCoupon({ code: "arjun20", owner_type: "artist", owner_id: g.artist_id, discount_percent: 20, seat_limit: 3 })
    expect(made).toMatchObject({ ok: true, code: "ARJUN20" })

    const check = coupons.checkCoupon("arjun20", g.id, 2)
    expect(check).toMatchObject({ ok: true, seats_left: 3, discount_amount: r2(g.ticket_price * 2 * 0.2) })

    const first = await (await book(g.id, 2, "ARJUN20")).json()
    expect(first.amount).toBe(r2(g.ticket_price * 2 * 0.8))
    expect(get<any>("SELECT discount_amount, list_amount FROM audience_bookings WHERE id = ?", first.booking_id)).toMatchObject({
      discount_amount: r2(g.ticket_price * 2 * 0.2),
      list_amount: r2(g.ticket_price * 2),
    })

    // The pending checkout holds its 2 seats, so only 1 is left.
    const tooMany = await book(g.id, 2, "ARJUN20", "9123456780")
    expect(tooMany.status).toBe(400)
    expect((await tooMany.json()).error).toMatch(/Only 1 discounted ticket is left/)

    const last = await (await book(g.id, 1, "ARJUN20", "9123456780")).json()
    expect(last.amount).toBe(r2(g.ticket_price * 0.8))
    expect(coupons.checkCoupon("ARJUN20", g.id, 1)).toMatchObject({ ok: false, error: "That coupon has been used up." })

    // An abandoned checkout releases its seats once the hold is over.
    run("UPDATE audience_bookings SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", first.booking_id)
    expect(coupons.checkCoupon("ARJUN20", g.id, 2)).toMatchObject({ ok: true, seats_left: 2 })
  })

  it("an artist's coupon works only on that artist's gigs", () => {
    const g = gig()
    const other = get<{ id: string }>("SELECT id FROM events WHERE ticket_price > 0 AND artist_id <> ? LIMIT 1", g.artist_id)
    if (!other) return
    expect(coupons.checkCoupon("ARJUN20", other.id, 1)).toMatchObject({ ok: false })
  })

  it("a promoter's coupon credits the sale to the promoter", async () => {
    const g = gig()
    const promoter = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE role = 'promoter' LIMIT 1")
    if (!promoter) return
    coupons.createCoupon({ code: "PROMO15", owner_type: "promoter", owner_id: promoter.id, discount_percent: 15, seat_limit: 10 })
    const body = await (await book(g.id, 1, "PROMO15")).json()
    expect(get<any>("SELECT promoter_id FROM audience_bookings WHERE id = ?", body.booking_id).promoter_id).toBe(promoter.id)
  })

  it("a 100% coupon confirms a free booking without Cashfree", async () => {
    const g = gig()
    coupons.createCoupon({ code: "GUESTLIST", owner_type: "artist", owner_id: g.artist_id, discount_percent: 100, seat_limit: 2 })
    const body = await (await book(g.id, 2, "GUESTLIST")).json()
    expect(body.amount).toBe(0)
    expect(get<any>("SELECT payment_status, total_amount FROM audience_bookings WHERE id = ?", body.booking_id)).toMatchObject({
      payment_status: "paid",
      total_amount: 0,
    })
  })

  it("suggests codes from the owner's name and skips taken ones", () => {
    const ideas = coupons.suggestCodes("Arjun Mehta", 20, ["Toit Brewhouse"])
    expect(ideas).toContain("ARJUNLIVE")
    expect(ideas).toContain("TOIT20")
    expect(ideas).not.toContain("ARJUN20") // already made above
  })
})

describe("door list", () => {
  it("marks guests arrived and paid at the door, and undoes it", async () => {
    const g = gig()
    const body = await (await book(g.id, 3, "", "9000000001")).json()
    let guest = guests.listGuests(g.id).find((x) => x.id === body.booking_id)!
    expect(guest).toMatchObject({ paid: false, arrived: false, num_people: 3 })

    expect(guests.updateGuest(body.booking_id, { paid: true, arrived: true }, staff())).toMatchObject({
      ok: true,
      guest: { paid: true, paid_at_door: true, arrived: true },
    })
    expect(get("SELECT 1 FROM venue_checkins WHERE event_id = ? AND audience_phone = '9000000001'", g.id)).toBeTruthy()

    guest = (guests.updateGuest(body.booking_id, { paid: false, arrived: false }, staff()) as any).guest
    expect(guest).toMatchObject({ paid: false, paid_at_door: false, arrived: false })
    expect(get("SELECT 1 FROM venue_checkins WHERE event_id = ? AND audience_phone = '9000000001'", g.id)).toBeUndefined()
  })

  it("never un-pays a booking paid online", () => {
    const g = gig()
    const paid = get<{ id: string }>("SELECT id FROM audience_bookings WHERE event_id = ? AND payment_status = 'paid' AND door_paid_at IS NULL LIMIT 1", g.id)!
    expect(guests.updateGuest(paid.id, { paid: false }, staff())).toMatchObject({ ok: true, guest: { paid: true } })
  })
})
