"use client"

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  use,
} from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import MuseLoadingScreen from "@/components/muse-loading-screen"
import { extractYouTubeId } from "@/lib/youtube"
import { generateUPIQR } from "@/lib/upipay"
import {
  Search,
  Heart,
  Sparkles,
  Plus,
  X,
  CheckCircle2,
  IndianRupee,
  Check,
  ChevronUp,
  ChevronDown,
  Play,
} from "lucide-react"

function getOrCreateVoterToken(): string {
  if (typeof window === "undefined") return ""
  const key = "muse_audience_voter_token"
  let tok = window.localStorage.getItem(key)
  if (!tok) {
    tok =
      "voter_" +
      Math.random().toString(36).slice(2, 10) +
      "_" +
      Date.now().toString(36)
    window.localStorage.setItem(key, tok)
  }
  return tok
}

// Full-resolution, letterbox-free frame for the lyrics view (falls back to hqdefault on error)
function getYouTubeFrame(song: any): string {
  const id = song?.youtube_video_id || extractYouTubeId(song?.youtube_url)
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : ""
}

const toHqThumb = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget
  if (img.src.includes("maxresdefault")) img.src = img.src.replace("maxresdefault", "hqdefault")
}

export default function AudienceLiveGigPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)

  const [voterToken, setVoterToken] = useState<string>("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<
    "all" | "top" | "artist" | "dedications"
  >("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Optimistic upvoting map: { [songId]: { count: number, hasVoted: boolean } }
  const [optimisticVotes, setOptimisticVotes] = useState<
    Record<string, { count: number; hasVoted: boolean }>
  >({})

  // Floating +1 heart particles
  const [floatingParticles, setFloatingParticles] = useState<
    Array<{ id: number; x: number; y: number; label?: string }>
  >([])

  // 3-Song Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requesterName, setRequesterName] = useState("")
  const [song1Title, setSong1Title] = useState("")
  const [song1Artist, setSong1Artist] = useState("")
  const [song2Title, setSong2Title] = useState("")
  const [song2Artist, setSong2Artist] = useState("")
  const [song3Title, setSong3Title] = useState("")
  const [song3Artist, setSong3Artist] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  // 3-Song Dedication Modal State (Mention 3 songs -> Artist selects 1 -> Pay directly to artist)
  const [showDedicationModal, setShowDedicationModal] = useState(false)
  const [dedSong1, setDedSong1] = useState("")
  const [dedSong2, setDedSong2] = useState("")
  const [dedSong3, setDedSong3] = useState("")
  const [payDedicatedTo, setPayDedicatedTo] = useState("")
  const [payDedicationMsg, setPayDedicationMsg] = useState("")
  const [payRequesterName, setPayRequesterName] = useState("")
  const [submittingDedicationBatch, setSubmittingDedicationBatch] = useState(false)
  const [payingSongId, setPayingSongId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  // Tip Artist Directly Modal State
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState<number>(100)
  const [tipCustomAmount, setTipCustomAmount] = useState<string>("")
  const [tipSupporterName, setTipSupporterName] = useState<string>("")
  const [tipMessage, setTipMessage] = useState<string>("")
  const [tipping, setTipping] = useState(false)
  const [tipError, setTipError] = useState<string | null>(null)

  const fetchGigData = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(
          `/api/gigs/${encodeURIComponent(eventId)}?voter_token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        )
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch {
        // ignore network error
      } finally {
        setLoading(false)
      }
    },
    [eventId]
  )

  useEffect(() => {
    const tok = getOrCreateVoterToken()
    setVoterToken(tok)
    const savedName =
      typeof window !== "undefined"
        ? window.localStorage.getItem("muse_audience_name") || ""
        : ""
    if (savedName) {
      setRequesterName(savedName)
      setPayRequesterName(savedName)
      setTipSupporterName(savedName)
    }
    fetchGigData(tok)

    const interval = setInterval(() => {
      fetchGigData(tok)
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchGigData])

  // Songs list based on playlist tab
  const songs = useMemo(() => {
    if (!data) return []
    const allSongs: any[] = data.allConfirmedSongs || []
    const priorityDedications: any[] = data.priorityDedications || []

    let list = allSongs
    if (activeTab === "top") {
      list = [...allSongs].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    } else if (activeTab === "artist") {
      const artistOnly = allSongs.filter(
        (s) => s.source_type === "artist_playlist"
      )
      list = artistOnly.length > 0 ? artistOnly : allSongs
    } else if (activeTab === "dedications") {
      const deds =
        priorityDedications.length > 0
          ? priorityDedications
          : allSongs.filter((s) => s.dedicated_to)
      list = deds.length > 0 ? deds : allSongs
    }

    return list
  }, [data, activeTab])

  // ── Lyrics view (first view): follows whatever the artist is playing ──
  const [clock, setClock] = useState(0)
  const [view, setView] = useState<"player" | "lyrics" | "list">("player")
  const [lyrics, setLyrics] = useState<{
    synced: boolean
    lines: { t: number; text: string }[]
    duration?: number | null
  } | null>(null)
  const playbackAnchor = useRef({ pos: 0, at: 0, playing: false })

  const playerSong = useMemo(() => {
    const all: any[] = data?.allConfirmedSongs || []
    return (
      data?.nowPlaying ||
      all.find((s: any) => s.id === data?.event?.active_song_request_id) ||
      all.find((s: any) => s.status === "playing") ||
      null
    )
  }, [data])
  const playerSongId = playerSong?.id
  const playerTitle = playerSong?.song_title
  const playerArtist = playerSong?.original_artist

  useEffect(() => {
    setLyrics(null)
    if (!playerTitle) return
    let off = false
    fetch(
      `/api/lyrics?title=${encodeURIComponent(playerTitle)}&artist=${encodeURIComponent(playerArtist || "")}`
    )
      .then((r) => (r.ok ? r.json() : { synced: false, lines: [] }))
      .then((j) => !off && setLyrics(j))
      .catch(() => !off && setLyrics({ synced: false, lines: [] }))
    return () => {
      off = true
    }
  }, [playerSongId, playerTitle, playerArtist])

  // Re-anchor to the artist's reported YouTube position on every poll
  useEffect(() => {
    const ev = data?.event
    if (!ev) return
    const updatedAt = Number(ev.playback_updated_at) || 0
    const serverNow = Number(data.serverNow) || Date.now()
    const age = updatedAt ? serverNow - updatedAt : Infinity
    const live = Boolean(ev.playback_playing) && age < 20000
    const pos = (Number(ev.playback_position) || 0) + (live ? age / 1000 : 0)
    playbackAnchor.current = { pos, at: performance.now(), playing: live }
    setClock(pos)
  }, [data])

  useEffect(() => {
    const id = setInterval(() => {
      const a = playbackAnchor.current
      if (a.playing) setClock(a.pos + (performance.now() - a.at) / 1000)
    }, 250)
    return () => clearInterval(id)
  }, [])

  const trackLength =
    lyrics?.duration || (lyrics?.lines.length ? lyrics.lines[lyrics.lines.length - 1].t + 10 : 0)

  const getVoteState = useCallback(
    (song: any) => {
      if (!song) return { count: 0, hasVoted: false }
      const upvotedIds: string[] = data?.upvotedRequestIds || []
      const defaultVoted = upvotedIds.includes(song.id)
      const opt = optimisticVotes[song.id]
      if (opt !== undefined) {
        return opt
      }
      return {
        count: song.upvotes ?? 0,
        hasVoted: defaultVoted,
      }
    },
    [data?.upvotedRequestIds, optimisticVotes]
  )

  const handleUpvote = async (
    song: any,
    eventTarget?: { x: number; y: number }
  ) => {
    if (!voterToken || !song) return
    const current = getVoteState(song)
    const willVote = !current.hasVoted
    const nextCount = willVote
      ? current.count + 1
      : Math.max(0, current.count - 1)

    setOptimisticVotes((prev) => ({
      ...prev,
      [song.id]: { count: nextCount, hasVoted: willVote },
    }))

    if (willVote && eventTarget) {
      const pId = Date.now() + Math.random()
      setFloatingParticles((prev) => [
        ...prev,
        { id: pId, x: eventTarget.x, y: eventTarget.y, label: "+1" },
      ])
      setTimeout(() => {
        setFloatingParticles((prev) => prev.filter((p) => p.id !== pId))
      }, 1000)
    }

    try {
      await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_upvote",
          request_id: song.id,
          voter_token: voterToken,
        }),
      })
      fetchGigData(voterToken)
    } catch {
      setOptimisticVotes((prev) => {
        const next = { ...prev }
        delete next[song.id]
        return next
      })
    }
  }

  // Submit 3 General Song Requests
  const handleSubmit3Songs = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    try {
      if (typeof window !== "undefined" && requesterName.trim()) {
        window.localStorage.setItem("muse_audience_name", requesterName.trim())
      }

      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_3_songs",
          requester_name: requesterName,
          voter_token: voterToken,
          wants_dedication: false,
          dedicated_to: null,
          dedication_message: null,
          songs: [
            { song_title: song1Title, original_artist: song1Artist },
            { song_title: song2Title, original_artist: song2Artist },
            { song_title: song3Title, original_artist: song3Artist },
          ],
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to submit songs.")

      setSong1Title("")
      setSong1Artist("")
      setSong2Title("")
      setSong2Artist("")
      setSong3Title("")
      setSong3Artist("")
      setShowRequestModal(false)
      setSubmitSuccess("3 songs sent to the artist!")
      setTimeout(() => setSubmitSuccess(null), 5000)
      fetchGigData(voterToken)
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Step 1 of Dedication: Submit 3 Song Names + Dedication Info so Artist can select 1
  const handleSubmitDedication3Songs = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayError(null)
    setSubmittingDedicationBatch(true)

    try {
      const fromName = payRequesterName.trim() || requesterName.trim() || "Audience Member"
      if (typeof window !== "undefined" && fromName) {
        window.localStorage.setItem("muse_audience_name", fromName)
      }

      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_3_songs",
          requester_name: fromName,
          voter_token: voterToken,
          wants_dedication: true,
          dedicated_to: payDedicatedTo.trim(),
          dedication_message: payDedicationMsg.trim() || null,
          songs: [
            { song_title: dedSong1, original_artist: "" },
            { song_title: dedSong2, original_artist: "" },
            { song_title: dedSong3, original_artist: "" },
          ],
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to send 3 songs for dedication.")

      setDedSong1("")
      setDedSong2("")
      setDedSong3("")
      await fetchGigData(voterToken)
    } catch (err: any) {
      setPayError(err.message)
    } finally {
      setSubmittingDedicationBatch(false)
    }
  }

  // Step 2 of Dedication: Pay Directly to the Artist for the selected song
  const handlePayDirectForSelectedSong = async (song: any, batch?: any) => {
    if (!song) return
    setPayError(null)
    setPayingSongId(song.id)

    try {
      const finalDedicatedTo =
        payDedicatedTo.trim() ||
        song.dedicated_to ||
        batch?.dedicated_to ||
        "Special Someone"
      const finalFrom =
        payRequesterName.trim() ||
        song.requester_name ||
        batch?.requester_name ||
        "Audience Member"
      const finalMsg =
        payDedicationMsg.trim() ||
        song.dedication_message ||
        batch?.dedication_message ||
        ""

      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay_dedication_50",
          request_id: song.id,
          dedicated_to: finalDedicatedTo,
          dedication_message: finalMsg,
          requester_name: finalFrom,
          payment_mode: "instant",
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Payment failed.")

      if (body.payment_url) {
        window.location.href = body.payment_url
        return
      }

      setShowDedicationModal(false)
      setSubmitSuccess(
        `Sent! Your dedication for "${song.song_title}" goes live once ${data?.event?.artist_name || "the artist"} confirms the ₹50 arrived.`
      )
      setTimeout(() => setSubmitSuccess(null), 5000)
      fetchGigData(voterToken)
    } catch (err: any) {
      setPayError(err.message)
    } finally {
      setPayingSongId(null)
    }
  }

  // Direct Tip to the Artist
  const handleTipArtist = async (e: React.FormEvent) => {
    e.preventDefault()
    setTipError(null)
    setTipping(true)

    const finalAmount = tipCustomAmount.trim()
      ? Number(tipCustomAmount)
      : tipAmount

    try {
      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tip_artist",
          amount: finalAmount,
          supporter_name: tipSupporterName.trim() || "Audience Member",
          message: tipMessage.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Tip failed.")

      setShowTipModal(false)
      setTipCustomAmount("")
      setTipMessage("")
      setSubmitSuccess(
        `Thanks! ${data?.event?.artist_name || "The artist"} will confirm your ₹${finalAmount} tip once it arrives.`
      )
      setTimeout(() => setSubmitSuccess(null), 5000)
    } catch (err: any) {
      setTipError(err.message)
    } finally {
      setTipping(false)
    }
  }

  if (loading && !data) {
    return <MuseLoadingScreen isLoading={true} />
  }

  if (!data?.event) {
    return (
      <div className="min-h-screen bg-[radial-gradient(120%_80%_at_50%_0%,#5a0910_0%,#1a0507_55%,#070709_100%)] text-[#F4EFE6] flex flex-col items-center justify-center p-6 text-center">
        <div className="dots mb-4"><i /></div>
        <p className="title-x mb-5 text-[30px]">Live gig not found</p>
        <Link
          href="/"
          className="btn-light"
        >
          Return Home
        </Link>
      </div>
    )
  }

  const { event } = data
  const myBatches: any[] = data.myBatches || []
  const instagramRaw: string = event.artist_instagram || ""
  const instagramHandle = instagramRaw.replace(/^@/, "")
  const instagramUrl = instagramRaw.startsWith("http")
    ? instagramRaw
    : instagramHandle
      ? `https://instagram.com/${instagramHandle}`
      : undefined
  const artistAvatar =
    event.artist_avatar ||
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80"

  const vote = playerSong ? getVoteState(playerSong) : { count: 0, hasVoted: false }
  const artistPhoto = artistAvatar.includes("images.unsplash.com")
    ? artistAvatar.replace(/([?&])w=\d+/, "$1w=1200")
    : artistAvatar
  const venue = (event.location_name || "").split("•")[0].trim()
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
  const songProgress = Math.min(1, Math.max(0, clock / (trackLength || 240)))
  const CARD_COLORS = ["#8f0d16", "#F4EFE6", "#3a060b", "#0b0a0e"]

  const openTip = () => {
    setTipError(null)
    setShowTipModal(true)
  }
  const openDedicate = () => {
    setPayError(null)
    if (playerSong && !dedSong1) setDedSong1(playerSong.song_title || "")
    setShowDedicationModal(true)
  }
  const heartNow = (e: React.MouseEvent<HTMLElement>) => {
    if (!playerSong) return
    const rect = e.currentTarget.getBoundingClientRect()
    handleUpvote(playerSong, { x: rect.left + rect.width / 2, y: rect.top })
  }

  const MenuLines = ({ dark }: { dark?: boolean }) => (
    <span className="flex w-5 flex-col items-end gap-[4px]">
      {["w-5", "w-4", "w-3"].map((w) => (
        <span key={w} className={`h-[1.5px] ${w} rounded ${dark ? "bg-[#F4EFE6]/85" : "bg-[#1c1c1f]"}`} />
      ))}
    </span>
  )

  const InstagramGlyph = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ig-glyph" cx="0.2" cy="1" r="1.15">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="12%" stopColor="#fdf497" />
          <stop offset="42%" stopColor="#fd5949" />
          <stop offset="68%" stopColor="#d6249f" />
          <stop offset="100%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  )

  // Shared transport row: request · tip · ♥ · dedicate
  const Actions = ({ dark }: { dark?: boolean }) => {
    const ink = dark ? "text-[#F4EFE6]" : "text-[#1c1c1f]"
    const sub = dark ? "text-[#F4EFE6]/55" : "text-[#1c1c1f]/45"
    return (
      <div className="flex items-start justify-between">
        <button type="button" aria-label="Request songs" onClick={() => setShowRequestModal(true)} className={`mt-[2.6cqw] ${ink}`}>
          <Plus className="h-[5cqw] w-[5cqw]" strokeWidth={1.5} />
        </button>
        <div className="flex items-start gap-[3cqw]">
          <button type="button" onClick={openTip} className="flex w-[19cqw] flex-col items-center gap-[1.6cqw]">
            <IndianRupee className={`mt-[2.4cqw] h-[5cqw] w-[5cqw] ${ink}`} strokeWidth={1.5} />
            <span className={`text-[2.3cqw] leading-tight ${sub}`}>Tip the artist</span>
          </button>
          <button
            type="button"
            disabled={!playerSong}
            onClick={heartNow}
            aria-label={vote.hasVoted ? "Remove your heart" : "Heart this song"}
            className="flex flex-col items-center gap-[1.6cqw] disabled:opacity-40"
          >
            <span
              className={`flex h-[10cqw] w-[10cqw] items-center justify-center rounded-full transition active:scale-90 ${
                vote.hasVoted ? "bg-[#F4EFE6] text-[#8f0d16]" : dark ? "border border-[#F4EFE6]/70 text-[#F4EFE6]" : "bg-[#1c1c1f] text-white"
              }`}
            >
              <Heart className="h-[4.2cqw] w-[4.2cqw] fill-current" strokeWidth={0} />
            </span>
            <span className={`text-[2.3cqw] leading-tight ${sub}`}>{vote.count}</span>
          </button>
          <button type="button" onClick={openDedicate} className="flex w-[19cqw] flex-col items-center gap-[1.6cqw]">
            <Sparkles className={`mt-[2.4cqw] h-[5cqw] w-[5cqw] ${ink}`} strokeWidth={1.5} />
            <span className={`text-[2.3cqw] leading-tight ${sub}`}>Dedicate a song to someone special</span>
          </button>
        </div>
        <span className="w-[5cqw]" aria-hidden="true" />
      </div>
    )
  }

  // Follow the artist on Instagram, set beside their name at the top of the player and lyrics
  const FollowPill = () =>
    instagramUrl ? (
    <a
      href={instagramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Follow ${event.artist_name || "the artist"} on Instagram`}
      className="micro pointer-events-auto inline-flex shrink-0 items-center gap-[1.4cqw] rounded-full border border-[#F4EFE6]/40 bg-black/25 px-[2.6cqw] py-[1.2cqw] text-[2.1cqw]! text-[#F4EFE6] backdrop-blur-sm transition hover:border-[#F4EFE6]"
    >
      <InstagramGlyph className="h-[2.8cqw] w-[2.8cqw]" />
      Follow
    </a>
    ) : null

  const slide = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as any },
  }

  return (
    <div className="fixed inset-0 flex justify-center bg-[radial-gradient(120%_80%_at_50%_0%,#5a0910_0%,#1a0507_55%,#070709_100%)] font-sans">
      <MuseLoadingScreen isLoading={false} minDurationMs={2600} />

      {/* Floating +1 Heart Particles */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingParticles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0.8, x: p.x, y: p.y }}
            animate={{ opacity: 0, scale: 1.5, y: p.y - 100, x: p.x + (Math.random() * 24 - 12) }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute flex items-center gap-1 font-bold text-sm"
          >
            <Heart className="w-5 h-5 fill-[#F4EFE6] text-[#F4EFE6]" />
            <span className="text-xs font-semibold text-[#F4EFE6]">{p.label || "+1"}</span>
          </motion.div>
        ))}
      </div>

      {submitSuccess && (
        <div className="fixed top-5 inset-x-4 z-50 max-w-sm mx-auto px-4 py-3 rounded-2xl border border-white/10 bg-[#121014]/95 text-[#F4EFE6] text-xs font-medium flex items-center justify-between shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#F4EFE6] shrink-0" />
            <span>{submitSuccess}</span>
          </div>
          <button type="button" onClick={() => setSubmitSuccess(null)} className="text-white/60 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative h-full w-full max-w-[480px] overflow-hidden" style={{ containerType: "inline-size" }}>
        <AnimatePresence mode="wait" initial={false}>
          {/* ───────── Screen 2 · Now playing ───────── */}
          {view === "player" && (
            <motion.section key="player" {...slide} className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_70%_at_50%_45%,#6a0a12_0%,#2a0509_50%,#0b0405_100%)] text-[#F4EFE6]">
              {/* red capsule with the artist */}
              <div
                className="absolute left-1/2 top-0 w-[62cqw] -translate-x-1/2 overflow-hidden rounded-b-full bg-[#8f0d16] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
                style={{ height: "calc(46% + 33cqw)" }}
              >
                <img src={artistPhoto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover grayscale contrast-125 brightness-75 mix-blend-multiply" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#8f0d16]/20 via-[#8f0d16]/45 to-[#3a060b]/85" />
              </div>

              {/* the artist's name across the top of the capsule, with Follow beside it */}
              <div
                className="pointer-events-none absolute left-1/2 z-10 flex w-[62cqw] -translate-x-1/2 flex-col items-center gap-[2.4cqw]"
                style={{ top: "calc((46% + 33cqw) * 0.46 - 46cqw)" }}
              >
                <p className="title-x text-center text-[8cqw] opacity-45">{(event.artist_name || "Live").split("&")[0].trim()}</p>
                <FollowPill />
              </div>

              <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[7cqw] pt-[9cqw]">
                <button type="button" aria-label="Setlist" onClick={() => setView("list")}>
                  <ChevronDown className="h-6 w-6" strokeWidth={1.4} />
                </button>
                <button type="button" aria-label="Setlist" onClick={() => setView("list")}>
                  <MenuLines dark />
                </button>
              </header>

              {/* disc + progress arc */}
              <div className="absolute left-1/2 top-[46%] h-0 w-0">
                <svg viewBox="-100 -100 200 200" className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible" style={{ width: "86cqw", height: "86cqw" }} aria-hidden="true">
                  <path d="M -96 0 A 96 96 0 0 0 96 0" fill="none" stroke="#F4EFE6" strokeOpacity="0.2" strokeWidth="0.9" />
                  {(() => {
                    const a = Math.PI - songProgress * Math.PI
                    const x = 96 * Math.cos(a)
                    const y = 96 * Math.sin(a)
                    return (
                      <>
                        <path d={`M -96 0 A 96 96 0 0 0 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke="#F4EFE6" strokeWidth="1.4" />
                        <circle cx={x} cy={y} r="5.5" fill="#F4EFE6" stroke="#0b0a0e" strokeWidth="2.6" />
                      </>
                    )
                  })()}
                </svg>
                <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0a0e] p-[2.6cqw] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)]" style={{ width: "59cqw", height: "59cqw" }}>
                  <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-white/10">
                    <img key={playerSongId} src={getYouTubeFrame(playerSong) || artistAvatar} onError={toHqThumb} alt="" className="h-full w-full object-cover" />
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-0 px-[9cqw] text-center" style={{ top: "calc(46% + 38cqw)" }}>
                <p className="micro text-[2.4cqw]! text-[#F4EFE6]/60 tabular-nums">{playerSong ? fmt(clock) : " "}</p>
                <p className="title-x mt-[3cqw] truncate text-[5.4cqw]">{playerTitle || "Up next soon"}</p>
                <p className="micro mt-[1.6cqw] truncate text-[2.4cqw]! text-[#F4EFE6]/55">
                  {playerArtist}
                </p>
                <div className="mt-[5cqw]">
                  <Actions dark />
                </div>
              </div>

              {/* lyrics drawer handle */}
              <button
                type="button"
                onClick={() => setView("lyrics")}
                className="absolute inset-x-0 bottom-0 flex h-[19cqw] flex-col items-center justify-center rounded-t-[11cqw] border-t border-white/10 bg-[#0b0a0e] text-[#F4EFE6]"
              >
                <span className="micro text-[2.8cqw]!">Lyrics</span>
                <span className="mt-[3cqw] h-[3px] w-[26cqw] rounded-full bg-[#F4EFE6]/70" />
              </button>
            </motion.section>
          )}

          {/* ───────── Screen 3 · Lyrics ───────── */}
          {view === "lyrics" && (
            <motion.section key="lyrics" {...slide} className="absolute inset-0 overflow-hidden bg-[#0d0c0e] text-white">
              <img src={artistPhoto} alt="" aria-hidden="true" className="absolute inset-x-0 top-0 h-[85%] w-full object-cover grayscale contrast-110 brightness-[0.55]" />
              <div className="absolute inset-0 bg-[#8f0d16] mix-blend-multiply opacity-75" />
              <div className="absolute inset-0 bg-[#0d0c0e]/40" />
              <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[#0d0c0e]/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0d0c0e] from-[35%] to-transparent" />

              <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-[7cqw] pt-[9cqw]">
                <button type="button" aria-label="Back to now playing" onClick={() => setView("player")} className="text-white/85">
                  <ChevronUp className="h-6 w-6" strokeWidth={1.4} />
                </button>
                <div className="min-w-0 flex-1 px-3 text-center">
                  <div className="flex items-center justify-center gap-[2cqw]">
                    <p className="micro min-w-0 truncate text-[2.8cqw]! text-[#F4EFE6]/90">{event.artist_name || "Live set"}</p>
                    <FollowPill />
                  </div>
                  {venue && <p className="micro mt-[1cqw] truncate text-[2.2cqw]! text-[#F4EFE6]/45">{venue}</p>}
                </div>
                <button type="button" aria-label="Setlist" onClick={() => setView("list")} className="mt-1.5">
                  <MenuLines dark />
                </button>
              </header>

              {/* album disc, half off the left edge, with its orbit arc */}
              <div className="pointer-events-none absolute left-0 top-[49%] z-10 h-0 w-0">
                <svg
                  viewBox="-100 -100 200 200"
                  className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible"
                  style={{ width: "76cqw", height: "76cqw" }}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="orbit-fade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#fff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {/* right half of the orbit, from top to bottom */}
                  <path d="M 0 -99 A 99 99 0 0 1 0 99" fill="none" stroke="url(#orbit-fade)" strokeWidth="0.9" />
                  {/* position marker */}
                  <circle cx={99 * Math.cos(-0.47)} cy={99 * Math.sin(-0.47)} r="4.2" fill="#fff" stroke="#0d0c0e" strokeWidth="1.6" />
                </svg>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F4EFE6]/90 p-[1.2cqw] shadow-[0_0_40px_rgba(244,239,230,0.12)]"
                  style={{ width: "55cqw", height: "55cqw" }}
                >
                  <div className="h-full w-full overflow-hidden rounded-full border-[1.2cqw] border-[#0d0c0e] bg-black">
                    <img
                      key={playerSongId}
                      src={getYouTubeFrame(playerSong) || artistAvatar}
                      onError={toHqThumb}
                      alt=""
                      className="h-full w-full object-cover object-[65%_center]"
                    />
                  </div>
                </div>
              </div>

              {/* lyrics */}
              <div
                className="absolute z-10 flex -translate-y-1/2 items-center"
                style={{ left: "45cqw", right: "10cqw", top: "49%" }}
              >
                {(() => {
                  const ls = lyrics?.lines || []
                  if (!playerSong)
                    return <p className="text-[6cqw] font-light leading-[1.25] text-white/50">Waiting for the artist to start the next song</p>
                  if (!lyrics) return <p className="text-[6cqw] font-light leading-[1.25] text-white/35">Finding lyrics…</p>
                  if (!ls.length)
                    return <p className="text-[6cqw] font-light leading-[1.25] text-white/70">No lyrics found for this one yet</p>
                  let idx = lyrics.synced ? ls.findLastIndex((l) => l.t <= clock) : Math.floor(clock / 4)
                  idx = Math.min(Math.max(idx, 0), ls.length - 1)
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full"
                      aria-live="polite"
                    >
                      <p className="line-clamp-3 text-[4.7cqw] font-light leading-[1.3] text-white/30">{ls[idx - 1]?.text || " "}</p>
                      <p className="title-x my-[7cqw] text-[5.6cqw] leading-[1.05]!">{ls[idx].text}</p>
                      <p className="line-clamp-3 text-[4.7cqw] font-light leading-[1.3] text-white/30">{ls[idx + 1]?.text || " "}</p>
                    </motion.div>
                  )
                })()}
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 px-[9cqw] pb-[9cqw] text-center">
                <p className="micro text-[2.4cqw]! text-[#F4EFE6]/60 tabular-nums">{playerSong ? fmt(clock) : " "}</p>
                <p className="title-x mt-[2.5cqw] truncate text-[4.8cqw]">{playerTitle || "Up next soon"}</p>
                <div className="mt-[5cqw]">
                  <Actions dark />
                </div>
              </div>
            </motion.section>
          )}

          {/* ───────── Screen 1 · Setlist ───────── */}
          {view === "list" && (
            <motion.section key="list" {...slide} className="absolute inset-0 flex flex-col bg-[radial-gradient(120%_60%_at_50%_0%,#5a0910_0%,#1a0507_50%,#070709_100%)] text-[#F4EFE6]">
              <header className="flex items-center justify-between px-[7cqw] pt-[11cqw]">
                <div>
                  <div className="dots"><i /></div>
                  <h1 className="title-x mt-[2.4cqw] text-[8cqw]">Setlist</h1>
                </div>
                <div className="flex items-center gap-[5cqw]">
                  <button type="button" aria-label="Search songs" onClick={() => setShowSearchModal(true)}>
                    <Search className="h-[5cqw] w-[5cqw]" strokeWidth={1.8} />
                  </button>
                  <button type="button" aria-label="Request songs" onClick={() => setShowRequestModal(true)}>
                    <Plus className="h-[5.4cqw] w-[5.4cqw]" strokeWidth={1.8} />
                  </button>
                  <button type="button" aria-label="Close setlist" onClick={() => setView("player")}>
                    <X className="h-[5.4cqw] w-[5.4cqw]" strokeWidth={1.8} />
                  </button>
                </div>
              </header>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="micro mt-[2cqw] flex items-center gap-[1.8cqw] px-[7cqw] text-[2.4cqw]! text-[#F4EFE6]/55"
              >
                <span className="truncate">{event.artist_name}</span>
                <span>·</span>
                <InstagramGlyph className="h-[3.4cqw] w-[3.4cqw] shrink-0 text-[#F4EFE6]" />
                <span className="shrink-0 text-[#F4EFE6]">Follow</span>
              </a>

              {/* rail + cards */}
              <div className="relative mt-[7cqw] h-[64cqw] shrink-0">
                <div className="absolute inset-y-[4cqw] left-0 w-[86cqw] rounded-r-[9cqw] border border-l-0 border-white/10 bg-white/[0.04]" />
                <div className="absolute inset-y-[4cqw] left-0 flex w-[14cqw] flex-col-reverse items-center justify-around">
                  {[
                    { id: "all", label: "All" },
                    { id: "top", label: "Top" },
                    { id: "dedications", label: "Dedicated" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`micro -rotate-90 whitespace-nowrap text-[2.4cqw]! transition ${
                        activeTab === tab.id ? "text-[#F4EFE6]" : "text-[#F4EFE6]/40"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="no-scrollbar absolute inset-y-0 left-[16cqw] right-0 flex snap-x snap-mandatory gap-[4cqw] overflow-x-auto pr-[8cqw]">
                  {songs.map((song: any, i: number) => {
                    const v = getVoteState(song)
                    const isNow = song.id === playerSongId
                    return (
                      <div
                        key={song.id}
                        id={`setlist-${song.id}`}
                        className="relative h-full w-[46cqw] shrink-0 snap-start rounded-[7cqw] p-[2.4cqw] shadow-[0_18px_30px_-16px_rgba(0,0,0,0.45)]"
                        style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}
                      >
                        <div className="relative h-full w-full overflow-hidden rounded-[5.4cqw]">
                          <img src={getYouTubeFrame(song) || artistAvatar} onError={toHqThumb} alt="" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                          <p className="title-x absolute inset-x-[3cqw] bottom-[13cqw] truncate text-center text-[3.2cqw]">
                            {song.song_title}
                          </p>
                          <div className="absolute inset-x-[3cqw] bottom-[3cqw] flex items-center justify-between">
                            {isNow ? (
                              <button
                                type="button"
                                aria-label="Open now playing"
                                onClick={() => setView("player")}
                                className="flex h-[7.5cqw] w-[7.5cqw] items-center justify-center rounded-full bg-[#F4EFE6] text-[#0b0a0e]"
                              >
                                <Play className="ml-[0.4cqw] h-[3cqw] w-[3cqw] fill-current" strokeWidth={0} />
                              </button>
                            ) : (
                              <span className="micro text-[2.4cqw]! text-[#F4EFE6]/85">{String(i + 1).padStart(2, "0")}</span>
                            )}
                            <button
                              type="button"
                              aria-label={v.hasVoted ? "Remove your heart" : "Heart this song"}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                handleUpvote(song, { x: rect.left + rect.width / 2, y: rect.top })
                              }}
                              className="text-[#F4EFE6]"
                            >
                              <Heart className={`h-[6.4cqw] w-[6.4cqw] ${v.hasVoted ? "fill-[#F4EFE6]" : ""}`} strokeWidth={1.6} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* table */}
              <div className="no-scrollbar mt-[6cqw] min-h-0 flex-1 overflow-y-auto px-[7cqw] pb-[26cqw]">
                <div className="micro flex items-center gap-[5cqw] border-b border-white/10 pb-[2cqw] text-[2.2cqw]! text-[#F4EFE6]/45">
                  <span className="w-[4cqw] text-center">#</span>
                  <span className="flex-1">Title</span>
                  <Heart className="h-[2.8cqw] w-[2.8cqw]" strokeWidth={1.6} />
                </div>
                {songs.length === 0 && <p className="py-8 text-center text-[3.2cqw] text-[#F4EFE6]/50">No songs yet. Tap + to request one.</p>}
                {songs.map((song: any, i: number) => {
                  const v = getVoteState(song)
                  const isNow = song.id === playerSongId
                  return (
                    <div key={song.id} className="flex items-center gap-[5cqw] py-[2.6cqw]">
                      <span className="w-[4cqw] text-center text-[3.1cqw] tabular-nums text-[#F4EFE6]/60">
                        {isNow ? <Play className="mx-auto h-[2.8cqw] w-[2.8cqw] fill-current text-[#F4EFE6]" strokeWidth={0} /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[3.3cqw] ${isNow ? "font-medium" : ""}`}>{song.song_title}</p>
                        {song.dedicated_to && <p className="truncate text-[2.5cqw] italic text-[#F4EFE6]/55">for {song.dedicated_to}</p>}
                      </div>
                      <button
                        type="button"
                        aria-label={v.hasVoted ? "Remove your heart" : "Heart this song"}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          handleUpvote(song, { x: rect.left + rect.width / 2, y: rect.top })
                        }}
                        className={`flex items-center gap-[1.4cqw] text-[3cqw] tabular-nums ${v.hasVoted ? "text-[#F4EFE6]" : "text-[#F4EFE6]/55"}`}
                      >
                        {v.count}
                        <Heart className={`h-[3.2cqw] w-[3.2cqw] ${v.hasVoted ? "fill-current" : ""}`} strokeWidth={1.6} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* mini player */}
              {playerSong && (
                <button
                  type="button"
                  onClick={() => setView("player")}
                  className="absolute inset-x-[5cqw] bottom-[7cqw] flex items-center gap-[3cqw] rounded-[3cqw] border border-white/10 bg-[#121014]/90 p-[2cqw] pr-[4cqw] text-left shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md"
                >
                  <img src={getYouTubeFrame(playerSong) || artistAvatar} onError={toHqThumb} alt="" className="h-[9cqw] w-[9cqw] rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="title-x block truncate text-[3.2cqw]">{playerTitle}</span>
                    <span className="micro mt-[0.8cqw] block truncate text-[2.2cqw]! text-[#F4EFE6]/50">{playerArtist}</span>
                  </span>
                  <Play className="h-[3.6cqw] w-[3.6cqw] fill-current text-[#F4EFE6]/70" strokeWidth={0} />
                </button>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODALS
      ───────────────────────────────────────────────────────────── */}

      {/* A. SEARCH SONGS MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-16">
          <div className="w-full max-w-sm bg-[#121014] border border-white/15 rounded-3xl p-6 text-[#F4EFE6] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="title-x text-[22px]"
              >
                Search Songs
              </h3>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F4EFE6] flex items-center justify-center text-[#F4EFE6] hover:text-[#0b0a0e] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song name..."
              className="w-full px-4 py-3 rounded-full bg-white/[0.04] border border-white/15 text-sm text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-white/5">
              {songs
                .filter((s: any) =>
                  !searchQuery.trim()
                    ? true
                    : s.song_title
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase())
                )
                .map((song: any) => {
                  const vs = getVoteState(song)
                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        setShowSearchModal(false)
                        setView("list")
                        requestAnimationFrame(() =>
                          document
                            .getElementById(`setlist-${song.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
                        )
                      }}
                      className="pt-2.5 pb-1 flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 px-2 rounded-xl transition"
                    >
                      <p
                        className="title-x truncate text-[13px]"
                      >
                        {song.song_title}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          handleUpvote(song, {
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          })
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                          vs.hasVoted
                            ? "bg-[#F4EFE6] text-[#0b0a0e] shadow-xs"
                            : "bg-white/5 hover:bg-[#F4EFE6] hover:text-[#0b0a0e] text-[#F4EFE6]"
                        }`}
                      >
                        <Heart className="w-3 h-3 fill-current" />
                        {vs.count}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* B. TIP THE ARTIST DIRECTLY MODAL */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-[#121014] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#F4EFE6] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={artistAvatar}
                  alt={event.artist_name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-[#F4EFE6]/80 shadow-sm"
                />
                <div>
                  <span className="micro text-[#F4EFE6]/60 block">
                    100% Direct to Artist
                  </span>
                  <h3
                    className="title-x text-[19px] leading-[1]!"
                  >
                    Tip {event.artist_name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTipModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F4EFE6] flex items-center justify-center text-[#F4EFE6] hover:text-[#0b0a0e] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTipArtist} className="space-y-3">
              {/* Preset Tip Amounts */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 200, 500].map((amt) => {
                  const selected = !tipCustomAmount.trim() && tipAmount === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setTipAmount(amt)
                        setTipCustomAmount("")
                      }}
                      className={`py-2.5 rounded-full text-xs font-semibold tracking-wider border transition-all cursor-pointer ${
                        selected
                          ? "bg-[#F4EFE6] text-[#0b0a0e] border-[#F4EFE6] shadow-xs"
                          : "bg-[#121014] text-[#F4EFE6] border-white/15 hover:border-[#F4EFE6]/60"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  )
                })}
              </div>

              <input
                type="number"
                min={10}
                value={tipCustomAmount}
                onChange={(e) => setTipCustomAmount(e.target.value)}
                placeholder="Or enter custom amount (₹)"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              <input
                type="text"
                value={tipSupporterName}
                onChange={(e) => setTipSupporterName(e.target.value)}
                placeholder="Your Name (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              <input
                type="text"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Short note for the artist (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              {tipError && <p className="text-xs text-[#ff9a9a]">{tipError}</p>}

              {(() => {
                if (!event?.artist_upi_id) return <p className="text-[11px] text-[#F4EFE6]/60">This artist hasn't added a UPI ID yet.</p>
                const amt = Number(tipCustomAmount.trim() || tipAmount || 100)
                const tipQr = generateUPIQR({
                  vpa: event.artist_upi_id,
                  name: event?.artist_payee_name || event?.artist_name || "Live Artist",
                  amount: amt,
                  orderId: `UPIPAY_TIP_${Date.now().toString().slice(-5)}`,
                  note: tipMessage.trim() || `Tip for ${event?.artist_name || "Artist"}`,
                  mode: "fixed",
                })
                return (
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#F4EFE6]">
                        Direct UPIPay to:{" "}
                        <code className="font-mono text-[#F4EFE6]/80">{tipQr.vpa}</code>
                      </span>
                      <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                        0% Fee
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <a
                        href={tipQr.intentLinks.gpay}
                        className="py-1.5 rounded-full bg-[#121014] hover:bg-[#F4EFE6] hover:text-[#0b0a0e] border border-white/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        GPay
                      </a>
                      <a
                        href={tipQr.intentLinks.phonepe}
                        className="py-1.5 rounded-full bg-[#121014] hover:bg-[#F4EFE6] hover:text-[#0b0a0e] border border-white/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        PhonePe
                      </a>
                      <a
                        href={tipQr.intentLinks.paytm}
                        className="py-1.5 rounded-full bg-[#121014] hover:bg-[#F4EFE6] hover:text-[#0b0a0e] border border-white/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        Paytm
                      </a>
                      <a
                        href={tipQr.intentLinks.upiUri}
                        className="py-1.5 rounded-full bg-[#121014] hover:bg-[#F4EFE6] hover:text-[#0b0a0e] border border-white/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        UPI App
                      </a>
                    </div>
                  </div>
                )
              })()}

              <button
                type="submit"
                disabled={tipping}
                className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>
                  {tipping
                    ? "Sending UPIPay Tip..."
                    : `Complete ₹${tipCustomAmount.trim() || tipAmount} UPIPay to Artist`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* C. 3-SONG DEDICATION MODAL:
          1. Mention 3 Song Names + Dedication Details
          2. Artist selects 1 of the 3 songs -> Pay Directly to the Artist for that song
      */}
      {showDedicationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#121014] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#F4EFE6] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="micro text-[#F4EFE6]/60 block">
                  Song Dedication • Direct to Artist
                </span>
                <h3
                  className="title-x text-[19px] leading-[1]!"
                >
                  Mention 3 Songs for Artist to Select
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDedicationModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F4EFE6] flex items-center justify-center text-[#F4EFE6] hover:text-[#0b0a0e] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#F4EFE6]/60 leading-relaxed">
              Enter <strong>3 song names</strong> below.{" "}
              <strong>{event.artist_name}</strong> will select the song they can
              perform best, and you can pay directly to the artist for that
              selected song.
            </p>

            {/* Existing 3-Song Dedication Batches (Artist Selection & Direct Payment) */}
            {myBatches.length > 0 && (
              <div className="space-y-2.5 p-4 rounded-2xl bg-white/[0.04] border border-white/15">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F4EFE6]/60">
                  Your 3-Song Choices & Artist Selection
                </p>

                {myBatches.slice(0, 2).map((batch: any) => {
                  const batchSongs: any[] = batch.songs || []
                  const selectedSong = batchSongs.find(
                    (s) => s.status === "confirmed" || s.status === "playing"
                  )
                  const paidSong = batchSongs.find(
                    (s) => s.dedication_payment_status === "paid"
                  )

                  return (
                    <div
                      key={batch.id}
                      className="space-y-2 pt-2 first:pt-0 border-t first:border-t-0 border-white/10"
                    >
                      {batch.dedicated_to && (
                        <p className="fine text-xs! text-[#F4EFE6]/80">
                          Dedicated to <strong>{batch.dedicated_to}</strong>
                        </p>
                      )}

                      <div className="space-y-1.5">
                        {batchSongs.map((s: any, idx: number) => {
                          const isSelected =
                            s.status === "confirmed" || s.status === "playing"
                          const isPaid = s.dedication_payment_status === "paid"
                          return (
                            <div
                              key={s.id}
                              className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs ${
                                isSelected
                                  ? "bg-white/[0.06] border-[#F4EFE6] text-[#F4EFE6]"
                                  : "bg-[#121014] border-white/10 text-[#F4EFE6]/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] opacity-70">
                                  #{idx + 1}
                                </span>
                                <span
                                  className="title-x truncate text-[13px]"
                                >
                                  {s.song_title}
                                </span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#F4EFE6] text-[#0b0a0e] text-[9px] font-semibold uppercase tracking-wider shrink-0">
                                    Artist Selected
                                  </span>
                                )}
                              </div>

                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                                  <Check className="w-3.5 h-3.5" /> Paid
                                </span>
                              ) : s.payment_reported ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80 shrink-0">
                                  Confirming payment
                                </span>
                              ) : !isSelected && !selectedSong && s.status === "pending_artist" ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F4EFE6]/45 shrink-0">
                                  Awaiting artist
                                </span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      {selectedSong && !paidSong && !selectedSong.payment_reported && (() => {
                        if (!event?.artist_upi_id) return <p className="text-[11px] text-[#F4EFE6]/60">This artist hasn't added a UPI ID yet.</p>
                        const dedQr = generateUPIQR({
                          vpa: event.artist_upi_id,
                          name: event?.artist_payee_name || event?.artist_name || "Live Artist",
                          amount: 50,
                          orderId: `UPIPAY_DED_${selectedSong.id.slice(0, 6)}`,
                          note: `Dedication: ${selectedSong.song_title}`,
                          mode: "fixed",
                        })
                        return (
                          <div className="space-y-2 pt-1">
                            <div className="p-3 rounded-2xl bg-[#121014] border border-white/15 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-[#F4EFE6]">
                                  UPIPay VPA: <code className="font-mono text-[#F4EFE6]/80">{dedQr.vpa}</code>
                                </span>
                                <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                                  ₹50 Fixed
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                <a
                                  href={dedQr.intentLinks.gpay}
                                  className="py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-semibold text-center hover:bg-[#F4EFE6] hover:text-[#0b0a0e] transition shadow-xs"
                                >
                                  GPay
                                </a>
                                <a
                                  href={dedQr.intentLinks.phonepe}
                                  className="py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-semibold text-center hover:bg-[#F4EFE6] hover:text-[#0b0a0e] transition shadow-xs"
                                >
                                  PhonePe
                                </a>
                                <a
                                  href={dedQr.intentLinks.paytm}
                                  className="py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-semibold text-center hover:bg-[#F4EFE6] hover:text-[#0b0a0e] transition shadow-xs"
                                >
                                  Paytm
                                </a>
                                <a
                                  href={dedQr.intentLinks.upiUri}
                                  className="py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-semibold text-center hover:bg-[#F4EFE6] hover:text-[#0b0a0e] transition shadow-xs"
                                >
                                  UPI App
                                </a>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={payingSongId === selectedSong.id}
                              onClick={() =>
                                handlePayDirectForSelectedSong(selectedSong, batch)
                              }
                              className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                              <span>
                                {payingSongId === selectedSong.id
                                  ? "Processing Direct UPIPay..."
                                  : `Pay ₹50 via UPIPay for "${selectedSong.song_title}"`}
                              </span>
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Form to Submit 3 Song Names for Dedication */}
            <form onSubmit={handleSubmitDedication3Songs} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={payDedicatedTo}
                  onChange={(e) => setPayDedicatedTo(e.target.value)}
                  placeholder="Dedicated To (Name) *"
                  className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                />
                <input
                  type="text"
                  required
                  value={payRequesterName}
                  onChange={(e) => setPayRequesterName(e.target.value)}
                  placeholder="Your Name (From) *"
                  className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                />
              </div>

              <input
                type="text"
                value={payDedicationMsg}
                onChange={(e) => setPayDedicationMsg(e.target.value)}
                placeholder="Dedication Message / Shoutout (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              {[
                {
                  idx: 1,
                  title: dedSong1,
                  setTitle: setDedSong1,
                  placeholder: "Song Choice #1 *",
                },
                {
                  idx: 2,
                  title: dedSong2,
                  setTitle: setDedSong2,
                  placeholder: "Song Choice #2 *",
                },
                {
                  idx: 3,
                  title: dedSong3,
                  setTitle: setDedSong3,
                  placeholder: "Song Choice #3 *",
                },
              ].map((item) => (
                <div key={item.idx} className="space-y-1">
                  <input
                    type="text"
                    required
                    value={item.title}
                    onChange={(e) => item.setTitle(e.target.value)}
                    placeholder={item.placeholder}
                    className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                  />
                </div>
              ))}

              {payError && <p className="text-xs text-[#ff9a9a]">{payError}</p>}

              <button
                type="submit"
                disabled={submittingDedicationBatch}
                className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                {submittingDedicationBatch
                  ? "Sending 3 Songs to Artist..."
                  : "Send 3 Songs for Artist to Select"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* D. REQUEST 3 SONGS MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-[#121014] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#F4EFE6] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="title-x text-[22px]"
              >
                Request 3 Songs
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#F4EFE6] flex items-center justify-center text-[#F4EFE6] hover:text-[#0b0a0e] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit3Songs} className="space-y-3">
              <input
                type="text"
                required
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Your Name / Table"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              {[
                {
                  idx: 1,
                  title: song1Title,
                  setTitle: setSong1Title,
                  placeholder: "Song #1 Name",
                },
                {
                  idx: 2,
                  title: song2Title,
                  setTitle: setSong2Title,
                  placeholder: "Song #2 Name",
                },
                {
                  idx: 3,
                  title: song3Title,
                  setTitle: setSong3Title,
                  placeholder: "Song #3 Name",
                },
              ].map((item) => (
                <div key={item.idx} className="space-y-1">
                  <input
                    type="text"
                    required
                    value={item.title}
                    onChange={(e) => item.setTitle(e.target.value)}
                    placeholder={item.placeholder}
                    className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                  />
                </div>
              ))}

              {submitError && (
                <p className="text-xs text-[#ff9a9a]">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                {submitting ? "Sending..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
