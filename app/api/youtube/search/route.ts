import { NextResponse } from "next/server"
import { extractYouTubeId } from "@/lib/youtube"

export interface YouTubeSearchResult {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  duration?: string
  source?: "youtube_api" | "innertube"
}

// 1. YouTube Innertube Web Client Search (Official Web Client API, No API key needed)
async function searchInnertube(query: string): Promise<YouTubeSearchResult[]> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240101.00.00",
            hl: "en",
            gl: "IN",
          },
        },
        query,
      }),
      signal: AbortSignal.timeout(4000),
    })

    if (!res.ok) return []
    const json = await res.json()
    const sections =
      json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []

    const results: YouTubeSearchResult[] = []

    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || []
      for (const item of items) {
        const vr = item?.videoRenderer
        if (vr?.videoId) {
          const videoId = String(vr.videoId)
          const title =
            vr.title?.runs?.map((r: any) => r.text).join("") ||
            vr.title?.simpleText ||
            "YouTube Video"
          const channel =
            vr.ownerText?.runs?.map((r: any) => r.text).join("") ||
            vr.shortBylineText?.runs?.map((r: any) => r.text).join("") ||
            "YouTube"
          const thumbnails = vr.thumbnail?.thumbnails || []
          const thumbnail =
            thumbnails[thumbnails.length - 1]?.url ||
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          const duration = vr.lengthText?.simpleText || undefined

          results.push({
            videoId,
            title,
            channel,
            thumbnail,
            duration,
            source: "innertube",
          })
          if (results.length >= 10) break
        }
      }
      if (results.length >= 10) break
    }

    return results
  } catch {
    return []
  }
}

// 2. Official YouTube Data API v3 (If YOUTUBE_API_KEY environment variable is configured)
async function searchYouTubeDataApi(query: string, apiKey: string): Promise<YouTubeSearchResult[]> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(
      query
    )}&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.error("[YouTube Data API Error]", res.status, errBody)
      return []
    }
    const json = await res.json()
    const items = Array.isArray(json.items) ? json.items : []

    return items
      .filter((it: any) => Boolean(it.id?.videoId))
      .map((it: any) => ({
        videoId: it.id.videoId,
        title: it.snippet?.title || "YouTube Video",
        channel: it.snippet?.channelTitle || "YouTube",
        thumbnail:
          it.snippet?.thumbnails?.high?.url ||
          it.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${it.id.videoId}/hqdefault.jpg`,
        source: "youtube_api" as const,
      }))
  } catch (err: any) {
    console.error("[YouTube Data API Fetch Error]", err?.message || err)
    return []
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = String(searchParams.get("q") ?? "").trim()

  if (!q) {
    return NextResponse.json({ results: [] })
  }

  // If the user entered a direct YouTube link or 11-char ID
  const directId = extractYouTubeId(q)
  if (directId) {
    return NextResponse.json({
      results: [
        {
          videoId: directId,
          title: `Direct YouTube Video (${directId})`,
          channel: "Custom Link",
          thumbnail: `https://img.youtube.com/vi/${directId}/hqdefault.jpg`,
          source: "innertube",
        },
      ],
      api_connected: Boolean(process.env.YOUTUBE_API_KEY),
    })
  }

  // 1. Try official API key if present
  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey) {
    const apiResults = await searchYouTubeDataApi(q, apiKey)
    if (apiResults.length > 0) {
      return NextResponse.json({ results: apiResults, api_connected: true, source: "youtube_data_api" })
    }
  }

  // 2. Try Innertube Web client
  const innertubeResults = await searchInnertube(q)
  if (innertubeResults.length > 0) {
    return NextResponse.json({ results: innertubeResults, api_connected: Boolean(apiKey), source: "innertube" })
  }

  // No guessing or fake results
  return NextResponse.json({ results: [], api_connected: Boolean(apiKey) })
}
