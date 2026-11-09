import crypto from "node:crypto"
import { hashPassword } from "./password"
import { all, get, run, transaction } from "./db"
import { FEE_STATUSES, paymentGigs, paymentSummary } from "./payments"

// Read models for the admin panel. Every function here is reached only through
// app/api/admin/*, which checks requireRole("admin") first.

const PAID_TICKETS = "payment_status = 'paid'"
const NOT_CANCELLED = "COALESCE(e.fee_status, '') <> 'Cancelled'"

export function dashboardStats() {
  const count = (sql: string) => get<{ n: number }>(sql)?.n ?? 0
  const ticketRevenue = get<{ n: number }>(`SELECT COALESCE(SUM(total_amount), 0) AS n FROM audience_bookings WHERE ${PAID_TICKETS}`)?.n ?? 0
  const artistRevenue = get<{ n: number }>("SELECT COALESCE(SUM(amount), 0) AS n FROM artist_transactions WHERE status = 'paid'")?.n ?? 0
  // Tips and dedications collected through Cashfree: our cut, and the artists' share not yet paid out.
  const platformFees =
    (get<{ n: number }>("SELECT COALESCE(SUM(platform_fee), 0) AS n FROM artist_transactions WHERE status = 'paid'")?.n ?? 0) +
    (get<{ n: number }>(`SELECT COALESCE(SUM(platform_fee), 0) AS n FROM audience_bookings WHERE ${PAID_TICKETS}`)?.n ?? 0)
  const tipsOwed =
    get<{ n: number }>(
      "SELECT COALESCE(SUM(amount - platform_fee), 0) AS n FROM artist_transactions WHERE status = 'paid' AND payout_status = 'owed'",
    )?.n ?? 0

  // Last six calendar months, oldest first, so empty months still show up on the chart.
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const byMonth = (sql: string) =>
    new Map(all<{ m: string; n: number }>(sql, months[0]).map((r) => [r.m, r.n]))
  const events = byMonth("SELECT substr(date, 1, 7) AS m, COUNT(*) AS n FROM events WHERE substr(date, 1, 7) >= ? GROUP BY m")
  const tickets = byMonth(
    `SELECT substr(created_at, 1, 7) AS m, SUM(total_amount) AS n FROM audience_bookings
      WHERE ${PAID_TICKETS} AND substr(created_at, 1, 7) >= ? GROUP BY m`,
  )
  const artist = byMonth(
    `SELECT substr(created_at, 1, 7) AS m, SUM(amount) AS n FROM artist_transactions
      WHERE status = 'paid' AND substr(created_at, 1, 7) >= ? GROUP BY m`,
  )
  const refunds = byMonth(
    `SELECT substr(r.updated_at, 1, 7) AS m, SUM(b.total_amount) AS n
       FROM refund_requests r JOIN audience_bookings b ON b.id = r.booking_id
      WHERE r.status = 'refunded' AND substr(r.updated_at, 1, 7) >= ? GROUP BY m`,
  )

  return {
    totals: {
      events: count("SELECT COUNT(*) AS n FROM events"),
      revenue: ticketRevenue + artistRevenue,
      platformFees,
      tipsOwed,
      promoters: count("SELECT COUNT(*) AS n FROM users WHERE role = 'promoter'"),
      venues: count("SELECT COUNT(*) AS n FROM users WHERE role = 'venue'"),
      artists: count("SELECT COUNT(*) AS n FROM users WHERE role = 'artist'"),
      pendingRefunds: count("SELECT COUNT(*) AS n FROM refund_requests WHERE status = 'pending'"),
      inquiries: count("SELECT COUNT(*) AS n FROM inquiries"),
    },
    payments: paymentSummary(),
    monthly: months.map((m) => ({
      month: m,
      events: events.get(m) ?? 0,
      revenue: (tickets.get(m) ?? 0) + (artist.get(m) ?? 0),
      refunds: refunds.get(m) ?? 0,
    })),
  }
}

export function listEvents() {
  return all(
    `SELECT e.id, e.title, e.description, e.date, e.location_name, e.ticket_price, e.created_at,
            e.is_listed, e.artist_fee, e.advance_paid, e.fee_status, e.external_ref,
            e.artist_id, e.venue_id, a.name AS artist_name, v.name AS venue_name, c.name AS created_by_name,
            COALESCE(SUM(CASE WHEN b.${PAID_TICKETS} THEN b.num_people END), 0) AS tickets_sold,
            COALESCE(SUM(CASE WHEN b.${PAID_TICKETS} THEN b.total_amount END), 0) AS ticket_revenue,
            COUNT(b.id) AS bookings
       FROM events e
       LEFT JOIN users a ON a.id = e.artist_id
       LEFT JOIN users v ON v.id = e.venue_id
       LEFT JOIN users c ON c.id = e.created_by
       LEFT JOIN audience_bookings b ON b.event_id = e.id
      GROUP BY e.id
      ORDER BY e.date DESC`,
  )
}

export function listPromoters() {
  return all(
    `SELECT u.id, u.name, u.email, u.phone, u.promoter_code, u.created_at,
            (SELECT COUNT(*) FROM events e WHERE e.created_by = u.id) AS events_created,
            (SELECT COUNT(*) FROM audience_bookings b WHERE b.promoter_id = u.id AND b.${PAID_TICKETS}) AS paid_bookings,
            (SELECT COALESCE(SUM(b.total_amount), 0) FROM audience_bookings b WHERE b.promoter_id = u.id AND b.${PAID_TICKETS}) AS revenue
       FROM users u
      WHERE u.role = 'promoter'
      ORDER BY u.created_at DESC`,
  )
}

export function listVenues() {
  return all(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at,
            ${Object.keys(PROFILE_FIELDS.venue).map((k) => "u." + k).join(", ")},
            (SELECT COUNT(*) FROM events e WHERE e.venue_id = u.id) AS events_hosted,
            (SELECT COUNT(*) FROM events e WHERE e.venue_id = u.id AND e.date >= strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS events_upcoming,
            (SELECT COUNT(*) FROM venue_checkins c WHERE c.verified_by = u.id) AS checkins
       FROM users u
      WHERE u.role = 'venue'
      ORDER BY u.created_at DESC`,
  )
}

/** Ticket bookings and artist dedications/tips in one feed, newest first. */
export function listTransactions(limit = 500) {
  return all(
    `SELECT * FROM (
       SELECT b.id, 'ticket' AS kind, b.name AS payer_name, b.phone AS payer_phone, b.email AS payer_email,
              b.total_amount AS amount, b.platform_fee, b.payment_status AS status, b.payment_link_id AS reference,
              'cashfree' AS provider, e.title AS event_title, b.num_people, NULL AS note, b.created_at
         FROM audience_bookings b LEFT JOIN events e ON e.id = b.event_id
       UNION ALL
       SELECT t.id, t.type AS kind, t.payer_name, t.payer_phone, NULL AS payer_email,
              t.amount, t.platform_fee, t.status, COALESCE(t.upi_utr, t.upi_order_id) AS reference,
              t.provider, e.title AS event_title, NULL AS num_people, t.note, t.created_at
         FROM artist_transactions t LEFT JOIN events e ON e.id = t.event_id
     ) ORDER BY created_at DESC LIMIT ?`,
    limit,
  )
}

export function listRefunds() {
  return all(
    `SELECT r.id, r.booking_id, r.user_email, r.reason, r.status, r.admin_notes, r.created_at, r.updated_at,
            b.name AS booker_name, b.phone AS booker_phone, b.total_amount AS amount,
            b.payment_status, b.payment_link_id, e.title AS event_title, e.date AS event_date
       FROM refund_requests r
       JOIN audience_bookings b ON b.id = r.booking_id
       LEFT JOIN events e ON e.id = b.event_id
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC`,
  )
}

export function listInquiries() {
  return all(
    `SELECT i.id, i.name, i.email, i.phone, i.inquiry_type, i.event_id, i.message, i.created_at,
            e.title AS event_title
       FROM inquiries i LEFT JOIN events e ON e.id = i.event_id
      ORDER BY i.created_at DESC`,
  )
}

export type RefundAction = "approve" | "reject" | "refund"

// Which statuses each action may start from, and where it leads.
const REFUND_TRANSITIONS: Record<RefundAction, { from: string[]; to: string }> = {
  approve: { from: ["pending"], to: "approved" },
  reject: { from: ["pending", "approved"], to: "rejected" },
  // Records that the money has gone back (issued in the Cashfree dashboard); marks the booking refunded.
  refund: { from: ["approved"], to: "refunded" },
}

export const isRefundAction = (a: unknown): a is RefundAction =>
  typeof a === "string" && Object.prototype.hasOwnProperty.call(REFUND_TRANSITIONS, a)

export type RefundUpdateResult = { ok: true; status: string } | { ok: false; status: 404 | 409; error: string }

export function updateRefund(id: string, action: RefundAction, notes?: string | null): RefundUpdateResult {
  const t = REFUND_TRANSITIONS[action]
  return transaction(() => {
    const row = get<{ status: string; booking_id: string }>("SELECT status, booking_id FROM refund_requests WHERE id = ?", id)
    if (!row) return { ok: false, status: 404, error: "Refund request not found." }
    if (!t.from.includes(row.status)) {
      return { ok: false, status: 409, error: `Can't ${action} a refund that is ${row.status}.` }
    }
    run(
      `UPDATE refund_requests
          SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
      t.to,
      notes?.trim() || null,
      id,
    )
    if (t.to === "refunded") run("UPDATE audience_bookings SET payment_status = 'refunded' WHERE id = ?", row.booking_id)
    return { ok: true, status: t.to }
  })
}

// ---------------------------------------------------------------------------
// Writes: events and accounts. Every caller has already checked requireRole("admin").

export type WriteResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; status: 400 | 404 | 409; error: string }

const bad = (error: string, status: 400 | 404 | 409 = 400) => ({ ok: false as const, status, error })
const text = (v: unknown, max = 2000) => {
  const s = String(v ?? "").trim().slice(0, max)
  return s || null
}

export interface EventInput {
  title?: unknown
  description?: unknown
  date?: unknown
  ticket_price?: unknown
  artist_id?: unknown
  venue_id?: unknown
  location_name?: unknown
  is_listed?: unknown
  artist_fee?: unknown
  advance_paid?: unknown
  fee_status?: unknown
}


/** Validates an event payload. With `partial`, only the fields present are checked and returned. */
function eventFields(b: EventInput, partial: boolean) {
  const out: Record<string, string | number | null> = {}
  const has = (k: keyof EventInput) => !partial || b[k] !== undefined

  if (has("title")) {
    const title = text(b.title, 160)
    if (!title) return bad("Give the event a title.")
    out.title = title
  }
  if (has("date")) {
    const d = new Date(String(b.date ?? ""))
    if (isNaN(d.getTime())) return bad("Pick a valid date and time.")
    out.date = d.toISOString()
    out.event_date_only = d.toISOString().slice(0, 10) // public listings filter on this
  }
  if (has("ticket_price")) {
    const price = b.ticket_price === "" || b.ticket_price == null ? 0 : Number(b.ticket_price)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return bad("Enter a valid ticket price.")
    out.ticket_price = Math.round(price * 100) / 100
  }
  if (has("description")) out.description = text(b.description)
  if (has("is_listed")) out.is_listed = b.is_listed === false || b.is_listed === 0 || b.is_listed === "0" || b.is_listed === "false" ? 0 : 1
  for (const k of ["artist_fee", "advance_paid"] as const) {
    if (!has(k)) continue
    const raw = b[k]
    if (raw === "" || raw == null) {
      out[k] = null
      continue
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return bad(k === "artist_fee" ? "Enter a valid artist fee." : "Enter a valid advance.")
    out[k] = Math.round(n * 100) / 100
  }
  if (has("fee_status")) {
    const st = text(b.fee_status, 20)
    if (st && !(FEE_STATUSES as readonly string[]).includes(st)) return bad("Fee status must be Pending, Advance Paid, Paid or Cancelled.")
    out.fee_status = st
  }
  if (has("artist_id")) {
    const id = text(b.artist_id, 100)
    if (id && !get("SELECT 1 FROM users WHERE id = ? AND role = 'artist'", id)) return bad("That artist doesn't exist.")
    out.artist_id = id
  }
  let venueName: string | null = null
  if (has("venue_id")) {
    const id = text(b.venue_id, 100)
    if (id) {
      venueName = get<{ name: string }>("SELECT name FROM users WHERE id = ? AND role = 'venue'", id)?.name ?? null
      if (!venueName) return bad("That venue doesn't exist.")
    }
    out.venue_id = id
  }
  if (has("location_name")) out.location_name = text(b.location_name, 200)
  // A venue with no typed location shows the venue's name on the public pages.
  if (venueName && !out.location_name && (!partial || b.location_name !== undefined)) out.location_name = venueName
  if (out.location_name !== undefined) {
    out.location_slug = out.location_name
      ? String(out.location_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
      : null
  }
  return { ok: true as const, fields: out }
}

export function createEvent(b: EventInput, createdBy: string): WriteResult {
  const v = eventFields(b, false)
  if (!v.ok) return v
  const id = crypto.randomUUID()
  const cols = Object.keys(v.fields)
  run(
    `INSERT INTO events (id, created_by, ${cols.join(", ")}) VALUES (?, ?, ${cols.map(() => "?").join(", ")})`,
    id,
    createdBy,
    ...cols.map((c) => v.fields[c]),
  )
  return { ok: true, id }
}

export function updateEvent(id: string, b: EventInput): WriteResult {
  if (!get("SELECT 1 FROM events WHERE id = ?", id)) return bad("Event not found.", 404)
  const v = eventFields(b, true)
  if (!v.ok) return v
  const cols = Object.keys(v.fields)
  if (!cols.length) return bad("Nothing to update.")
  run(`UPDATE events SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, ...cols.map((c) => v.fields[c]), id)
  return { ok: true, id }
}

/** Deleting cascades to bookings, so an event with paid tickets can't be deleted. */
export function deleteEvent(id: string): WriteResult {
  if (!get("SELECT 1 FROM events WHERE id = ?", id)) return bad("Event not found.", 404)
  const paid = get<{ n: number }>(`SELECT COUNT(*) AS n FROM audience_bookings WHERE event_id = ? AND ${PAID_TICKETS}`, id)?.n ?? 0
  if (paid) return bad(`This event has ${paid} paid booking${paid === 1 ? "" : "s"}. Refund them before deleting it.`, 409)
  run("DELETE FROM events WHERE id = ?", id)
  return { ok: true, id }
}

/** Single event with every field the edit form needs. */
export function getEvent(id: string) {
  return get(
    `SELECT id, title, description, date, ticket_price, artist_id, venue_id, location_name,
            is_listed, artist_fee, advance_paid, fee_status FROM events WHERE id = ?`,
    id,
  )
}

export type AccountRole = "artist" | "venue" | "promoter"
export const isAccountRole = (r: unknown): r is AccountRole => r === "artist" || r === "venue" || r === "promoter"

export interface AccountInput {
  name?: unknown
  email?: unknown
  phone?: unknown
  password?: unknown
  bio?: unknown
  instagram_handle?: unknown
  [field: string]: unknown
}

type FieldKind = ["text", number] | ["num"] | ["int"]
/** Extra profile columns each role can edit, beyond name/email/phone. */
export const PROFILE_FIELDS: Record<AccountRole, Record<string, FieldKind>> = {
  artist: {
    category: ["text", 160],
    city: ["text", 60],
    instruments: ["text", 200],
    rating: ["int"],
    reliability_score: ["num"],
    average_fee: ["num"],
    total_performances: ["int"],
    perf_with_m: ["int"],
    last_perf_date: ["text", 40],
    payment_status: ["text", 60],
    amount_paid: ["num"],
    amount_pending: ["num"],
    notes: ["text", 2000],
    payee_name: ["text", 120],
    bank_name: ["text", 120],
    account_number: ["text", 40],
    ifsc_code: ["text", 20],
    upi_id: ["text", 80],
    bank_details: ["text", 1000],
  },
  venue: {
    city: ["text", 60],
    address: ["text", 300],
    map_link: ["text", 500],
    poc_name: ["text", 120],
    poc_phone: ["text", 30],
    social_links: ["text", 500],
  },
  promoter: {},
}

function profileValue(kind: FieldKind, v: unknown): string | number | null {
  if (kind[0] === "text") return text(v, kind[1])
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""))
  if (!Number.isFinite(n)) return null
  return kind[0] === "int" ? Math.round(n) : n
}

/** The profile columns present in `b`, validated, as [column, value] pairs. */
function profileFields(role: AccountRole, b: AccountInput) {
  return Object.entries(PROFILE_FIELDS[role])
    .filter(([k]) => b[k] !== undefined)
    .map(([k, kind]) => [k, profileValue(kind, b[k])] as const)
}

export function createAccount(role: AccountRole, b: AccountInput): WriteResult<{ id: string; promoter_code: string | null }> {
  const name = text(b.name, 120)
  const email = String(b.email ?? "").trim().toLowerCase()
  const password = String(b.password ?? "")
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad("A name and valid email are required.")
  if (password.length < 8) return bad("Password must be at least 8 characters.")
  if (get("SELECT 1 FROM users WHERE email = ?", email)) return bad("An account with this email already exists.", 409)

  let code: string | null = null
  if (role === "promoter") {
    const stem = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "MUS"
    for (let i = 0; i < 20 && !code; i++) {
      const c = stem + Math.floor(100 + Math.random() * 900)
      if (!get("SELECT 1 FROM users WHERE promoter_code = ?", c)) code = c
    }
    if (!code) return bad("Couldn't generate a promoter code. Try again.", 409)
  }
  const handle = text(b.instagram_handle, 60)
  const id = crypto.randomUUID()
  run(
    `INSERT INTO users (id, name, email, phone, role, promoter_code, instagram_handle, bio, password_hash)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id,
    name,
    email,
    text(b.phone, 30),
    role,
    code,
    handle ? "@" + handle.replace(/^@+/, "") : null,
    text(b.bio, 600),
    hashPassword(password),
  )
  const extra = profileFields(role, b)
  if (extra.length) run(`UPDATE users SET ${extra.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, ...extra.map(([, v]) => v), id)
  return { ok: true, id, promoter_code: code }
}

/** Edits an artist, venue or promoter. A non-empty password resets it and signs them out. */
export function updateAccount(id: string, b: AccountInput): WriteResult {
  const user = get<{ role: string }>("SELECT role FROM users WHERE id = ?", id)
  if (!user || !isAccountRole(user.role)) return bad("Account not found.", 404)
  const sets: string[] = []
  const vals: (string | number | null)[] = []
  for (const [k, v] of profileFields(user.role, b)) sets.push(`${k} = ?`), vals.push(v)
  if (b.name !== undefined) {
    const name = text(b.name, 120)
    if (!name) return bad("Name can't be empty.")
    sets.push("name = ?"), vals.push(name)
  }
  if (b.email !== undefined) {
    const email = String(b.email ?? "").trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Enter a valid email.")
    if (get("SELECT 1 FROM users WHERE email = ? AND id <> ?", email, id)) return bad("Another account uses this email.", 409)
    sets.push("email = ?"), vals.push(email)
  }
  if (b.phone !== undefined) sets.push("phone = ?"), vals.push(text(b.phone, 30))
  if (b.bio !== undefined) sets.push("bio = ?"), vals.push(text(b.bio, 600))
  if (b.instagram_handle !== undefined) {
    const h = text(b.instagram_handle, 60)
    sets.push("instagram_handle = ?"), vals.push(h ? "@" + h.replace(/^@+/, "") : null)
  }
  const password = String(b.password ?? "")
  if (password) {
    if (password.length < 8) return bad("Password must be at least 8 characters.")
    sets.push("password_hash = ?"), vals.push(hashPassword(password))
  }
  if (!sets.length) return bad("Nothing to update.")
  transaction(() => {
    run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, ...vals, id)
    if (password) run("DELETE FROM sessions WHERE user_id = ?", id)
  })
  return { ok: true, id }
}

// ---------------------------------------------------------------------------
// Artists and the schedule

export function listArtists() {
  const now = new Date().toISOString()
  const pay = new Map(paymentSummary().byArtist.map((a) => [a.artist_id, a]))
  const rows = all(
    `SELECT u.id, u.name, u.email, u.phone, u.instagram_handle, u.bio, u.created_at,
            ${Object.keys(PROFILE_FIELDS.artist).map((k) => "u." + k).join(", ")},
            (SELECT COUNT(*) FROM events e WHERE e.artist_id = u.id AND ${NOT_CANCELLED}) AS gigs_total,
            (SELECT COUNT(*) FROM events e WHERE e.artist_id = u.id AND e.date >= ? AND ${NOT_CANCELLED}) AS gigs_upcoming,
            (SELECT MIN(e.date) FROM events e WHERE e.artist_id = u.id AND e.date >= ? AND ${NOT_CANCELLED}) AS next_gig,
            (SELECT COALESCE(SUM(t.amount), 0) FROM artist_transactions t WHERE t.artist_id = u.id AND t.status = 'paid') AS earnings,
            (SELECT COALESCE(SUM(t.amount - t.platform_fee), 0) FROM artist_transactions t
              WHERE t.artist_id = u.id AND t.status = 'paid' AND t.payout_status = 'owed') AS tips_owed
       FROM users u
      WHERE u.role = 'artist'
      ORDER BY next_gig IS NULL, next_gig, u.name`,
    now,
    now,
  )
  // Payment figures come from the gigs themselves, not the rollups imported from Hyphening.
  return rows.map((r) => ({ ...r, payments: pay.get(r.id) ?? null }))
}

/** Records that the artist has been paid their share of every Cashfree-collected tip and dedication. */
export function payOutArtistTips(artistId: string): WriteResult<{ id: string; paid_out: number; amount: number }> {
  if (!get("SELECT 1 FROM users WHERE id = ? AND role = 'artist'", artistId)) return { ok: false, status: 404, error: "Artist not found." }
  return transaction(() => {
    const amount =
      get<{ n: number }>(
        `SELECT COALESCE(SUM(amount - platform_fee), 0) AS n FROM artist_transactions
          WHERE artist_id = ? AND status = 'paid' AND payout_status = 'owed'`,
        artistId,
      )?.n ?? 0
    const r = run(
      "UPDATE artist_transactions SET payout_status = 'paid_out' WHERE artist_id = ? AND status = 'paid' AND payout_status = 'owed'",
      artistId,
    )
    return { ok: true as const, id: artistId, paid_out: Number(r.changes), amount }
  })
}

/** One artist's gigs that carry a fee, oldest first, for the payments dialog. */
export function artistGigs(artistId: string) {
  if (!get("SELECT 1 FROM users WHERE id = ? AND role = 'artist'", artistId)) return null
  const gigs = paymentGigs(artistId)
  return { gigs, summary: paymentSummary(gigs).byArtist[0] ?? null }
}

/** Marks every played, unpaid, not-cancelled gig of an artist as Paid. Returns how many changed. */
export function settleArtist(artistId: string): WriteResult<{ id: string; settled: number }> {
  if (!get("SELECT 1 FROM users WHERE id = ? AND role = 'artist'", artistId)) return bad("Artist not found.", 404)
  const r = run(
    `UPDATE events SET fee_status = 'Paid'
      WHERE artist_id = ? AND date <= ? AND artist_fee IS NOT NULL
        AND COALESCE(fee_status, 'Pending') IN ('Pending', 'Advance Paid')`,
    artistId,
    new Date().toISOString(),
  )
  return { ok: true, id: artistId, settled: Number(r.changes) }
}

/** The India calendar day of an ISO timestamp, which is how clashes are judged. */
export const istDay = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60e3).toISOString().slice(0, 10)

export interface ScheduleRow {
  id: string
  title: string
  date: string
  description: string | null
  ticket_price: number
  location_name: string | null
  artist_id: string | null
  artist_name: string | null
  venue_id: string | null
  venue_name: string | null
  is_listed: number
  artist_fee: number | null
  advance_paid: number | null
  fee_status: string | null
  tickets_sold: number
  day: string
  clashes: string[]
}

/**
 * Events from `from` onwards (default: start of today, India time), oldest first, each flagged
 * when its artist or venue has another event the same day, or it has no artist yet.
 */
export function listSchedule(from?: string, artistId?: string): ScheduleRow[] {
  const start = from && !isNaN(new Date(from).getTime()) ? new Date(from).toISOString() : `${istDay(new Date().toISOString())}T00:00:00+05:30`
  const rows = all<Omit<ScheduleRow, "day" | "clashes">>(
    `SELECT e.id, e.title, e.description, e.date, e.ticket_price, e.location_name, e.artist_id, a.name AS artist_name,
            e.venue_id, v.name AS venue_name, e.is_listed, e.artist_fee, e.advance_paid, e.fee_status,
            COALESCE((SELECT SUM(b.num_people) FROM audience_bookings b WHERE b.event_id = e.id AND b.${PAID_TICKETS}), 0) AS tickets_sold
       FROM events e
       LEFT JOIN users a ON a.id = e.artist_id
       LEFT JOIN users v ON v.id = e.venue_id
      WHERE e.date >= ?
      ORDER BY e.date`,
    new Date(start).toISOString(),
  ).map((r) => ({ ...r, day: istDay(r.date), clashes: [] as string[] }))

  const group = (key: (r: ScheduleRow) => string | null) => {
    const m = new Map<string, ScheduleRow[]>()
    for (const r of rows) {
      const k = key(r)
      if (k) m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.values()].filter((g) => g.length > 1)
  }
  const on = (r: ScheduleRow, k: string | null) => (r.fee_status === "Cancelled" ? null : k)
  for (const g of group((r) => on(r, r.artist_id ? `${r.artist_id}|${r.day}` : null)))
    for (const r of g) r.clashes.push(`${r.artist_name} has ${g.length} gigs this day`)
  for (const g of group((r) => on(r, r.venue_id ? `${r.venue_id}|${r.day}` : null)))
    for (const r of g) r.clashes.push(`${r.venue_name} hosts ${g.length} gigs this day`)
  for (const r of rows) if (!r.artist_id && r.fee_status !== "Cancelled") r.clashes.push("No artist booked")

  return artistId ? rows.filter((r) => r.artist_id === artistId) : rows
}

/** Small lists for the event form's pickers. */
export function pickers() {
  return {
    artists: all("SELECT id, name FROM users WHERE role = 'artist' ORDER BY name"),
    venues: all("SELECT id, name FROM users WHERE role = 'venue' ORDER BY name"),
  }
}
