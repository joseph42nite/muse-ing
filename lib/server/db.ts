import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import { hashPassword } from "./password"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('promoter','venue','admin','artist')),
  promoter_code TEXT UNIQUE,
  instagram_handle TEXT,
  avatar_url TEXT,
  bio TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  event_date_only TEXT,
  location_name TEXT,
  location_slug TEXT,
  artist_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  venue_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  ticket_price REAL NOT NULL DEFAULT 0,
  active_karaoke_Floor_video_id TEXT,
  active_song_request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS events_loc_date_idx ON events (location_slug, event_date_only);

CREATE TABLE IF NOT EXISTS song_batches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_phone TEXT,
  voter_token TEXT,
  wants_dedication INTEGER NOT NULL DEFAULT 0,
  dedicated_to TEXT,
  dedication_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS song_batches_event_idx ON song_batches (event_id);

CREATE TABLE IF NOT EXISTS song_requests (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES song_batches(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'audience_request'
    CHECK (source_type IN ('artist_playlist', 'audience_request')),
  choice_index INTEGER NOT NULL DEFAULT 1,
  song_title TEXT NOT NULL,
  original_artist TEXT,
  youtube_url TEXT,
  youtube_video_id TEXT,
  youtube_title TEXT,
  karaoke_candidates_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending_artist'
    CHECK (status IN ('pending_artist', 'confirmed', 'playing', 'played', 'declined')),
  upvotes INTEGER NOT NULL DEFAULT 0,
  wants_dedication INTEGER NOT NULL DEFAULT 0,
  dedicated_to TEXT,
  dedication_message TEXT,
  dedication_payment_status TEXT NOT NULL DEFAULT 'none'
    CHECK (dedication_payment_status IN ('none', 'awaiting_payment', 'pending_gateway', 'paid')),
  dedication_amount REAL NOT NULL DEFAULT 50,
  payment_link_id TEXT,
  payment_link_url TEXT,
  requester_name TEXT NOT NULL DEFAULT 'Artist Playlist',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS song_requests_event_idx ON song_requests (event_id, status);
CREATE INDEX IF NOT EXISTS song_requests_batch_idx ON song_requests (batch_id);
CREATE INDEX IF NOT EXISTS song_requests_link_idx ON song_requests (payment_link_id);

CREATE TABLE IF NOT EXISTS song_upvotes (
  request_id TEXT NOT NULL REFERENCES song_requests(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (request_id, voter_token)
);

CREATE TABLE IF NOT EXISTS audience_bookings (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  promoter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','cancelled','refunded')),
  payment_link_id TEXT,
  payment_link_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS bookings_event_idx ON audience_bookings (event_id, payment_status);
CREATE INDEX IF NOT EXISTS bookings_link_idx ON audience_bookings (payment_link_id);

CREATE TABLE IF NOT EXISTS venue_checkins (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  audience_phone TEXT NOT NULL,
  checkin_time TEXT NOT NULL,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS checkins_event_idx ON venue_checkins (event_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES audience_bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS karaoke_cache (
  normalized_key TEXT PRIMARY KEY,
  song_title TEXT NOT NULL,
  original_artist TEXT,
  primary_video_id TEXT NOT NULL,
  primary_title TEXT,
  candidates_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES audience_bookings(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','refunded')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS artist_transactions (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  request_id TEXT REFERENCES song_requests(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'dedication' CHECK (type IN ('dedication', 'tip')),
  payer_name TEXT NOT NULL,
  payer_phone TEXT,
  amount REAL NOT NULL,
  song_title TEXT,
  note TEXT,
  upi_order_id TEXT,
  upi_utr TEXT,
  provider TEXT NOT NULL DEFAULT 'upipay',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS artist_tx_artist_idx ON artist_transactions (artist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  inquiry_type TEXT NOT NULL DEFAULT 'general',
  event_id TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`

// Columns added after the first release. ALTER TABLE ADD COLUMN fails if the column exists,
// which is how already-migrated databases skip them.
const ADDED_COLUMNS = [
  "ALTER TABLE song_requests ADD COLUMN karaoke_candidates_json TEXT",
  "ALTER TABLE users ADD COLUMN upi_id TEXT",
  "ALTER TABLE users ADD COLUMN payee_name TEXT",
  "ALTER TABLE users ADD COLUMN bank_name TEXT",
  "ALTER TABLE users ADD COLUMN account_number TEXT",
  "ALTER TABLE users ADD COLUMN ifsc_code TEXT",
  "ALTER TABLE users ADD COLUMN upipay_provider TEXT DEFAULT 'upi_direct'",
  "ALTER TABLE users ADD COLUMN upipay_merchant_id TEXT",
  "ALTER TABLE events ADD COLUMN playback_position REAL",
  "ALTER TABLE events ADD COLUMN playback_playing INTEGER DEFAULT 0",
  "ALTER TABLE events ADD COLUMN playback_updated_at INTEGER",
  // Artist roster and venue details (imported from Hyphening, editable in the admin panel).
  "ALTER TABLE users ADD COLUMN category TEXT",
  "ALTER TABLE users ADD COLUMN city TEXT",
  "ALTER TABLE users ADD COLUMN instruments TEXT",
  "ALTER TABLE users ADD COLUMN rating INTEGER",
  "ALTER TABLE users ADD COLUMN notes TEXT",
  "ALTER TABLE users ADD COLUMN reliability_score REAL",
  "ALTER TABLE users ADD COLUMN average_fee REAL",
  "ALTER TABLE users ADD COLUMN total_performances INTEGER",
  "ALTER TABLE users ADD COLUMN perf_with_m INTEGER",
  "ALTER TABLE users ADD COLUMN last_perf_date TEXT",
  "ALTER TABLE users ADD COLUMN payment_status TEXT",
  "ALTER TABLE users ADD COLUMN amount_paid REAL",
  "ALTER TABLE users ADD COLUMN amount_pending REAL",
  "ALTER TABLE users ADD COLUMN bank_details TEXT",
  "ALTER TABLE users ADD COLUMN address TEXT",
  "ALTER TABLE users ADD COLUMN map_link TEXT",
  "ALTER TABLE users ADD COLUMN poc_name TEXT",
  "ALTER TABLE users ADD COLUMN poc_phone TEXT",
  "ALTER TABLE users ADD COLUMN social_links TEXT",
  "ALTER TABLE users ADD COLUMN external_ref TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_external_ref_idx ON users (external_ref)",
  // Gig bookkeeping. is_listed = 0 keeps an event off the public gig list and search.
  "ALTER TABLE events ADD COLUMN is_listed INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE events ADD COLUMN artist_fee REAL",
  "ALTER TABLE events ADD COLUMN advance_paid REAL",
  "ALTER TABLE events ADD COLUMN fee_status TEXT",
  "ALTER TABLE events ADD COLUMN external_ref TEXT",
  "ALTER TABLE events ADD COLUMN external_snapshot TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS events_external_ref_idx ON events (external_ref)",
]

// Bump when SCHEMA or ADDED_COLUMNS change so a dev server's cached connection re-migrates.
const SCHEMA_VERSION = 8

// One-time data fixes, each applied once per database and recorded in app_migrations.
const DATA_MIGRATIONS: { id: string; sql: string }[] = [
  {
    // Hyphening gigs were first imported hidden from the website. Gigs show by default now.
    id: "2026-11-list-imported-gigs",
    sql: `UPDATE events SET is_listed = 1
           WHERE external_ref LIKE 'hyphening:gig:%' AND is_listed = 0 AND COALESCE(fee_status, '') <> 'Cancelled'`,
  },
]

function migrate(conn: DatabaseSync) {
  conn.exec(SCHEMA)
  for (const sql of ADDED_COLUMNS) {
    try {
      conn.exec(sql)
    } catch {
      // column already exists
    }
  }
  conn.exec("CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
  for (const m of DATA_MIGRATIONS) {
    if (conn.prepare("SELECT 1 FROM app_migrations WHERE id = ?").get(m.id)) continue
    conn.exec("BEGIN")
    try {
      conn.exec(m.sql)
      conn.prepare("INSERT INTO app_migrations (id, applied_at) VALUES (?, ?)").run(m.id, new Date().toISOString())
      conn.exec("COMMIT")
    } catch (e) {
      conn.exec("ROLLBACK")
      throw e
    }
  }
}

/**
 * Demo data is on by default in development and off in production, so a live deployment never
 * ships the demo artist logins or their placeholder bank details. Override with SEED_DEMO_DATA=true|false.
 */
function shouldSeedDemoData() {
  const flag = process.env.SEED_DEMO_DATA
  if (flag === "true") return true
  if (flag === "false") return false
  return process.env.NODE_ENV !== "production"
}

type Row = SQLInputValue[]

function seedDemoData(conn: DatabaseSync) {
  if (conn.prepare("SELECT 1 FROM users WHERE email = ?").get("artist@museing.com")) return

  const day = (offset: number) => new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10)
  const today = day(0)
  const tomorrow = day(1)
  const nextWeek = day(5)
  const ARJUN = "artist-arjun-01"
  const MAYA = "artist-maya-02"
  const KABIR = "artist-kabir-03"
  const TONIGHT = "gig-koramangala-tonight"
  const BANDRA = "gig-bandra-tonight"
  const demoPassword = hashPassword("artist123")
  const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&auto=format&fit=crop&q=80`

  const users: Row[] = [
    [ARJUN, "Arjun Mehta & The Midnight Collective", "artist@museing.com", "9876543210", "@arjunmehtalive", unsplash("1511671782779-c97d3d27a1d4"), "Indie-pop & acoustic soul vocalist performing live crowd-curated sets across Bengaluru & Mumbai."],
    [MAYA, "Maya Sen", "maya@museing.com", "9876543211", "@mayasenmusic", unsplash("1516450360452-9312f5e86fc7"), "Neo-bollywood, retro classics & unplugged acoustic requests."],
    [KABIR, "Kabir & The Neon Strings", "kabir@museing.com", "9876543212", "@kabirneonstrings", unsplash("1493225457124-a3eb161ffa5f"), "High-energy rock, pop anthems & interactive sing-along nights."],
  ]

  // id, title, description, date, date only, location, slug, artist, price, karaoke video
  const events: Row[] = [
    [TONIGHT, "Unplugged Crowd Request Night", "Browse Arjun's live setlist, upvote the songs you want next, submit 3 song suggestions, or dedicate a song with a ₹50 live shoutout!", `${today}T20:30:00.000Z`, today, "Toit Brewhouse, Indiranagar • Bengaluru", "toit-indiranagar", ARJUN, 499, "sFMRqxCexDk"],
    [BANDRA, "Bollywood & Retro Sing-Along Live", "Interactive acoustic evening where every song on the setlist is upvoted and shaped by the audience.", `${today}T20:30:00.000Z`, today, "The Quarter, Royal Opera House • Mumbai", "the-quarter-mumbai", MAYA, 699, null],
    ["gig-indiranagar-tomorrow", "Saturday Arena Anthems & Dedications", "Electric acoustic mashups, live LED karaoke lyrics, and crowd dedications all night.", `${tomorrow}T21:00:00.000Z`, tomorrow, "Hard Rock Cafe, Koregaon Park • Pune", "hard-rock-pune", KABIR, 599, null],
    ["gig-arjun-saturday", "Saturday Rooftop Acoustic & Dedications", "Live acoustic requests, crowd sing-alongs, and UPIPay instant dedications.", `${tomorrow}T21:00:00.000Z`, tomorrow, "Windmills Craftworks, Whitefield • Bengaluru", "windmills-whitefield", ARJUN, 799, null],
    ["gig-arjun-friday-next", "Midnight Indie & Sufi Unplugged", "Intimate unplugged setlist powered by audience upvotes.", `${nextWeek}T20:30:00.000Z`, nextWeek, "Fandom at Gilly's Redefined, Koramangala • Bengaluru", "fandom-koramangala", ARJUN, 599, null],
  ]

  // id, event, requester, phone, voter token, wants dedication, dedicated to, message
  const batches: Row[] = [
    ["batch-demo-1", TONIGHT, "Rohan Verma", "9820112233", "seed-voter-1", 1, "Ananya (Happy Anniversary!)", "Please call out Ananya & Rohan's 3rd anniversary before singing this!"],
    ["batch-demo-2", TONIGHT, "Sneha & Table 7", "9811223344", "seed-voter-2", 1, "Vikram (Birthday Boy!)", "It's Vikram's 25th birthday at Table 7!"],
    ["batch-demo-3", TONIGHT, "Devika Nair", "9900112233", "seed-voter-3", 0, null, null],
    ["batch-demo-4", TONIGHT, "Aarav Patel", "9845012345", "seed-voter-4", 1, "Meera", "Dedicated to Meera!"],
    ["batch-demo-5", TONIGHT, "Priya Sharma (Table 4)", "9731098765", "seed-voter-5", 1, "Karthik & Priya", "Our first date song! Will pay ₹50 as soon as you confirm!"],
    ["batch-demo-6", TONIGHT, "Siddharth & Friends", "9880011223", "seed-voter-6", 0, null, null],
  ]

  const yt = (id: string) => [`https://www.youtube.com/watch?v=${id}`, id]
  const playlist = (id: string, event: string, title: string, artist: string, video: string, upvotes: number): Row =>
    [id, null, event, "artist_playlist", 1, title, artist, ...yt(video), "confirmed", upvotes, 0, null, null, "none", "Artist Playlist"]
  const ask = (id: string, batch: string, choice: number, title: string, artist: string, video: string | null, status: string, upvotes: number, wants: number, to: string | null, msg: string | null, pay: string, requester: string): Row =>
    [id, batch, TONIGHT, "audience_request", choice, title, artist, ...(video ? yt(video) : [null, null]), status, upvotes, wants, to, msg, pay, requester]

  const priya = "Our first date song! Will pay ₹50 as soon as you confirm!"
  const requests: Row[] = [
    playlist("playlist-arjun-1", TONIGHT, "gul", "Anuv Jain", "SmaY7RfB6b0", 27),
    playlist("playlist-arjun-2", TONIGHT, "Mitwa", "Shafqat Amanat Ali (Kabhi Alvida Naa Kehna)", "ru_5PA8cwkE", 19),
    playlist("playlist-arjun-3", TONIGHT, "Counting Stars", "OneRepublic", "hT_nvWreIhg", 15),
    playlist("playlist-arjun-4", TONIGHT, "Kun Faya Kun", "A.R. Rahman, Javed Ali, Mohit Chauhan", "T94PHkuydcw", 34),
    playlist("playlist-maya-1", BANDRA, "Lag Jaa Gale", "Lata Mangeshkar", "TFr6G5zveS8", 29),
    playlist("playlist-maya-2", BANDRA, "Agar Tum Saath Ho", "Alka Yagnik & Arijit Singh", "sK7riqg2mr4", 21),
    // Paid dedications (priority section)
    ask("req-demo-1a", "batch-demo-1", 1, "Kesariya", "Arijit Singh", "sFMRqxCexDk", "confirmed", 18, 1, "Ananya (Happy Anniversary!)", "Please call out Ananya & Rohan's 3rd anniversary before singing this!", "paid", "Rohan Verma"),
    ask("req-demo-1b", "batch-demo-1", 2, "Tum Se Hi", "Mohit Chauhan", null, "declined", 0, 1, "Ananya", null, "none", "Rohan Verma"),
    ask("req-demo-1c", "batch-demo-1", 3, "Raabta", "Arijit Singh", null, "declined", 0, 1, "Ananya", null, "none", "Rohan Verma"),
    ask("req-demo-2a", "batch-demo-2", 1, "Yellow", "Coldplay", "1G4isv_Fylg", "confirmed", 14, 1, "Vikram (Birthday Boy!)", "It's Vikram's 25th birthday at Table 7!", "paid", "Sneha & Table 7"),
    ask("req-demo-2b", "batch-demo-2", 2, "Fix You", "Coldplay", null, "declined", 0, 1, "Vikram", null, "none", "Sneha & Table 7"),
    ask("req-demo-2c", "batch-demo-2", 3, "Viva La Vida", "Coldplay", null, "declined", 0, 1, "Vikram", null, "none", "Sneha & Table 7"),
    // Confirmed crowd queue
    ask("req-demo-3a", "batch-demo-3", 1, "Channa Mereya", "Arijit Singh", "284Ov7ysmfA", "confirmed", 31, 0, null, null, "none", "Devika Nair"),
    ask("req-demo-3b", "batch-demo-3", 2, "Kabira", "Tochi Raina", null, "declined", 0, 0, null, null, "none", "Devika Nair"),
    ask("req-demo-3c", "batch-demo-3", 3, "Ilahi", "Arijit Singh", null, "declined", 0, 0, null, null, "none", "Devika Nair"),
    // Confirmed by the artist, dedication still awaiting payment
    ask("req-demo-4a", "batch-demo-4", 1, "Perfect", "Ed Sheeran", "2Vv-BfVoq4g", "confirmed", 22, 1, "Meera", "Dedicated to Meera!", "awaiting_payment", "Aarav Patel"),
    ask("req-demo-4b", "batch-demo-4", 2, "Thinking Out Loud", "Ed Sheeran", null, "declined", 0, 1, "Meera", null, "none", "Aarav Patel"),
    ask("req-demo-4c", "batch-demo-4", 3, "Photograph", "Ed Sheeran", null, "declined", 0, 1, "Meera", null, "none", "Aarav Patel"),
    // Waiting for the artist to pick one of three
    ask("req-demo-5a", "batch-demo-5", 1, "Tera Ban Jaunga", "Akhil Sachdeva", null, "pending_artist", 0, 1, "Karthik & Priya", priya, "none", "Priya Sharma (Table 4)"),
    ask("req-demo-5b", "batch-demo-5", 2, "Pehla Nasha", "Udit Narayan", null, "pending_artist", 0, 1, "Karthik & Priya", priya, "none", "Priya Sharma (Table 4)"),
    ask("req-demo-5c", "batch-demo-5", 3, "Wonderwall", "Oasis", null, "pending_artist", 0, 1, "Karthik & Priya", priya, "none", "Priya Sharma (Table 4)"),
    ask("req-demo-6a", "batch-demo-6", 1, "Dil Chahta Hai", "Shankar-Ehsaan-Loy", null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends"),
    ask("req-demo-6b", "batch-demo-6", 2, "Senorita (ZNMD)", "Farhan Akhtar", null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends"),
    ask("req-demo-6c", "batch-demo-6", 3, "Summer of '69", "Bryan Adams", null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends"),
  ]

  // id, request, type, payer, phone, amount, song, note, order id, utr
  const transactions: Row[] = [
    ["tx-demo-1", "req-demo-1a", "dedication", "Rohan Verma", "9820112233", 50, "Kesariya", "Dedicated to Ananya (Happy Anniversary!)", "UPIPAY_DED_1001", "429518293012"],
    ["tx-demo-2", "req-demo-2a", "dedication", "Sneha & Table 7", "9811223344", 50, "Yellow", "Dedicated to Vikram (Birthday Boy!)", "UPIPAY_DED_1002", "429519847105"],
    ["tx-demo-3", null, "tip", "Kabir & Table 3", "9845099887", 200, null, "Amazing acoustic rendition of Kun Faya Kun!", "UPIPAY_TIP_1003", "429520491823"],
  ]

  const insertAll = (sql: string, rows: Row[]) => {
    const stmt = conn.prepare(sql)
    for (const r of rows) stmt.run(...r)
  }

  conn.exec("BEGIN")
  try {
    insertAll(
      `INSERT OR IGNORE INTO users (id, name, email, phone, role, instagram_handle, avatar_url, bio, password_hash)
       VALUES (?, ?, ?, ?, 'artist', ?, ?, ?, ?)`,
      users.map((u) => [...u, demoPassword])
    )
    conn
      .prepare(
        `UPDATE users SET upi_id = 'arjunmehta@ybl', payee_name = 'Arjun Mehta Live', bank_name = 'HDFC Bank • Indiranagar',
                          account_number = '5010048291034', ifsc_code = 'HDFC0000142', upipay_provider = 'upi_direct'
          WHERE id = ?`
      )
      .run(ARJUN)
    insertAll(
      `INSERT OR IGNORE INTO events
        (id, title, description, date, event_date_only, location_name, location_slug, artist_id, ticket_price, active_karaoke_Floor_video_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      events
    )
    insertAll(
      `INSERT OR IGNORE INTO song_batches
        (id, event_id, requester_name, requester_phone, voter_token, wants_dedication, dedicated_to, dedication_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      batches
    )
    insertAll(
      `INSERT OR IGNORE INTO song_requests
        (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, youtube_url, youtube_video_id, status, upvotes, wants_dedication, dedicated_to, dedication_message, dedication_payment_status, requester_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      requests
    )
    insertAll(
      `INSERT OR IGNORE INTO artist_transactions
        (id, artist_id, event_id, request_id, type, payer_name, payer_phone, amount, song_title, note, upi_order_id, upi_utr, provider, status)
       VALUES (?, '${ARJUN}', '${TONIGHT}', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upipay', 'paid')`,
      transactions
    )
    conn.exec("COMMIT")
  } catch (e) {
    conn.exec("ROLLBACK")
    throw e
  }
}

const g = globalThis as unknown as { __museDb?: DatabaseSync; __museDbVersion?: number }

// Single shared connection (survives Next.js dev hot reloads).
export function db(): DatabaseSync {
  if (!g.__museDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "muse.db")
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const conn = new DatabaseSync(file)
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
    g.__museDb = conn
  }
  if (g.__museDbVersion !== SCHEMA_VERSION) {
    migrate(g.__museDb)
    if (shouldSeedDemoData()) seedDemoData(g.__museDb)
    g.__museDbVersion = SCHEMA_VERSION
  }
  return g.__museDb
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db().prepare(sql).all(...params) as T[]
}
export function get<T = any>(sql: string, ...params: any[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined
}
export function run(sql: string, ...params: any[]) {
  return db().prepare(sql).run(...params)
}

/** Runs fn inside a single transaction; rolls back if it throws. fn must be synchronous. */
export function transaction<T>(fn: () => T): T {
  const conn = db()
  conn.exec("BEGIN IMMEDIATE")
  try {
    const out = fn()
    conn.exec("COMMIT")
    return out
  } catch (e) {
    conn.exec("ROLLBACK")
    throw e
  }
}
