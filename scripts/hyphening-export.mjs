// Runs ON the Hyphening server (piped over ssh, cwd = the Hyphening app). Prints curation venues and
// artists as JSON on stdout, with bank details decrypted. Nothing is written to disk.
//   ssh hyphening 'cd /home/ubuntu/hyphening && node --input-type=module' < scripts/hyphening-export.mjs
import "dotenv/config"
import Database from "better-sqlite3"
import { decrypt } from "./src/services/encryption.js"

const db = new Database("data/ops_dashboard.db", { readonly: true })
const key = process.env.ARTIST_BANK_KEY

const artists = db
  .prepare("SELECT * FROM artists ORDER BY name")
  .all()
  .map(({ bank_details_enc, ...a }) => {
    let bank = null
    if (bank_details_enc && key) {
      try {
        const d = decrypt(bank_details_enc, key)
        try {
          bank = JSON.parse(d)
        } catch {
          bank = d
        }
      } catch {
        bank = null
      }
    }
    return { ...a, bank_details: bank }
  })

const clients = db.prepare("SELECT id, name, is_active FROM crm_clients WHERE client_type = 'artist_curation'").all()
const venueRows = db.prepare("SELECT * FROM venues").all()
const venues = clients.map((c) => ({ client: c, venue: venueRows.find((v) => v.client_id === c.id) ?? null }))

const gigs = db
  .prepare(
    `SELECT g.id, g.gig_date, g.fee_inr, g.advance_paid, g.status,
            a.artist_id AS artist_code, a.name AS artist_name,
            v.client_id AS venue_client_id, v.name AS venue_name, v.city AS venue_city
       FROM gig_status g
       LEFT JOIN artists a ON a.id = g.artist_id
       LEFT JOIN venues v ON v.id = g.venue_id
      ORDER BY g.gig_date`,
  )
  .all()

process.stdout.write(JSON.stringify({ artists, venues, gigs }))
