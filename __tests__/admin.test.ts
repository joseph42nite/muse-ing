/**
 * @jest-environment node
 */
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muse-admin-test-"))
process.env.DATABASE_PATH = path.join(dir, "test.db")
process.env.SEED_DEMO_DATA = "true"

// The session token the mocked cookie jar hands to getSessionUser().
let token: string | undefined
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (token ? { value: token } : undefined), set: () => {}, delete: () => {} }),
}))

const { get, run } = require("../lib/server/db") as typeof import("../lib/server/db")
const admin = require("../lib/server/admin") as typeof import("../lib/server/admin")

const routes = {
  stats: require("../app/api/admin/stats/route"),
  events: require("../app/api/admin/events/route"),
  promoters: require("../app/api/admin/promoters/route"),
  venues: require("../app/api/admin/venues/route"),
  transactions: require("../app/api/admin/transactions/route"),
  refunds: require("../app/api/admin/refunds/route"),
  inquiries: require("../app/api/admin/inquiries/route"),
  artists: require("../app/api/admin/artists/route"),
  schedule: require("../app/api/admin/schedule/route"),
  pickers: require("../app/api/admin/pickers/route"),
}
const eventById = require("../app/api/admin/events/[id]/route")
const accountById = require("../app/api/admin/accounts/[id]/route")
const json = (url: string, method: string, body?: unknown) =>
  new Request(`http://x${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const refundAction = require("../app/api/admin/refunds/[id]/route")

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex")
function sessionFor(id: string, role: string) {
  run(
    "INSERT OR IGNORE INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, 'x')",
    id, id, `${id}@test.local`, role,
  )
  const t = crypto.randomBytes(16).toString("hex")
  run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", sha(t), id, new Date(Date.now() + 86400e3).toISOString())
  return t
}

const patch = (id: string, body: unknown) =>
  refundAction.PATCH(new Request(`http://x/api/admin/refunds/${id}`, { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  }) as Promise<Response>

function seedRefund(id: string) {
  run(
    `INSERT INTO audience_bookings (id, event_id, name, phone, num_people, total_amount, payment_status)
     VALUES (?, 'gig-koramangala-tonight', 'Buyer', '9000000000', 2, 998, 'paid')`,
    `bk-${id}`,
  )
  run("INSERT INTO refund_requests (id, booking_id, user_email, reason) VALUES (?, ?, 'b@x.in', 'sick')", id, `bk-${id}`)
}

let adminToken: string
let tokens: Record<string, string | undefined>

beforeAll(() => {
  expect(get("SELECT 1 FROM users WHERE email = 'artist@museing.com'")).toBeTruthy()
  adminToken = sessionFor("admin-1", "admin")
  tokens = {
    "signed out": undefined,
    promoter: sessionFor("promoter-1", "promoter"),
    venue: sessionFor("venue-1", "venue"),
    artist: sessionFor("artist-x", "artist"),
  }
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("admin API guard", () => {
  it("returns 403 to everyone but admins", async () => {
    for (const [who, t] of Object.entries(tokens)) {
      token = t
      for (const [name, mod] of Object.entries(routes)) {
        const res: Response = await mod.GET()
        expect([who, name, res.status]).toEqual([who, name, 403])
      }
      expect((await patch("nope", { action: "approve" })).status).toBe(403)
    }
  })

  it("serves admins", async () => {
    token = adminToken
    for (const mod of Object.values(routes)) expect((await mod.GET()).status).toBe(200)
    const stats = await (await routes.stats.GET()).json()
    expect(stats.totals.events).toBeGreaterThanOrEqual(5)
    expect(stats.totals.revenue).toBeGreaterThanOrEqual(300) // seeded artist transactions
    expect(stats.monthly).toHaveLength(6)
  })
})

describe("admin read models", () => {
  it("lists events with artists and a merged transaction feed", () => {
    const events = admin.listEvents()
    expect(events.find((e) => e.id === "gig-koramangala-tonight")?.artist_name).toMatch(/Arjun/)
    const kinds = new Set(admin.listTransactions().map((t) => t.kind))
    expect(kinds.has("dedication") && kinds.has("tip")).toBe(true)
  })

  it("lists inquiries newest first with the event title", () => {
    run("INSERT INTO inquiries (id, name, email, event_id, message, created_at) VALUES ('iq-1','A','a@x.in','gig-bandra-tonight','hi','2026-01-01T00:00:00Z')")
    run("INSERT INTO inquiries (id, name, email, message, created_at) VALUES ('iq-2','B','b@x.in','yo','2026-02-01T00:00:00Z')")
    const rows = admin.listInquiries()
    expect(rows.map((r) => r.id).slice(0, 2)).toEqual(["iq-2", "iq-1"])
    expect(rows[1].event_title).toMatch(/Bollywood/)
  })
})

describe("refund actions", () => {
  it("approves, then marks refunded and updates the booking", async () => {
    token = adminToken
    seedRefund("rf-1")
    expect((await patch("rf-1", { action: "refund" })).status).toBe(409) // must be approved first
    const res = await patch("rf-1", { action: "approve", notes: "ok" })
    expect(await res.json()).toEqual({ id: "rf-1", status: "approved" })
    expect((await patch("rf-1", { action: "refund" })).status).toBe(200)
    expect(get("SELECT status, admin_notes FROM refund_requests WHERE id = 'rf-1'")).toEqual({ status: "refunded", admin_notes: "ok" })
    expect(get("SELECT payment_status FROM audience_bookings WHERE id = 'bk-rf-1'").payment_status).toBe("refunded")
    expect((await patch("rf-1", { action: "reject" })).status).toBe(409)
  })

  it("rejects pending requests and validates input", async () => {
    token = adminToken
    seedRefund("rf-2")
    expect((await patch("rf-2", { action: "reject" })).status).toBe(200)
    expect(get("SELECT payment_status FROM audience_bookings WHERE id = 'bk-rf-2'").payment_status).toBe("paid")
    expect((await patch("rf-2", { action: "delete" })).status).toBe(400)
    expect((await patch("missing", { action: "approve" })).status).toBe(404)
    expect(admin.isRefundAction("toString")).toBe(false)
  })
})

describe("admin writes", () => {
  it("blocks non-admins from every write", async () => {
    for (const t of Object.values(tokens)) {
      token = t
      expect((await routes.events.POST(json("/api/admin/events", "POST", { title: "x" }))).status).toBe(403)
      expect((await routes.artists.POST(json("/api/admin/artists", "POST", {}))).status).toBe(403)
      expect((await routes.venues.POST(json("/api/admin/venues", "POST", {}))).status).toBe(403)
      expect((await routes.promoters.POST(json("/api/admin/promoters", "POST", {}))).status).toBe(403)
      expect((await eventById.PATCH(json("/e", "PATCH", { title: "x" }), ctx("gig-bandra-tonight"))).status).toBe(403)
      expect((await eventById.DELETE(json("/e", "DELETE"), ctx("gig-bandra-tonight"))).status).toBe(403)
      expect((await accountById.PATCH(json("/a", "PATCH", { name: "x" }), ctx("artist-maya-02"))).status).toBe(403)
    }
    expect(get("SELECT title FROM events WHERE id = 'gig-bandra-tonight'").title).toMatch(/Bollywood/)
  })

  it("creates, edits and deletes an event", async () => {
    token = adminToken
    const venue = await (await routes.venues.POST(json("/v", "POST", { name: "Blue Frog", email: "blue@frog.in", password: "longenough" }))).json()
    expect(venue.id).toBeTruthy()
    const bad = await routes.events.POST(json("/e", "POST", { title: "", date: "2027-01-01T15:00:00Z" }))
    expect(bad.status).toBe(400)
    const noArtist = await routes.events.POST(json("/e", "POST", { title: "X", date: "2027-01-01T15:00:00Z", artist_id: "nope" }))
    expect(noArtist.status).toBe(400)

    const res = await routes.events.POST(
      json("/e", "POST", { title: "New Year Unplugged", date: "2027-01-01T15:00:00Z", ticket_price: "450", artist_id: "artist-maya-02", venue_id: venue.id }),
    )
    expect(res.status).toBe(200)
    const { id } = await res.json()
    const row = get("SELECT * FROM events WHERE id = ?", id)
    expect(row).toMatchObject({ title: "New Year Unplugged", ticket_price: 450, artist_id: "artist-maya-02", location_name: "Blue Frog", event_date_only: "2027-01-01", created_by: "admin-1" })

    expect((await eventById.PATCH(json("/e", "PATCH", { location_name: "Rooftop", ticket_price: 0 }), ctx(id))).status).toBe(200)
    expect(get("SELECT location_name, location_slug, ticket_price, title FROM events WHERE id = ?", id)).toEqual({
      location_name: "Rooftop", location_slug: "rooftop", ticket_price: 0, title: "New Year Unplugged",
    })
    expect((await eventById.GET(json("/e", "GET"), ctx(id))).status).toBe(200)
    expect((await eventById.PATCH(json("/e", "PATCH", {}), ctx(id))).status).toBe(400)
    expect((await eventById.PATCH(json("/e", "PATCH", { title: "x" }), ctx("missing"))).status).toBe(404)
    expect((await eventById.DELETE(json("/e", "DELETE"), ctx(id))).status).toBe(200)
    expect(get("SELECT 1 FROM events WHERE id = ?", id)).toBeUndefined()
  })

  it("won't delete an event with paid tickets", async () => {
    token = adminToken
    run(
      `INSERT INTO audience_bookings (id, event_id, name, phone, num_people, total_amount, payment_status)
       VALUES ('bk-keep', 'gig-arjun-friday-next', 'B', '9000000001', 1, 599, 'paid')`,
    )
    const res = await eventById.DELETE(json("/e", "DELETE"), ctx("gig-arjun-friday-next"))
    expect(res.status).toBe(409)
    expect(get("SELECT 1 FROM events WHERE id = 'gig-arjun-friday-next'")).toBeTruthy()
  })

  it("creates accounts that can sign in, and edits them", async () => {
    token = adminToken
    const { verifyPassword } = require("../lib/server/password")
    const res = await routes.artists.POST(json("/a", "POST", { name: "Zoya", email: "Zoya@Band.in", password: "longenough", instagram_handle: "zoyalive" }))
    const { id } = await res.json()
    const u = get("SELECT role, email, instagram_handle, password_hash FROM users WHERE id = ?", id)
    expect(u).toMatchObject({ role: "artist", email: "zoya@band.in", instagram_handle: "@zoyalive" })
    expect(verifyPassword("longenough", u.password_hash)).toBe(true)
    expect((await routes.artists.POST(json("/a", "POST", { name: "Z2", email: "zoya@band.in", password: "longenough" }))).status).toBe(409)
    expect((await routes.artists.POST(json("/a", "POST", { name: "Z3", email: "z3@band.in", password: "short" }))).status).toBe(400)

    const promo = await (await routes.promoters.POST(json("/p", "POST", { name: "Rahul", email: "rahul@p.in", password: "longenough" }))).json()
    expect(promo.promoter_code).toMatch(/^RAH\d{3}$/)

    run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('zoya-s', ?, '2099-01-01')", id)
    expect((await accountById.PATCH(json("/a", "PATCH", { phone: "99", password: "newpassword" }), ctx(id))).status).toBe(200)
    expect(verifyPassword("newpassword", get("SELECT password_hash FROM users WHERE id = ?", id).password_hash)).toBe(true)
    expect(get("SELECT 1 FROM sessions WHERE user_id = ?", id)).toBeUndefined()
    expect((await accountById.PATCH(json("/a", "PATCH", { name: "x" }), ctx("admin-1"))).status).toBe(404) // admins aren't editable here
  })
})

describe("schedule", () => {
  it("flags double bookings and gigs without an artist", () => {
    run("INSERT INTO events (id, title, date, artist_id) VALUES ('s-1', 'A', '2030-05-01T14:00:00Z', 'artist-kabir-03')")
    run("INSERT INTO events (id, title, date, artist_id) VALUES ('s-2', 'B', '2030-05-01T17:00:00Z', 'artist-kabir-03')")
    run("INSERT INTO events (id, title, date, artist_id) VALUES ('s-3', 'C', '2030-05-02T14:00:00Z', 'artist-kabir-03')")
    run("INSERT INTO events (id, title, date) VALUES ('s-4', 'D', '2030-05-03T14:00:00Z')")
    const rows = admin.listSchedule("2030-05-01T00:00:00+05:30")
    const by = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(by["s-1"].clashes[0]).toMatch(/2 gigs/)
    expect(by["s-2"].clashes[0]).toMatch(/2 gigs/)
    expect(by["s-3"].clashes).toEqual([])
    expect(by["s-4"].clashes).toEqual(["No artist booked"])
    expect(rows.map((r) => r.id)).toEqual(["s-1", "s-2", "s-3", "s-4"])
    expect(admin.listSchedule("2030-05-01", "artist-kabir-03").map((r) => r.id)).toEqual(["s-1", "s-2", "s-3"])
    // 1am India time belongs to the day it reads as there, not the UTC day
    expect(admin.istDay("2030-05-01T19:45:00Z")).toBe("2030-05-02")
  })

  it("lists artists with their next gig", () => {
    const kabir = admin.listArtists().find((a: { id: string }) => a.id === "artist-kabir-03")
    expect(kabir.gigs_upcoming).toBeGreaterThanOrEqual(3)
    expect(kabir.next_gig).toBeTruthy()
  })
})

describe("roster details and the venue view", () => {
  it("saves artist roster and bank fields, and venue details", async () => {
    token = adminToken
    const res = await routes.artists.POST(
      json("/a", "POST", { name: "Mira", email: "mira@band.in", password: "longenough", city: "BLR", average_fee: "₹4,000", rating: "7" }),
    )
    const { id } = await res.json()
    await accountById.PATCH(json("/a", "PATCH", { account_number: "1234", ifsc_code: "HDFC0001", promoter_code: "HACK" }), ctx(id))
    const a = get("SELECT city, average_fee, rating, account_number, ifsc_code, promoter_code FROM users WHERE id = ?", id)
    expect(a).toMatchObject({ city: "BLR", average_fee: 4000, rating: 7, account_number: "1234", ifsc_code: "HDFC0001", promoter_code: null })
    expect(admin.listArtists().find((r: { id: string }) => r.id === id).account_number).toBe("1234")

    const v = await (await routes.venues.POST(json("/v", "POST", { name: "Hall", email: "hall@v.in", password: "longenough", poc_name: "Asha", account_number: "nope" }))).json()
    const row = get("SELECT poc_name, account_number FROM users WHERE id = ?", v.id)
    expect(row).toEqual({ poc_name: "Asha", account_number: null }) // venues can't hold bank fields
  })

  it("shows a venue only its own events, with the artist's playlist", async () => {
    const venueEvents = require("../app/api/venue/events/route")
    const venueToken = sessionFor("venue-a", "venue")
    sessionFor("venue-b", "venue")
    run("INSERT INTO events (id, title, date, venue_id, artist_id) VALUES ('ve-1', 'Mine', '2030-06-01T14:00:00Z', 'venue-a', 'artist-kabir-03')")
    run("INSERT INTO events (id, title, date, venue_id) VALUES ('ve-2', 'Theirs', '2030-06-02T14:00:00Z', 'venue-b')")
    run(`INSERT INTO song_requests (id, event_id, source_type, song_title, status) VALUES
         ('vs-1', 've-1', 'artist_playlist', 'Song A', 'confirmed'),
         ('vs-2', 've-1', 'artist_playlist', 'Song B', 'declined'),
         ('vs-3', 've-1', 'audience_request', 'Request', 'pending_artist')`)
    token = venueToken
    const body = await (await venueEvents.GET()).json()
    expect(body.venue.name).toBe("venue-a")
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(["ve-1"])
    expect(body.events[0].artist_name).toBeTruthy()
    expect(body.events[0].playlist.map((s: { song_title: string }) => s.song_title)).toEqual(["Song A"])
    token = sessionFor("artist-x", "artist")
    expect((await venueEvents.GET()).status).toBe(403)
  })
})

describe("gig bookkeeping and listing", () => {
  it("keeps unlisted events off the public list, and validates artist fees", async () => {
    token = adminToken
    const publicEvents = require("../app/api/public/events/route")
    const res = await routes.events.POST(
      json("/e", "POST", { title: "Private gig", date: "2031-02-01T14:30:00Z", is_listed: "0", artist_fee: "4000", fee_status: "Pending" }),
    )
    const { id } = await res.json()
    expect(get("SELECT is_listed, artist_fee, fee_status FROM events WHERE id = ?", id)).toEqual({
      is_listed: 0,
      artist_fee: 4000,
      fee_status: "Pending",
    })
    const listed = async () =>
      ((await (await publicEvents.GET(new Request("http://x/api/public/events"))).json()).events as { id: string }[]).some((e) => e.id === id)
    expect(await listed()).toBe(false)
    await eventById.PATCH(json("/e", "PATCH", { is_listed: "1", fee_status: "Paid" }), ctx(id))
    expect(await listed()).toBe(true)
    expect((await eventById.PATCH(json("/e", "PATCH", { fee_status: "Maybe" }), ctx(id))).status).toBe(400)
    expect((await eventById.PATCH(json("/e", "PATCH", { artist_fee: "-5" }), ctx(id))).status).toBe(400)
    expect(admin.listSchedule("2031-01-01").find((r) => r.id === id)?.fee_status).toBe("Paid")
  })
})
