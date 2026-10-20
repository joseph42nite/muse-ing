// Usage: node scripts/create-admin.mjs "Admin Name" admin@example.com 'a-strong-password'
import { DatabaseSync } from "node:sqlite"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const [name, email, password] = process.argv.slice(2)
if (!name || !email || !password || password.length < 8) {
  console.error('Usage: node scripts/create-admin.mjs "Name" email password(min 8 chars)')
  process.exit(1)
}
const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "muse.db")
if (!fs.existsSync(file)) {
  console.error(`Database not found at ${file}. Start the app once (npm run dev) so it is created.`)
  process.exit(1)
}
const salt = crypto.randomBytes(16)
const hash = `scrypt$${salt.toString("hex")}$${crypto.scryptSync(password, salt, 64).toString("hex")}`
const db = new DatabaseSync(file)
db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (?,?,?,?,?)").run(
  crypto.randomUUID(), name, email.toLowerCase(), "admin", hash,
)
console.log(`Admin ${email} created.`)
