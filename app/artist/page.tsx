"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Reorder, useDragControls } from "framer-motion"
import QrCodeModal from "@/components/qr-code-modal"
import MuseLoadingScreen from "@/components/muse-loading-screen"
import StageTrackActions from "@/components/stage-track-actions"
import { extractYouTubeId } from "@/lib/youtube"
import { generateUPIQR } from "@/lib/upipay"
import {
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Check,
  CheckCircle2,
  Music,
  X,
  Tv,
  QrCode,
  Plus,
  ExternalLink,
  Volume2,
  VolumeX,
  Heart,
  LogOut,
  UserCheck,
  Search,
  Trash2,
  Disc3,
  ListMusic,
  Radio,
  Calendar,
  Wallet,
  MapPin,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ListOrdered,
  GripVertical,
  Shuffle,
  Repeat,
  MoreHorizontal,
  Youtube,
  Loader2,
} from "lucide-react"

function getSongThumbnail(song: any): string | null {
  if (song?.youtube_video_id) {
    return `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`
  }
  const extracted = extractYouTubeId(song?.youtube_url)
  if (extracted) {
    return `https://img.youtube.com/vi/${extracted}/hqdefault.jpg`
  }
  return null
}

function SetlistSongRow({
  song,
  index,
  totalCount,
  activeKaraokeSong,
  isKaraokePlaying,
  handleLoadSongIntoKaraoke,
  setIsKaraokePlaying,
  handleMarkPlayed,
  handleToggleSongUpvote,
  handleDeletePlaylistSong,
  handleMoveSong,
}: {
  song: any
  index: number
  totalCount: number
  activeKaraokeSong: any
  isKaraokePlaying: boolean
  handleLoadSongIntoKaraoke: (song: any) => void
  setIsKaraokePlaying: (playing: boolean) => void
  handleMarkPlayed: (id: string) => void
  handleToggleSongUpvote: (id: string) => void
  handleDeletePlaylistSong: (id: string) => void
  handleMoveSong: (id: string, direction: "up" | "down") => void
}) {
  const dragControls = useDragControls()
  const isCurrentActive = activeKaraokeSong?.id === song.id
  const isCurrentlyPlaying = isCurrentActive && isKaraokePlaying
  const isMarkedDone = song.status === "played"
  const isPaidDedication =
    song.dedication_payment_status === "paid" || Boolean(song.wants_dedication)

  return (
    <Reorder.Item
      as="div"
      value={song}
      id={song.id}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{
        scale: 1.025,
        boxShadow: "0 22px 35px -8px rgba(24, 22, 21, 0.28), 0 0 0 2px rgba(217, 35, 35, 0.7)",
        zIndex: 50,
        backgroundColor: "#FFFFFF",
      }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl border transition select-none ${
        isCurrentlyPlaying
          ? "bg-[#D92323]/8 border-[#D92323]/40 shadow-sm ring-2 ring-[#D92323]/20"
          : isMarkedDone
          ? "bg-white/50 border-emerald-300/60 opacity-80 hover:opacity-100"
          : isPaidDedication
          ? "bg-amber-50/80 border-amber-300/80 hover:bg-amber-50"
          : "bg-white border-[#181615]/10 hover:border-[#181615]/25 hover:shadow-xs"
      }`}
    >
      {/* Left: Rank + Thumbnail + Title/Artist + Badges */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-black text-[#5C5650] w-5 text-center shrink-0">
          {index + 1}
        </span>

        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
          {getSongThumbnail(song) ? (
            <img
              src={getSongThumbnail(song)!}
              alt={song.song_title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-400">
              <Music className="w-5 h-5" />
            </div>
          )}
          {isCurrentlyPlaying && (
            <div className="absolute inset-0 bg-[#D92323]/60 flex items-center justify-center">
              <Play className="w-4 h-4 fill-white text-white animate-pulse" />
            </div>
          )}
          {isMarkedDone && !isCurrentlyPlaying && (
            <div className="absolute inset-0 bg-emerald-900/60 flex items-center justify-center">
              <Check className="w-4 h-4 text-white stroke-[3]" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-xs sm:text-sm font-extrabold truncate ${
                isMarkedDone ? "line-through text-[#5C5650]" : "text-[#181615]"
              }`}
            >
              {song.song_title}
            </p>

            {isMarkedDone && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0">
                <Check className="w-2.5 h-2.5 text-emerald-600" />
                Played
              </span>
            )}

            {isCurrentlyPlaying && (
              <span className="px-2 py-0.5 rounded-full bg-[#D92323] text-white text-[9px] font-extrabold flex items-center gap-1 shrink-0 animate-pulse">
                <Play className="w-2 h-2 fill-white" />
                Playing Video
              </span>
            )}

            {isPaidDedication && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 text-[9px] font-black shrink-0">
                ₹50 VIP
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#5C5650] truncate">
            {song.original_artist || (song.source_type === "artist_playlist" ? "Setlist Track" : song.requester_name ? `Requested by ${song.requester_name}` : "Live Track")}
          </p>
        </div>
      </div>

      {/* Right: PLAY YOUTUBE VIDEO BUTTON + MARK DONE BUTTON + ACTIONS */}
      <div className="flex items-center gap-2.5 shrink-0">
        
        {/* 1. PLAY YOUTUBE VIDEO BUTTON (Directly Next to Song) */}
        {isCurrentlyPlaying ? (
          <button
            type="button"
            onClick={() => setIsKaraokePlaying(false)}
            className="px-3.5 py-1.5 rounded-full bg-[#D92323] hover:bg-[#b81d1d] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition shrink-0"
            title="Pause Playing Video"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Playing</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleLoadSongIntoKaraoke(song)}
            className="px-3.5 py-1.5 rounded-full bg-[#181615] hover:bg-[#D92323] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition shrink-0 group/play"
            title="Play YouTube Video next to song"
          >
            <Play className="w-3.5 h-3.5 fill-current group-hover/play:scale-110 transition-transform" />
            <span>Play Video</span>
          </button>
        )}

        {/* 2. MARK AS DONE BUTTON */}
        <button
          type="button"
          onClick={() => handleMarkPlayed(song.id)}
          className={`p-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
            isMarkedDone
              ? "bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100"
              : "border-[#181615]/15 hover:border-emerald-600 hover:text-emerald-600 text-[#5C5650]"
          }`}
          title={isMarkedDone ? "Already marked as Done (click to toggle)" : "Mark as Done"}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        {/* 3. Upvotes / Heart */}
        <button
          type="button"
          onClick={() => handleToggleSongUpvote(song.id)}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#5C5650] hover:text-[#D92323] cursor-pointer"
          title="Upvote"
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              (song.upvotes || 0) > 0 ? "fill-[#D92323] text-[#D92323]" : "text-neutral-300"
            }`}
          />
          <span>{song.upvotes || 0}</span>
        </button>

        {/* 4. Delete from Playlist (if artist's playlist) */}
        {song.source_type === "artist_playlist" && (
          <button
            type="button"
            onClick={() => handleDeletePlaylistSong(song.id)}
            className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-[#D92323] transition cursor-pointer p-1"
            title="Remove from Playlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 5. Three Lines Reorder Handle: Hold & drag anywhere to reorder queue */}
        <div
          className="flex items-center gap-1 pl-1.5 border-l border-[#181615]/10 text-neutral-400 shrink-0"
          title="Hold and drag to reorder setlist queue"
        >
          <div
            onPointerDown={(e) => {
              e.stopPropagation()
              dragControls.start(e)
            }}
            style={{ touchAction: "none" }}
            className="flex flex-col items-center justify-center gap-[3px] py-1.5 px-2 rounded-lg hover:bg-[#181615]/10 active:scale-110 active:bg-[#D92323]/15 text-[#5C5650] hover:text-[#181615] cursor-grab active:cursor-grabbing transition select-none group/handle"
            title="Hold and drag to move anywhere in setlist"
          >
            <span className="w-3.5 h-[2px] bg-neutral-400 group-hover/handle:bg-[#181615] rounded-full transition-colors" />
            <span className="w-3.5 h-[2px] bg-neutral-400 group-hover/handle:bg-[#181615] rounded-full transition-colors" />
            <span className="w-3.5 h-[2px] bg-neutral-400 group-hover/handle:bg-[#181615] rounded-full transition-colors" />
          </div>

          {/* Quick Nudge Buttons */}
          <div className="flex flex-col -space-y-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleMoveSong(song.id, "up")
              }}
              disabled={index === 0}
              className="p-0.5 rounded hover:bg-[#181615]/10 text-neutral-400 hover:text-[#181615] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition"
              title="Push up in setlist"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleMoveSong(song.id, "down")
              }}
              disabled={index === totalCount - 1}
              className="p-0.5 rounded hover:bg-[#181615]/10 text-neutral-400 hover:text-[#181615] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition"
              title="Push down in setlist"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Reorder.Item>
  )
}

export default function ArtistDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [qrOpen, setQrOpen] = useState(false)

  // Quick Add Song Form State
  const [showAddPlaylistForm, setShowAddPlaylistForm] = useState(false)
  const [playlistTitle, setPlaylistTitle] = useState("")
  const [playlistArtist, setPlaylistArtist] = useState("")
  const [playlistYoutubeUrl, setPlaylistYoutubeUrl] = useState("")
  const [addingPlaylist, setAddingPlaylist] = useState(false)

  // YouTube Karaoke & HDMI State (Never autoplays on load)
  const [activeKaraokeSong, setActiveKaraokeSong] = useState<any>(null)
  const [karaokeVideoId, setKaraokeVideoId] = useState<string>("")
  const [customYoutubeInput, setCustomYoutubeInput] = useState<string>("")
  const [hdmiConnected, setHdmiConnected] = useState(false)
  const [muteKaraokeAudio, setMuteKaraokeAudio] = useState(false)
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false)

  // In-Player YouTube Search State
  const [ytSearchQuery, setYtSearchQuery] = useState("")
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([])
  const [isSearchingYt, setIsSearchingYt] = useState(false)
  const [ytSearchSubmitted, setYtSearchSubmitted] = useState(false)
  const [showYtResultsPanel, setShowYtResultsPanel] = useState(false)
  const [ytApiConnected, setYtApiConnected] = useState<boolean | null>(null)

  // Sync search input with the currently selected song title
  useEffect(() => {
    if (activeKaraokeSong?.song_title) {
      const suggested = `${activeKaraokeSong.song_title} ${activeKaraokeSong.original_artist || ""} karaoke`.trim()
      setYtSearchQuery(suggested)
    }
  }, [activeKaraokeSong?.id, activeKaraokeSong?.song_title])

  // Auto-mark Done on YouTube Video End or Near-End
  const autoMarkedIdsRef = useRef<Set<string>>(new Set())
  const ytPlayerRef = useRef<any>(null)
  const [doneToast, setDoneToast] = useState<{ id: string; title: string } | null>(null)
  const [playlistViewFilter, setPlaylistViewFilter] = useState<"playlist" | "requests" | "dedications" | "all">("playlist")
  const [currentDateStr, setCurrentDateStr] = useState<string>("")

  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    )
  }, [])

  // Optional custom YouTube URL override per pending song confirmation
  const [confirmYoutubeUrls] = useState<Record<string, string>>({})

  // Pending batches tab filter: 'all' | 'dedication' | 'regular'
  const [pendingBatchFilter, setPendingBatchFilter] = useState<"all" | "dedication" | "regular">("all")

  // Single Unified Main Tab (No duplicate tabs)
  const [activeTab, setActiveTab] = useState<"music" | "batches" | "videos" | "shows" | "bank">("music")

  // Left Sidebar Track Filter
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "playlist" | "dedications" | "requests">("all")
  const [searchFilter, setSearchFilter] = useState("")

  // Bank & UPIPay State
  const [upiId, setUpiId] = useState("")
  const [payeeName, setPayeeName] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [ifscCode, setIfscCode] = useState("")
  const [upipayProvider, setUpipayProvider] = useState<"upi_direct" | "phonepe" | "paytm">("upi_direct")
  const [upipayMerchantId, setUpipayMerchantId] = useState("")
  const [savingBank, setSavingBank] = useState(false)
  const [bankSavedMsg, setBankSavedMsg] = useState<string | null>(null)
  const [bankErrorMsg, setBankErrorMsg] = useState<string | null>(null)

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

  // Debounce ref for setlist reordering persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
            setUpiId((prev) => prev || json.artist.upi_id || "arjunmehta@ybl")
            setPayeeName((prev) => prev || json.artist.payee_name || json.artist.name || "")
            setBankName((prev) => prev || json.artist.bank_name || "")
            setAccountNumber((prev) => prev || json.artist.account_number || "")
            setIfscCode((prev) => prev || json.artist.ifsc_code || "")
            setUpipayProvider((prev) => prev || json.artist.upipay_provider || "upi_direct")
            setUpipayMerchantId((prev) => prev || json.artist.upipay_merchant_id || "")
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
    if (song?.id) {
      autoMarkedIdsRef.current.delete(song.id)
    }
    setActiveKaraokeSong(song)
    const resolvedVideoId =
      overrideVideoId ||
      song.youtube_video_id ||
      extractYouTubeId(song.youtube_url) ||
      ""

    setKaraokeVideoId(resolvedVideoId)
    setIsKaraokePlaying(Boolean(resolvedVideoId))
    setCustomYoutubeInput(resolvedVideoId ? `https://www.youtube.com/watch?v=${resolvedVideoId}` : "")
    if (resolvedVideoId) {
      broadcastToLedScreen(resolvedVideoId, song, muteKaraokeAudio)
    }

    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_now_playing",
        request_id: song.id,
      }),
    })
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
      setShowAddPlaylistForm(false)
      fetchDashboard()
    } finally {
      setAddingPlaylist(false)
    }
  }

  const handleToggleSongUpvote = async (requestId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_upvote",
        request_id: requestId,
      }),
    })
    fetchDashboard()
  }

  const handleConfirmAudienceSong = async (requestId: string) => {
    const customYt = confirmYoutubeUrls[requestId] || undefined
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_song",
        request_id: requestId,
        youtube_url: customYt,
        decline_others: true,
      }),
    })
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

  const handleDeclineSong = async (requestId: string) => {
    await fetch("/api/artist/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decline_song",
        request_id: requestId,
      }),
    })
    fetchDashboard()
  }

  const handleReorderSongs = (newOrder: any[]) => {
    const updated = newOrder.map((s: any, idx: number) => ({
      ...s,
      choice_index: idx + 1,
    }))

    setData((prev: any) => (prev ? { ...prev, artistPlaylist: updated } : prev))

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch("/api/artist/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder_entire_playlist",
          ordered_ids: updated.map((s: any) => s.id),
        }),
      })
    }, 350)
  }

  const handleMoveSong = (songId: string, direction: "up" | "down") => {
    const currentList = [...(data?.artistPlaylist || [])]
    const idx = currentList.findIndex((s: any) => s.id === songId)
    if (idx === -1) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= currentList.length) return
    const [moved] = currentList.splice(idx, 1)
    currentList.splice(targetIdx, 0, moved)
    handleReorderSongs(currentList)
  }

  const handleMarkPlayed = useCallback(
    async (requestId: string) => {
      await fetch("/api/artist/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_played",
          request_id: requestId,
        }),
      })
      fetchDashboard()
    },
    [fetchDashboard]
  )

  // Auto-mark as done when the YouTube video finishes or is in the end of finishing
  const triggerAutoMarkDone = useCallback(
    async (songIdOverride?: string) => {
      const targetId = songIdOverride || activeKaraokeSong?.id
      if (!targetId || autoMarkedIdsRef.current.has(targetId)) return
      autoMarkedIdsRef.current.add(targetId)

      const targetTitle = activeKaraokeSong?.song_title || "Song"
      setDoneToast({ id: targetId, title: targetTitle })
      setTimeout(() => {
        setDoneToast((prev) => (prev?.id === targetId ? null : prev))
      }, 7000)

      await handleMarkPlayed(targetId)
    },
    [activeKaraokeSong, handleMarkPlayed]
  )

  // 1. Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!(window as any).YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [])

  // Helper to subscribe the YouTube iframe to postMessage state/time events
  const registerYouTubeIframeListener = useCallback(() => {
    if (typeof window === "undefined") return
    const iframe = document.getElementById("stage-active-player") as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "listening", id: "stage-active-player", channel: "widget" }),
        "*"
      )
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "addEventListener",
          args: ["onStateChange"],
          id: "stage-active-player",
          channel: "widget",
        }),
        "*"
      )
    }
    const YT = (window as any).YT
    if (YT?.Player && iframe) {
      try {
        ytPlayerRef.current = new YT.Player(iframe, {
          events: {
            onStateChange: (e: any) => {
              if (e?.data === 0) triggerAutoMarkDone()
            },
          },
        })
      } catch {
        // already bound
      }
    }
  }, [triggerAutoMarkDone])

  // 2. YouTube postMessage listener: Detects state change (ended) or nearing the end
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data
        // Video finished (info === 0 is ENDED)
        if (payload?.event === "onStateChange" && (payload?.info === 0 || payload?.info === "0")) {
          triggerAutoMarkDone()
        }
        // Video in the end of finishing (within last 4 seconds) or playerState === 0
        if (payload?.event === "infoDelivery" && payload?.info) {
          if (payload.info.playerState === 0) {
            triggerAutoMarkDone()
          }
          const cur = payload.info.currentTime
          const dur = payload.info.duration
          if (typeof cur === "number" && typeof dur === "number" && dur > 5 && cur >= dur - 4) {
            triggerAutoMarkDone()
          }
        }
      } catch {
        // ignore non-json messages
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [triggerAutoMarkDone])

  // 3. Keep YouTube listener registered & poll player instance for near-end detection
  useEffect(() => {
    registerYouTubeIframeListener()
    const interval = setInterval(() => {
      registerYouTubeIframeListener()
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
          const cur = ytPlayerRef.current.getCurrentTime()
          const dur = ytPlayerRef.current.getDuration()
          if (typeof cur === "number" && typeof dur === "number" && dur > 5 && cur >= dur - 4) {
            triggerAutoMarkDone()
          }
        }
      } catch {
        // ignore
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [karaokeVideoId, isKaraokePlaying, registerYouTubeIframeListener, triggerAutoMarkDone])

  // 4. Default active song from today's playlist on first load if not chosen yet
  useEffect(() => {
    if (data?.artistPlaylist?.length > 0 && !activeKaraokeSong) {
      const defaultSong =
        data.artistPlaylist.find((s: any) => s.status === "playing") ||
        data.artistPlaylist.find((s: any) => s.status !== "played") ||
        data.artistPlaylist[0]
      if (defaultSong) {
        setActiveKaraokeSong(defaultSong)
        const resolved =
          defaultSong.youtube_video_id ||
          extractYouTubeId(defaultSong.youtube_url) ||
          ""
        setKaraokeVideoId(resolved)
        setCustomYoutubeInput(resolved ? `https://www.youtube.com/watch?v=${resolved}` : "")
      }
    }
  }, [data, activeKaraokeSong])

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

  const handleSaveCustomYoutubeUrl = async () => {
    const extracted = extractYouTubeId(customYoutubeInput)
    if (extracted) {
      setKaraokeVideoId(extracted)
      setIsKaraokePlaying(true)
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

  const handleSearchYouTube = async (customQ?: string) => {
    const q = (customQ ?? ytSearchQuery).trim()
    if (!q) return

    // If it's a direct YouTube link or 11-char video ID, load and attach immediately
    const directId = extractYouTubeId(q)
    if (directId) {
      setKaraokeVideoId(directId)
      setIsKaraokePlaying(true)
      setCustomYoutubeInput(`https://www.youtube.com/watch?v=${directId}`)
      broadcastToLedScreen(directId, activeKaraokeSong, muteKaraokeAudio)
      if (activeKaraokeSong?.id) {
        await fetch("/api/artist/dashboard", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attach_youtube",
            request_id: activeKaraokeSong.id,
            youtube_url: `https://www.youtube.com/watch?v=${directId}`,
          }),
        })
        fetchDashboard()
      }
      setShowYtResultsPanel(false)
      return
    }

    setIsSearchingYt(true)
    setYtSearchSubmitted(true)
    setShowYtResultsPanel(true)
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const json = await res.json()
        setYtSearchResults(Array.isArray(json.results) ? json.results : [])
        if (typeof json.api_connected === "boolean") {
          setYtApiConnected(json.api_connected)
        }
      } else {
        setYtSearchResults([])
      }
    } catch {
      setYtSearchResults([])
    } finally {
      setIsSearchingYt(false)
    }
  }

  const handleSelectYouTubeVideo = async (video: any) => {
    if (!video?.videoId) return
    const vidId = video.videoId
    setKaraokeVideoId(vidId)
    setIsKaraokePlaying(true)
    setCustomYoutubeInput(`https://www.youtube.com/watch?v=${vidId}`)
    broadcastToLedScreen(vidId, activeKaraokeSong, muteKaraokeAudio)

    if (activeKaraokeSong?.id) {
      await fetch("/api/artist/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach_youtube",
          request_id: activeKaraokeSong.id,
          youtube_url: `https://www.youtube.com/watch?v=${vidId}`,
        }),
      })
      fetchDashboard()
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

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBank(true)
    setBankSavedMsg(null)
    setBankErrorMsg(null)
    try {
      const res = await fetch("/api/artist/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_bank_details",
          upi_id: upiId,
          payee_name: payeeName,
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          upipay_provider: upipayProvider,
          upipay_merchant_id: upipayMerchantId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBankErrorMsg(json.error || "Failed to save.")
      } else {
        setBankSavedMsg("Saved!")
        setTimeout(() => setBankSavedMsg(null), 4000)
        fetchDashboard()
      }
    } catch {
      setBankErrorMsg("Network error.")
    } finally {
      setSavingBank(false)
    }
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
    return <MuseLoadingScreen isLoading={true} />
  }

  if (needsAuth) {
    return (
      <div
        className="min-h-screen bg-[#F4EFE6] text-[#181615] flex items-center justify-center p-4"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        <div className="max-w-sm w-full bg-[#FAF7F2] border-2 border-[#181615] rounded-[28px] p-8 text-center space-y-5 shadow-2xl">
          <Link href="/" className="inline-flex items-center justify-center select-none">
            <span
              className="text-5xl font-normal leading-none tracking-tight"
              style={{ fontFamily: "var(--font-instrument-serif), serif" }}
            >
              <span className="text-[#181615]">m</span>
              <span className="text-[#D92323]">-</span>
            </span>
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#181615]">Artist Portal</h1>
            <p className="text-xs text-[#5C5650]">Sign in to open your live stage console.</p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDemoArtistLogin}
              className="w-full py-2.5 px-4 rounded-full bg-[#D92323] text-white font-semibold text-xs hover:bg-[#b81d1d] transition cursor-pointer"
            >
              Demo Login (Arjun Mehta)
            </button>
            <Link
              href="/login"
              className="block w-full py-2.5 px-4 rounded-full bg-white border border-[#181615]/15 text-[#181615] text-xs font-semibold hover:border-[#181615] transition"
            >
              Sign In
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
    transactions = [],
    earningsSummary = { totalRevenue: 0, dedicationRevenue: 0, tipRevenue: 0, totalTransactions: 0 },
  } = data || {}

  const previewUpiQr = generateUPIQR({
    vpa: upiId || artist?.upi_id || "arjunmehta@ybl",
    name: payeeName || artist?.payee_name || artist?.name || "Live Artist",
    amount: 50,
    orderId: "UPIPAY_PREVIEW_50",
    note: "Song Dedication (₹50)",
    mode: "fixed",
  })

  const currentStageSong =
    activeKaraokeSong ||
    artistPlaylist.find((s: any) => s.status === "playing") ||
    priorityDedications[0] ||
    artistPlaylist[0] ||
    upvotedQueue[0] ||
    null

  const readyToPayBatchesCount = pendingBatches.filter((b: any) => Boolean(b.wants_dedication)).length
  const regularBatchesCount = pendingBatches.filter((b: any) => !b.wants_dedication).length

  const filteredPendingBatches = pendingBatches.filter((b: any) => {
    if (pendingBatchFilter === "dedication") return Boolean(b.wants_dedication)
    if (pendingBatchFilter === "regular") return !b.wants_dedication
    return true
  })

  // Unified tracklist filtered by Left Sidebar selection
  const allTracksPool = [
    ...priorityDedications.map((s: any) => ({ ...s, _tag: "₹50 Paid" })),
    ...artistPlaylist.map((s: any) => ({ ...s, _tag: "Playlist" })),
    ...upvotedQueue.map((s: any) => ({ ...s, _tag: "Request" })),
  ]

  const filteredTracks = allTracksPool
    .filter((s: any) => {
      if (sidebarFilter === "playlist") return s.source_type === "artist_playlist"
      if (sidebarFilter === "dedications") return s.dedication_payment_status === "paid" || Boolean(s.wants_dedication)
      if (sidebarFilter === "requests") return s.source_type === "audience_request"
      return true
    })
    .filter((s: any) => {
      if (!searchFilter.trim()) return true
      const q = searchFilter.toLowerCase()
      return (
        s.song_title?.toLowerCase().includes(q) ||
        s.original_artist?.toLowerCase().includes(q) ||
        s.requester_name?.toLowerCase().includes(q)
      )
    })

  // Filtered & sorted tracks specifically for Today's Setlist (Tab 1)
  const displaySongsForTab1 =
    playlistViewFilter === "playlist"
      ? artistPlaylist
      : playlistViewFilter === "requests"
      ? upvotedQueue
      : playlistViewFilter === "dedications"
      ? priorityDedications
      : filteredTracks

  const sortedTab1Songs = [...displaySongsForTab1].sort((a: any, b: any) => {
    // 1. Currently active or playing song goes to top
    const aPlaying = (a.id === activeKaraokeSong?.id && isKaraokePlaying) || a.status === "playing" ? 1 : 0
    const bPlaying = (b.id === activeKaraokeSong?.id && isKaraokePlaying) || b.status === "playing" ? 1 : 0
    if (bPlaying !== aPlaying) return bPlaying - aPlaying

    // 2. Played songs pushed to bottom
    const aPlayed = a.status === "played" ? 1 : 0
    const bPlayed = b.status === "played" ? 1 : 0
    if (bPlayed !== aPlayed) return aPlayed - bPlayed

    // 3. VIP paid dedications
    const aPaid = (a.dedication_payment_status === "paid" || Boolean(a.wants_dedication)) ? 1 : 0
    const bPaid = (b.dedication_payment_status === "paid" || Boolean(b.wants_dedication)) ? 1 : 0
    if (bPaid !== aPaid) return bPaid - aPaid

    // 4. Setlist queue custom choice index order
    const aChoice = typeof a.choice_index === "number" && a.choice_index > 0 ? a.choice_index : 999
    const bChoice = typeof b.choice_index === "number" && b.choice_index > 0 ? b.choice_index : 999
    if (aChoice !== bChoice) return aChoice - bChoice

    // 5. Songs being upvoted a lot pushed to top!
    const bVotes = Number(b.upvotes || 0)
    const aVotes = Number(a.upvotes || 0)
    if (bVotes !== aVotes) return bVotes - aVotes

    return 0
  })

  // The NEXT SONG in Today's Playlist:
  // Must strictly be the next unplayed song following the active song in Today's Playlist / Setlist!
  const todayPlaylistSongs =
    sortedTab1Songs.length > 0
      ? sortedTab1Songs
      : artistPlaylist.length > 0
      ? artistPlaylist
      : data?.artistPlaylist || []

  const activeIndexInPlaylist = todayPlaylistSongs.findIndex(
    (s: any) => s.id === activeKaraokeSong?.id
  )

  let nextPlaylistSong: any = null
  if (activeIndexInPlaylist !== -1) {
    nextPlaylistSong =
      todayPlaylistSongs
        .slice(activeIndexInPlaylist + 1)
        .find((s: any) => s.status !== "played" && s.id !== activeKaraokeSong?.id) || null
  }

  // Fallback: If no unplayed song after active song, find the first unplayed song in Today's Playlist
  if (!nextPlaylistSong) {
    nextPlaylistSong =
      todayPlaylistSongs.find(
        (s: any) => s.status !== "played" && s.id !== activeKaraokeSong?.id
      ) || null
  }

  const filteredTab1Songs = sortedTab1Songs.filter((s: any) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    return (
      s.song_title?.toLowerCase().includes(q) ||
      s.original_artist?.toLowerCase().includes(q) ||
      s.requester_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div
      className="min-h-screen w-full bg-[#FAF7F2] text-[#181615] flex flex-col justify-between select-none"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <MuseLoadingScreen isLoading={false} minDurationMs={2600} />

      {/* ═══════════════════════════════════════════════════════════════════
          1. SINGLE TOP HEADER (Untouched Brand Header: m- + HDMI / Profile / Sign Out)
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#181615]/10 px-6 sm:px-10 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="muse-ing home"
            className="group flex items-center transition-transform duration-300 hover:scale-105 cursor-pointer select-none"
            title="Muse-ing Home"
          >
            <span
              className="instrument text-4xl sm:text-5xl font-normal leading-none tracking-tight"
              style={{ fontFamily: "var(--font-instrument-serif), serif" }}
            >
              <span className="text-[#181615]">m</span>
              <span className="text-[#D92323]">-</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleConnectHdmiScreen}
            className="px-4 py-2 rounded-full bg-[#181615] hover:bg-[#D92323] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Tv className="w-3.5 h-3.5 text-amber-300" />
            <span>{hdmiConnected ? "HDMI Screen Active" : "Connect HDMI Screen"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="px-3.5 py-2 rounded-full bg-white border border-[#181615]/15 hover:border-[#181615] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#181615]" />
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-full bg-white border border-[#181615]/15 text-[#5C5650] hover:text-[#D92323] hover:border-[#D92323]/30 transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          2. FULL-WIDTH LAPTOP VIEWPORT SPREAD (No Duplicate Inner Header)
          Left Sidebar (Filters + Playlists) | Right Stage Area
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row flex-1 w-full">
        
        {/* ─────────────────────────────────────────────────────────────
            LEFT SIDEBAR (Warm Cream #F4EFE6 — No Duplicate Logo)
        ───────────────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-[240px] xl:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#181615]/10 px-6 py-6 flex flex-col justify-between bg-[#F4EFE6]">
          <div className="space-y-7">
            {/* Queue Filter Group -> 3 Buttons: Setlist, Shows, Bank */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5C5650] mb-2">
                Queue Filter
              </p>
              {[
                { id: "music", label: "Setlist", icon: ListMusic, count: artistPlaylist.length },
                { id: "shows", label: "Shows", icon: Calendar, count: gigs.length },
                { id: "bank", label: "Bank", icon: Wallet, count: `₹${earningsSummary.totalRevenue || 0}` },
              ].map((item) => {
                const Icon = item.icon
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as any)
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                      active
                        ? "bg-[#D92323]/12 text-[#D92323] font-bold"
                        : "text-[#5C5650] hover:text-[#181615] hover:bg-[#181615]/5 font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </span>
                    <span className="text-[10px] opacity-70">{item.count}</span>
                  </button>
                )
              })}
            </div>

            {/* Stage Shortcuts Group */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5C5650] mb-2">
                Stage Links
              </p>
              {activeGig && (
                <Link
                  href={`/live/${activeGig.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full px-3 py-2 rounded-xl text-xs text-[#5C5650] hover:text-[#181615] hover:bg-[#181615]/5 font-medium flex items-center gap-2.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#D92323]" />
                  <span>Audience View</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="w-full px-3 py-2 rounded-xl text-xs text-[#5C5650] hover:text-[#181615] hover:bg-[#181615]/5 font-medium flex items-center gap-2.5 transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-[#181615]" />
                <span>Table QR</span>
              </button>
            </div>

            {/* Tonight's Playlist Quick List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C5650]">
                  Playlists
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPlaylistForm((v) => !v)}
                  className="w-5 h-5 rounded-full bg-white border border-[#181615]/15 hover:bg-[#D92323] hover:text-white hover:border-[#D92323] flex items-center justify-center text-[#181615] transition cursor-pointer"
                  title="Add Song"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                {artistPlaylist.map((song: any) => (
                  <div
                    key={song.id}
                    onClick={() => handleLoadSongIntoKaraoke(song)}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-white/80 flex items-center justify-between gap-1 cursor-pointer group transition"
                  >
                    <span className="text-xs text-[#5C5650] group-hover:text-[#181615] font-medium truncate">
                      {song.song_title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePlaylistSong(song.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-[#D92323]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT MAIN STAGE AREA (Full Width Laptop Spread)
        ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col bg-[#FAF7F2] overflow-hidden">
          
          {/* 1. HERO BANNER IN MUSE BRAND COLORS (#181615 Charcoal + #D92323 Crimson) */}
          <div
            className="relative px-8 sm:px-12 pt-6 pb-12 text-white overflow-hidden"
            style={{
              background: "linear-gradient(120deg, #181615 0%, #3B1212 52%, #A61B1B 100%)",
            }}
          >
            {/* Right Cutout Portrait */}
            <img
              src={
                artist?.avatar_url ||
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80"
              }
              alt={artist?.name || "Artist"}
              className="absolute right-6 bottom-0 h-[108%] w-[38%] object-cover object-top pointer-events-none opacity-85"
              style={{
                maskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, transparent 100%)",
              }}
            />

            {/* Search Pill Only (No Duplicate Header Icons) */}
            <div className="relative z-10 flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 w-full max-w-[280px]">
                <Search className="w-3.5 h-3.5 text-white/80 shrink-0" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search"
                  className="bg-transparent text-xs text-white placeholder-white/70 focus:outline-none w-full"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter("")}
                    className="text-white/70 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Artist Title */}
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 block">
                ARTIST
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
                {artist?.name?.split("&")[0]?.trim() || "Arjun Mehta"}
              </h1>
            </div>
          </div>

          {/* 2. ROUNDED SHEET OVERLAPPING BANNER */}
          <div className="relative z-20 -mt-5 rounded-t-[28px] bg-[#FAF7F2] px-8 sm:px-12 pt-6 pb-8 flex-1 flex flex-col justify-between">
            
            {/* Quick Add Song Popover Form */}
            {showAddPlaylistForm && (
              <form
                onSubmit={handleAddPlaylistSong}
                className="mb-5 p-3.5 rounded-2xl bg-white border border-[#181615]/15 flex flex-wrap items-center gap-2.5 shadow-xs"
              >
                <input
                  type="text"
                  required
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  placeholder="Song Title *"
                  className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                />
                <input
                  type="text"
                  value={playlistArtist}
                  onChange={(e) => setPlaylistArtist(e.target.value)}
                  placeholder="Artist"
                  className="w-40 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                />
                <input
                  type="text"
                  value={playlistYoutubeUrl}
                  onChange={(e) => setPlaylistYoutubeUrl(e.target.value)}
                  placeholder="YouTube URL (Optional)"
                  className="w-52 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={addingPlaylist}
                  className="px-5 py-2 rounded-xl bg-[#D92323] text-white text-xs font-bold cursor-pointer"
                >
                  {addingPlaylist ? "..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPlaylistForm(false)}
                  className="p-1.5 text-[#5C5650] hover:text-[#181615]"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 1: MUSIC (Today's Playlist + Side-by-Side YouTube Player)
            ═══════════════════════════════════════════════════════ */}
            {activeTab === "music" && (
              <div className="space-y-6 flex-1">
                {/* A. PLAYLIST HEADER & VIEW CONTROLS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 p-4 sm:p-5 rounded-2xl border border-[#181615]/10 shadow-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <ListMusic className="w-5 h-5 text-[#D92323]" />
                      <h2 className="text-base sm:text-lg font-black text-[#181615] tracking-tight">
                        Today&apos;s Playlist
                      </h2>

                      {/* Today's Date Badge */}
                      <span className="px-2.5 py-0.5 rounded-full bg-[#181615] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>{currentDateStr || "Today"}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-[#181615]/10 text-[#181615] text-[11px] font-bold">
                        {artistPlaylist.length} Songs
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {artistPlaylist.filter((s: any) => s.status === "played").length} Played
                      </span>
                    </div>

                    {/* Show Name & Location */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#5C5650] flex-wrap">
                      <span className="text-[#181615] font-extrabold flex items-center gap-1">
                        <Disc3 className="w-3.5 h-3.5 text-[#D92323]" />
                        <span>{activeGig?.title || "Unplugged Live Night"}</span>
                      </span>
                      <span className="text-[#5C5650]/40">•</span>
                      <span className="flex items-center gap-1 text-[#5C5650]">
                        <MapPin className="w-3.5 h-3.5 text-[#D92323]" />
                        <span>{activeGig?.location_name || "Indiranagar, Bengaluru"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* B. 2-COLUMN GRID: TODAY'S PLAYLIST (LEFT) + YOUTUBE PLAYER (RIGHT) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                  
                  {/* ─────────────────────────────────────────────────────────────
                      LEFT COLUMN (SPAN 7): TODAY'S PLAYLIST SONGS LIST
                  ───────────────────────────────────────────────────────────── */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Songs List */}
                    <div className="space-y-2">
                      {filteredTab1Songs.length === 0 ? (
                        <div className="bg-white/80 rounded-2xl p-8 text-center space-y-3 border border-[#181615]/10">
                          <Music className="w-8 h-8 text-[#5C5650]/40 mx-auto" />
                          <p className="text-xs font-bold text-[#5C5650]">
                            No songs found for this filter.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAddPlaylistForm(true)}
                            className="px-4 py-1.5 rounded-full bg-[#D92323] text-white text-xs font-bold cursor-pointer"
                          >
                            + Add a Song to Setlist
                          </button>
                        </div>
                      ) : (
                        <Reorder.Group
                          as="div"
                          axis="y"
                          values={filteredTab1Songs}
                          onReorder={handleReorderSongs}
                          className="space-y-2"
                        >
                          {filteredTab1Songs.map((song: any, index: number) => (
                            <SetlistSongRow
                              key={song.id}
                              song={song}
                              index={index}
                              totalCount={filteredTab1Songs.length}
                              activeKaraokeSong={activeKaraokeSong}
                              isKaraokePlaying={isKaraokePlaying}
                              handleLoadSongIntoKaraoke={handleLoadSongIntoKaraoke}
                              setIsKaraokePlaying={setIsKaraokePlaying}
                              handleMarkPlayed={handleMarkPlayed}
                              handleToggleSongUpvote={handleToggleSongUpvote}
                              handleDeletePlaylistSong={handleDeletePlaylistSong}
                              handleMoveSong={handleMoveSong}
                            />
                          ))}
                        </Reorder.Group>
                      )}
                    </div>

                    {/* Incoming Song Batches grouped by person/batch */}
                    {pendingBatches.length > 0 && (
                      <div className="pt-4 border-t border-[#181615]/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-wider text-[#181615] flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-[#D92323]" />
                            <span>Incoming Song Batches ({pendingBatches.length})</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setActiveTab("batches")}
                            className="text-xs font-bold text-[#D92323] hover:underline cursor-pointer"
                          >
                            View All Batches →
                          </button>
                        </div>

                        <div className="space-y-3">
                          {pendingBatches.slice(0, 4).map((batch: any) => {
                            const pendingSongs = (batch.songs || []).filter(
                              (s: any) => s.status === "pending_artist"
                            )
                            if (pendingSongs.length === 0) return null
                            const isGolden = Boolean(batch.wants_dedication)

                            return (
                              <div
                                key={batch.id}
                                className={`rounded-2xl p-3.5 transition ${
                                  isGolden
                                    ? "bg-gradient-to-br from-amber-50 via-amber-100/70 to-yellow-50 border-2 border-amber-400 shadow-sm ring-2 ring-amber-300/40"
                                    : "bg-white border border-[#181615]/12 shadow-2xs hover:border-[#181615]/25"
                                }`}
                              >
                                {/* Header: Requester name + VIP badge + Pass/Delete Batch */}
                                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#181615]/10">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-[#181615]">
                                      {batch.requester_name || "Audience Member"}
                                    </span>
                                    {isGolden && (
                                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 text-[10px] font-black shadow-xs flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5 fill-amber-950" />
                                        ₹50 Golden Dedication
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold text-[#5C5650]">
                                      Pick 1 of {pendingSongs.length}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeclineBatch(batch.id)}
                                    className="text-[11px] font-bold text-neutral-400 hover:text-red-600 transition cursor-pointer px-1.5 py-0.5 rounded"
                                    title="Decline entire batch"
                                  >
                                    Pass Batch
                                  </button>
                                </div>

                                {/* Songs within this person's batch */}
                                <div className="space-y-1.5">
                                  {pendingSongs.map((s: any) => (
                                    <div
                                      key={s.id}
                                      className={`p-2.5 rounded-xl flex items-center justify-between gap-3 transition ${
                                        isGolden
                                          ? "bg-white/90 border border-amber-300/80 hover:bg-white shadow-2xs"
                                          : "bg-[#FAF7F2] border border-[#181615]/10 hover:bg-white hover:border-[#181615]/20"
                                      }`}
                                    >
                                      {/* Clean song name & artist */}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm font-extrabold text-[#181615] truncate">
                                          {s.song_title}
                                        </p>
                                        {s.original_artist && (
                                          <p className="text-[10px] sm:text-[11px] text-[#5C5650] truncate">
                                            {s.original_artist}
                                          </p>
                                        )}
                                      </div>

                                      {/* Select or Delete this song */}
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmAudienceSong(s.id)}
                                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs ${
                                            isGolden
                                              ? "bg-amber-500 hover:bg-amber-600 text-amber-950 font-black"
                                              : "bg-[#181615] hover:bg-[#D92323] text-white"
                                          }`}
                                          title="Pick this song for setlist"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                          <span>Select</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeclineSong(s.id)}
                                          className="p-1.5 rounded-xl border border-[#181615]/15 hover:border-red-400 text-neutral-400 hover:text-red-600 transition cursor-pointer"
                                          title="Delete song"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─────────────────────────────────────────────────────────────
                      RIGHT COLUMN (SPAN 5): STICKY YOUTUBE VIDEO PLAYER
                      Plays Video Next to Song + Auto-Marks as Done on Finish
                  ───────────────────────────────────────────────────────────── */}
                  <div className="lg:col-span-5 sticky top-20 space-y-4">
                    <div className="bg-white rounded-3xl p-5 border border-[#181615]/12 shadow-sm space-y-4">
                      
                      {/* Video Player Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isKaraokePlaying ? (
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D92323] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D92323]" />
                              </span>
                              <span className="text-xs font-black uppercase tracking-wider text-[#D92323]">
                                Now Playing
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold uppercase tracking-wider text-[#5C5650]">
                              YouTube Player
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Song Title & Original Artist */}
                      <div>
                        <h3 className="text-base font-black text-[#181615] leading-tight truncate">
                          {activeKaraokeSong?.song_title || "Select a Song from Playlist"}
                        </h3>
                        <p className="text-xs text-[#5C5650] truncate mt-0.5">
                          {activeKaraokeSong?.original_artist || "Click 'Play Video' next to any song to watch and perform"}
                        </p>
                        {activeKaraokeSong?.status === "played" && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Completed & Marked as Done
                          </span>
                        )}
                      </div>

                      {/* Interactive YouTube Player Embed */}
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md relative border border-[#181615]/10">
                        <iframe
                          id="stage-active-player"
                          onLoad={registerYouTubeIframeListener}
                          src={`https://www.youtube.com/embed/${karaokeVideoId}?autoplay=${
                            isKaraokePlaying ? 1 : 0
                          }&mute=${muteKaraokeAudio ? 1 : 0}&enablejsapi=1&origin=${
                            typeof window !== "undefined" ? window.location.origin : ""
                          }&rel=0`}
                          title={activeKaraokeSong?.song_title || "Karaoke Backing Video"}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      </div>

                      {/* Completion Toast Notification with Upvoted Next Song */}
                      {doneToast && (
                        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-300">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                &quot;{doneToast.title}&quot; marked done!
                              </p>
                              {nextPlaylistSong && (
                                <p className="text-[10px] text-emerald-100 truncate">
                                  Up Next: {nextPlaylistSong.song_title}
                                </p>
                              )}
                            </div>
                          </div>
                          {nextPlaylistSong && (
                            <button
                              type="button"
                              onClick={() => handleLoadSongIntoKaraoke(nextPlaylistSong)}
                              className="px-3 py-1.5 rounded-xl bg-white text-emerald-950 text-xs font-black hover:bg-emerald-50 transition shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play Next</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quick Action Controls Under Player */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <StageTrackActions
                          isMarkDoneVisible={Boolean(activeKaraokeSong?.id && activeKaraokeSong.status !== "played")}
                          onMarkDone={() => activeKaraokeSong?.id && handleMarkPlayed(activeKaraokeSong.id)}
                          isNextTrackVisible={Boolean(nextPlaylistSong)}
                          onNextTrack={() => nextPlaylistSong && handleLoadSongIntoKaraoke(nextPlaylistSong)}
                          nextTrackTitle={nextPlaylistSong?.song_title}
                        />

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMuteKaraokeAudio((m) => !m)}
                            className="p-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-[#5C5650] hover:text-[#181615] transition cursor-pointer"
                            title={muteKaraokeAudio ? "Unmute Video Audio" : "Mute Video Audio (Perform Live)"}
                          >
                            {muteKaraokeAudio ? (
                              <VolumeX className="w-3.5 h-3.5 text-[#D92323]" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleConnectHdmiScreen}
                            className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 hover:border-[#181615] text-[#181615] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            title="Cast to LED / Stage Screen via HDMI"
                          >
                            <Tv className="w-3.5 h-3.5 text-amber-600" />
                            <span>LED Screen</span>
                          </button>
                        </div>
                      </div>

                      {/* Up Next Card (Dynamically Pushes Most Upvoted Song to the Artist) */}
                      {nextPlaylistSong && (
                        <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#181615]/10 flex items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                              {getSongThumbnail(nextPlaylistSong) ? (
                                <img
                                  src={getSongThumbnail(nextPlaylistSong)!}
                                  alt={nextPlaylistSong.song_title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-400">
                                  <Music className="w-5 h-5" />
                                </div>
                              )}
                              {(nextPlaylistSong.upvotes || 0) > 0 && (
                                <div className="absolute bottom-0 inset-x-0 bg-[#D92323] text-white text-[8px] font-black text-center py-0.5 leading-none">
                                  +{nextPlaylistSong.upvotes}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#D92323] flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Up Next in Setlist
                                </span>
                                {todayPlaylistSongs.findIndex((s: any) => s.id === nextPlaylistSong.id) >= 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-[#181615]/10 text-[#181615] text-[9px] font-black">
                                    Slot #{todayPlaylistSongs.findIndex((s: any) => s.id === nextPlaylistSong.id) + 1}
                                  </span>
                                )}
                                {(nextPlaylistSong.upvotes || 0) > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-[#D92323]/10 text-[#D92323] text-[9px] font-black flex items-center gap-0.5">
                                    <Heart className="w-2.5 h-2.5 fill-current" />
                                    {nextPlaylistSong.upvotes} Votes
                                  </span>
                                )}
                                {nextPlaylistSong.dedication_payment_status === "paid" && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black">
                                    ₹50 VIP
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-black text-[#181615] truncate">
                                {nextPlaylistSong.song_title}
                              </p>
                              <p className="text-[10px] text-[#5C5650] truncate">
                                {nextPlaylistSong.original_artist || "Setlist Track"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLoadSongIntoKaraoke(nextPlaylistSong)}
                            className="px-3 py-1.5 rounded-xl bg-[#181615] hover:bg-[#D92323] text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                            title={`Play ${nextPlaylistSong.song_title}`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play Next</span>
                          </button>
                        </div>
                      )}

                      {/* YouTube Search & Video Picker (No need to leave app to copy/paste) */}
                      <div className="pt-3 border-t border-[#181615]/10 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Youtube className="w-4 h-4 text-[#D92323]" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#181615]">
                              Search YouTube
                            </span>
                            {ytApiConnected === true ? (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live API
                              </span>
                            ) : ytApiConnected === false ? (
                              <span
                                className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 text-[9px] font-bold"
                                title="Add YOUTUBE_API_KEY in .env.local for live web search"
                              >
                                Catalog Mode
                              </span>
                            ) : null}
                          </div>
                          {showYtResultsPanel && ytSearchResults.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowYtResultsPanel(false)}
                              className="text-[10px] font-bold text-[#5C5650] hover:text-[#181615] cursor-pointer"
                            >
                              Hide Results
                            </button>
                          )}
                        </div>

                        {/* Search Input Bar */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            handleSearchYouTube()
                          }}
                          className="flex gap-2"
                        >
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-[#5C5650] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={ytSearchQuery}
                              onChange={(e) => setYtSearchQuery(e.target.value)}
                              placeholder="Search YouTube or paste URL..."
                              className="w-full pl-8 pr-7 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition"
                            />
                            {ytSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setYtSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <button
                            type="submit"
                            disabled={isSearchingYt || !ytSearchQuery.trim()}
                            className="px-3.5 py-2 rounded-xl bg-[#D92323] hover:bg-[#b81d1d] text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shrink-0 shadow-xs"
                          >
                            {isSearchingYt ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Search className="w-3.5 h-3.5" />
                            )}
                            <span>Search</span>
                          </button>
                        </form>

                        {/* Quick 1-Click Search Variation Chips */}
                        {activeKaraokeSong?.song_title && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-[#5C5650] font-semibold">Try:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const q = `${activeKaraokeSong.song_title} karaoke lyrics`
                                setYtSearchQuery(q)
                                handleSearchYouTube(q)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#181615]/5 hover:bg-[#181615]/10 text-[10px] font-semibold text-[#181615] cursor-pointer transition"
                            >
                              Karaoke
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const q = `${activeKaraokeSong.song_title} acoustic guitar backing`
                                setYtSearchQuery(q)
                                handleSearchYouTube(q)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#181615]/5 hover:bg-[#181615]/10 text-[10px] font-semibold text-[#181615] cursor-pointer transition"
                            >
                              Acoustic
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const q = `${activeKaraokeSong.song_title} ${activeKaraokeSong.original_artist || ""} official instrumental`
                                setYtSearchQuery(q)
                                handleSearchYouTube(q)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#181615]/5 hover:bg-[#181615]/10 text-[10px] font-semibold text-[#181615] cursor-pointer transition"
                            >
                              Instrumental
                            </button>
                          </div>
                        )}

                        {/* Results List */}
                        {showYtResultsPanel && (
                          <div className="space-y-1.5 pt-1">
                            {isSearchingYt ? (
                              <div className="p-4 text-center rounded-2xl bg-[#FAF7F2] border border-[#181615]/10 flex items-center justify-center gap-2 text-xs font-semibold text-[#5C5650]">
                                <Loader2 className="w-4 h-4 animate-spin text-[#D92323]" />
                                <span>Searching YouTube for &quot;{ytSearchQuery}&quot;...</span>
                              </div>
                            ) : ytSearchResults.length === 0 && ytSearchSubmitted ? (
                              <div className="p-3 text-center rounded-2xl bg-[#FAF7F2] border border-[#181615]/10 text-xs text-[#5C5650]">
                                No videos found. Try different keywords or paste a YouTube link.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                                {ytSearchResults.map((video: any) => {
                                  const isLoaded = karaokeVideoId === video.videoId
                                  return (
                                    <div
                                      key={video.videoId}
                                      onClick={() => handleSelectYouTubeVideo(video)}
                                      className={`p-2 rounded-xl flex items-center justify-between gap-2.5 border transition cursor-pointer group ${
                                        isLoaded
                                          ? "bg-[#D92323]/10 border-[#D92323] text-[#181615] ring-1 ring-[#D92323]/30"
                                          : "bg-[#FAF7F2] border-[#181615]/10 hover:border-[#D92323]/50 hover:bg-white"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="relative w-14 h-9 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                                          <img
                                            src={video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                                            alt={video.title}
                                            className="w-full h-full object-cover"
                                          />
                                          {video.duration && (
                                            <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-white text-[8px] font-bold">
                                              {video.duration}
                                            </span>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className={`text-[11px] font-bold truncate ${isLoaded ? "text-[#D92323] font-black" : "text-[#181615]"}`}>
                                            {video.title}
                                          </p>
                                          <p className="text-[10px] text-[#5C5650] truncate">
                                            {video.channel || "YouTube"}
                                          </p>
                                        </div>
                                      </div>

                                      {isLoaded ? (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-[#D92323] text-white shrink-0">
                                          Loaded
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-[#181615] group-hover:bg-[#D92323] text-white transition shrink-0 flex items-center gap-1 shadow-2xs"
                                        >
                                          <Play className="w-2.5 h-2.5 fill-current" />
                                          <span>Play</span>
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 2: BATCHES (Full Incoming 3-Song Batches View)
            ═══════════════════════════════════════════════════════ */}
            {activeTab === "batches" && (
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-sm font-extrabold text-[#181615]">
                    PICK A SONG : Incoming 3-Song Batches ({pendingBatches.length})
                  </h2>
                  <div className="flex items-center gap-1 bg-white border border-[#181615]/10 p-1 rounded-full">
                    <button
                      type="button"
                      onClick={() => setPendingBatchFilter("all")}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                        pendingBatchFilter === "all" ? "bg-[#181615] text-white" : "text-[#5C5650]"
                      }`}
                    >
                      All ({pendingBatches.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingBatchFilter("dedication")}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                        pendingBatchFilter === "dedication"
                          ? "bg-amber-400 text-[#181615]"
                          : "text-amber-800"
                      }`}
                    >
                      ₹50 Ready ({readyToPayBatchesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingBatchFilter("regular")}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                        pendingBatchFilter === "regular"
                          ? "bg-[#D92323] text-white"
                          : "text-[#5C5650]"
                      }`}
                    >
                      Standard ({regularBatchesCount})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPendingBatches.map((batch: any) => {
                    const isGolden = Boolean(batch.wants_dedication)
                    return (
                      <div
                        key={batch.id}
                        className={`rounded-2xl p-4 space-y-3 transition ${
                          isGolden
                            ? "bg-gradient-to-br from-amber-50 via-amber-100/70 to-yellow-50 border-2 border-amber-400 shadow-md ring-4 ring-amber-400/20"
                            : "bg-white border border-[#181615]/12 shadow-2xs hover:border-[#181615]/20"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[#181615]/10">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-[#181615]">
                              {batch.requester_name || "Audience Member"}
                            </span>
                            {isGolden && (
                              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 text-[10px] font-black shadow-xs flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 fill-amber-950" />
                                ₹50 Golden Dedication
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeclineBatch(batch.id)}
                            className="text-[11px] text-[#5C5650] hover:text-[#D92323] font-semibold cursor-pointer"
                          >
                            Pass Batch
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {batch.songs.map((s: any, idx: number) => {
                            if (s.status !== "pending_artist") return null
                            return (
                              <div
                                key={s.id}
                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl transition ${
                                  isGolden
                                    ? "bg-white/95 border border-amber-300 hover:bg-white shadow-2xs"
                                    : "bg-[#FAF7F2] border border-[#181615]/10 hover:border-[#181615]/20 hover:bg-white"
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="text-xs sm:text-sm font-extrabold text-[#181615] truncate">
                                    {idx + 1}. {s.song_title}
                                  </p>
                                  {s.original_artist && (
                                    <p className="text-[11px] text-[#5C5650] truncate">
                                      {s.original_artist}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmAudienceSong(s.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1 shadow-xs ${
                                      isGolden
                                        ? "bg-amber-500 hover:bg-amber-600 text-amber-950 font-black"
                                        : "bg-[#181615] hover:bg-[#D92323] text-white"
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Select</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeclineSong(s.id)}
                                    className="p-1.5 rounded-xl border border-[#181615]/15 hover:border-red-400 text-neutral-400 hover:text-red-600 transition cursor-pointer"
                                    title="Delete song"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 3: VIDEOS (Stage Karaoke Player — Autoplay=0 on Load)
            ═══════════════════════════════════════════════════════ */}
            {activeTab === "videos" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                <div className="lg:col-span-8 aspect-video rounded-2xl overflow-hidden bg-black shadow-md">
                  <iframe
                    id="stage-active-player"
                    onLoad={registerYouTubeIframeListener}
                    src={`https://www.youtube.com/embed/${karaokeVideoId}?autoplay=${isKaraokePlaying ? 1 : 0}&mute=${muteKaraokeAudio ? 1 : 0}&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}&rel=0`}
                    title="Stage Karaoke Player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>

                <div className="lg:col-span-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customYoutubeInput}
                      onChange={(e) => setCustomYoutubeInput(e.target.value)}
                      placeholder="Paste YouTube URL or ID"
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#181615]/15 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomYoutubeUrl}
                      className="px-4 py-2 rounded-xl bg-[#D92323] text-white text-xs font-bold cursor-pointer"
                    >
                      Load
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 4: SHOWS (Upcoming Gigs & List View with Stats)
            ═══════════════════════════════════════════════════════ */}
            {activeTab === "shows" && (
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[#181615]">
                      All Shows ({gigs.length})
                    </h2>
                    <p className="text-xs text-[#5C5650] mt-0.5">
                      Review crowd engagement, upvotes, dedications, and live audience tips per show.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewGigModal(true)}
                    className="px-4 py-2 rounded-full bg-[#D92323] hover:bg-[#b81d1d] text-white text-xs font-semibold uppercase tracking-[0.14em] shadow-xs cursor-pointer transition active:scale-[0.98]"
                  >
                    + Add Show
                  </button>
                </div>

                {/* Shows List View */}
                <div className="space-y-3">
                  {gigs.map((gig: any) => {
                    const isActive = activeGig?.id === gig.id
                    const upvotesCount = Number(gig.total_upvotes || 0)
                    const dedicationsCount = Number(gig.dedications_count || 0)
                    const dedicationsAmount = Number(gig.dedications_amount || 0)
                    const tipsCount = Number(gig.tips_count || 0)
                    const tipsAmount = Number(gig.tips_amount || 0)

                    return (
                      <div
                        key={gig.id}
                        className={`rounded-2xl p-4 sm:p-5 border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isActive
                            ? "bg-white border-2 border-[#D92323] shadow-sm ring-2 ring-[#D92323]/15"
                            : "bg-white border-[#181615]/10 hover:border-[#181615]/25 shadow-2xs"
                        }`}
                      >
                        {/* Left: Date + Title + Location + Active Status */}
                        <div className="space-y-1.5 min-w-0 md:max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-[#D92323] px-2 py-0.5 rounded-md bg-[#D92323]/10">
                              {gig.event_date_only || "Tonight"}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-[#D92323] text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Current Active Stage
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-[#181615] truncate">
                            {gig.title}
                          </h3>

                          <div className="flex items-center gap-1.5 text-xs text-[#5C5650] truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#D92323] shrink-0" />
                            <span className="truncate">{gig.location_name}</span>
                          </div>
                        </div>

                        {/* Center: Real Stats Grid (Upvotes, Dedications, Tips) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 py-2 md:py-0 border-y md:border-y-0 md:border-x border-[#181615]/10 md:px-6">
                          {/* 1. UPVOTES */}
                          <div className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/8 text-center space-y-0.5 min-w-[85px]">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#5C5650]">
                              <Heart className="w-3 h-3 text-[#D92323] fill-[#D92323]" />
                              <span>Upvotes</span>
                            </div>
                            <p className="text-base sm:text-lg font-black text-[#181615]">
                              {upvotesCount}
                            </p>
                          </div>

                          {/* 2. DEDICATIONS */}
                          <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-300/80 text-center space-y-0.5 min-w-[85px]">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
                              <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                              <span>Dedications</span>
                            </div>
                            <p className="text-base sm:text-lg font-black text-amber-950">
                              {dedicationsCount}
                            </p>
                            {dedicationsAmount > 0 && (
                              <p className="text-[10px] font-bold text-amber-700">
                                ₹{dedicationsAmount}
                              </p>
                            )}
                          </div>

                          {/* 3. TIPS */}
                          <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-300/80 text-center space-y-0.5 min-w-[85px]">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                              <Wallet className="w-3 h-3 text-emerald-600" />
                              <span>Tips</span>
                            </div>
                            <p className="text-base sm:text-lg font-black text-emerald-950">
                              {tipsCount}
                            </p>
                            {tipsAmount > 0 && (
                              <p className="text-[10px] font-bold text-emerald-700">
                                ₹{tipsAmount}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions (Switch/Active + View Public Stage) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEventId(gig.id)
                              fetchDashboard(gig.id)
                              setActiveTab("music")
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer transition select-none active:scale-[0.98] ${
                              isActive
                                ? "bg-[#D92323] text-white shadow-xs"
                                : "bg-[#181615] hover:bg-[#D92323] text-white shadow-xs"
                            }`}
                          >
                            {isActive ? "Stage Active" : "Switch Stage"}
                          </button>

                          <Link
                            href={`/live/${gig.id}`}
                            target="_blank"
                            className="p-2 rounded-full bg-[#FAF7F2] hover:bg-white border border-[#181615]/15 text-[#181615] transition shadow-2xs"
                            title="Open public live venue URL"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 5: BANK (Money Coming In & UPIPay Setup)
            ═══════════════════════════════════════════════════════ */}
            {activeTab === "bank" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left: Money Coming In */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-[#181615] text-white p-4">
                      <span className="text-[10px] uppercase font-bold opacity-75">Total</span>
                      <p className="text-2xl font-extrabold mt-0.5">
                        ₹{earningsSummary.totalRevenue || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4">
                      <span className="text-[10px] uppercase font-bold text-amber-800">
                        Dedications
                      </span>
                      <p className="text-2xl font-extrabold text-amber-950 mt-0.5">
                        ₹{earningsSummary.dedicationRevenue || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">Tips</span>
                      <p className="text-2xl font-extrabold text-emerald-950 mt-0.5">
                        ₹{earningsSummary.tipRevenue || 0}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {transactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#181615]/10 text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#181615]">{tx.payer_name}</span>
                          <span className="text-[#5C5650] ml-2">
                            {tx.song_title || tx.note || "Tip"}
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-emerald-700">
                          +₹{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Compact Bank & UPIPay Form */}
                <form
                  onSubmit={handleSaveBankDetails}
                  className="lg:col-span-5 space-y-2.5 bg-white p-4 rounded-2xl border border-[#181615]/12"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#181615]">UPIPay &amp; Bank</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">0% Fee</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="UPI ID (e.g. arjunmehta@ybl) *"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs font-mono focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="Account Holder Name *"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Bank Name"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="IFSC Code"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs font-mono focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={upipayProvider}
                      onChange={(e) => setUpipayProvider(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs focus:outline-none"
                    >
                      <option value="upi_direct">Direct UPI</option>
                      <option value="phonepe">PhonePe Biz</option>
                      <option value="paytm">Paytm Biz</option>
                    </select>
                    <input
                      type="text"
                      value={upipayMerchantId}
                      onChange={(e) => setUpipayMerchantId(e.target.value)}
                      placeholder="Merchant ID"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#181615]/15 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  {bankErrorMsg && <p className="text-[11px] text-[#D92323] font-bold">{bankErrorMsg}</p>}
                  {bankSavedMsg && <p className="text-[11px] text-emerald-700 font-bold">{bankSavedMsg}</p>}
                  <button
                    type="submit"
                    disabled={savingBank}
                    className="w-full py-2 rounded-xl bg-[#D92323] hover:bg-[#b81d1d] text-white text-xs font-bold cursor-pointer transition"
                  >
                    {savingBank ? "Saving..." : "Save Bank Details"}
                  </button>
                  <code className="block text-[9px] font-mono text-[#5C5650] truncate">
                    {previewUpiQr.upiUri}
                  </code>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────
          BOTTOM FULL-WIDTH STICKY PLAYER BAR (Muse Brand Accents)
      ───────────────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 z-30 border-t border-[#181615]/10 bg-white px-6 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Song Art + Name + Heart */}
        <div className="flex items-center gap-3 min-w-[200px]">
          {currentStageSong && getSongThumbnail(currentStageSong) ? (
            <img
              src={getSongThumbnail(currentStageSong)!}
              alt={currentStageSong?.song_title || "Track"}
              className="w-10 h-10 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-extrabold text-[#181615] truncate">
                {currentStageSong?.song_title || "Ready"}
              </p>
              <Heart className="w-3 h-3 text-[#D92323] shrink-0" />
            </div>
            <p className="text-[11px] text-[#5C5650] truncate">
              {currentStageSong?.original_artist || artist?.name || "Live"}
            </p>
          </div>
        </div>

        {/* Center: Transport + Crimson Circle Play Button + Slim Progress Bar */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-lg">
          <div className="flex items-center gap-4 text-[#5C5650]">
            <Shuffle className="w-3.5 h-3.5 hover:text-[#181615] cursor-pointer" />
            <button
              type="button"
              onClick={() => {
                if (artistPlaylist.length > 0) handleLoadSongIntoKaraoke(artistPlaylist[0])
              }}
              className="hover:text-[#181615] cursor-pointer"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isKaraokePlaying && currentStageSong) {
                  handleLoadSongIntoKaraoke(currentStageSong)
                } else {
                  setIsKaraokePlaying((v) => !v)
                }
              }}
              className="w-9 h-9 rounded-full bg-[#D92323] hover:bg-[#b81d1d] text-white flex items-center justify-center shadow-md cursor-pointer transition"
            >
              {isKaraokePlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (artistPlaylist.length > 1) handleLoadSongIntoKaraoke(artistPlaylist[1])
              }}
              className="hover:text-[#181615] cursor-pointer"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
            <Repeat className="w-3.5 h-3.5 hover:text-[#181615] cursor-pointer" />
          </div>

          <div className="w-full flex items-center gap-2 text-[10px] text-[#5C5650] font-medium">
            <span>{isKaraokePlaying ? "1:18" : "0:00"}</span>
            <div className="flex-1 h-1 rounded-full bg-[#181615]/10 relative overflow-hidden">
              <div
                className={`h-full bg-[#D92323] rounded-full ${
                  isKaraokePlaying ? "w-1/2" : "w-0"
                }`}
              />
            </div>
            <span>3:45</span>
          </div>
        </div>

        {/* Right: Lyrics/HDMI + Mute + Volume Bar */}
        <div className="flex items-center gap-3 text-[#5C5650]">
          <button
            type="button"
            onClick={handleConnectHdmiScreen}
            className={`hover:text-[#181615] cursor-pointer ${
              hdmiConnected ? "text-[#D92323]" : ""
            }`}
            title="HDMI Screen"
          >
            <Tv className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextMute = !muteKaraokeAudio
              setMuteKaraokeAudio(nextMute)
              broadcastToLedScreen(karaokeVideoId, activeKaraokeSong, nextMute)
            }}
            className="hover:text-[#181615] cursor-pointer"
            title="Mute Audio"
          >
            {muteKaraokeAudio ? (
              <VolumeX className="w-4 h-4 text-[#D92323]" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <div className="w-16 h-1 rounded-full bg-[#181615]/15 overflow-hidden hidden sm:block">
            <div
              className={`h-full bg-[#D92323] ${muteKaraokeAudio ? "w-0" : "w-3/4"}`}
            />
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          MODALS
      ───────────────────────────────────────────────────────────── */}
      {qrOpen && activeGig && (
        <QrCodeModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          eventTitle={activeGig.title}
          artistName={artist?.name || "Live Artist"}
          locationName={activeGig.location_name}
          locationSlug={activeGig.location_slug}
          eventDateOnly={activeGig.event_date_only}
        />
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-[#181615] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#181615]">Profile</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-2.5">
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Artist Name"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
              />
              <input
                type="text"
                value={profileInsta}
                onChange={(e) => setProfileInsta(e.target.value)}
                placeholder="@instagram"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
              />
              <input
                type="url"
                value={profileAvatar}
                onChange={(e) => setProfileAvatar(e.target.value)}
                placeholder="Avatar URL"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#D92323] text-white text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {showNewGigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-[#181615] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#181615]">New Show</h3>
              <button
                type="button"
                onClick={() => setShowNewGigModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGig} className="space-y-2.5">
              <input
                type="text"
                required
                value={newGigTitle}
                onChange={(e) => setNewGigTitle(e.target.value)}
                placeholder="Show Title *"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
              />
              <input
                type="text"
                required
                value={newGigLocation}
                onChange={(e) => setNewGigLocation(e.target.value)}
                placeholder="Venue *"
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={newGigDate}
                  onChange={(e) => setNewGigDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
                />
                <input
                  type="number"
                  value={newGigPrice}
                  onChange={(e) => setNewGigPrice(e.target.value)}
                  placeholder="Price (₹)"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 text-xs focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#D92323] text-white text-xs font-bold cursor-pointer"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
