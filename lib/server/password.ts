import crypto from "node:crypto"

// Format: scrypt$<salt hex>$<hash hex>. scripts/create-admin.mjs writes the same format.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, "hex")
  if (!expected.length) return false
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length)
  return crypto.timingSafeEqual(actual, expected)
}
