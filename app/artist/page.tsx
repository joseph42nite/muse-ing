"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import QrCodeModal from "@/components/qr-code-modal"
import { extractYouTubeId, searchKaraokeTracks } from "@/lib/youtube"
import {
  Mic2,
  MapPin,
  Calendar,
  Sparkles,
  ThumbsUp,
  Play,
  Check,
  X,
  Tv,
  QrCode,
  Plus,
  Youtube,
  ExternalLink,
  Instagram,
  ListMusic,
  Volume2,
  VolumeX,
  Heart,
  LogOut,
  UserCheck,
  Search,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react"

export default function ArtistDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [qrOpen, setQrOpen] = useState(false)

  // Pre-Gig Artist Playlist Form State
  const [playlistTitle, setPlaylistTitle] = useState("")
  const [playlistArtist, setPlaylistArtist] = useState("")
  const [playlistYoutubeUrl, setPlaylistYoutubeUrl] = useState("")
  const [addingPlaylist, setAddingPlaylist] = useState(false)

  // YouTube Karaoke Widget & HDMI State
  const [activeKaraokeSong, setActiveKaraokeSong] = useState<any>(null)
  const [karaokeVideoId, setKaraokeVideoId] = useState<string>("sFMRqxCexDk")
  const [karaokeSearchQuery, setKaraokeSearchQuery] = useState<string>("Kesariya karaoke lyrics")
  const [customYoutubeInput, setCustomYoutubeInput] = useState<string>("")
  const [hdmiConnected, setHdmiConnected] = useState(false)
  const [muteKaraokeAudio, setMuteKaraokeAudio] = useState(false)

  // Optional custom YouTube URL override per pending song confirmation
  const [confirmYoutubeUrls, setConfirmYoutubeUrls] = useState<Record<string, string>>({})
  const [showCustomUrlInputFor, setShowCustomUrlInputFor] = useState<Record<string, boolean>>({})

  // Modals for Profile & New Gig
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profileInsta, setProfileInsta] = useState("")
  const [profileAvatar, setProfileAvatar] = useState("")
  const [profileBio, setProfileBio] = useState("")

  const [showNewGigModal, setShowNewGigModal] = useState(false)
  const [newGigTitle, setNewGigTitle] = useState("")
  const [newGigLocation, setNewGigLocation] = useState("")
  const [newGigDate, setNewGigDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newGigPrice, setNewGigPrice] = useState("499")

  const fetchDashboard = useCallback(
    async (evId?: string) => {
      try {
        const targetId = evId ?? selectedEventId
        const url = targetId
          ? `/api/artist/dashboard?eventId=${encodeURIComponent(targetId)}`
          : "/api/artist/dashboard"
        const res = await fetch(url, { cache: "no-store" })
        if (res.status === 401) {
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        if (res.ok) {
          const json = await res.json()
          setNeedsAuth(false)
          setData(json)
          if (json.activeGig && !targetId) {
            setSelectedEventId(json.activeGig.id)
          }
          if (json.artist) {
            setProfileName((prev) => prev || json.artist.name || "")
            setProfileInsta((prev) => prev || json.artist.instagram_handle || "")
            setProfileAvatar((prev) => prev || json.artist.avatar_url || "")
            setProfileBio((prev) => prev || json.artist.bio || "")
          }
        }
      } catch {
        // ignore transient errors
      } finally {
        setLoading(false)
      }
    },
    [selectedEventId]
  )

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(() => {
      fetchDashboard()
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const handleDemoArtistLogin = async () => {
    setLoading(true)
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "artist@museing.com", password: "artist123" }),
    })
    await fetchDashboard()
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  // Broadcast to HDMI Venue LED Screen Window
  const broadcastToLedScreen = (videoId: string, song?: any, muted?: boolean) => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("muse_led_screen")
      bc.postMessage({
        type: "LOAD_KARAOKE",
        videoId,
        song,
        muted: muted ?? muteKaraokeAudio,
      })
      bc.close()
    }
  }

  const handleConnectHdmiScreen = () => {
    const gigId = data?.activeGig?.id || "gig-koramangala-tonight"
    const popup = window.open(
      `/artist/led-screen?eventId=${encodeURIComponent(gigId)}`,
      "MuseVenueLED",
      "popup,width=1280,height=720"
    )
    setHdmiConnected(true)
    if (popup) {
      setTimeout(() => {
        broadcastToLedScreen(karaokeVideoId, activeKaraokeSong, muteKaraokeAudio)
      }, 900)
    }
  }

  const handleLoadSongIntoKaraoke = async (song: any, overrideVideoId?: string) => {
    setActiveKaraokeSong(song)
    const q = `${song.song_title} ${song.original_artist || ""} karaoke lyrics`.trim()
    setKaraokeSearchQuery(q)

    const matchedTracks = searchKaraokeTracks(song.song_title)
    const resolvedVideoId =
      overrideVideoId ||
      song.youtube_video_id ||
      extractYouTubeId(song.youtube_url) ||
      matchedTracks[0]?.videoId ||
      "sFMRqxCexDk"

    setKaraokeVideoId(resolvedVideoId)
    setCustomYoutubeInput(`https://www.youtube.com/watch?v=${resolvedVideoId}`)
    broadcastToLedScreen(resolvedVideoId, song, muteKaraokeAudio)

    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_now_playing",
        request_id: song.id,
      }),
    })
    fetchDashboard()

    const el = document.getElementById("karaoke-hdmi-station")
    if (el) el.scrollIntoView({ behavior: "smooth" })
  }

  const handleSwitchKaraokeCandidate = async (song: any, candidate: any) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "select_karaoke_candidate",
        request_id: song.id,
        video_id: candidate.videoId,
        title: candidate.title,
      }),
    })
    setKaraokeVideoId(candidate.videoId)
    setActiveKaraokeSong({ ...song, youtube_video_id: candidate.videoId, youtube_title: candidate.title })
    broadcastToLedScreen(candidate.videoId, song, muteKaraokeAudio)
    fetchDashboard()
  }

  const handleAddPlaylistSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlistTitle.trim() || !data?.activeGig?.id) return
    setAddingPlaylist(true)
    try {
      await fetch("/api/artist/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_playlist_song",
          event_id: data.activeGig.id,
          song_title: playlistTitle,
          original_artist: playlistArtist,
          youtube_url: playlistYoutubeUrl,
        }),
      })
      setPlaylistTitle("")
      setPlaylistArtist("")
      setPlaylistYoutubeUrl("")
      fetchDashboard()
    } finally {
      setAddingPlaylist(false)
    }
  }

  const handleConfirmAudienceSong = async (requestId: string) => {
    const customYt = confirmYoutubeUrls[requestId] || undefined
    const res = await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_song",
        request_id: requestId,
        youtube_url: customYt,
        decline_others: true,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (body?.youtube_video_id) {
      setKaraokeVideoId(body.youtube_video_id)
    }
    fetchDashboard()
  }

  const handleDeclineBatch = async (batchId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decline_batch",
        batch_id: batchId,
      }),
    })
    fetchDashboard()
  }

  const handleMarkPlayed = async (requestId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_played",
        request_id: requestId,
      }),
    })
    fetchDashboard()
  }

  const handleDeletePlaylistSong = async (requestId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_song",
        request_id: requestId,
      }),
    })
    fetchDashboard()
  }

  const handleMarkDedicationPaid = async (requestId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_dedication_paid",
        request_id: requestId,
      }),
    })
    fetchDashboard()
  }

  const handleSaveCustomYoutubeUrl = async () => {
    const extracted = extractYouTubeId(customYoutubeInput)
    if (extracted) {
      setKaraokeVideoId(extracted)
      broadcastToLedScreen(extracted, activeKaraokeSong, muteKaraokeAudio)
      if (activeKaraokeSong?.id) {
        await fetch("/api/artist/dashboard", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attach_youtube",
            request_id: activeKaraokeSong.id,
            youtube_url: customYoutubeInput,
          }),
        })
        fetchDashboard()
      }
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch("/api/artist/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_profile",
        name: profileName,
        instagram_handle: profileInsta,
        avatar_url: profileAvatar,
        bio: profileBio,
      }),
    })
    setShowProfileModal(false)
    fetchDashboard()
  }

  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/artist/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_gig",
        title: newGigTitle,
        location_name: newGigLocation,
        date: `${newGigDate}T20:30:00.000Z`,
        ticket_price: Number(newGigPrice) || 0,
      }),
    })
    const json = await res.json()
    setShowNewGigModal(false)
    if (json.id) {
      setSelectedEventId(json.id)
      fetchDashboard(json.id)
    }
  }

  if (loading && !data && !needsAuth) {
    return (
      <div className="min-h-screen bg-[#07070c] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-white/60">Loading Artist Stage Dashboard…</p>
        </div>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#07070c] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/[0.04] border border-white/15 rounded-3xl p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mx-auto">
            <Mic2 className="w-6 h-6 text-purple-300" />
          </div>
          <h1 className="text-2xl font-semibold">Artist Stage Dashboard</h1>
          <p className="text-xs text-white/65 leading-relaxed">
            Sign in to view your automatically scheduled gig location, pre-load your setlist with YouTube Karaoke links, confirm 3-song audience requests, and connect to the venue&apos;s HDMI LED screen.
          </p>
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleDemoArtistLogin}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-black font-bold text-xs hover:opacity-95 transition cursor-pointer"
            >
              1-Click Sign In as Demo Artist (Arjun Mehta)
            </button>
            <Link
              href="/login"
              className="block w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium transition"
            >
              Sign In with Another Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const {
    artist,
    gigs = [],
    activeGig,
    priorityDedications = [],
    upvotedQueue = [],
    artistPlaylist = [],
    pendingBatches = [],
  } = data || {}

  const karaokeSuggestions = searchKaraokeTracks(karaokeSearchQuery)

  return (
    <div className="min-h-screen bg-[#07070c] text-white pb-20">
      {/* Top Navigation & Artist Status Bar (Audience Phone View button removed per request) */}
      <header className="sticky top-0 z-30 bg-[#07070c]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-amber-400 flex items-center justify-center text-black font-bold text-sm">
                M
              </div>
              <span className="font-semibold text-base tracking-tight">Muse-ing</span>
            </Link>
            <span className="text-white/25">|</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-300 bg-purple-500/15 border border-purple-400/30 px-3 py-1 rounded-full">
              <Mic2 className="w-3.5 h-3.5" />
              Artist Command Center
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeGig && (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-300" />
                Location + Date QR
              </button>
            )}
            <button
              type="button"
              onClick={handleConnectHdmiScreen}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Tv className="w-3.5 h-3.5" />
              {hdmiConnected ? "HDMI Venue LED Connected" : "Connect HDMI / Venue LED Screen"}
            </button>
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-8">
        {/* 1. AUTO-DETECTED SCHEDULED GIG & LOCATION BANNER */}
        <section className="rounded-3xl bg-gradient-to-r from-purple-950/60 via-[#12121f] to-amber-950/40 border border-white/15 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <img
                src={
                  artist?.avatar_url ||
                  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80"
                }
                alt={artist?.name || "Artist"}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-400/50 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Auto-Detected Scheduled Gig
                  </span>
                  {artist?.instagram_handle && (
                    <span className="inline-flex items-center gap-1 text-xs text-pink-300">
                      <Instagram className="w-3.5 h-3.5" />
                      {artist.instagram_handle}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {activeGig ? activeGig.title : "No Gig Scheduled Yet"}
                </h1>
                {activeGig && (
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-white/80">
                    <span className="flex items-center gap-1.5 text-purple-200 font-medium">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      Location: {activeGig.location_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-200 font-medium">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      Scheduled Date: {activeGig.event_date_only}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {gigs.length > 1 && (
                <select
                  value={activeGig?.id || ""}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value)
                    fetchDashboard(e.target.value)
                  }}
                  className="px-3.5 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white"
                >
                  {gigs.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.event_date_only} • {g.location_name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setShowNewGigModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Gig
              </button>
            </div>
          </div>
        </section>

        {/* 2. PRE-GIG / LIVE ARTIST PLAYLIST BUILDER */}
        <section className="rounded-3xl bg-white/[0.03] border border-purple-400/30 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">
                <ListMusic className="w-4 h-4" />
                Pre-Gig Prepared Playlist &amp; Auto-Matched Karaoke ({artistPlaylist.length} Songs)
              </div>
              <h2 className="text-lg font-semibold text-white">
                Songs You Plan to Sing (Visible to Audience for Upvoting &amp; ₹50 Dedications)
              </h2>
              <p className="text-xs text-white/60">
                Add your prepared setlist ahead of time. Leave the YouTube box blank to auto-match a verified Karaoke track, or paste your own link!
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAddPlaylistSong}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-black/40 border border-white/10 rounded-2xl p-3.5 mb-4"
          >
            <div className="md:col-span-3">
              <input
                type="text"
                required
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                placeholder="Song Title (e.g., Gul, Yellow) *"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="text"
                value={playlistArtist}
                onChange={(e) => setPlaylistArtist(e.target.value)}
                placeholder="Original Artist (e.g., Anuv Jain)"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="md:col-span-4">
              <input
                type="text"
                value={playlistYoutubeUrl}
                onChange={(e) => setPlaylistYoutubeUrl(e.target.value)}
                placeholder="Optional: YouTube URL (Auto-matched if left blank)"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={addingPlaylist}
                className="w-full h-full py-2 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {addingPlaylist ? "Adding..." : "Add to Playlist"}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {artistPlaylist.map((song: any) => (
              <div
                key={song.id}
                className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 text-[10px] font-medium">
                      <ThumbsUp className="w-3 h-3 text-emerald-400" />
                      {song.upvotes || 0} Upvotes
                    </span>
                    {song.youtube_video_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                        <Youtube className="w-3 h-3 text-red-400" />
                        Karaoke Ready
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white leading-snug">{song.song_title}</p>
                  <p className="text-xs text-white/55 truncate mt-0.5">
                    {song.original_artist || "Artist Setlist"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleLoadSongIntoKaraoke(song)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white text-black font-semibold text-[11px] flex items-center justify-center gap-1 hover:bg-white/90 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-black" />
                    Play Karaoke
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePlaylistSong(song.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-300 cursor-pointer"
                    title="Remove from Playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. SEPARATE PRIORITY SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SECTION A: ₹50 PRIORITY SONG DEDICATIONS */}
          <div className="rounded-3xl bg-gradient-to-b from-amber-500/15 via-[#141210] to-[#0d0d14] border-2 border-amber-400/50 p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-black font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Priority #1 • ₹50 Song Dedications
                </span>
                <span className="text-xs font-bold text-amber-300">
                  {priorityDedications.length} Active
                </span>
              </div>
              <p className="text-xs text-amber-100/75 mb-4">
                Paid ₹50 Dedications take top priority! Call out the dedicated name on the mic before singing.
              </p>

              <div className="space-y-3.5">
                {priorityDedications.length === 0 ? (
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-6 text-center text-xs text-white/50">
                    No ₹50 paid dedications in queue right now.
                  </div>
                ) : (
                  priorityDedications.map((song: any) => (
                    <div
                      key={song.id}
                      className={`rounded-2xl p-4 border transition ${
                        song.status === "playing"
                          ? "bg-emerald-500/20 border-emerald-400"
                          : "bg-black/60 border-amber-400/40"
                      }`}
                    >
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap mb-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/25 text-amber-200 font-bold text-[10px]">
                            ₹50 PAID PRIORITY
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-semibold">
                            <ThumbsUp className="w-3 h-3 text-emerald-400" />
                            {song.upvotes || 0} Upvotes
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white leading-snug break-words">
                          {song.song_title}
                        </h3>
                        {song.original_artist && (
                          <p className="text-xs text-white/70 mt-0.5">{song.original_artist}</p>
                        )}
                      </div>

                      {/* Name Callout Box */}
                      <div className="p-3 rounded-xl bg-amber-400/15 border border-amber-400/40 mb-3">
                        <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          CALL OUT NAME: <span className="text-white underline">{song.dedicated_to}</span>
                        </p>
                        <p className="text-[11px] text-white/80 mt-0.5">
                          Requested by: <strong>{song.requester_name}</strong>
                        </p>
                        {song.dedication_message && (
                          <p className="text-xs text-amber-100 mt-1 italic">
                            &ldquo;{song.dedication_message}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Auto-Matched Karaoke Candidate Version Switcher */}
                      {Array.isArray(song.karaoke_candidates) && song.karaoke_candidates.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Youtube className="w-3 h-3 text-red-400" />
                            Auto-Matched Karaoke Track (Tap to Switch Key/Version):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {song.karaoke_candidates.map((cand: any) => {
                              const isSelected = song.youtube_video_id === cand.videoId
                              return (
                                <button
                                  key={cand.videoId}
                                  type="button"
                                  onClick={() => handleSwitchKaraokeCandidate(song, cand)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                                    isSelected
                                      ? "bg-red-500/30 border border-red-400 text-white"
                                      : "bg-white/5 hover:bg-white/15 border border-white/10 text-white/65"
                                  }`}
                                >
                                  {isSelected ? "✓ " : ""}
                                  {cand.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSongIntoKaraoke(song)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                          Load Karaoke &amp; HDMI
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkPlayed(song.id)}
                          className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-emerald-500/25 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Done
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION B: UPVOTED CROWD & PLAYLIST QUEUE */}
          <div className="rounded-3xl bg-white/[0.04] border border-purple-400/40 p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/25 border border-purple-400/40 text-purple-200 font-bold text-xs">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                  Priority #2 • Upvoted Songs Queue
                </span>
                <span className="text-xs font-semibold text-purple-300">
                  {upvotedQueue.length} Confirmed
                </span>
              </div>
              <p className="text-xs text-white/65 mb-4">
                Confirmed crowd requests &amp; your playlist songs ranked live by audience upvotes.
              </p>

              <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                {upvotedQueue.length === 0 ? (
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-6 text-center text-xs text-white/50">
                    No confirmed songs in the upvote queue yet.
                  </div>
                ) : (
                  upvotedQueue.map((song: any, index: number) => (
                    <div
                      key={song.id}
                      className={`rounded-2xl p-4 border transition ${
                        song.status === "playing"
                          ? "bg-emerald-500/20 border-emerald-400"
                          : "bg-black/50 border-white/10 hover:border-purple-400/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/80">
                              #{index + 1}
                            </span>
                            {song.source_type === "artist_playlist" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                Your Playlist
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                                By {song.requester_name}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white leading-snug break-words">
                            {song.song_title}
                          </h3>
                          {song.original_artist && (
                            <p className="text-xs text-white/60 mt-0.5">{song.original_artist}</p>
                          )}
                        </div>

                        <div className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-center shrink-0">
                          <p className="text-sm font-extrabold text-white leading-none">
                            ▲ {song.upvotes || 0}
                          </p>
                          <p className="text-[9px] uppercase text-purple-200 mt-0.5">Upvotes</p>
                        </div>
                      </div>

                      {song.wants_dedication === 1 && song.dedication_payment_status !== "paid" && (
                        <div className="mb-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-amber-200">
                            <Clock className="w-3 h-3 inline mr-1 text-amber-400" />
                            Dedication for <strong>{song.dedicated_to}</strong> (Awaiting ₹50)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarkDedicationPaid(song.id)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-semibold text-[10px] shrink-0 cursor-pointer"
                          >
                            Mark ₹50 Paid
                          </button>
                        </div>
                      )}

                      {/* Auto-Matched Karaoke Candidate Pills */}
                      {Array.isArray(song.karaoke_candidates) && song.karaoke_candidates.length > 0 && (
                        <div className="mb-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Youtube className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            {song.karaoke_candidates.map((cand: any) => {
                              const isSelected = song.youtube_video_id === cand.videoId
                              return (
                                <button
                                  key={cand.videoId}
                                  type="button"
                                  onClick={() => handleSwitchKaraokeCandidate(song, cand)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                                    isSelected
                                      ? "bg-red-500/25 border border-red-400/60 text-red-200"
                                      : "bg-white/5 hover:bg-white/15 border border-white/10 text-white/60"
                                  }`}
                                >
                                  {isSelected ? "✓ " : ""}
                                  {cand.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSongIntoKaraoke(song)}
                          className="flex-1 py-2 px-3 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-white/90 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                          Load Karaoke
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkPlayed(song.id)}
                          className="py-2 px-3 rounded-xl bg-white/10 hover:bg-emerald-500/25 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Done
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION C: INCOMING 3-SONG AUDIENCE REQUESTS (FULL SONG TITLES PROMINENTLY SHOWN) */}
          <div className="rounded-3xl bg-white/[0.04] border border-white/15 p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Incoming 3-Song Requests
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  {pendingBatches.length} Batches
                </span>
              </div>
              <p className="text-xs text-white/65 mb-4">
                Each audience member sends 3 songs. Confirm the 1 song you can sing—its YouTube Karaoke is auto-matched &amp; ready!
              </p>

              <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
                {pendingBatches.length === 0 ? (
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-6 text-center text-xs text-white/50">
                    All incoming 3-song requests have been reviewed!
                  </div>
                ) : (
                  pendingBatches.map((batch: any) => (
                    <div
                      key={batch.id}
                      className={`rounded-2xl p-4 border ${
                        batch.wants_dedication
                          ? "bg-amber-500/10 border-amber-400/40"
                          : "bg-black/50 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-xs font-bold text-white">
                          From: {batch.requester_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeclineBatch(batch.id)}
                          className="text-[11px] text-white/50 hover:text-red-400 flex items-center gap-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Pass All
                        </button>
                      </div>

                      {batch.wants_dedication === 1 && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/35 text-[11px] text-amber-200">
                          <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                          <strong>₹50 Dedication Candidate!</strong> Wants to dedicate to{" "}
                          <span className="text-white underline">{batch.dedicated_to}</span> once you confirm 1 song.
                        </div>
                      )}

                      {/* Redesigned 3-Song Cards: Song Title is Large, Full-Width & Never Truncated */}
                      <div className="space-y-2.5">
                        {(batch.songs || []).map((s: any) => (
                          <div
                            key={s.id}
                            className="p-3.5 rounded-xl bg-white/[0.05] border border-white/15 space-y-2.5 hover:border-emerald-400/40 transition"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded bg-purple-500/25 border border-purple-400/30 text-purple-200 font-bold text-[10px] uppercase tracking-wider">
                                  Song #{s.choice_index}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <Youtube className="w-3 h-3 text-red-400" />
                                  Auto-Karaoke Matched
                                </span>
                              </div>

                              {/* Full Prominent Song Name */}
                              <h4 className="text-base font-bold text-white leading-snug break-words mt-1">
                                {s.song_title}
                              </h4>
                              {s.original_artist && (
                                <p className="text-xs text-white/65 mt-0.5 break-words">
                                  {s.original_artist}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmAudienceSong(s.id)}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                Confirm &ldquo;{s.song_title}&rdquo;
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setShowCustomUrlInputFor((prev) => ({
                                    ...prev,
                                    [s.id]: !prev[s.id],
                                  }))
                                }
                                title="Override YouTube Link"
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/65 text-[10px] cursor-pointer"
                              >
                                <Youtube className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {showCustomUrlInputFor[s.id] && (
                              <input
                                type="text"
                                value={confirmYoutubeUrls[s.id] || ""}
                                onChange={(e) =>
                                  setConfirmYoutubeUrls((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }))
                                }
                                placeholder="Optional: Custom YouTube URL (otherwise auto-matched)"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-[11px] text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. UNDER IT: YOUTUBE KARAOKE WIDGET + HDMI VENUE LED SCREEN CONTROLLER */}
        <section
          id="karaoke-hdmi-station"
          className="rounded-3xl bg-gradient-to-br from-[#13111c] via-[#0c0c14] to-[#171210] border border-white/15 p-6 shadow-2xl scroll-mt-20"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">
                <Youtube className="w-4 h-4" />
                Integrated Stage Karaoke &amp; Venue LED Controller
              </div>
              <h2 className="text-2xl font-bold text-white">
                YouTube Karaoke Player &amp; HDMI Venue LED Screen
              </h2>
              <p className="text-xs text-white/65 mt-0.5">
                Every confirmed song is automatically matched with an embed-ready Karaoke video. Use Lyrics-Only Mute Mode when playing live acoustic instruments!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Mute Backing Audio / Lyrics Teleprompter Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextMute = !muteKaraokeAudio
                  setMuteKaraokeAudio(nextMute)
                  broadcastToLedScreen(karaokeVideoId, activeKaraokeSong, nextMute)
                }}
                className={`px-4 py-3 rounded-2xl border font-semibold text-xs flex items-center gap-2 transition cursor-pointer ${
                  muteKaraokeAudio
                    ? "bg-amber-400/20 border-amber-400 text-amber-200"
                    : "bg-white/10 border-white/15 text-white/85 hover:bg-white/15"
                }`}
              >
                {muteKaraokeAudio ? (
                  <>
                    <VolumeX className="w-4 h-4 text-amber-300" />
                    Lyrics-Only Mode (Audio Muted)
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-300" />
                    Karaoke Audio ON
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConnectHdmiScreen}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-bold text-xs flex items-center gap-2 hover:opacity-95 transition cursor-pointer shadow-xl"
              >
                <Tv className="w-4 h-4" />
                {hdmiConnected
                  ? "Syncing with HDMI Venue LED Screen (Re-Open)"
                  : "Connect HDMI / Launch Venue LED Screen"}
              </button>

              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(karaokeSearchQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-200 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-4 h-4" />
                Open on YouTube
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Embedded YouTube Karaoke Player */}
            <div className="lg:col-span-7 space-y-4">
              {activeKaraokeSong && (
                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-emerald-300 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                        Loaded in Stage Karaoke &amp; HDMI Output
                      </p>
                      <p className="text-base font-bold text-white">
                        {activeKaraokeSong.song_title}{" "}
                        {activeKaraokeSong.original_artist
                          ? `• ${activeKaraokeSong.original_artist}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {activeKaraokeSong.dedication_payment_status === "paid" &&
                    activeKaraokeSong.dedicated_to && (
                      <div className="px-3.5 py-2 rounded-xl bg-amber-400/20 border border-amber-400/50 text-xs text-amber-200 font-semibold">
                        🎤 Shoutout: Dedicated to {activeKaraokeSong.dedicated_to} (from{" "}
                        {activeKaraokeSong.requester_name})
                      </div>
                    )}
                </div>
              )}

              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
                <iframe
                  key={`${karaokeVideoId}-${muteKaraokeAudio ? "muted" : "audio"}`}
                  src={`https://www.youtube.com/embed/${karaokeVideoId}?autoplay=0&mute=${
                    muteKaraokeAudio ? 1 : 0
                  }&rel=0&modestbranding=1`}
                  title="Artist Stage YouTube Karaoke Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customYoutubeInput}
                  onChange={(e) => setCustomYoutubeInput(e.target.value)}
                  placeholder="Paste any YouTube Karaoke URL (https://www.youtube.com/watch?v=...) or Video ID"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomYoutubeUrl}
                  className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs shrink-0 cursor-pointer"
                >
                  Load &amp; Project to HDMI
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Instant Karaoke Track Search & One-Click Switcher */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-black/40 border border-white/10 rounded-2xl p-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2">
                  Search Auto-Matched Karaoke Catalog or Jump to YouTube
                </label>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={karaokeSearchQuery}
                      onChange={(e) => setKaraokeSearchQuery(e.target.value)}
                      placeholder="Search song title + karaoke..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(karaokeSearchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-xs flex items-center gap-1 shrink-0"
                  >
                    YouTube ↗
                  </a>
                </div>

                <p className="text-[11px] uppercase tracking-wider text-white/45 font-semibold mb-2">
                  Embed-Verified Karaoke Tracks (Click to Play &amp; Sync HDMI)
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {karaokeSuggestions.map((item, idx) => (
                    <button
                      key={`${item.videoId}-${idx}`}
                      type="button"
                      onClick={() => {
                        setKaraokeVideoId(item.videoId)
                        setCustomYoutubeInput(`https://www.youtube.com/watch?v=${item.videoId}`)
                        broadcastToLedScreen(item.videoId, activeKaraokeSong, muteKaraokeAudio)
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                        karaokeVideoId === item.videoId
                          ? "bg-purple-500/20 border-purple-400 text-white"
                          : "bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-white/80"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-white/50">
                          {item.label ? `${item.label} • ` : ""}
                          {item.channel}
                        </p>
                      </div>
                      <Play className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-white/55 flex items-center justify-between">
                <span>HDMI Tip: Drag the Venue LED window to your extended HDMI display.</span>
                <button
                  type="button"
                  onClick={handleConnectHdmiScreen}
                  className="text-emerald-300 hover:underline font-medium cursor-pointer"
                >
                  Open LED Window ↗
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Venue Table QR Modal */}
      {activeGig && (
        <QrCodeModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          locationName={activeGig.location_name || "Venue"}
          locationSlug={activeGig.location_slug || "toit-indiranagar"}
          eventDateOnly={activeGig.event_date_only || new Date(activeGig.date).toISOString().slice(0, 10)}
          eventTitle={activeGig.title}
          artistName={artist?.name}
        />
      )}

      {/* Edit Artist Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12121c] border border-white/15 rounded-3xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Artist Profile (Shown on Audience QR View)</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs text-white/75 mb-1">Stage Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/75 mb-1">Instagram Handle</label>
                <input
                  type="text"
                  value={profileInsta}
                  onChange={(e) => setProfileInsta(e.target.value)}
                  placeholder="@arjunmehtalive"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/75 mb-1">Profile Image URL</label>
                <input
                  type="url"
                  value={profileAvatar}
                  onChange={(e) => setProfileAvatar(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/75 mb-1">Short Bio</label>
                <input
                  type="text"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs cursor-pointer"
              >
                Save Artist Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Schedule New Gig Modal */}
      {showNewGigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12121c] border border-white/15 rounded-3xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Schedule a New Gig Location</h3>
              <button
                type="button"
                onClick={() => setShowNewGigModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateGig} className="space-y-3.5">
              <div>
                <label className="block text-xs text-white/75 mb-1">Gig / Event Title *</label>
                <input
                  type="text"
                  required
                  value={newGigTitle}
                  onChange={(e) => setNewGigTitle(e.target.value)}
                  placeholder="e.g., Friday Acoustic Request Night"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/75 mb-1">Venue &amp; City Location *</label>
                <input
                  type="text"
                  required
                  value={newGigLocation}
                  onChange={(e) => setNewGigLocation(e.target.value)}
                  placeholder="e.g., Hard Rock Cafe • Bengaluru"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/75 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newGigDate}
                    onChange={(e) => setNewGigDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/75 mb-1">Entry Ticket (₹)</label>
                  <input
                    type="number"
                    value={newGigPrice}
                    onChange={(e) => setNewGigPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-black font-bold text-xs cursor-pointer"
              >
                Create Gig &amp; Generate Location+Date QR
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
