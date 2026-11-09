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
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion"
import MuseLoadingScreen from "@/components/muse-loading-screen"
import { extractYouTubeId } from "@/lib/youtube"
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
  const [tipAmount, setTipAmount] = useState<string>("")
  const [tipSupporterName, setTipSupporterName] = useState<string>("")
  const [tipMessage, setTipMessage] = useState<string>("")
  const [tipping, setTipping] = useState(false)
  const [tipError, setTipError] = useState<string | null>(null)

  // Tips and dedications are paid through Cashfree, which needs the payer's phone number.
  const [payerPhone, setPayerPhone] = useState("")
  const phoneDigits = payerPhone.replace(/\D/g, "").slice(-10)
  const rememberPayer = (name: string) => {
    try {
      if (name) window.localStorage.setItem("muse_audience_name", name)
      if (phoneDigits.length === 10) window.localStorage.setItem("muse_audience_phone", phoneDigits)
    } catch {
      /* storage unavailable */
    }
  }

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
    try {
      setPayerPhone(window.localStorage.getItem("muse_audience_phone") || "")
    } catch {
      /* storage unavailable */
    }
    fetchGigData(tok)

    const interval = setInterval(() => {
      fetchGigData(tok)
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchGigData])

  // Back from the Cashfree checkout (?payment=<id>): confirm the payment and say how it went.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentId = params.get("payment")
    if (!paymentId) return
    params.delete("payment")
    const qs = params.toString()
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash)

    let cancelled = false
    const check = async (attempt: number) => {
      const p = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (cancelled || !p) return
      if (p.status === "created" && attempt < 6) {
        setTimeout(() => check(attempt + 1), 2000)
        return
      }
      const message =
        p.status === "paid"
          ? p.kind === "dedication"
            ? `Paid! Your dedication for "${p.song_title}" is in the priority queue.`
            : `Thanks! Your ₹${p.amount} tip went through.`
          : p.status === "created"
            ? "Still waiting for the payment to confirm. It'll show up here once it does."
            : "The payment didn't go through. Nothing was charged; you can try again."
      setSubmitSuccess(message)
      setTimeout(() => setSubmitSuccess(null), 6000)
      fetchGigData(getOrCreateVoterToken())
    }
    check(0)
    return () => {
      cancelled = true
    }
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
  const [view, setView] = useState<"player" | "lyrics">("player")
  // The lyrics are a sheet that rides up over now playing. sheetY is its top edge in px:
  // 0 = open, the stage height = tucked away below. It follows the finger 1:1 and springs on release.
  const stageH = useRef(0)
  const sheetY = useMotionValue(4000)
  const sheetAnim = useRef<ReturnType<typeof animate> | null>(null)
  const sheetP = useTransform(sheetY, (y) => (stageH.current ? Math.min(1, Math.max(0, y / stageH.current)) : 1))
  const playerScale = useTransform(sheetP, [0, 1], [0.92, 1])
  const playerDim = useTransform(sheetP, [0, 1], [0.65, 0])
  const sheetRadius = useTransform(sheetP, [0, 0.04], [0, 34])
  const viewRef = useRef(view)
  viewRef.current = view
  const goTo = (to: "player" | "lyrics", velocity = 0) => {
    sheetAnim.current?.stop()
    sheetAnim.current = animate(sheetY, to === "lyrics" ? 0 : stageH.current, {
      type: "spring",
      stiffness: 300,
      damping: 34,
      mass: 0.9,
      velocity,
      restDelta: 0.5,
    })
    setView(to)
  }
  // Measured through a callback ref: the stage only mounts once the gig has loaded
  const stageRO = useRef<ResizeObserver | null>(null)
  const stageRef = useCallback(
    (el: HTMLDivElement | null) => {
      stageRO.current?.disconnect()
      if (!el) return
      const measure = () => {
        stageH.current = el.clientHeight
        if (!sheetY.isAnimating()) sheetY.set(viewRef.current === "lyrics" ? 0 : el.clientHeight)
      }
      measure()
      stageRO.current = new ResizeObserver(measure)
      stageRO.current.observe(el)
    },
    [sheetY],
  )
  // Vertical pans anywhere on the stage drag the sheet; sideways pans are left alone
  const panFrom = useRef<number | null>(null)
  const onStagePanStart = (_: PointerEvent, info: { offset: { x: number; y: number } }) => {
    if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) return void (panFrom.current = null)
    sheetAnim.current?.stop()
    panFrom.current = sheetY.get()
  }
  const onStagePan = (_: PointerEvent, info: { offset: { y: number } }) => {
    if (panFrom.current == null) return
    const h = stageH.current
    let y = panFrom.current + info.offset.y
    if (y < 0) y *= 0.2 // rubber band past the ends
    if (y > h) y = h + (y - h) * 0.2
    sheetY.set(y)
  }
  const onStagePanEnd = (_: PointerEvent, info: { velocity: { y: number } }) => {
    if (panFrom.current == null) return
    const moved = sheetY.get() - panFrom.current
    panFrom.current = null
    const v = info.velocity.y
    // a flick decides it; otherwise pulling a fifth of the screen is enough to commit
    const far = stageH.current * 0.2
    const open = v < -350 ? true : v > 350 ? false : view === "lyrics" ? moved < far : moved < -far
    goTo(open ? "lyrics" : "player", v)
  }
  // The setlist opens as a Liquid Glass sheet over whichever screen is showing
  const [listOpen, setListOpen] = useState(false)
  useEffect(() => {
    if (!listOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setListOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [listOpen])
  // A trackpad or mouse wheel flips between now playing and lyrics, once per gesture
  const wheelAt = useRef(0)
  const onWheelFlip = (e: React.WheelEvent) => {
    if (listOpen || Math.abs(e.deltaY) < 30 || Date.now() - wheelAt.current < 900) return
    wheelAt.current = Date.now()
    if (e.deltaY > 0 && view === "player") goTo("lyrics")
    if (e.deltaY < 0 && view === "lyrics") goTo("player")
  }
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
    if (phoneDigits.length !== 10) {
      setPayError("Enter your 10-digit phone number to pay.")
      return
    }
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
          requester_phone: phoneDigits,
        }),
      })
      const body = await res.json()
      if (!res.ok || !body.payment_url) throw new Error(body.error || "Payment failed.")

      rememberPayer(finalFrom)
      window.location.href = body.payment_url
      return
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
    if (phoneDigits.length !== 10) {
      setTipError("Enter your 10-digit phone number to pay.")
      return
    }
    setTipping(true)

    const finalAmount = Number(tipAmount)
    if (!tipAmount.trim() || !Number.isFinite(finalAmount) || finalAmount < 10) {
      setTipError("Enter how much you'd like to tip (₹10 or more).")
      return
    }

    try {
      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tip_artist",
          amount: finalAmount,
          supporter_name: tipSupporterName.trim() || "Audience Member",
          supporter_phone: phoneDigits,
          message: tipMessage.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok || !body.payment_url) throw new Error(body.error || "Tip failed.")

      rememberPayer(tipSupporterName.trim())
      window.location.href = body.payment_url
    } catch (err: any) {
      setTipError(err.message)
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

  // what the disc shows: the song playing, else the first song in the set that has a video
  const discSong =
    playerSong || (data?.allConfirmedSongs || []).find((s: any) => getYouTubeFrame(s)) || null

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
    const ring = dark ? "border border-[#F4EFE6]/25 bg-white/[0.04]" : "border border-[#1c1c1f]/20"
    const circle = "flex h-[max(44px,11.5cqw)] w-[max(44px,11.5cqw)] items-center justify-center rounded-full transition active:scale-90"
    const icon = "h-[max(18px,4.8cqw)] w-[max(18px,4.8cqw)]"
    const label = `text-[max(11px,2.7cqw)] leading-none tracking-wide ${sub}`
    const Item = ({ onClick, aria, children, text, disabled, filled }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={aria}
        className="flex flex-1 flex-col items-center gap-[max(8px,2.2cqw)] disabled:opacity-40"
      >
        <span className={`${circle} ${filled || ring} ${ink}`}>{children}</span>
        <span className={label}>{text}</span>
      </button>
    )
    return (
      <div className="flex items-start justify-between">
        <Item onClick={() => setShowRequestModal(true)} aria="Request songs" text="Request">
          <Plus className={icon} strokeWidth={1.5} />
        </Item>
        <Item onClick={openTip} aria="Tip the artist" text="Tip">
          <IndianRupee className={icon} strokeWidth={1.5} />
        </Item>
        <Item
          onClick={heartNow}
          disabled={!playerSong}
          aria={vote.hasVoted ? "Remove your heart" : "Heart this song"}
          text={vote.count}
          filled={vote.hasVoted ? "bg-[#F4EFE6] !text-[#8f0d16]" : undefined}
        >
          <Heart className={`${icon} fill-current`} strokeWidth={0} />
        </Item>
        <Item onClick={openDedicate} aria="Dedicate a song to someone special" text="Dedicate">
          <Sparkles className={icon} strokeWidth={1.5} />
        </Item>
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
      className="micro pointer-events-auto inline-flex shrink-0 items-center gap-[1.4cqw] glass glass-button rounded-full px-[2.6cqw] py-[1.2cqw] text-[2.1cqw]! text-[#F4EFE6]"
    >
      <InstagramGlyph className="h-[2.8cqw] w-[2.8cqw]" />
      Follow
    </a>
    ) : null

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
        <div className="fixed top-5 inset-x-4 z-50 max-w-sm mx-auto px-4 py-3 glass-thick rounded-2xl text-[#F4EFE6] text-xs font-medium flex items-center justify-between">
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
        {/* Both screens stay mounted: swiping up pulls the lyrics sheet over now playing, swiping down
            pushes it back, following the finger and springing to whichever side it was thrown to. */}
        <motion.div
          ref={stageRef}
          className="absolute inset-0"
          style={{ touchAction: "pan-x" }}
          onPanStart={onStagePanStart}
          onPan={onStagePan}
          onPanEnd={onStagePanEnd}
          onWheel={onWheelFlip}
        >
          {/* ───────── Screen 2 · Now playing ───────── */}
            <motion.section
              key="player"
              inert={view !== "player"}
              style={{ scale: playerScale }}
              className="absolute inset-0 flex origin-top flex-col overflow-hidden overscroll-none bg-[radial-gradient(120%_70%_at_50%_45%,#6a0a12_0%,#2a0509_50%,#0b0405_100%)] text-[#F4EFE6]"
            >
              {/* disc stage is laid out in flow below; its red capsule reaches up behind the header.
                  The glass menu button floats over the top-right corner of every screen. */}
              <header className="relative z-10 flex h-11 shrink-0 items-center justify-between px-[5cqw] mt-[max(16px,4cqw)]">
                {/* the Muse-ing mark, a glass button back to the home page, mirroring the menu button */}
                <Link
                  href="/"
                  aria-label="Muse-ing home"
                  className="glass glass-button title-x grid h-11 w-11 place-items-center rounded-full text-[14px] leading-none"
                >
                  M-
                </Link>
              </header>

              {/* the artist's name across the top of the capsule, with Follow below it */}
              <div className="relative z-10 mx-auto -mt-[3cqw] flex w-[60cqw] shrink-0 flex-col items-center gap-[3cqw]">
                <p className="title-x line-clamp-2 text-center text-[7cqw] leading-[0.95]! opacity-60">{(event.artist_name || "Live").split("&")[0].trim()}</p>
                <FollowPill />
              </div>

              {/* disc + progress arc, sized to whatever height is left */}
              <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
                <div className="absolute left-1/2 h-0 w-0" style={{ top: "calc(50% - min(59cqw, 62cqh) * 0.14)" }}>
                  {/* red capsule with the artist, running from behind the disc to the top of the screen */}
                  <div
                    className="absolute left-0 -translate-x-1/2 overflow-hidden rounded-b-full bg-[#8f0d16] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
                    style={{ width: "calc(min(59cqw, 62cqh) * 1.06)", bottom: "calc(min(59cqw, 62cqh) * -0.56)", height: "200vh" }}
                  >
                    <img src={artistPhoto} alt="" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[70vh] w-full object-cover grayscale contrast-125 brightness-75 mix-blend-multiply" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#8f0d16]/20 from-[60%] via-[#8f0d16]/45 to-[#3a060b]/85" />
                  </div>
                  <svg
                    viewBox="-100 -100 200 200"
                    className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible"
                    style={{ width: "calc(min(59cqw, 62cqh) * 1.42)", height: "calc(min(59cqw, 62cqh) * 1.42)" }}
                    aria-hidden="true"
                  >
                    <path d="M -96 0 A 96 96 0 0 0 96 0" fill="none" stroke="#F4EFE6" strokeOpacity="0.2" strokeWidth="0.9" />
                    {(() => {
                      const a = Math.PI - songProgress * Math.PI
                      const x = 96 * Math.cos(a)
                      const y = 96 * Math.sin(a)
                      return (
                        <>
                          <path d={`M -96 0 A 96 96 0 0 0 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke="#F4EFE6" strokeWidth="1.4" />
                          <circle cx={x} cy={y} r="4.5" fill="#F4EFE6" stroke="#0b0a0e" strokeWidth="2.2" />
                        </>
                      )
                    })()}
                  </svg>
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0a0e] p-[2.4cqw] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)]"
                    style={{ width: "min(59cqw, 62cqh)", height: "min(59cqw, 62cqh)" }}
                  >
                    {/* the record is the song's YouTube thumbnail; before anything plays, the first song in the set */}
                    <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-white/10">
                      <img key={discSong?.id ?? "artist"} src={getYouTubeFrame(discSong) || artistAvatar} onError={toHqThumb} alt="" className="h-full w-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 shrink-0 px-[8cqw] text-center">
                {playerSong && <p className="micro text-[max(10px,2.4cqw)]! text-[#F4EFE6]/60 tabular-nums">{fmt(clock)}</p>}
                <p className="title-x mt-[2cqw] truncate text-[6cqw]">{playerTitle || "Up next soon"}</p>
                {playerArtist && (
                  <p className="micro mt-[1.6cqw] truncate text-[max(10px,2.4cqw)]! text-[#F4EFE6]/55">{playerArtist}</p>
                )}
                <div className="mt-[max(20px,6cqw)] mb-[max(20px,6cqw)]">
                  <Actions dark />
                </div>
              </div>

              {/* lyrics drawer handle */}
              <button
                type="button"
                onClick={() => goTo("lyrics")}
                className="relative z-10 flex shrink-0 flex-col items-center justify-center gap-[max(10px,2.6cqw)] rounded-t-[9cqw] border-t border-white/10 bg-[#0b0a0e] pt-[max(16px,4cqw)] pb-[max(16px,4cqw,env(safe-area-inset-bottom))] text-[#F4EFE6]"
              >
                <span className="micro text-[max(11px,2.6cqw)]!">Lyrics</span>
                <span className="h-[3px] w-[22cqw] rounded-full bg-[#F4EFE6]/50" />
              </button>
            </motion.section>

          {/* now playing dims as the lyrics come up over it */}
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: playerDim }} />

          {/* ───────── Screen 3 · Lyrics ───────── */}
            <motion.section
              key="lyrics"
              inert={view !== "lyrics"}
              style={{ y: sheetY, borderTopLeftRadius: sheetRadius, borderTopRightRadius: sheetRadius }}
              className="absolute inset-0 overflow-hidden overscroll-none bg-[#0d0c0e] text-white shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.6)] will-change-transform"
            >
              {/* grab handle */}
              <span aria-hidden="true" className="absolute left-1/2 top-[6px] z-20 h-[4px] w-9 -translate-x-1/2 rounded-full bg-white/35" />
              <img src={artistPhoto} alt="" aria-hidden="true" className="absolute inset-x-0 top-0 h-[85%] w-full object-cover grayscale contrast-110 brightness-[0.55]" />
              <div className="absolute inset-0 bg-[#8f0d16] mix-blend-multiply opacity-75" />
              <div className="absolute inset-0 bg-[#0d0c0e]/40" />
              <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[#0d0c0e]/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0d0c0e] from-[35%] to-transparent" />

              <header className="absolute inset-x-0 top-[max(16px,4cqw)] z-10 flex items-start justify-between px-[5cqw]">
                <button type="button" aria-label="Back to now playing" onClick={() => goTo("player")} className="-m-2 grid h-11 w-11 shrink-0 place-items-center p-2 text-white/85">
                  <ChevronUp className="h-6 w-6" strokeWidth={1.4} />
                </button>
                <div className="min-w-0 flex-1 px-3 pt-1 text-center">
                  <p className="micro truncate text-[max(10px,2.8cqw)]! text-[#F4EFE6]/90">{event.artist_name || "Live set"}</p>
                  {instagramUrl && (
                    <div className="mt-[max(8px,2cqw)] flex justify-center">
                      <FollowPill />
                    </div>
                  )}
                  {venue && <p className="micro mt-[max(8px,2cqw)] truncate text-[max(9px,2.2cqw)]! text-[#F4EFE6]/45">{venue}</p>}
                </div>
                {/* room for the floating glass menu button */}
                <span className="h-11 w-11 shrink-0" aria-hidden="true" />
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

              <div className="absolute inset-x-0 bottom-0 z-10 px-[8cqw] pb-[max(8cqw,env(safe-area-inset-bottom))] text-center">
                <p className="micro text-[2.4cqw]! text-[#F4EFE6]/60 tabular-nums">{playerSong ? fmt(clock) : " "}</p>
                <p className="title-x mt-[2.5cqw] truncate text-[4.8cqw]">{playerTitle || "Up next soon"}</p>
                <div className="mt-[5cqw]">
                  <Actions dark />
                </div>
              </div>
            </motion.section>
        </motion.div>

        {/* ───────── Setlist · a Liquid Glass sheet that springs out of the menu button ───────── */}
        <AnimatePresence>
          {listOpen && (
            <motion.div
              key="setlist-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setListOpen(false)}
              className="absolute inset-0 z-30 bg-black/40"
              aria-hidden="true"
            />
          )}
          {listOpen && (
            <motion.div
              key="setlist"
              role="dialog"
              aria-label="Setlist"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } }}
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
              style={{ transformOrigin: "calc(100% - 5cqw - 12px) calc(max(16px, 4cqw) + 12px)" }}
              className="glass-thick absolute inset-x-[8px] top-[8px] bottom-[max(8px,env(safe-area-inset-bottom))] z-30 flex flex-col overflow-hidden rounded-[30px] text-[#F4EFE6]"
            >
              <header className="flex shrink-0 items-center gap-2 pl-[max(18px,5cqw)] pr-[calc(5cqw+44px)] pt-[max(8px,calc(4cqw-8px))]">
                <h2 className="title-x flex-1 text-[max(26px,7cqw)] leading-none">Setlist</h2>
                <button
                  type="button"
                  aria-label="Search songs"
                  onClick={() => setShowSearchModal(true)}
                  className="glass glass-button grid h-10 w-10 place-items-center rounded-full"
                >
                  <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  aria-label="Request songs"
                  onClick={() => setShowRequestModal(true)}
                  className="glass glass-button grid h-10 w-10 place-items-center rounded-full"
                >
                  <Plus className="h-[19px] w-[19px]" strokeWidth={1.8} />
                </button>
              </header>
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="micro mt-2 flex min-w-0 items-center gap-2 px-[max(18px,5cqw)] text-[11px]! text-[#F4EFE6]/55"
                >
                  <span className="truncate">{event.artist_name}</span>
                  <span>·</span>
                  <InstagramGlyph className="h-3.5 w-3.5 shrink-0 text-[#F4EFE6]" />
                  <span className="shrink-0 text-[#F4EFE6]">Follow</span>
                </a>
              ) : (
                <p className="micro mt-2 truncate px-[max(18px,5cqw)] text-[11px]! text-[#F4EFE6]/55">{event.artist_name}</p>
              )}

              {/* filter: a glass segmented control */}
              <div className="mx-[max(18px,5cqw)] mt-4 flex shrink-0 rounded-full bg-black/25 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                {[
                  { id: "all", label: "All" },
                  { id: "top", label: "Top" },
                  { id: "dedications", label: "Dedicated" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className="micro relative flex-1 rounded-full py-2 text-[11px]! transition-colors"
                  >
                    {activeTab === tab.id && (
                      <motion.span
                        layoutId="setlist-tab"
                        className="glass absolute inset-0 rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className={`relative ${activeTab === tab.id ? "text-[#F4EFE6]" : "text-[#F4EFE6]/50"}`}>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
                {/* cards */}
                {songs.length > 0 && (
                  <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[max(18px,5cqw)] px-[max(18px,5cqw)] pb-2">
                    {songs.map((song: any, i: number) => {
                      const v = getVoteState(song)
                      const isNow = song.id === playerSongId
                      return (
                        <div
                          key={song.id}
                          id={`setlist-${song.id}`}
                          className="relative aspect-[4/5] w-[40cqw] max-w-[180px] shrink-0 snap-start rounded-[24px] p-[6px] shadow-[0_18px_30px_-16px_rgba(0,0,0,0.45)]"
                          style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}
                        >
                          <div className="relative h-full w-full overflow-hidden rounded-[19px]">
                            <img src={getYouTubeFrame(song) || artistAvatar} onError={toHqThumb} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <p className="title-x absolute inset-x-3 bottom-12 line-clamp-2 text-center text-[13px] leading-tight">{song.song_title}</p>
                            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                              {isNow ? (
                                <button
                                  type="button"
                                  aria-label="Open now playing"
                                  onClick={() => {
                                    setListOpen(false)
                                    goTo("player")
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full bg-[#F4EFE6] text-[#0b0a0e]"
                                >
                                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" strokeWidth={0} />
                                </button>
                              ) : (
                                <span className="micro text-[11px]! text-[#F4EFE6]/85">{String(i + 1).padStart(2, "0")}</span>
                              )}
                              <button
                                type="button"
                                aria-label={v.hasVoted ? "Remove your heart" : "Heart this song"}
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  handleUpvote(song, { x: rect.left + rect.width / 2, y: rect.top })
                                }}
                                className="-m-2 p-2 text-[#F4EFE6]"
                              >
                                <Heart className={`h-6 w-6 ${v.hasVoted ? "fill-[#F4EFE6]" : ""}`} strokeWidth={1.6} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* table */}
                <div className="mt-4 px-[max(18px,5cqw)]">
                  <div className="micro flex items-center gap-4 border-b border-white/10 pb-2 text-[10px]! text-[#F4EFE6]/45">
                    <span className="w-5 text-center">#</span>
                    <span className="flex-1">Title</span>
                    <Heart className="h-3 w-3" strokeWidth={1.6} />
                  </div>
                  {songs.length === 0 && <p className="py-10 text-center text-[14px] text-[#F4EFE6]/50">No songs yet. Tap + to request one.</p>}
                  {songs.map((song: any, i: number) => {
                    const v = getVoteState(song)
                    const isNow = song.id === playerSongId
                    return (
                      <div key={song.id} className="flex min-h-[52px] items-center gap-4 border-b border-white/[0.06] py-2 last:border-0">
                        <span className="w-5 text-center text-[13px] tabular-nums text-[#F4EFE6]/50">
                          {isNow ? <Play className="mx-auto h-3 w-3 fill-current text-[#F4EFE6]" strokeWidth={0} /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[15px] ${isNow ? "font-semibold" : ""}`}>{song.song_title}</p>
                          {song.dedicated_to && <p className="truncate text-[12px] italic text-[#F4EFE6]/55">for {song.dedicated_to}</p>}
                        </div>
                        <button
                          type="button"
                          aria-label={v.hasVoted ? "Remove your heart" : "Heart this song"}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            handleUpvote(song, { x: rect.left + rect.width / 2, y: rect.top })
                          }}
                          className={`-mr-2 flex items-center gap-1.5 rounded-full px-2 py-2 text-[13px] tabular-nums ${v.hasVoted ? "text-[#F4EFE6]" : "text-[#F4EFE6]/55"}`}
                        >
                          {v.count}
                          <Heart className={`h-4 w-4 ${v.hasVoted ? "fill-current" : ""}`} strokeWidth={1.6} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* now playing, back to the player */}
              {playerSong && (
                <button
                  type="button"
                  onClick={() => {
                    setListOpen(false)
                    goTo("player")
                  }}
                  className="glass glass-button mx-2 mb-2 flex shrink-0 items-center gap-3 rounded-[22px] p-2 pr-4 text-left"
                >
                  <img src={getYouTubeFrame(playerSong) || artistAvatar} onError={toHqThumb} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="title-x block truncate text-[14px]">{playerTitle}</span>
                    <span className="micro mt-0.5 block truncate text-[10px]! text-[#F4EFE6]/55">{playerArtist}</span>
                  </span>
                  <Play className="h-4 w-4 fill-current text-[#F4EFE6]/80" strokeWidth={0} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* the Liquid Glass menu button: three lines that morph into an X while the setlist is open */}
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-label={listOpen ? "Close the setlist" : "Open the setlist"}
          aria-expanded={listOpen}
          className="glass glass-button absolute right-[5cqw] top-[max(16px,4cqw)] z-40 grid h-11 w-11 place-items-center rounded-full"
        >
          <span aria-hidden className="relative block h-3 w-4">
            <span className={`glass-line top-0 ${listOpen ? "translate-y-[5px] rotate-45" : ""}`} />
            <span className={`glass-line top-[5px] ${listOpen ? "scale-x-0 opacity-0" : ""}`} />
            <span className={`glass-line top-[10px] ${listOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
          </span>
        </button>
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
                        setListOpen(true)
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
                    Tip the artist
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
              <div className="relative">
                <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 title-x text-[22px] text-[#F4EFE6]/60">₹</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={10}
                  step="1"
                  required
                  autoFocus
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Any amount"
                  aria-label="Tip amount in rupees"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white/[0.04] border border-white/15 title-x text-[22px] text-[#F4EFE6] placeholder:text-[#F4EFE6]/30 focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                />
              </div>

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

              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                placeholder="Your phone number (for the payment) *"
                className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
              />

              <p className="text-[11px] text-[#F4EFE6]/50">
                You&apos;ll pay securely with UPI, card or netbanking on the next screen.
              </p>

              {tipError && <p className="text-xs text-[#ff9a9a]">{tipError}</p>}

              <button
                type="submit"
                disabled={tipping}
                className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#0b0a0e] font-semibold text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>
                  {tipping
                    ? "Opening payment…"
                    : Number(tipAmount) > 0
                      ? `Pay ₹${Number(tipAmount).toLocaleString("en-IN")}`
                      : "Pay"}
                </span>
              </button>
              <p className="text-center text-[10.5px] text-[#F4EFE6]/45">
                Paid via Cashfree. See our{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-[#F4EFE6]">Terms</Link> and{" "}
                <Link href="/refunds" target="_blank" className="underline underline-offset-2 hover:text-[#F4EFE6]">Refund Policy</Link>.
              </p>
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
                  Song Dedication
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
              perform best, then you pay ₹50 to put that song in the priority
              queue with your shoutout.
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

                      {selectedSong && !paidSong && !selectedSong.payment_reported && (
                          <div className="space-y-2 pt-1">
                            <input
                              type="tel"
                              inputMode="numeric"
                              autoComplete="tel"
                              value={payerPhone}
                              onChange={(e) => setPayerPhone(e.target.value)}
                              placeholder="Your phone number (for the payment) *"
                              className="w-full px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/15 text-xs text-[#F4EFE6] focus:outline-none focus:border-[#F4EFE6]/60 transition-colors"
                            />
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
                                  ? "Opening payment…"
                                  : `Pay ₹50 for "${selectedSong.song_title}"`}
                              </span>
                            </button>
                            {payError && <p className="text-xs text-[#ff9a9a]">{payError}</p>}
                            <p className="text-center text-[10.5px] text-[#F4EFE6]/45">
                              Paid via Cashfree. See our{" "}
                              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-[#F4EFE6]">Terms</Link> and{" "}
                              <Link href="/refunds" target="_blank" className="underline underline-offset-2 hover:text-[#F4EFE6]">Refund Policy</Link>.
                            </p>
                          </div>
                      )}
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
