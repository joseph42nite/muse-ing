/**
 * @jest-environment node
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it, expect, afterAll, afterEach, jest } from "@jest/globals"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muse-pay-test-"))
process.env.DATABASE_PATH = path.join(dir, "test.db")
process.env.SEED_DEMO_DATA = "true"
delete process.env.CASHFREE_APP_ID
delete process.env.CASHFREE_SECRET_KEY

// No session cookie: admin routes see a signed-out visitor.
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

const { all, get, run } = require("../lib/server/db") as typeof import("../lib/server/db")
const pay = require("../lib/server/gateway-payments") as typeof import("../lib/server/gateway-payments")
const settings = require("../lib/server/settings") as typeof import("../lib/server/settings")
const admin = require("../lib/server/admin") as typeof import("../lib/server/admin")
const gigRoute = require("../app/api/gigs/[eventId]/route")
const statusRoute = require("../app/api/payments/[id]/route")
const bookingRoute = require("../app/api/payment-links/route")

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))
afterEach(() => settings.setPlatformFeePercent(10))

const gig = () => get<{ id: string; artist_id: string }>("SELECT id, artist_id FROM events WHERE artist_id IS NOT NULL LIMIT 1")!
const post = (eventId: string, body: unknown) =>
  gigRoute.POST(new Request(`http://x/api/gigs/${eventId}`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ eventId }),
  })
const tip = (eventId: string, extra: Record<string, unknown> = {}) =>
  post(eventId, { action: "tip_artist", amount: 100, supporter_name: "Asha", supporter_phone: "98765 43210", ...extra })

describe("platform fee", () => {
  it("starts at 10% and follows the admin setting, capped at 50%", () => {
    expect(settings.platformFeePercent()).toBe(10)
    settings.setPlatformFeePercent(12.5)
    expect(settings.platformFeeFor(50)).toBe(6.25)
    settings.setPlatformFeePercent(90)
    expect(settings.platformFeePercent()).toBe(50)
  })

  it("is set through the admin settings route, which only admins can reach", async () => {
    const route = require("../app/api/admin/settings/route")
    const res = await route.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ platform_fee_percent: 15 }) }))
    expect(res.status).toBe(403)
    expect(settings.platformFeePercent()).toBe(10)
  })

  it("is recorded on ticket bookings, which still charge the listed price", async () => {
    // Stand in for Cashfree so the booking's payment link can be made.
    process.env.CASHFREE_APP_ID = "test"
    process.env.CASHFREE_SECRET_KEY = "test"
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
      const linkId = JSON.parse(String((init as RequestInit).body)).link_id
      return new Response(JSON.stringify({ link_id: linkId, link_url: "https://pay.example/x", link_status: "ACTIVE" }))
    })
    const ev = get<{ id: string; ticket_price: number }>("SELECT id, ticket_price FROM events WHERE ticket_price > 0 LIMIT 1")!
    const res = await bookingRoute.POST(
      new Request("http://x/api/payment-links", {
        method: "POST",
        body: JSON.stringify({ event_id: ev.id, name: "Asha", phone: "9876543210", num_people: 2 }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.amount).toBe(ev.ticket_price * 2)
    const booking = get<{ total_amount: number; platform_fee: number }>(
      "SELECT total_amount, platform_fee FROM audience_bookings WHERE id = ?",
      body.booking_id,
    )!
    expect(booking.total_amount).toBe(ev.ticket_price * 2)
    expect(booking.platform_fee).toBe(Math.round(ev.ticket_price * 2 * 10) / 100)
    fetchSpy.mockRestore()
    delete process.env.CASHFREE_APP_ID
    delete process.env.CASHFREE_SECRET_KEY
  })
})

describe("tips through Cashfree", () => {
  it("needs a phone number", async () => {
    const res = await tip(gig().id, { supporter_phone: "123" })
    expect(res.status).toBe(400)
  })

  it("records the artist transaction once, with the fee fixed when the link was made", async () => {
    const g = gig()
    const body = await (await tip(g.id)).json()
    expect(body.payment_url).toBe(`/api/payments/${body.payment_id}/dev-pay`)
    settings.setPlatformFeePercent(20) // a later change doesn't touch this payment

    expect(pay.settleGatewayPayment(body.payment_id, "PAID")).toBe("paid")
    expect(pay.settleGatewayPayment(body.payment_id, "PAID")).toBe("paid")
    expect(pay.settleGatewayPayment(body.payment_id, "EXPIRED")).toBe("paid")

    const txs = all("SELECT * FROM artist_transactions WHERE upi_order_id = ?", body.payment_id)
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({
      artist_id: g.artist_id, type: "tip", amount: 100, platform_fee: 10, provider: "cashfree", status: "paid", payout_status: "owed",
    })

    const status = await (await statusRoute.GET(new Request("http://x"), { params: Promise.resolve({ id: body.payment_id }) })).json()
    expect(status).toMatchObject({ status: "paid", kind: "tip", amount: 100 })
  })

  it("an expired link writes nothing", async () => {
    const body = await (await tip(gig().id)).json()
    expect(pay.settleGatewayPayment(body.payment_id, "EXPIRED")).toBe("failed")
    expect(get("SELECT 1 FROM artist_transactions WHERE upi_order_id = ?", body.payment_id)).toBeUndefined()
  })

  it("admin pays out the artist's share", async () => {
    const g = gig()
    const owed = get<{ n: number }>(
      "SELECT SUM(amount - platform_fee) AS n FROM artist_transactions WHERE artist_id = ? AND payout_status = 'owed'",
      g.artist_id,
    )!.n
    expect(owed).toBeGreaterThan(0)
    const r = admin.payOutArtistTips(g.artist_id)
    expect(r).toMatchObject({ ok: true, amount: owed })
    expect(get("SELECT 1 FROM artist_transactions WHERE artist_id = ? AND payout_status = 'owed'", g.artist_id)).toBeUndefined()
  })
})

describe("dedications through Cashfree", () => {
  const confirmedSong = (eventId: string) => {
    const id = `test-song-${Math.random().toString(36).slice(2)}`
    run(
      `INSERT INTO song_requests (id, event_id, source_type, song_title, status, dedication_payment_status)
       VALUES (?, ?, 'audience_request', 'Tum Hi Ho', 'confirmed', 'none')`,
      id,
      eventId,
    )
    return id
  }
  const dedicate = (eventId: string, requestId: string) =>
    post(eventId, {
      action: "pay_dedication_50", request_id: requestId, dedicated_to: "Riya", requester_name: "Asha", requester_phone: "9876543210",
    })

  it("moves the song into priority once paid", async () => {
    const g = gig()
    const songId = confirmedSong(g.id)
    const body = await (await dedicate(g.id, songId)).json()
    expect(get<any>("SELECT dedication_payment_status FROM song_requests WHERE id = ?", songId).dedication_payment_status).toBe("pending_gateway")

    // A second tap reuses the open link instead of making another charge
    const again = await (await dedicate(g.id, songId)).json()
    expect(again.payment_id).toBe(body.payment_id)

    pay.settleGatewayPayment(body.payment_id, "PAID")
    expect(get<any>("SELECT dedication_payment_status FROM song_requests WHERE id = ?", songId).dedication_payment_status).toBe("paid")
    expect(get<any>("SELECT type, amount FROM artist_transactions WHERE upi_order_id = ?", body.payment_id)).toMatchObject({
      type: "dedication", amount: 50,
    })
    expect((await dedicate(g.id, songId)).status).toBe(409)
  })

  it("goes back to unpaid when the link expires", async () => {
    const g = gig()
    const songId = confirmedSong(g.id)
    const body = await (await dedicate(g.id, songId)).json()
    pay.settleGatewayPayment(body.payment_id, "EXPIRED")
    expect(get<any>("SELECT dedication_payment_status FROM song_requests WHERE id = ?", songId).dedication_payment_status).toBe("none")
  })
})
