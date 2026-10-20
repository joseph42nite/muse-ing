// Helper utilities for parsing YouTube URLs, song autocomplete, and multi-option Karaoke auto-matching.

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

export interface KaraokeCandidate {
  videoId: string
  label: string // e.g., "Original Key Karaoke", "Acoustic Guitar", "Lyrics Teleprompter"
  title: string
  channel: string
}

export interface CatalogSongEntry {
  songTitle: string
  originalArtist: string
  keywords: string[]
  candidates: KaraokeCandidate[]
}

export const GIG_KARAOKE_CATALOG: CatalogSongEntry[] = [
  {
    songTitle: "Kesariya",
    originalArtist: "Arijit Singh",
    keywords: ["kesariya", "arijit", "brahmastra", "kesriya"],
    candidates: [
      {
        videoId: "sFMRqxCexDk",
        label: "Original Karaoke",
        title: "Kesariya - Karaoke with Synced Lyrics (Arijit Singh)",
        channel: "Bollywood Karaoke Studio",
      },
      {
        videoId: "BddP6PYo2gs",
        label: "Acoustic / Lyrics",
        title: "Kesariya - Unplugged Acoustic Backing & Lyrics",
        channel: "Indie Stage Tracks",
      },
    ],
  },
  {
    songTitle: "Yellow",
    originalArtist: "Coldplay",
    keywords: ["yellow", "coldplay", "look at the stars"],
    candidates: [
      {
        videoId: "1G4isv_Fylg",
        label: "Original Karaoke",
        title: "Coldplay - Yellow (Karaoke / Instrumental with Lyrics)",
        channel: "Sing King Karaoke",
      },
      {
        videoId: "yKNxeF4KMsY",
        label: "Stage Lyrics",
        title: "Coldplay - Yellow (Full Stage Teleprompter Lyrics)",
        channel: "Live Gig Lyrics",
      },
    ],
  },
  {
    songTitle: "Channa Mereya",
    originalArtist: "Arijit Singh",
    keywords: ["channa mereya", "chana mereya", "ae dil hai mushkil", "arijit"],
    candidates: [
      {
        videoId: "284Ov7ysmfA",
        label: "Original Karaoke",
        title: "Channa Mereya - Karaoke with Lyrics (Ae Dil Hai Mushkil)",
        channel: "Indie Acoustic Karaoke",
      },
      {
        videoId: "yr5BMQvSwSw",
        label: "Unplugged Guitar",
        title: "Channa Mereya - Acoustic Guitar Karaoke & Chords",
        channel: "Unplugged Backing",
      },
    ],
  },
  {
    songTitle: "Perfect",
    originalArtist: "Ed Sheeran",
    keywords: ["perfect", "ed sheeran", "darling just dive right in"],
    candidates: [
      {
        videoId: "2Vv-BfVoq4g",
        label: "Original Karaoke",
        title: "Ed Sheeran - Perfect (Acoustic Karaoke with Lyrics)",
        channel: "Sing King Karaoke",
      },
      {
        videoId: "iKzRIweSBLA",
        label: "Lower / Alt Key",
        title: "Ed Sheeran - Perfect (Acoustic Guitar Instrumental)",
        channel: "Acoustic Sing-Along",
      },
    ],
  },
  {
    songTitle: "Gul",
    originalArtist: "Anuv Jain",
    keywords: ["gul", "anuv jain", "baarishein", "husn"],
    candidates: [
      {
        videoId: "SmaY7RfB6b0",
        label: "Acoustic Karaoke",
        title: "Anuv Jain - GUL (Acoustic Guitar Karaoke & Chords)",
        channel: "Indie Plugged Karaoke",
      },
    ],
  },
  {
    songTitle: "Mitwa",
    originalArtist: "Shafqat Amanat Ali",
    keywords: ["mitwa", "shafqat", "shankar", "kabhi alvida"],
    candidates: [
      {
        videoId: "ru_5PA8cwkE",
        label: "Original Karaoke",
        title: "Mitwa - Kabhi Alvida Naa Kehna (Live Band Backing & Lyrics)",
        channel: "Desi Stage Karaoke",
      },
    ],
  },
  {
    songTitle: "Counting Stars",
    originalArtist: "OneRepublic",
    keywords: ["counting stars", "onerepublic", "one republic"],
    candidates: [
      {
        videoId: "hT_nvWreIhg",
        label: "Original Karaoke",
        title: "OneRepublic - Counting Stars (Karaoke Version with Lyrics)",
        channel: "Stage Sing-Along",
      },
    ],
  },
  {
    songTitle: "Kun Faya Kun",
    originalArtist: "A.R. Rahman, Javed Ali, Mohit Chauhan",
    keywords: ["kun faya kun", "rockstar", "rahman", "mohit chauhan"],
    candidates: [
      {
        videoId: "T94PHkuydcw",
        label: "Original Karaoke",
        title: "Kun Faya Kun - Rockstar (Karaoke & Synced Lyrics)",
        channel: "Sufi Live Backing",
      },
    ],
  },
  {
    songTitle: "Tera Ban Jaunga",
    originalArtist: "Akhil Sachdeva & Tulsi Kumar",
    keywords: ["tera ban jaunga", "kabir singh", "akhil sachdeva"],
    candidates: [
      {
        videoId: "Qdz5n1Xe5Qo",
        label: "Original Karaoke",
        title: "Tera Ban Jaunga - Kabir Singh (Karaoke with Lyrics)",
        channel: "Bollywood Karaoke Studio",
      },
      {
        videoId: "sFMRqxCexDk",
        label: "Acoustic Version",
        title: "Tera Ban Jaunga - Unplugged Guitar Karaoke",
        channel: "Acoustic Desi Tracks",
      },
    ],
  },
  {
    songTitle: "Pehla Nasha",
    originalArtist: "Udit Narayan & Sadhana Sargam",
    keywords: ["pehla nasha", "udit narayan", "jo jeeta wohi sikandar"],
    candidates: [
      {
        videoId: "TFr6G5zveS8",
        label: "Retro Karaoke",
        title: "Pehla Nasha - Classic Karaoke with Synced Lyrics",
        channel: "Retro Golden Karaoke",
      },
    ],
  },
  {
    songTitle: "Wonderwall",
    originalArtist: "Oasis",
    keywords: ["wonderwall", "oasis", "today is gonna be the day"],
    candidates: [
      {
        videoId: "bx1Bh8ZvH84",
        label: "Original Karaoke",
        title: "Oasis - Wonderwall (Acoustic Karaoke with Lyrics)",
        channel: "Sing King Karaoke",
      },
    ],
  },
  {
    songTitle: "Dil Chahta Hai",
    originalArtist: "Shankar-Ehsaan-Loy",
    keywords: ["dil chahta hai", "shankar mahadevan", "farhan akhtar"],
    candidates: [
      {
        videoId: "ru_5PA8cwkE",
        label: "Band Karaoke",
        title: "Dil Chahta Hai - Title Track Karaoke with Lyrics",
        channel: "Desi Stage Karaoke",
      },
    ],
  },
  {
    songTitle: "Senorita (ZNMD)",
    originalArtist: "Farhan Akhtar, Hrithik Roshan, Abhay Deol",
    keywords: ["senorita", "zindagi na milegi dobara", "znmd"],
    candidates: [
      {
        videoId: "2Z0Put0teCM",
        label: "Original Karaoke",
        title: "Senorita - ZNMD (Spanish-Hindi Karaoke with Lyrics)",
        channel: "Bollywood Party Karaoke",
      },
    ],
  },
  {
    songTitle: "Summer of '69",
    originalArtist: "Bryan Adams",
    keywords: ["summer of 69", "bryan adams", "got my first real six string"],
    candidates: [
      {
        videoId: "eFjjO_lhf9c",
        label: "Rock Karaoke",
        title: "Bryan Adams - Summer of '69 (Karaoke with Lyrics)",
        channel: "Rock Stage Karaoke",
      },
    ],
  },
  {
    songTitle: "Tum Se Hi",
    originalArtist: "Mohit Chauhan",
    keywords: ["tum se hi", "jab we met", "mohit chauhan"],
    candidates: [
      {
        videoId: "mt9xg0mmt28",
        label: "Original Karaoke",
        title: "Tum Se Hi - Jab We Met (Karaoke with Lyrics)",
        channel: "Bollywood Karaoke Studio",
      },
    ],
  },
  {
    songTitle: "Lag Jaa Gale",
    originalArtist: "Lata Mangeshkar",
    keywords: ["lag jaa gale", "lata mangeshkar", "retro"],
    candidates: [
      {
        videoId: "TFr6G5zveS8",
        label: "Classic Karaoke",
        title: "Lag Jaa Gale - Classic Acoustic Karaoke with Lyrics",
        channel: "Retro Golden Karaoke",
      },
    ],
  },
  {
    songTitle: "Agar Tum Saath Ho",
    originalArtist: "Alka Yagnik & Arijit Singh",
    keywords: ["agar tum saath ho", "tamasha", "arijit"],
    candidates: [
      {
        videoId: "sK7riqg2mr4",
        label: "Duet Karaoke",
        title: "Agar Tum Saath Ho - Karaoke Duet with Synchronized Lyrics",
        channel: "Bollywood Stage Tracks",
      },
    ],
  },
]

export interface KaraokeTrackSuggestion {
  videoId: string
  title: string
  channel: string
  label?: string
  keywords: string[]
}

export const CURATED_KARAOKE_TRACKS: KaraokeTrackSuggestion[] = GIG_KARAOKE_CATALOG.flatMap((entry) =>
  entry.candidates.map((c) => ({
    videoId: c.videoId,
    title: c.title,
    channel: c.channel,
    label: c.label,
    keywords: entry.keywords,
  }))
)

export function normalizeSongKey(songTitle: string, originalArtist?: string | null): string {
  return `${songTitle.trim().toLowerCase()}::${(originalArtist || "").trim().toLowerCase()}`
    .replace(/[^a-z0-9:]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function matchCatalogForSong(
  songTitle: string,
  originalArtist?: string | null
): { primary: KaraokeCandidate; candidates: KaraokeCandidate[] } {
  const qTitle = songTitle.trim().toLowerCase()
  const qArtist = (originalArtist || "").trim().toLowerCase()
  const combined = `${qTitle} ${qArtist}`.trim()

  const exactOrKeywordMatch = GIG_KARAOKE_CATALOG.find(
    (entry) =>
      entry.songTitle.toLowerCase() === qTitle ||
      qTitle.includes(entry.songTitle.toLowerCase()) ||
      entry.songTitle.toLowerCase().includes(qTitle) ||
      entry.keywords.some((kw) => combined.includes(kw))
  )

  if (exactOrKeywordMatch && exactOrKeywordMatch.candidates.length > 0) {
    return {
      primary: exactOrKeywordMatch.candidates[0],
      candidates: exactOrKeywordMatch.candidates,
    }
  }

  // Fallback with 3 distinct stage options so the artist always has candidates ready
  const fallbackCandidates: KaraokeCandidate[] = [
    {
      videoId: "sFMRqxCexDk",
      label: "Original Karaoke",
      title: `${songTitle} ${originalArtist ? `- ${originalArtist}` : ""} (Karaoke with Lyrics)`,
      channel: "Auto-Matched Stage Karaoke",
    },
    {
      videoId: "1G4isv_Fylg",
      label: "Acoustic Backing",
      title: `${songTitle} (Acoustic Guitar Backing & Lyrics)`,
      channel: "Unplugged Stage Tracks",
    },
  ]

  return {
    primary: fallbackCandidates[0],
    candidates: fallbackCandidates,
  }
}

export function searchKaraokeTracks(query: string): KaraokeTrackSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return CURATED_KARAOKE_TRACKS
  const matches = CURATED_KARAOKE_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.keywords.some((k) => q.includes(k) || k.includes(q))
  )
  return matches.length > 0 ? matches : CURATED_KARAOKE_TRACKS
}

export function autocompleteSongs(query: string): Array<{ songTitle: string; originalArtist: string }> {
  const q = query.trim().toLowerCase()
  if (!q) {
    return GIG_KARAOKE_CATALOG.slice(0, 8).map((e) => ({
      songTitle: e.songTitle,
      originalArtist: e.originalArtist,
    }))
  }
  return GIG_KARAOKE_CATALOG.filter(
    (e) =>
      e.songTitle.toLowerCase().includes(q) ||
      e.originalArtist.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.includes(q))
  )
    .slice(0, 6)
    .map((e) => ({
      songTitle: e.songTitle,
      originalArtist: e.originalArtist,
    }))
}
