// Upserts Hyphening curation venues and artists into the Muse-ing database, reading the JSON that
// scripts/hyphening-export.mjs prints on stdin. Matches on users.external_ref, so re-running updates
// instead of duplicating. New accounts get an unusable random password: set one in the admin panel
// (Artists / Venues → click the row) to let someone sign in. Add --dry-run to preview without writing.
import { DatabaseSync } from "node:sqlite"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const dry = process.argv.includes("--dry-run")
const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "muse.db")
if (!fs.existsSync(file)) throw new Error(`Database not found at ${file}`)
const input = JSON.parse(fs.readFileSync(0, "utf8"))
const db = new DatabaseSync(file)

const clean = (v, max = 2000) => {
  const s = String(v ?? "").trim()
  return s ? s.slice(0, max) : null
}
const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : null
}
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(String(e ?? "").trim())
const unusablePassword = () => {
  const salt = crypto.randomBytes(16)
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(crypto.randomBytes(32), salt, 64).toString("hex")}`
}
const handleFrom = (link) => {
  const s = clean(link, 300)
  if (!s) return null
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  const h = m ? m[1] : !s.includes("/") ? s.replace(/^@+/, "") : null
  return h ? "@" + h : null
}

/** Pulls structured fields out of bank details, which Hyphening stores as free text. */
export function parseBank(raw) {
  if (!raw) return {}
  if (typeof raw === "object") {
    const pick = (...ks) => clean(ks.map((k) => raw[k]).find((v) => v))
    return {
      text: clean(
        Object.entries(raw)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
        1000,
      ),
      payee_name: pick("account_holder", "holder_name", "payee_name", "name"),
      account_number: pick("account_number", "account_no", "acc_no"),
      ifsc_code: pick("ifsc", "ifsc_code"),
      bank_name: pick("bank_name", "bank"),
      upi_id: pick("upi_id", "upi"),
    }
  }
  const t = String(raw).replace(/\*/g, "")
  const grab = (re) => {
    const m = t.match(re)
    return m ? clean(m[1], 120) : null
  }
  // Labels seen in the roster: "A/C NO:", "ACC NO. -", "Acc no:", "Ac 123…", "Account number :-", "Bank account-".
  const acct = grab(
    /\b(?:bank[ \t]+account|a\/?c|acc(?:ount)?)\b\.?[ \t]*(?:no|number|num)?\.?[ \t]*[:–-]*[ \t]*([0-9][0-9 ]{7,24}[0-9])/i,
  )
  return {
    text: clean(String(raw), 1000),
    payee_name: grab(
      /(?:account[ \t]*holder(?:'?s)?(?:[ \t]*name)?|a\/?c[ \t]*holder(?:[ \t]*name)?|holder(?:'?s)?[ \t]*name|beneficiary(?:[ \t]*name)?|payee(?:[ \t]*name)?)[ \t]*[:–-]+[ \t]*([^\n,]+)/i,
    ),
    account_number: acct ? acct.replace(/\s+/g, "") : null,
    ifsc_code: grab(/ifsc(?:[ \t]*code)?[ \t]*[:–-]*[ \t]*([A-Za-z]{4}0[A-Za-z0-9]{6})/i)?.toUpperCase() ?? null,
    bank_name: grab(/\bbank(?:[ \t]*name)?[ \t]*[:–-]+[ \t]*([^\n,]+)/i),
    upi_id: grab(/\b([A-Za-z0-9._-]{2,}@[A-Za-z]{2,})\b/),
  }
}

const byRef = db.prepare("SELECT id FROM users WHERE external_ref = ?")
const byEmail = db.prepare("SELECT id, role, external_ref FROM users WHERE email = ?")
const emailTaken = (email) => !!byEmail.get(email)
const report = { created: [], linked: [], updated: [] }
const idByRef = new Map()

function upsert(role, ref, name, preferredEmail, fallbackEmail, fields) {
  let id = byRef.get(ref)?.id
  let action = "updated"
  if (!id && preferredEmail) {
    // Link an account made by hand with the same email and role instead of duplicating it.
    const u = byEmail.get(preferredEmail)
    if (u && u.role === role && !u.external_ref) {
      id = u.id
      action = "linked"
    }
  }
  if (!id) {
    action = "created"
    id = crypto.randomUUID()
    let email = preferredEmail && !emailTaken(preferredEmail) ? preferredEmail : fallbackEmail
    for (let i = 2; emailTaken(email); i++) email = fallbackEmail.replace("@", `-${i}@`)
    if (!dry)
      db.prepare("INSERT INTO users (id, name, email, role, password_hash, external_ref) VALUES (?,?,?,?,?,?)").run(
        id,
        name,
        email,
        role,
        unusablePassword(),
        ref,
      )
    report.created.push(`${role}: ${name} <${email}>`)
  } else {
    report[action].push(`${role}: ${name}`)
  }
  idByRef.set(ref, id)
  if (!dry) {
    const cols = [["name", name], ["external_ref", ref], ...Object.entries(fields)]
    db.prepare(`UPDATE users SET ${cols.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
      ...cols.map(([, v]) => v),
      id,
    )
  }
}

// Gigs become Muse events. Hyphening only stores the day, so new gigs start at 8pm India time and
// are created off the public site (is_listed = 0). Each event remembers what was last imported
// (external_snapshot). On a re-run a field is only updated if it still holds that value, so anything
// changed in the admin panel (a payment status, fee, artist, time…) is kept. A gig cancelled in
// Hyphening is marked Cancelled here, never deleted.
const gigReport = { created: 0, updated: 0, unchanged: 0, kept: 0, skipped: [] }
const CITY = { blr: "Bengaluru", bangalore: "Bengaluru", bengaluru: "Bengaluru", mum: "Mumbai", mumbai: "Mumbai" }
const userId = (ref) => idByRef.get(ref) ?? byRef.get(ref)?.id ?? null
const istDay = (iso) => new Date(new Date(iso).getTime() + 330 * 60e3).toISOString().slice(0, 10)
const STATUS = { paid: "Paid", pending: "Pending", "advance paid": "Advance Paid", cancelled: "Cancelled" }
const SYNCED = ["artist_id", "venue_id", "artist_fee", "advance_paid", "fee_status", "day"]

function importGigs(gigs) {
  const eventByRef = db.prepare(
    "SELECT id, date, artist_id, venue_id, artist_fee, advance_paid, fee_status, external_snapshot FROM events WHERE external_ref = ?",
  )
  for (const g of gigs) {
    const ref = `hyphening:gig:${g.id}`
    const existing = eventByRef.get(ref)
    const label = `${g.gig_date} ${g.artist_name ?? "?"} @ ${g.venue_name ?? "?"}`
    const status = STATUS[String(g.status ?? "").trim().toLowerCase()] ?? "Pending"
    if (!existing && status === "Cancelled") continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.gig_date ?? ""))) {
      gigReport.skipped.push(`${label}: no valid date`)
      continue
    }
    const incoming = {
      artist_id: g.artist_code ? userId(`hyphening:artist:${g.artist_code}`) : null,
      venue_id: g.venue_client_id ? userId(`hyphening:client:${g.venue_client_id}`) : null,
      artist_fee: num(g.fee_inr),
      advance_paid: num(g.advance_paid),
      fee_status: status,
      day: g.gig_date,
    }
    const snapshot = JSON.stringify(incoming)

    if (existing) {
      const current = { ...existing, day: istDay(existing.date) }
      // No snapshot yet (imported before snapshots existed): treat what's there as the last import.
      const last = existing.external_snapshot ? JSON.parse(existing.external_snapshot) : current
      const cols = []
      for (const k of SYNCED) {
        if (incoming[k] === (current[k] ?? null)) continue
        if ((current[k] ?? null) !== (last[k] ?? null)) {
          gigReport.kept++ // changed in Muse since the last import: keep it
          continue
        }
        if (k === "day") cols.push(["date", `${incoming.day}T14:30:00.000Z`], ["event_date_only", incoming.day])
        else cols.push([k, incoming[k]])
      }
      cols.push(["external_snapshot", snapshot])
      if (!dry)
        db.prepare(`UPDATE events SET ${cols.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`).run(...cols.map(([, v]) => v), existing.id)
      if (cols.length > 1) gigReport.updated++
      else gigReport.unchanged++
      continue
    }
    const venueName = clean(g.venue_name, 120) ?? "Venue"
    const city = CITY[String(g.venue_city ?? "").trim().toLowerCase()] ?? clean(g.venue_city, 60)
    const location = city ? `${venueName} • ${city}` : venueName
    const { day, ...fields } = incoming
    const row = {
      id: crypto.randomUUID(),
      title: clean(`${g.artist_name ? `${String(g.artist_name).trim()} live` : "Live"} at ${venueName}`, 160),
      date: `${day}T14:30:00.000Z`, // 8:00pm IST
      event_date_only: day,
      location_name: location,
      location_slug: slug(location).slice(0, 80),
      ticket_price: 0,
      is_listed: 0,
      external_ref: ref,
      external_snapshot: snapshot,
      ...fields,
    }
    if (!dry) {
      const cols = Object.keys(row)
      db.prepare(`INSERT INTO events (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((k) => row[k]))
    }
    gigReport.created++
  }
}

db.exec("BEGIN")
try {
  for (const { client, venue } of input.venues ?? []) {
    const name = clean(venue?.name ?? client.name, 120)
    const email = validEmail(venue?.poc_email) ? venue.poc_email.trim().toLowerCase() : null
    upsert("venue", `hyphening:client:${client.id}`, name, email, `${slug(name)}@venues.muse-ing.in`, {
      phone: clean(venue?.poc_phone, 30),
      city: clean(venue?.city, 60),
      address: clean(venue?.address, 300),
      map_link: clean(venue?.map_link, 500),
      poc_name: clean(venue?.poc_name, 120),
      poc_phone: clean(venue?.poc_phone, 30),
      social_links: clean(venue?.social_links, 500),
    })
  }
  for (const a of input.artists ?? []) {
    const name = clean(a.name, 120)
    const email = validEmail(a.email) ? a.email.trim().toLowerCase() : null
    const bank = parseBank(a.bank_details)
    const rating = num(a.rating)
    upsert("artist", `hyphening:artist:${a.artist_id}`, name, email, `${slug(a.artist_id)}@artists.muse-ing.in`, {
      phone: clean(a.phone, 30),
      category: clean(a.category, 160),
      city: clean(a.city, 60),
      instruments: clean(a.instruments, 200),
      instagram_handle: handleFrom(a.insta_link),
      bio: clean(a.description, 600),
      rating: rating === null ? null : Math.round(rating),
      reliability_score: num(a.reliability_score),
      average_fee: num(a.average_fee_inr),
      total_performances: num(a.total_performances),
      perf_with_m: num(a.perf_with_m),
      last_perf_date: clean(a.last_perf_date, 40),
      payment_status: clean(a.payment_status, 60),
      amount_paid: num(a.total_amount_paid_inr),
      amount_pending: num(a.total_amount_pending_inr),
      notes: clean(a.notes, 2000),
      bank_details: bank.text ?? null,
      // Most rosters omit the holder line; the account is usually in the artist's own name.
      payee_name: bank.payee_name ?? (bank.text ? name : null),
      bank_name: bank.bank_name ?? null,
      account_number: bank.account_number ?? null,
      ifsc_code: bank.ifsc_code ?? null,
      upi_id: bank.upi_id ?? null,
    })
  }
  importGigs(input.gigs ?? [])
  db.exec(dry ? "ROLLBACK" : "COMMIT")
} catch (e) {
  db.exec("ROLLBACK")
  throw e
}

const withBank = (input.artists ?? []).filter((a) => a.bank_details).length
if (input.gigs)
  console.log(
    `gigs ${input.gigs.length}: ${gigReport.created} created, ${gigReport.updated} updated, ${gigReport.unchanged} unchanged, ${gigReport.kept} Muse edits kept, ${gigReport.skipped.length} skipped`,
  )
for (const s of gigReport.skipped) console.log(`  skipped: ${s}`)
console.log(
  `${dry ? "[dry run] " : ""}venues ${input.venues?.length ?? 0}, artists ${input.artists?.length ?? 0} (${withBank} with bank details)`,
)
for (const k of ["created", "linked", "updated"]) if (report[k].length) console.log(`${k}:\n  ${report[k].join("\n  ")}`)
