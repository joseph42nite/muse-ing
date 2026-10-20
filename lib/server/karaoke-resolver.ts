import { get, run } from "@/lib/server/db"
import {
  extractYouTubeId,
  KaraokeCandidate,
  matchCatalogForSong,
  normalizeSongKey,
} from "@/lib/youtube"

export interface ResolvedKaraokeResult {
  youtubeUrl: string
  youtubeVideoId: string
  youtubeTitle: string
  candidates: KaraokeCandidate[]
  candidatesJson: string
}

export async function resolveAndCacheKaraoke(
  songTitle: string,
  originalArtist?: string | null,
  explicitYoutubeUrl?: string | null
): Promise<ResolvedKaraokeResult> {
  const normKey = normalizeSongKey(songTitle, originalArtist)
  const explicitId = extractYouTubeId(explicitYoutubeUrl)

  // Check SQLite cache first
  const cached = get<{
    primary_video_id: string
    primary_title: string | null
    candidates_json: string
  }>(
    "SELECT primary_video_id, primary_title, candidates_json FROM karaoke_cache WHERE normalized_key = ?",
    normKey
  )

  if (cached && !explicitId) {
    let parsedCandidates: KaraokeCandidate[] = []
    try {
      parsedCandidates = JSON.parse(cached.candidates_json)
    } catch {
      parsedCandidates = []
    }
    return {
      youtubeUrl: `https://www.youtube.com/watch?v=${cached.primary_video_id}`,
      youtubeVideoId: cached.primary_video_id,
      youtubeTitle: cached.primary_title || `${songTitle} (Karaoke)`,
      candidates: parsedCandidates,
      candidatesJson: cached.candidates_json,
    }
  }

  // Match against our verified Gig Karaoke Catalog
  const catalogMatch = matchCatalogForSong(songTitle, originalArtist)
  let candidates = [...catalogMatch.candidates]

  // If official YOUTUBE_API_KEY is configured, fetch live embeddable karaoke tracks
  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey && !explicitId) {
    try {
      const q = `${songTitle} ${originalArtist || ""} karaoke lyrics -reaction -cover`.trim()
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=3&q=${encodeURIComponent(
        q
      )}&key=${encodeURIComponent(apiKey)}`
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(2500) })
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data.items) ? data.items : []
        if (items.length > 0) {
          const labels = ["Top Match Karaoke", "Alt Key / Acoustic", "Backup Lyrics"]
          candidates = items
            .map((it: any, idx: number) => ({
              videoId: it.id?.videoId,
              label: labels[idx] || `Option #${idx + 1}`,
              title: it.snippet?.title || `${songTitle} Karaoke`,
              channel: it.snippet?.channelTitle || "YouTube Karaoke",
            }))
            .filter((c: KaraokeCandidate) => Boolean(c.videoId))
        }
      }
    } catch {
      // Fallback to catalog candidates if offline or quota exceeded
    }
  }

  if (explicitId) {
    const customCandidate: KaraokeCandidate = {
      videoId: explicitId,
      label: "Artist Selected Link",
      title: `${songTitle} (Artist Selected Karaoke)`,
      channel: "Custom YouTube Link",
    }
    candidates = [customCandidate, ...candidates.filter((c) => c.videoId !== explicitId)].slice(0, 3)
  }

  const primary = candidates[0] || catalogMatch.primary
  const candidatesJson = JSON.stringify(candidates)

  // Save in SQLite karaoke_cache for 0ms future lookups
  run(
    `INSERT INTO karaoke_cache (normalized_key, song_title, original_artist, primary_video_id, primary_title, candidates_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(normalized_key) DO UPDATE SET
       primary_video_id = excluded.primary_video_id,
       primary_title = excluded.primary_title,
       candidates_json = excluded.candidates_json,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    normKey,
    songTitle.trim(),
    originalArtist?.trim() || null,
    primary.videoId,
    primary.title,
    candidatesJson
  )

  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${primary.videoId}`,
    youtubeVideoId: primary.videoId,
    youtubeTitle: primary.title,
    candidates,
    candidatesJson,
  }
}
