import crypto from "node:crypto"
import { cookies } from "next/headers"
import { get, run } from "./db"

export const SESSION_COOKIE = "muse_session"
const SESSION_DAYS = 14

export type Role = "promoter" | "venue" | "admin" | "artist"
export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  promoter_code: string | null
  instagram_handle?: string | null
  avatar_url?: string | null
  bio?: string | null
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, "hex")
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length)
  return crypto.timingSafeEqual(actual, expected)
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url")
  const expires = new Date(Date.now() + SESSION_DAYS * 86400e3)
  run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", sha(token), userId, expires.toISOString())
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", sha(token))
  jar.delete(SESSION_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const row = get<SessionUser & { expires_at: string }>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.promoter_code, u.instagram_handle, u.avatar_url, u.bio, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    sha(token),
  )
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE token_hash = ?", sha(token))
    return null
  }
  const { expires_at: _e, ...user } = row
  return user
}

/** Returns the signed-in user if their role is allowed, else null. */
export async function requireRole(...roles: Role[]): Promise<SessionUser | null> {
  const user = await getSessionUser()
  return user && roles.includes(user.role) ? user : null
}

export const unauthorized = () => Response.json({ error: "Not signed in." }, { status: 401 })
export const forbidden = () => Response.json({ error: "Not allowed." }, { status: 403 })
