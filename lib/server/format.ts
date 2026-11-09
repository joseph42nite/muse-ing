/** "@handle" for bare handles; full URLs and already-prefixed handles pass through. Empty → null. */
export function normalizeInstagramHandle(raw: unknown): string | null {
  const v = String(raw ?? "").trim()
  if (!v) return null
  return v.startsWith("@") || v.startsWith("http") ? v : `@${v}`
}

/** Upper-case A–Z/0–9 only. Empty → null. */
export function normalizePromoterCode(raw: unknown): string | null {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || null
}

/** Last 10 digits of a phone number (Indian mobile without country code). */
export function last10Digits(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "").slice(-10)
}

/** Escapes % and _ so user input can sit inside a LIKE pattern that uses ESCAPE '\'. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}
