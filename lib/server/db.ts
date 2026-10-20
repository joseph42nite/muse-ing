import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

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
`

function hashPw(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

function seedIfNeeded(conn: DatabaseSync) {
  const existingArtist = conn.prepare("SELECT id FROM users WHERE email = ?").get("artist@museing.com") as { id: string } | undefined
  if (existingArtist) return

  const todayDateOnly = new Date().toISOString().slice(0, 10)
  const tonightIso = `${todayDateOnly}T20:30:00.000Z`
  const tomorrowDateOnly = new Date(Date.now() + 86400e3).toISOString().slice(0, 10)
  const tomorrowIso = `${tomorrowDateOnly}T21:00:00.000Z`

  const artist1Id = "artist-arjun-01"
  const artist2Id = "artist-maya-02"
  const artist3Id = "artist-kabir-03"
  const defaultPw = hashPw("artist123")

  const insertUser = conn.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, phone, role, instagram_handle, avatar_url, bio, password_hash)
     VALUES (?, ?, ?, ?, 'artist', ?, ?, ?, ?)`
  )

  insertUser.run(
    artist1Id,
    "Arjun Mehta & The Midnight Collective",
    "artist@museing.com",
    "9876543210",
    "@arjunmehtalive",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80",
    "Indie-pop & acoustic soul vocalist performing live crowd-curated sets across Bengaluru & Mumbai.",
    defaultPw
  )

  insertUser.run(
    artist2Id,
    "Maya Sen",
    "maya@museing.com",
    "9876543211",
    "@mayasenmusic",
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80",
    "Neo-bollywood, retro classics & unplugged acoustic requests.",
    defaultPw
  )

  insertUser.run(
    artist3Id,
    "Kabir & The Neon Strings",
    "kabir@museing.com",
    "9876543212",
    "@kabirneonstrings",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80",
    "High-energy rock, pop anthems & interactive sing-along nights.",
    defaultPw
  )

  const event1Id = "gig-koramangala-tonight"
  const event2Id = "gig-bandra-tonight"
  const event3Id = "gig-indiranagar-tomorrow"

  const insertEvent = conn.prepare(
    `INSERT OR IGNORE INTO events
      (id, title, description, date, event_date_only, location_name, location_slug, artist_id, ticket_price, active_karaoke_Floor_video_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  insertEvent.run(
    event1Id,
    "Unplugged Crowd Request Night",
    "Browse Arjun's live setlist, upvote the songs you want next, submit 3 song suggestions, or dedicate a song with a ₹50 live shoutout!",
    tonightIso,
    todayDateOnly,
    "Toit Brewhouse, Indiranagar • Bengaluru",
    "toit-indiranagar",
    artist1Id,
    499,
    "sFMRqxCexDk"
  )

  insertEvent.run(
    event2Id,
    "Bollywood & Retro Sing-Along Live",
    "Interactive acoustic evening where every song on the setlist is upvoted and shaped by the audience.",
    tonightIso,
    todayDateOnly,
    "The Quarter, Royal Opera House • Mumbai",
    "the-quarter-mumbai",
    artist2Id,
    699,
    null
  )

  insertEvent.run(
    event3Id,
    "Saturday Arena Anthems & Dedications",
    "Electric acoustic mashups, live LED karaoke lyrics, and crowd dedications all night.",
    tomorrowIso,
    tomorrowDateOnly,
    "Hard Rock Cafe, Koregaon Park • Pune",
    "hard-rock-pune",
    artist3Id,
    599,
    null
  )

  const insertBatch = conn.prepare(
    `INSERT OR IGNORE INTO song_batches
      (id, event_id, requester_name, requester_phone, voter_token, wants_dedication, dedicated_to, dedication_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const insertRequest = conn.prepare(
    `INSERT OR IGNORE INTO song_requests
      (id, batch_id, event_id, source_type, choice_index, song_title, original_artist, youtube_url, youtube_video_id, status, upvotes, wants_dedication, dedicated_to, dedication_message, dedication_payment_status, requester_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  // --- ARTIST'S PRE-PREPARED PLAYLIST (Pre-added by Artist with YouTube Karaoke Links) ---
  insertRequest.run(
    "playlist-arjun-1",
    null,
    event1Id,
    "artist_playlist",
    1,
    "gul",
    "Anuv Jain",
    "https://www.youtube.com/watch?v=SmaY7RfB6b0",
    "SmaY7RfB6b0",
    "confirmed",
    27,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )

  insertRequest.run(
    "playlist-arjun-2",
    null,
    event1Id,
    "artist_playlist",
    1,
    "Mitwa",
    "Shafqat Amanat Ali (Kabhi Alvida Naa Kehna)",
    "https://www.youtube.com/watch?v=ru_5PA8cwkE",
    "ru_5PA8cwkE",
    "confirmed",
    19,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )

  insertRequest.run(
    "playlist-arjun-3",
    null,
    event1Id,
    "artist_playlist",
    1,
    "Counting Stars",
    "OneRepublic",
    "https://www.youtube.com/watch?v=hT_nvWreIhg",
    "hT_nvWreIhg",
    "confirmed",
    15,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )

  insertRequest.run(
    "playlist-arjun-4",
    null,
    event1Id,
    "artist_playlist",
    1,
    "Kun Faya Kun",
    "A.R. Rahman, Javed Ali, Mohit Chauhan",
    "https://www.youtube.com/watch?v=T94PHkuydcw",
    "T94PHkuydcw",
    "confirmed",
    34,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )

  // --- AUDIENCE BATCHES & REQUESTS ---
  // Batch 1: Confirmed + PAID ₹50 Dedication (Priority Section)
  insertBatch.run(
    "batch-demo-1",
    event1Id,
    "Rohan Verma",
    "9820112233",
    "seed-voter-1",
    1,
    "Ananya (Happy Anniversary!)",
    "Please call out Ananya & Rohan's 3rd anniversary before singing this!"
  )
  insertRequest.run(
    "req-demo-1a",
    "batch-demo-1",
    event1Id,
    "audience_request",
    1,
    "Kesariya",
    "Arijit Singh",
    "https://www.youtube.com/watch?v=sFMRqxCexDk",
    "sFMRqxCexDk",
    "confirmed",
    18,
    1,
    "Ananya (Happy Anniversary!)",
    "Please call out Ananya & Rohan's 3rd anniversary before singing this!",
    "paid",
    "Rohan Verma"
  )
  insertRequest.run("req-demo-1b", "batch-demo-1", event1Id, "audience_request", 2, "Tum Se Hi", "Mohit Chauhan", null, null, "declined", 0, 1, "Ananya", null, "none", "Rohan Verma")
  insertRequest.run("req-demo-1c", "batch-demo-1", event1Id, "audience_request", 3, "Raabta", "Arijit Singh", null, null, "declined", 0, 1, "Ananya", null, "none", "Rohan Verma")

  // Batch 2: Confirmed + PAID ₹50 Dedication (Priority Section)
  insertBatch.run(
    "batch-demo-2",
    event1Id,
    "Sneha & Table 7",
    "9811223344",
    "seed-voter-2",
    1,
    "Vikram (Birthday Boy!)",
    "It's Vikram's 25th birthday at Table 7!"
  )
  insertRequest.run(
    "req-demo-2a",
    "batch-demo-2",
    event1Id,
    "audience_request",
    1,
    "Yellow",
    "Coldplay",
    "https://www.youtube.com/watch?v=1G4isv_Fylg",
    "1G4isv_Fylg",
    "confirmed",
    14,
    1,
    "Vikram (Birthday Boy!)",
    "It's Vikram's 25th birthday at Table 7!",
    "paid",
    "Sneha & Table 7"
  )
  insertRequest.run("req-demo-2b", "batch-demo-2", event1Id, "audience_request", 2, "Fix You", "Coldplay", null, null, "declined", 0, 1, "Vikram", null, "none", "Sneha & Table 7")
  insertRequest.run("req-demo-2c", "batch-demo-2", event1Id, "audience_request", 3, "Viva La Vida", "Coldplay", null, null, "declined", 0, 1, "Vikram", null, "none", "Sneha & Table 7")

  // Batch 3: Confirmed high-upvoted song in Crowd Queue
  insertBatch.run("batch-demo-3", event1Id, "Devika Nair", "9900112233", "seed-voter-3", 0, null, null)
  insertRequest.run(
    "req-demo-3a",
    "batch-demo-3",
    event1Id,
    "audience_request",
    1,
    "Channa Mereya",
    "Arijit Singh",
    "https://www.youtube.com/watch?v=284Ov7ysmfA",
    "284Ov7ysmfA",
    "confirmed",
    31,
    0,
    null,
    null,
    "none",
    "Devika Nair"
  )
  insertRequest.run("req-demo-3b", "batch-demo-3", event1Id, "audience_request", 2, "Kabira", "Tochi Raina", null, null, "declined", 0, 0, null, null, "none", "Devika Nair")
  insertRequest.run("req-demo-3c", "batch-demo-3", event1Id, "audience_request", 3, "Ilahi", "Arijit Singh", null, null, "declined", 0, 0, null, null, "none", "Devika Nair")

  // Batch 4: Confirmed song in Crowd Queue (Artist confirmed it; Audience member can now complete ₹50 payment!)
  insertBatch.run("batch-demo-4", event1Id, "Aarav Patel", "9845012345", "seed-voter-4", 1, "Meera", "Dedicated to Meera!")
  insertRequest.run(
    "req-demo-4a",
    "batch-demo-4",
    event1Id,
    "audience_request",
    1,
    "Perfect",
    "Ed Sheeran",
    "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
    "2Vv-BfVoq4g",
    "confirmed",
    22,
    1,
    "Meera",
    "Dedicated to Meera!",
    "awaiting_payment",
    "Aarav Patel"
  )
  insertRequest.run("req-demo-4b", "batch-demo-4", event1Id, "audience_request", 2, "Thinking Out Loud", "Ed Sheeran", null, null, "declined", 0, 1, "Meera", null, "none", "Aarav Patel")
  insertRequest.run("req-demo-4c", "batch-demo-4", event1Id, "audience_request", 3, "Photograph", "Ed Sheeran", null, null, "declined", 0, 1, "Meera", null, "none", "Aarav Patel")

  // Batch 5: Incoming Pending 3-Song Submission (Waiting for Artist to confirm 1 of the 3!)
  insertBatch.run(
    "batch-demo-5",
    event1Id,
    "Priya Sharma (Table 4)",
    "9731098765",
    "seed-voter-5",
    1,
    "Karthik & Priya",
    "Our first date song! Will pay ₹50 as soon as you confirm!"
  )
  insertRequest.run("req-demo-5a", "batch-demo-5", event1Id, "audience_request", 1, "Tera Ban Jaunga", "Akhil Sachdeva", null, null, "pending_artist", 0, 1, "Karthik & Priya", "Our first date song! Will pay ₹50 as soon as you confirm!", "none", "Priya Sharma (Table 4)")
  insertRequest.run("req-demo-5b", "batch-demo-5", event1Id, "audience_request", 2, "Pehla Nasha", "Udit Narayan", null, null, "pending_artist", 0, 1, "Karthik & Priya", "Our first date song! Will pay ₹50 as soon as you confirm!", "none", "Priya Sharma (Table 4)")
  insertRequest.run("req-demo-5c", "batch-demo-5", event1Id, "audience_request", 3, "Wonderwall", "Oasis", null, null, "pending_artist", 0, 1, "Karthik & Priya", "Our first date song! Will pay ₹50 as soon as you confirm!", "none", "Priya Sharma (Table 4)")

  // Batch 6: Another Incoming Pending 3-Song Submission
  insertBatch.run("batch-demo-6", event1Id, "Siddharth & Friends", "9880011223", "seed-voter-6", 0, null, null)
  insertRequest.run("req-demo-6a", "batch-demo-6", event1Id, "audience_request", 1, "Dil Chahta Hai", "Shankar-Ehsaan-Loy", null, null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends")
  insertRequest.run("req-demo-6b", "batch-demo-6", event1Id, "audience_request", 2, "Senorita (ZNMD)", "Farhan Akhtar", null, null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends")
  insertRequest.run("req-demo-6c", "batch-demo-6", event1Id, "audience_request", 3, "Summer of '69", "Bryan Adams", null, null, "pending_artist", 0, 0, null, null, "none", "Siddharth & Friends")

  // Also seed Maya's playlist for Event 2 so every home card has live songs ready!
  insertRequest.run(
    "playlist-maya-1",
    null,
    event2Id,
    "artist_playlist",
    1,
    "Lag Jaa Gale",
    "Lata Mangeshkar",
    "https://www.youtube.com/watch?v=TFr6G5zveS8",
    "TFr6G5zveS8",
    "confirmed",
    29,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )
  insertRequest.run(
    "playlist-maya-2",
    null,
    event2Id,
    "artist_playlist",
    1,
    "Agar Tum Saath Ho",
    "Alka Yagnik & Arijit Singh",
    "https://www.youtube.com/watch?v=sK7riqg2mr4",
    "sK7riqg2mr4",
    "confirmed",
    21,
    0,
    null,
    null,
    "none",
    "Artist Playlist"
  )
}

const g = globalThis as unknown as { __museDb?: DatabaseSync }

// Single shared connection (survives Next.js dev hot reloads).
export function db(): DatabaseSync {
  if (!g.__museDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "muse.db")
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const conn = new DatabaseSync(file)
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
    conn.exec(SCHEMA)
    try {
      conn.exec("ALTER TABLE song_requests ADD COLUMN karaoke_candidates_json TEXT;")
    } catch {
      // Column already exists
    }
    seedIfNeeded(conn)
    g.__museDb = conn
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
