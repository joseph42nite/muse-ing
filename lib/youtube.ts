// Helper utilities for parsing YouTube URLs and extracting video IDs.
// No song guessing or hardcoded catalogs.

export function extractYouTubeId(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0]
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v")
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const parts = url.pathname.split("/").filter(Boolean)
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "v")
      if (embedIdx !== -1 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1]
      }
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
    if (match) return match[1]
  }
  return null
}
