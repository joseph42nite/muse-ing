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
import { motion, useMotionValue, useSpring } from "framer-motion"
import MuseLoadingScreen from "@/components/muse-loading-screen"
import { extractYouTubeId } from "@/lib/youtube"
import { generateUPIQR } from "@/lib/upipay"
import {
  BookOpen,
  LayoutGrid,
  Search,
  Heart,
  Sparkles,
  Plus,
  MapPin,
  Calendar,
  X,
  CheckCircle2,
  Feather,
  Instagram,
  IndianRupee,
  Check,
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

function mod(n: number, m: number): number {
  if (m <= 0) return 0
  return ((n % m) + m) % m
}

// Resolve YouTube thumbnail for each song (strictly preview image, no play button)
function getYouTubeThumbnail(song: any): string {
  if (song?.youtube_video_id) {
    return `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`
  }
  const extracted = extractYouTubeId(song?.youtube_url)
  if (extracted) {
    return `https://img.youtube.com/vi/${extracted}/hqdefault.jpg`
  }
  return ""
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

  // View mode: "book" (pin_video.mp4 3D Fanned Open-Spread Carousel) vs "grid"
  const [viewMode, setViewMode] = useState<"book" | "grid">("book")
  const [activeTab, setActiveTab] = useState<
    "all" | "top" | "artist" | "dedications"
  >("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // Continuous 3D page-flip progress
  const targetProgress = useMotionValue(0)
  const smoothProgress = useSpring(targetProgress, {
    stiffness: 72,
    damping: 20,
    mass: 0.6,
  })
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const unsub = smoothProgress.on("change", (v) => setProgress(v))
    return () => unsub()
  }, [smoothProgress])

  const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scheduleSnap = useCallback(() => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    snapTimeoutRef.current = setTimeout(() => {
      targetProgress.set(Math.round(targetProgress.get()))
    }, 150)
  }, [targetProgress])

  const flipBy = useCallback(
    (delta: number) => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
      targetProgress.set(Math.round(targetProgress.get()) + delta)
    },
    [targetProgress]
  )

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
  const [requesterPhone, setRequesterPhone] = useState("")
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
  const [payRequesterPhone, setPayRequesterPhone] = useState("")
  const [submittingDedicationBatch, setSubmittingDedicationBatch] = useState(false)
  const [payingSongId, setPayingSongId] = useState<string | null>(null)
  const [selectingSongId, setSelectingSongId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  // Tip Artist Directly Modal State
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState<number>(100)
  const [tipCustomAmount, setTipCustomAmount] = useState<string>("")
  const [tipSupporterName, setTipSupporterName] = useState<string>("")
  const [tipMessage, setTipMessage] = useState<string>("")
  const [tipping, setTipping] = useState(false)
  const [tipError, setTipError] = useState<string | null>(null)

  const dragStateRef = useRef<{
    active: boolean
    startX: number
    startProgress: number
    moved: boolean
  }>({ active: false, startX: 0, startProgress: 0, moved: false })

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showRequestModal ||
        showDedicationModal ||
        showTipModal ||
        showSearchModal ||
        showInfoModal
      )
        return
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        flipBy(1)
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        flipBy(-1)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    flipBy,
    showRequestModal,
    showDedicationModal,
    showTipModal,
    showSearchModal,
    showInfoModal,
  ])

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
          requester_phone: requesterPhone,
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
          requester_phone: payRequesterPhone,
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

  // Artist selects 1 of the 3 songs in the batch
  const handleArtistSelectSong = async (songId: string) => {
    setPayError(null)
    setSelectingSongId(songId)
    try {
      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "artist_select_song",
          request_id: songId,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not select song.")
      await fetchGigData(voterToken)
    } catch (err: any) {
      setPayError(err.message)
    } finally {
      setSelectingSongId(null)
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
          requester_phone: payRequesterPhone || "9876543210",
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
        `Paid ₹50 directly to artist for "${song.song_title}"!`
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
        `₹${finalAmount} Tip sent directly to ${data?.event?.artist_name || "the artist"}!`
      )
      setTimeout(() => setSubmitSuccess(null), 5000)
    } catch (err: any) {
      setTipError(err.message)
    } finally {
      setTipping(false)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (
      viewMode !== "book" ||
      showRequestModal ||
      showDedicationModal ||
      showTipModal ||
      showSearchModal ||
      showInfoModal ||
      songs.length === 0
    )
      return
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 2) return
    const step = Math.max(-0.35, Math.min(0.35, delta * 0.0028))
    targetProgress.set(targetProgress.get() + step)
    scheduleSnap()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startProgress: targetProgress.get(),
      moved: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current.active) return
    const dx = e.clientX - dragStateRef.current.startX
    if (Math.abs(dx) > 6) {
      dragStateRef.current.moved = true
    }
    const pageDelta = -dx / 220
    targetProgress.set(dragStateRef.current.startProgress + pageDelta)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current.active) return
    const dx = e.clientX - dragStateRef.current.startX
    dragStateRef.current.active = false
    if (Math.abs(dx) > 36) {
      const dir = dx < 0 ? 1 : -1
      targetProgress.set(Math.round(dragStateRef.current.startProgress) + dir)
    } else {
      targetProgress.set(Math.round(targetProgress.get()))
    }
  }

  // Left Half: LEFT 50% of the full YouTube Thumbnail spread across the open book
  // With a high-contrast dark frosted backdrop so the song title is 100% legible
  const renderLeftHalf = (song: any, songIdx: number) => {
    if (!song) return null
    const thumbUrl = getYouTubeThumbnail(song)

    return (
      <div className="relative w-full h-full select-none overflow-hidden bg-[#181615]">
        {/* Left half of the full-spread YouTube thumbnail */}
        <img
          src={thumbUrl}
          alt={song.song_title}
          draggable={false}
          className="absolute top-0 left-0 w-[200%] h-full max-w-none object-cover pointer-events-none select-none"
        />
        {/* Strong bottom & left editorial scrim so white typography pops cleanly */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,14,13,0.45) 0%, rgba(15,14,13,0.25) 40%, rgba(15,14,13,0.88) 100%)",
          }}
        />

        {/* Overlaid content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-mono text-[#181615] font-semibold tracking-widest px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md border border-[#181615]/15 shadow-md">
              #{String(songIdx + 1).padStart(2, "0")}
            </span>
          </div>

          {/* High-Contrast Editorial Polaroid Card for Maximum Text Readability */}
          <div className="mt-auto mr-1 rounded-2xl bg-white border-2 border-white p-4 sm:p-5 shadow-[0_20px_50px_-10px_rgba(24,22,21,0.28),0_8px_20px_-6px_rgba(24,22,21,0.18)]">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl text-[#181615] font-normal leading-tight tracking-normal break-words"
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
              }}
            >
              {song.song_title}
            </h2>
            {song.original_artist && (
              <p className="text-xs sm:text-sm font-medium text-[#5C5650] mt-1 truncate font-sans">
                {song.original_artist}
              </p>
            )}
            {song.dedicated_to && (
              <p className="text-xs text-[#D92323] mt-1.5 font-serif italic truncate flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#D92323] shrink-0 fill-[#D92323]" />
                <span>Dedicated to {song.dedicated_to}</span>
              </p>
            )}
          </div>
        </div>

        {/* Center Spine Crease Shadow on Right Edge of Left Page */}
        <div
          className="absolute inset-y-0 right-0 w-6 sm:w-10 pointer-events-none z-20"
          style={{
            background:
              "linear-gradient(270deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)",
          }}
        />
      </div>
    )
  }

  // Right Half: RIGHT 50% of the full YouTube Thumbnail spread across the open book + Clean Vote Button
  const renderRightHalf = (song: any) => {
    if (!song) return null
    const thumbUrl = getYouTubeThumbnail(song)
    const vs = getVoteState(song)

    return (
      <div className="relative w-full h-full select-none overflow-hidden bg-[#181615]">
        {/* Right half of the full-spread YouTube thumbnail */}
        <img
          src={thumbUrl}
          alt={song.song_title}
          draggable={false}
          className="absolute top-0 -left-full w-[200%] h-full max-w-none object-cover pointer-events-none select-none"
        />
        {/* Matching editorial scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,14,13,0.45) 0%, rgba(15,14,13,0.25) 40%, rgba(15,14,13,0.88) 100%)",
          }}
        />

        {/* Overlaid Vote Pill */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-3.5 sm:p-6">
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
            className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-full flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95 ${
              vs.hasVoted
                ? "bg-[#D92323] text-white shadow-[0_8px_25px_rgba(217,35,35,0.45)] border border-[#D92323]"
                : "bg-white text-[#181615] hover:bg-[#181615] hover:text-white border border-[#181615]/15"
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                vs.hasVoted ? "fill-white text-white" : "text-current"
              }`}
            />
            <span>{vs.hasVoted ? "Voted" : "Vote"}</span>
            <span className="opacity-40">•</span>
            <span>{vs.count}</span>
          </button>
        </div>

        {/* Center Spine Crease Shadow on Left Edge of Right Page */}
        <div
          className="absolute inset-y-0 left-0 w-6 sm:w-10 pointer-events-none z-20"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)",
          }}
        />
      </div>
    )
  }

  if (loading && !data) {
    return <MuseLoadingScreen isLoading={true} />
  }

  if (!data?.event) {
    return (
      <div className="min-h-screen bg-[#F4EFE6] text-[#181615] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-serif mb-2">Live Gig Not Found</p>
        <Link
          href="/"
          className="px-4 py-2 rounded-full bg-[#181615] text-[#F4EFE6] text-xs font-semibold"
        >
          Return Home
        </Link>
      </div>
    )
  }

  const { event } = data
  const myBatches: any[] = data.myBatches || []
  const instagramHandle = (event.artist_instagram || "@arjunmehtalive").replace(
    /^@/,
    ""
  )
  const instagramUrl = `https://instagram.com/${instagramHandle}`
  const artistAvatar =
    event.artist_avatar ||
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80"

  const N = Math.max(1, songs.length)
  const baseIdx = Math.floor(progress)
  const frac = progress - baseIdx

  const currentIdx = mod(baseIdx, N)
  const nextIdx = mod(baseIdx + 1, N)
  const currentSong = songs[currentIdx]
  const nextSong = songs[nextIdx]

  const leafAngle = -11 - frac * 158

  const activeIdx = mod(Math.round(progress), N)
  const activeSong = songs[activeIdx]

  return (
    <div
      onWheel={handleWheel}
      className="relative h-[100dvh] w-full bg-[#F4EFE6] text-[#181615] flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      <MuseLoadingScreen isLoading={false} minDurationMs={2600} />
      {/* Warm ambient background with subtle vignette matching landing page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-55"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,252,245,0.7) 0%, rgba(235,227,213,0.5) 70%, rgba(219,208,190,0.7) 100%)",
        }}
      />

      {/* Floating +1 Heart Particles */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingParticles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0.8, x: p.x, y: p.y }}
            animate={{
              opacity: 0,
              scale: 1.5,
              y: p.y - 100,
              x: p.x + (Math.random() * 24 - 12),
            }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute flex items-center gap-1 text-[#D92323] font-bold text-sm"
          >
            <Heart className="w-5 h-5 fill-[#D92323] text-[#D92323]" />
            <span className="text-xs text-[#181615] font-semibold">
              {p.label || "+1"}
            </span>
          </motion.div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. TOP HEADER CHROME
          - Top-left: m- logo (exact same position px-6 sm:px-12 pt-6 sm:pt-8 & size as Landing Page)
          - Top-right: Search button
          - Center: Artist icon, name & real Instagram icon (all mid-aligned)
          - Center: Song counter + Playlist filter tabs
      ───────────────────────────────────────────────────────────── */}
      <header className="relative z-30 px-6 sm:px-12 pt-6 sm:pt-8">
        <div className="flex items-center justify-between">
          {/* Top-Left: m- Logo (Exact same size and position as Landing Page) */}
          <Link
            href="/"
            aria-label="muse-ing home"
            className="group flex items-center transition-transform duration-300 hover:scale-110 cursor-pointer select-none shrink-0"
            title="Muse-ing Home"
          >
            <span
              className="instrument text-4xl sm:text-5xl md:text-6xl font-normal leading-none tracking-tight"
              style={{ fontFamily: "var(--font-instrument-serif), serif" }}
            >
              <span className="text-[#181615]">m</span>
              <span className="text-[#D92323]">-</span>
            </span>
          </Link>

          {/* Top-Right: Search Button (Enlarged to match top header scale) */}
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            aria-label="Search Songs"
            className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border border-[#181615]/15 bg-white/90 hover:bg-[#181615] text-[#181615] hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer shadow-sm shrink-0"
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
          </button>
        </div>

        {/* Center: Artist Icon, Name & Exact Instagram Icon ALL MID-ALIGNED */}
        <div className="flex flex-col items-center justify-center text-center -mt-9 sm:-mt-14 pointer-events-none">
          <div className="inline-flex items-center justify-center gap-2.5 sm:gap-3.5 max-w-[62vw] sm:max-w-xl pointer-events-auto">
            {/* Circular Artist Image - Enlarged */}
            <img
              src={artistAvatar}
              alt={event.artist_name || "Artist"}
              className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-md shrink-0"
            />

            {/* Artist Title in Instrument Serif */}
            <h1
              className="text-lg sm:text-2xl md:text-3xl font-normal tracking-tight text-[#181615] truncate"
              style={{ fontFamily: "var(--font-instrument-serif), serif" }}
            >
              {event.artist_name || "Setlist"}
            </h1>

            {/* Real Official Instagram Icon with Signature Pink/Magenta Gradient - Enlarged */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Artist Instagram"
              title={`@${instagramHandle} on Instagram`}
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-[28%] overflow-hidden flex items-center justify-center shadow-md transition hover:scale-110 shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
                <defs>
                  <radialGradient id="ig-grad-real" cx="0.2" cy="1" r="1.15">
                    <stop offset="0%" stopColor="#fdf497" />
                    <stop offset="12%" stopColor="#fdf497" />
                    <stop offset="42%" stopColor="#fd5949" />
                    <stop offset="68%" stopColor="#d6249f" />
                    <stop offset="100%" stopColor="#285AEB" />
                  </radialGradient>
                </defs>
                {/* Real full-time Instagram pink/sunset gradient background */}
                <rect width="24" height="24" rx="6.5" fill="url(#ig-grad-real)" />
                {/* Camera body glyph */}
                <rect
                  x="4.75"
                  y="4.75"
                  width="14.5"
                  height="14.5"
                  rx="4.2"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                />
                {/* Center lens glyph */}
                <circle
                  cx="12"
                  cy="12"
                  r="3.5"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                />
                {/* Flash dot glyph */}
                <circle cx="15.8" cy="8.2" r="1.05" fill="#FFFFFF" />
              </svg>
            </a>
          </div>

          {/* Tagline */}
          <p className="text-xs sm:text-sm text-[#5C5650] mt-1 font-serif italic tracking-wide pointer-events-auto">
            You choose your playlist, I sing for you
          </p>

          {/* Song counter */}
          <div className="inline-flex items-center gap-1.5 mt-0.5 text-xs text-[#5C5650]/80 font-medium pointer-events-auto">
            <Feather className="w-3 h-3 text-[#D92323]" />
            <span>
              {activeIdx + 1} of {songs.length} Songs
            </span>
          </div>
        </div>

        {/* Center: "top adn dedicated" Tabs in the middle */}
        <div className="flex items-center justify-center mt-3 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-black/5 border border-[#181615]/10 backdrop-blur-sm">
            {[
              { id: "all", label: "All" },
              { id: "top", label: "Top Voted" },
              { id: "artist", label: "Artist Set" },
              { id: "dedications", label: "Dedications" },
            ].map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any)
                    targetProgress.set(0)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    active
                      ? "bg-[#D92323] text-white shadow-sm"
                      : "text-[#181615]/75 hover:text-[#181615] hover:bg-white/70"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {submitSuccess && (
        <div className="fixed top-20 inset-x-4 z-50 max-w-sm mx-auto px-4 py-2.5 rounded-2xl bg-[#181615] text-[#FAF7F2] text-xs font-medium flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D92323] shrink-0" />
            <span>{submitSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            className="text-white/60 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. CENTER STAGE: pin_video.mp4 3D FANNED DECK
          - Single YouTube Thumbnail spread seamlessly across both pages
          - High-contrast frosted card on left for Song Name
          - Clean Vote Pill on right
      ───────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 flex items-center justify-center w-full px-2 overflow-visible">
        {songs.length === 0 ? (
          <div className="text-center p-8 rounded-3xl bg-[#FAF7F2] border border-[#181615]/10 max-w-xs mx-auto shadow-sm">
            <p className="text-base font-serif text-[#181615]">No songs yet</p>
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="mt-3 px-4 py-2 rounded-full bg-[#D92323] text-white text-xs font-medium"
            >
              + Request Songs
            </button>
          </div>
        ) : viewMode === "book" ? (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full max-w-5xl h-[290px] sm:h-[380px] md:h-[430px] flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
            style={{ perspective: "1300px" }}
          >
            {/* Floor Shadow */}
            <div
              className="pointer-events-none absolute -bottom-6 sm:-bottom-9 w-[86%] max-w-[680px] h-12 sm:h-16 rounded-full blur-xl opacity-65"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(24, 22, 21, 0.28) 0%, rgba(24, 22, 21, 0.12) 55%, transparent 80%)",
              }}
            />

            {/* 3D Spread + Fanned Stacks */}
            <div
              className="relative w-[260px] sm:w-[460px] md:w-[580px] h-[255px] sm:h-[340px] md:h-[390px]"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* ── A. LEFT FANNED CARD STACK (Shows previous songs' thumbnails) ── */}
              {[5, 4, 3, 2, 1].map((slot) => {
                const d = slot + frac * 0.25
                const slotIdx = mod(baseIdx - slot, N)
                const slotSong = songs[slotIdx]
                const slotThumb = getYouTubeThumbnail(slotSong)
                const scaleY = 1 - d * 0.042
                const translateZ = -d * 14

                return (
                  <div
                    key={`left-fan-${slot}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!dragStateRef.current.moved) flipBy(-1)
                    }}
                    className="absolute top-0 left-0 w-1/2 h-full rounded-l-2xl overflow-hidden border border-white/20 shadow-[-8px_12px_22px_rgba(24,22,21,0.22)] cursor-pointer bg-[#181615]"
                    style={{
                      transformOrigin: "100% 50%",
                      transform: `translate3d(calc(${-d} * clamp(11px, 3.2vw, 26px)), 0px, ${translateZ}px) rotateY(11deg) scaleY(${scaleY})`,
                      zIndex: 10 - slot,
                    }}
                  >
                    <img
                      src={slotThumb}
                      alt=""
                      draggable={false}
                      className="absolute top-0 left-0 w-[200%] h-full max-w-none object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: `rgba(0, 0, 0, ${0.2 + slot * 0.08})`,
                      }}
                    />
                  </div>
                )
              })}

              {/* ── B. RIGHT FANNED CARD STACK (Shows upcoming songs' thumbnails) ── */}
              {[5, 4, 3, 2, 1].map((slot) => {
                const d = Math.max(0.2, slot - frac * 0.25)
                const slotIdx = mod(baseIdx + slot, N)
                const slotSong = songs[slotIdx]
                const slotThumb = getYouTubeThumbnail(slotSong)
                const scaleY = 1 - d * 0.042
                const translateZ = -d * 14

                return (
                  <div
                    key={`right-fan-${slot}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!dragStateRef.current.moved) flipBy(1)
                    }}
                    className="absolute top-0 right-0 w-1/2 h-full rounded-r-2xl overflow-hidden border border-white/20 shadow-[8px_12px_22px_rgba(24,22,21,0.22)] cursor-pointer bg-[#181615]"
                    style={{
                      transformOrigin: "0% 50%",
                      transform: `translate3d(calc(${d} * clamp(11px, 3.2vw, 26px)), 0px, ${translateZ}px) rotateY(-11deg) scaleY(${scaleY})`,
                      zIndex: 10 - slot,
                    }}
                  >
                    <img
                      src={slotThumb}
                      alt=""
                      draggable={false}
                      className="absolute top-0 -left-full w-[200%] h-full max-w-none object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: `rgba(0, 0, 0, ${0.2 + slot * 0.08})`,
                      }}
                    />
                  </div>
                )
              })}

              {/* ── C. BASE LEFT OPEN HALF (Full YouTube Thumbnail + Song Name) ── */}
              <div
                onClick={() => {
                  if (!dragStateRef.current.moved) flipBy(-1)
                }}
                className="absolute top-0 left-0 w-1/2 h-full rounded-l-2xl overflow-hidden border border-white/25 shadow-[-12px_18px_32px_rgba(24,22,21,0.25)]"
                style={{
                  transformOrigin: "100% 50%",
                  transform: "rotateY(11deg)",
                  zIndex: 20,
                }}
              >
                {renderLeftHalf(currentSong, currentIdx)}
                {frac > 0.02 && (
                  <div
                    className="absolute inset-0 pointer-events-none z-30"
                    style={{
                      backgroundColor: `rgba(0, 0, 0, ${Math.sin(frac * Math.PI) * 0.22})`,
                    }}
                  />
                )}
              </div>

              {/* ── D. BASE RIGHT OPEN HALF (Full YouTube Thumbnail + Vote Button) ── */}
              <div
                onClick={() => {
                  if (!dragStateRef.current.moved) flipBy(1)
                }}
                className="absolute top-0 right-0 w-1/2 h-full rounded-r-2xl overflow-hidden border border-white/25 shadow-[12px_18px_32px_rgba(24,22,21,0.25)]"
                style={{
                  transformOrigin: "0% 50%",
                  transform: "rotateY(-11deg)",
                  zIndex: 20,
                }}
              >
                {renderRightHalf(frac > 0.005 ? nextSong : currentSong)}
                {frac > 0.005 && (
                  <div
                    className="absolute inset-0 pointer-events-none z-30"
                    style={{
                      backgroundColor: `rgba(0, 0, 0, ${(1 - frac) * 0.25})`,
                    }}
                  />
                )}
              </div>

              {/* ── E. 3D TURNING PAGE LEAF ── */}
              <div
                className="absolute top-0 right-0 w-1/2 h-full"
                style={{
                  transformOrigin: "0% 50%",
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${leafAngle}deg)`,
                  zIndex: 35,
                  pointerEvents: frac > 0.05 && frac < 0.95 ? "none" : "auto",
                }}
              >
                <div
                  className="absolute inset-0 w-full h-full rounded-r-2xl overflow-hidden border border-white/25 shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
                  {renderRightHalf(currentSong)}
                </div>

                <div
                  className="absolute inset-0 w-full h-full rounded-l-2xl overflow-hidden border border-white/25 shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {renderLeftHalf(nextSong, nextIdx)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Card / Grid View Mode */
          <div className="w-full max-w-md mx-auto px-3 max-h-[62vh] overflow-y-auto grid grid-cols-2 gap-3">
            {songs.map((song: any, idx: number) => {
              const vs = getVoteState(song)
              const thumb = getYouTubeThumbnail(song)
              return (
                <div
                  key={song.id}
                  onClick={() => {
                    targetProgress.set(idx)
                    setViewMode("book")
                  }}
                  className="relative p-3 rounded-2xl overflow-hidden border-2 border-white shadow-[0_12px_28px_-6px_rgba(24,22,21,0.22)] cursor-pointer transition flex flex-col justify-between h-40 bg-[#181615] group hover:scale-[1.02] duration-300"
                >
                  <img
                    src={thumb}
                    alt={song.song_title}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30" />

                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#181615] font-semibold px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs border border-[#181615]/10 shadow-xs">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <p
                      className="text-base sm:text-lg text-white line-clamp-2 leading-tight drop-shadow font-normal"
                      style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                    >
                      {song.song_title}
                    </p>
                    <div className="flex items-center justify-end mt-2">
                      <span className="text-[11px] font-mono font-medium text-white flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs border border-white/10">
                        <Heart
                          className={`w-3 h-3 ${
                            vs.hasVoted ? "fill-[#D92323] text-[#D92323]" : "text-white"
                          }`}
                        />
                        {vs.count}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM ACTION DOCK
          - Book / Card View Toggle (relocated from top-left)
          - Heart (Vote Current Song)
          - Tip Artist Directly Icon (right next to the Heart!)
          - Dedicate Song (3-song selection & direct artist payment)
          - Request 3 Songs (+)
      ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-30 pb-5 sm:pb-7 pt-2 px-4 flex items-center justify-center">
        <div className="p-1.5 sm:p-2 rounded-full bg-white/95 backdrop-blur-md border border-[#181615]/15 shadow-[0_16px_40px_-8px_rgba(24,22,21,0.22),0_4px_12px_-2px_rgba(24,22,21,0.12)] inline-flex items-center gap-2 sm:gap-3">
          {/* 1. Book / Card View Switcher */}
          <div className="flex items-center bg-black/5 rounded-full p-0.5 border border-[#181615]/10">
            <button
              type="button"
              onClick={() => setViewMode("book")}
              aria-label="Book Spread View"
              title="Book Spread View"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                viewMode === "book"
                  ? "bg-[#181615] text-white shadow-xs"
                  : "text-[#181615]/60 hover:text-[#181615]"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Card Grid View"
              title="Card Grid View"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#181615] text-white shadow-xs"
                  : "text-[#181615]/60 hover:text-[#181615]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* 2. Vote Current Song (♥ Heart) */}
          <button
            type="button"
            onClick={(e) => {
              if (!activeSong) return
              const rect = e.currentTarget.getBoundingClientRect()
              handleUpvote(activeSong, {
                x: rect.left + rect.width / 2,
                y: rect.top,
              })
            }}
            aria-label="Vote Current Song"
            title="Vote Current Song"
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-108 active:scale-95 cursor-pointer shadow-sm ${
              activeSong && getVoteState(activeSong).hasVoted
                ? "bg-[#D92323] border-[#D92323] text-white shadow-[0_4px_16px_rgba(217,35,35,0.35)]"
                : "bg-white hover:bg-[#181615] text-[#181615] hover:text-white border-[#181615]/15"
            }`}
          >
            <Heart
              className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${
                activeSong && getVoteState(activeSong).hasVoted
                  ? "fill-white text-white"
                  : "text-current"
              }`}
            />
          </button>

          {/* 3. Tip Artist Directly */}
          <button
            type="button"
            onClick={() => {
              setTipError(null)
              setShowTipModal(true)
            }}
            aria-label="Tip the Artist Directly"
            title="Tip the Artist Directly"
            className="h-10 sm:h-11 px-3.5 sm:px-4.5 rounded-full bg-white hover:bg-[#D92323] text-[#181615] hover:text-white border border-[#181615]/15 shadow-sm flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-semibold uppercase tracking-wider text-[11px] sm:text-xs group"
          >
            <IndianRupee className="w-3.5 h-3.5 text-[#D92323] group-hover:text-white transition-colors" />
            <span>Tip</span>
          </button>

          {/* 4. Dedicate Song */}
          <button
            type="button"
            onClick={() => {
              setPayError(null)
              if (activeSong && !dedSong1) {
                setDedSong1(activeSong.song_title || "")
              }
              setShowDedicationModal(true)
            }}
            aria-label="Dedicate Song"
            title="Dedicate Song"
            className="h-10 sm:h-11 px-3.5 sm:px-4.5 rounded-full bg-white hover:bg-[#D92323] text-[#181615] hover:text-white border border-[#181615]/15 shadow-sm flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-semibold uppercase tracking-wider text-[11px] sm:text-xs group"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D92323] group-hover:text-white transition-colors" />
            <span>Dedicate</span>
          </button>

          {/* 5. Add / Request 3 Songs (+) */}
          <button
            type="button"
            onClick={() => {
              setSubmitError(null)
              setShowRequestModal(true)
            }}
            aria-label="Request Songs"
            title="Request 3 Songs"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#181615] hover:bg-[#D92323] text-white shadow-md flex items-center justify-center hover:scale-108 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          MODALS
      ───────────────────────────────────────────────────────────── */}

      {/* A. SEARCH SONGS MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-[#181615]/60 backdrop-blur-sm flex items-start justify-center p-4 pt-16">
          <div className="w-full max-w-sm bg-white border border-[#181615]/15 rounded-3xl p-6 text-[#181615] shadow-[0_30px_70px_-15px_rgba(24,22,21,0.35)] space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-2xl font-normal"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                Search Songs
              </h3>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-[#181615] flex items-center justify-center text-[#181615] hover:text-white transition-all cursor-pointer"
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
              className="w-full px-4 py-3 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-sm text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-[#181615]/5">
              {songs
                .filter((s: any) =>
                  !searchQuery.trim()
                    ? true
                    : s.song_title
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase())
                )
                .map((song: any, i: number) => {
                  const vs = getVoteState(song)
                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        targetProgress.set(i)
                        setShowSearchModal(false)
                      }}
                      className="pt-2.5 pb-1 flex items-center justify-between gap-2 cursor-pointer hover:bg-black/5 px-2 rounded-xl transition"
                    >
                      <p
                        className="text-base truncate text-[#181615]"
                        style={{ fontFamily: "var(--font-instrument-serif), serif" }}
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
                            ? "bg-[#D92323] text-white shadow-xs"
                            : "bg-[#181615]/5 hover:bg-[#181615] hover:text-white text-[#181615]"
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
        <div className="fixed inset-0 z-50 bg-[#181615]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-white border-t sm:border border-[#181615]/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#181615] shadow-[0_30px_70px_-15px_rgba(24,22,21,0.35)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={artistAvatar}
                  alt={event.artist_name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D92323] font-semibold block">
                    100% Direct to Artist
                  </span>
                  <h3
                    className="text-2xl leading-tight font-normal"
                    style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                  >
                    Tip {event.artist_name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTipModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-[#181615] flex items-center justify-center text-[#181615] hover:text-white transition-all cursor-pointer"
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
                          ? "bg-[#D92323] text-white border-[#D92323] shadow-xs"
                          : "bg-white text-[#181615] border-[#181615]/15 hover:border-[#181615]"
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
                className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
              />

              <input
                type="text"
                value={tipSupporterName}
                onChange={(e) => setTipSupporterName(e.target.value)}
                placeholder="Your Name (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
              />

              <input
                type="text"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Short note for the artist (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
              />

              {tipError && <p className="text-xs text-[#D92323]">{tipError}</p>}

              {(() => {
                const amt = Number(tipCustomAmount.trim() || tipAmount || 100)
                const tipQr = generateUPIQR({
                  vpa: event?.artist_upi_id || "arjunmehta@ybl",
                  name: event?.artist_payee_name || event?.artist_name || "Live Artist",
                  amount: amt,
                  orderId: `UPIPAY_TIP_${Date.now().toString().slice(-5)}`,
                  note: tipMessage.trim() || `Tip for ${event?.artist_name || "Artist"}`,
                  mode: "fixed",
                })
                return (
                  <div className="p-3.5 rounded-2xl bg-[#F4EFE6]/60 border border-[#181615]/10 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#181615]">
                        Direct UPIPay to:{" "}
                        <code className="font-mono text-[#D92323]">{tipQr.vpa}</code>
                      </span>
                      <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                        0% Fee
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <a
                        href={tipQr.intentLinks.gpay}
                        className="py-1.5 rounded-full bg-white hover:bg-[#181615] hover:text-white border border-[#181615]/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        GPay
                      </a>
                      <a
                        href={tipQr.intentLinks.phonepe}
                        className="py-1.5 rounded-full bg-white hover:bg-[#181615] hover:text-white border border-[#181615]/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        PhonePe
                      </a>
                      <a
                        href={tipQr.intentLinks.paytm}
                        className="py-1.5 rounded-full bg-white hover:bg-[#181615] hover:text-white border border-[#181615]/15 text-[10px] font-semibold text-center transition shadow-xs"
                      >
                        Paytm
                      </a>
                      <a
                        href={tipQr.intentLinks.upiUri}
                        className="py-1.5 rounded-full bg-white hover:bg-[#181615] hover:text-white border border-[#181615]/15 text-[10px] font-semibold text-center transition shadow-xs"
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
                className="w-full py-3.5 rounded-full bg-[#D92323] hover:bg-[#b81d1d] text-white font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-[#181615]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white border-t sm:border border-[#181615]/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#181615] shadow-[0_30px_70px_-15px_rgba(24,22,21,0.35)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#D92323] font-semibold block">
                  Song Dedication • Direct to Artist
                </span>
                <h3
                  className="text-2xl leading-tight font-normal"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  Mention 3 Songs for Artist to Select
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDedicationModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-[#181615] flex items-center justify-center text-[#181615] hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C5650] leading-relaxed">
              Enter <strong>3 song names</strong> below.{" "}
              <strong>{event.artist_name}</strong> will select the song they can
              perform best, and you can pay directly to the artist for that
              selected song.
            </p>

            {/* Existing 3-Song Dedication Batches (Artist Selection & Direct Payment) */}
            {myBatches.length > 0 && (
              <div className="space-y-2.5 p-4 rounded-2xl bg-[#F4EFE6]/60 border border-[#181615]/15">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5650]">
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
                      className="space-y-2 pt-2 first:pt-0 border-t first:border-t-0 border-[#181615]/10"
                    >
                      {batch.dedicated_to && (
                        <p className="text-xs font-serif italic text-[#181615]">
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
                                  ? "bg-[#D92323]/8 border-[#D92323] text-[#181615]"
                                  : "bg-white border-[#181615]/10 text-[#5C5650]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] opacity-70">
                                  #{idx + 1}
                                </span>
                                <span
                                  className="text-base text-[#181615] truncate"
                                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                                >
                                  {s.song_title}
                                </span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#D92323] text-white text-[9px] font-semibold uppercase tracking-wider shrink-0">
                                    Artist Selected
                                  </span>
                                )}
                              </div>

                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                                  <Check className="w-3.5 h-3.5" /> Paid
                                </span>
                              ) : !isSelected ? (
                                <button
                                  type="button"
                                  disabled={selectingSongId === s.id}
                                  onClick={() => handleArtistSelectSong(s.id)}
                                  className="px-3 py-1 rounded-full bg-[#181615] hover:bg-[#D92323] text-white text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer shrink-0 shadow-xs"
                                >
                                  {selectingSongId === s.id
                                    ? "Selecting..."
                                    : "Artist Selects This"}
                                </button>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      {selectedSong && !paidSong && (() => {
                        const dedQr = generateUPIQR({
                          vpa: event?.artist_upi_id || "arjunmehta@ybl",
                          name: event?.artist_payee_name || event?.artist_name || "Live Artist",
                          amount: 50,
                          orderId: `UPIPAY_DED_${selectedSong.id.slice(0, 6)}`,
                          note: `Dedication: ${selectedSong.song_title}`,
                          mode: "fixed",
                        })
                        return (
                          <div className="space-y-2 pt-1">
                            <div className="p-3 rounded-2xl bg-white border border-[#181615]/15 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-[#181615]">
                                  UPIPay VPA: <code className="font-mono text-[#D92323]">{dedQr.vpa}</code>
                                </span>
                                <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                                  ₹50 Fixed
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                <a
                                  href={dedQr.intentLinks.gpay}
                                  className="py-1.5 rounded-full bg-[#F4EFE6] border border-[#181615]/15 text-[10px] font-semibold text-center hover:bg-[#181615] hover:text-white transition shadow-xs"
                                >
                                  GPay
                                </a>
                                <a
                                  href={dedQr.intentLinks.phonepe}
                                  className="py-1.5 rounded-full bg-[#F4EFE6] border border-[#181615]/15 text-[10px] font-semibold text-center hover:bg-[#181615] hover:text-white transition shadow-xs"
                                >
                                  PhonePe
                                </a>
                                <a
                                  href={dedQr.intentLinks.paytm}
                                  className="py-1.5 rounded-full bg-[#F4EFE6] border border-[#181615]/15 text-[10px] font-semibold text-center hover:bg-[#181615] hover:text-white transition shadow-xs"
                                >
                                  Paytm
                                </a>
                                <a
                                  href={dedQr.intentLinks.upiUri}
                                  className="py-1.5 rounded-full bg-[#F4EFE6] border border-[#181615]/15 text-[10px] font-semibold text-center hover:bg-[#181615] hover:text-white transition shadow-xs"
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
                              className="w-full py-3.5 rounded-full bg-[#D92323] hover:bg-[#b81d1d] text-white font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
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
                  className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
                />
                <input
                  type="text"
                  required
                  value={payRequesterName}
                  onChange={(e) => setPayRequesterName(e.target.value)}
                  placeholder="Your Name (From) *"
                  className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
                />
              </div>

              <input
                type="text"
                value={payDedicationMsg}
                onChange={(e) => setPayDedicationMsg(e.target.value)}
                placeholder="Dedication Message / Shoutout (Optional)"
                className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
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
                    className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
                  />
                </div>
              ))}

              {payError && <p className="text-xs text-[#D92323]">{payError}</p>}

              <button
                type="submit"
                disabled={submittingDedicationBatch}
                className="w-full py-3.5 rounded-full bg-[#181615] hover:bg-[#D92323] text-white font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#181615]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-white border-t sm:border border-[#181615]/15 rounded-t-3xl sm:rounded-3xl p-6 text-[#181615] shadow-[0_30px_70px_-15px_rgba(24,22,21,0.35)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-2xl font-normal"
                style={{ fontFamily: "var(--font-instrument-serif), serif" }}
              >
                Request 3 Songs
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-[#181615] flex items-center justify-center text-[#181615] hover:text-white transition-all cursor-pointer"
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
                className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
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
                    className="w-full px-4 py-2.5 rounded-full bg-[#F4EFE6]/70 border border-[#181615]/15 text-xs text-[#181615] focus:outline-none focus:border-[#D92323] transition-colors"
                  />
                </div>
              ))}

              {submitError && (
                <p className="text-xs text-[#D92323]">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-[#181615] hover:bg-[#D92323] text-white font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
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
