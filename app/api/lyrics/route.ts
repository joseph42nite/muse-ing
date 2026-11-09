import { NextResponse } from "next/server"

interface LrcLibTrack {
  trackName?: string
  artistName?: string
  duration?: number
  instrumental?: boolean
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

const UA = "muse-ing (https://github.com/muse-ing)"

async function search(params: Record<string, string>): Promise<LrcLibTrack[]> {
  const qs = new URLSearchParams(params)
  const res = await fetch(`https://lrclib.net/api/search?${qs}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  })
  return res.ok ? ((await res.json()) as LrcLibTrack[]) : []
}

function parseLrc(lrc: string): { t: number; text: string }[] {
  const out: { t: number; text: string }[] = []
  for (const line of lrc.split("\n")) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/)
    if (m && m[3].trim()) out.push({ t: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() })
  }
  return out
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const title = url.searchParams.get("title")?.trim() || ""
  const artist = (url.searchParams.get("artist")?.trim() || "").split(/,|&| feat\.? /i)[0].trim()
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 })

  try {
    let hits = artist ? await search({ track_name: title, artist_name: artist }) : []
    if (!hits.some((h) => h.syncedLyrics)) {
      const more = await search({ q: `${title} ${artist}`.trim() })
      hits = [...hits, ...more]
    }
    const best = hits.find((h) => h.syncedLyrics) || hits.find((h) => h.plainLyrics)
    if (!best) return NextResponse.json({ synced: false, lines: [] })

    if (best.syncedLyrics) {
      return NextResponse.json({ synced: true, lines: parseLrc(best.syncedLyrics), duration: best.duration || null })
    }
    const lines = (best.plainLyrics || "")
      .split("\n")
      .map((text, i) => ({ t: i * 4, text: text.trim() }))
      .filter((l) => l.text)
    return NextResponse.json({ synced: false, lines, duration: best.duration || null })
  } catch {
    return NextResponse.json({ synced: false, lines: [] })
  }
}
