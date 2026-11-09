"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Reorder, useDragControls } from "framer-motion"
import {
  Check,
  ExternalLink,
  GripVertical,
  LogOut,
  Menu,
  Music,
  Play,
  Plus,
  QrCode,
  Radio,
  CalendarDays,
  Search,
  SkipForward,
  Trash2,
  Tv,
  UserCheck,
  Volume2,
  VolumeX,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import QrCodeModal from "@/components/qr-code-modal"
import { extractYouTubeId } from "@/lib/youtube"
import { DEMO_ARTIST, DEMO_LOGIN_ENABLED } from "@/lib/demo"
import { cn } from "@/lib/utils"
import { Field, FormDialog } from "../admin/admin-form"
import { PageHeader } from "../admin/admin-table"
import "../admin/admin-noir.css"

type View = "tonight" | "shows" | "money"

const rupees = (n: unknown) => `₹${Number(n || 0).toLocaleString("en-IN")}`
const requester = (s: any) => (s?.source_type === "artist_playlist" ? null : s?.requester_name || null)
const isVip = (s: any) => s?.dedication_payment_status === "paid" || Boolean(s?.wants_dedication)
const videoIdOf = (s: any) => s?.youtube_video_id || extractYouTubeId(s?.youtube_url) || ""
const thumb = (s: any) => {
  const id = videoIdOf(s)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
const showDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : ""

async function artistPost(body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  const res = await fetch("/api/artist/dashboard", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}
const patch = (body: Record<string, unknown>) => artistPost(body, "PATCH").catch(() => null)

/* ───────────────────────────── Small pieces ───────────────────────────── */

function Panel({ title, meta, children, className }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("admin-panel p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="micro text-[#F4EFE6]">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  )
}

function Thumb({ song, size = "h-10 w-10" }: { song: any; size?: string }) {
  const src = thumb(song)
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-lg bg-white/[0.06]", size)}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#F4EFE6]/30">
          <Music className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

function Tag({ children, tone = "line" }: { children: React.ReactNode; tone?: "line" | "cream" | "red" }) {
  return (
    <span
      className={cn(
        "micro inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[8.5px]!",
        tone === "cream" && "bg-[#F4EFE6] text-[#14100a]",
        tone === "red" && "bg-[#D92323] text-white",
        tone === "line" && "border border-[#F4EFE6]/25 text-[#F4EFE6]/70",
      )}
    >
      {children}
    </span>
  )
}

/** One song in tonight's running order. The grip drags it; the play button sends it to the stage. */
function SongRow({
  song,
  slot,
  onStage,
  draggable,
  onPlay,
  onDone,
  onRemove,
}: {
  song: any
  slot?: number
  onStage: boolean
  draggable: boolean
  onPlay: () => void
  onDone: () => void
  onRemove?: () => void
}) {
  const controls = useDragControls()
  const played = song.status === "played"

  const body = (
    <>
      {draggable ? (
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          style={{ touchAction: "none" }}
          className="-ml-1 flex h-9 w-6 shrink-0 cursor-grab items-center justify-center text-[#F4EFE6]/30 hover:text-[#F4EFE6] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="hidden w-5 shrink-0 sm:block" />
      )}
      <span className="micro hidden w-5 shrink-0 text-center text-[#F4EFE6]/40 sm:inline">{slot ?? ""}</span>
      <Thumb song={song} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[14px] font-medium", played && "text-[#F4EFE6]/40 line-through")}>{song.song_title}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {isVip(song) && <Tag tone="cream">₹50</Tag>}
          {Number(song.upvotes) > 0 && <Tag>♥ {song.upvotes}</Tag>}
          <span className="truncate text-[12px] text-[#F4EFE6]/50">
            {requester(song) ? `for ${requester(song)}` : song.original_artist}
          </span>
        </div>
      </div>
      {onStage ? (
        <Tag tone="red">On stage</Tag>
      ) : (
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${song.song_title}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#F4EFE6] px-3 text-[#14100a] transition hover:bg-white sm:px-4"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span className="micro hidden text-[9px]! sm:inline">Play</span>
        </button>
      )}
      <button
        type="button"
        onClick={onDone}
        aria-label={played ? "Played" : "Mark played"}
        title={played ? "Played" : "Mark played"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
          played ? "border-transparent bg-[#F4EFE6]/15 text-[#F4EFE6]" : "border-[#F4EFE6]/20 text-[#F4EFE6]/60 hover:border-[#F4EFE6]/60 hover:text-white",
        )}
      >
        <Check className="h-4 w-4" />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove from setlist"
          className="hidden h-9 w-7 shrink-0 items-center justify-center text-[#F4EFE6]/25 transition hover:text-[#ff7a7a] sm:flex"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )

  const cls = cn(
    "flex items-center gap-2.5 rounded-2xl px-2 py-2 sm:gap-3",
    onStage ? "bg-[#D92323]/12 ring-1 ring-[#D92323]/50" : "hover:bg-white/[0.04]",
  )

  if (!draggable) return <div className={cls}>{body}</div>
  return (
    <Reorder.Item as="div" value={song} id={song.id} dragListener={false} dragControls={controls} className={cn(cls, "bg-[#0f0d12]/0")}>
      {body}
    </Reorder.Item>
  )
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function ArtistDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState("")
  const [view, setView] = useState<View>("tonight")
  const [menuOpen, setMenuOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [newShowOpen, setNewShowOpen] = useState(false)

  // Stage
  const [activeSong, setActiveSong] = useState<any>(null)
  const [videoId, setVideoId] = useState("")
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ledOpen, setLedOpen] = useState(false)
  const [doneToast, setDoneToast] = useState<{ id: string; title: string } | null>(null)

  // Video search
  const [ytQuery, setYtQuery] = useState("")
  const [ytResults, setYtResults] = useState<any[] | null>(null)
  const [ytSearching, setYtSearching] = useState(false)
  const [ytConnected, setYtConnected] = useState<boolean | null>(null)

  // Add song
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newArtist, setNewArtist] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [adding, setAdding] = useState(false)

  // Payments
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [bank, setBank] = useState<Record<string, string>>({})
  const [bankMsg, setBankMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingBank, setSavingBank] = useState(false)

  // Profile / new show forms
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [show, setShow] = useState<Record<string, string>>({})

  const autoMarked = useRef<Set<string>>(new Set())
  const ytPlayer = useRef<any>(null)
  const lastReport = useRef(0)
  const activeRef = useRef<any>(null)
  activeRef.current = activeSong
  const saveOrderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDashboard = useCallback(
    async (evId?: string) => {
      try {
        const id = evId ?? selectedEventId
        const res = await fetch(id ? `/api/artist/dashboard?eventId=${encodeURIComponent(id)}` : "/api/artist/dashboard", {
          cache: "no-store",
        })
        if (res.status === 401) {
          setNeedsAuth(true)
          return
        }
        if (!res.ok) return
        const json = await res.json()
        setNeedsAuth(false)
        setData(json)
        if (json.activeGig && !id) setSelectedEventId(json.activeGig.id)
        const a = json.artist
        if (a) {
          setBank((b) =>
            Object.keys(b).length
              ? b
              : {
                  upi_id: a.upi_id || "",
                  payee_name: a.payee_name || a.name || "",
                  bank_name: a.bank_name || "",
                  account_number: a.account_number || "",
                  ifsc_code: a.ifsc_code || "",
                  upipay_provider: a.upipay_provider || "upi_direct",
                  upipay_merchant_id: a.upipay_merchant_id || "",
                },
          )
        }
      } catch {
        // transient; the next poll retries
      } finally {
        setLoading(false)
      }
    },
    [selectedEventId],
  )

  useEffect(() => {
    fetchDashboard()
    const t = setInterval(() => fetchDashboard(), 3500)
    return () => clearInterval(t)
  }, [fetchDashboard])

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [view])

  /* ── Stage controls ── */

  const broadcast = (vid: string, song: any, mute = muted) => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return
    const bc = new BroadcastChannel("muse_led_screen")
    bc.postMessage({ type: "LOAD_KARAOKE", videoId: vid, song, muted: mute })
    bc.close()
  }

  const openLedScreen = () => {
    const gigId = data?.activeGig?.id
    if (!gigId) return
    const popup = window.open(`/artist/led-screen?eventId=${encodeURIComponent(gigId)}`, "MuseVenueLED", "popup,width=1280,height=720")
    setLedOpen(true)
    if (popup) setTimeout(() => broadcast(videoId, activeSong), 900)
  }

  const playSong = async (song: any, overrideVideo?: string) => {
    if (song?.id) autoMarked.current.delete(song.id)
    const vid = overrideVideo || videoIdOf(song)
    setActiveSong(song)
    setVideoId(vid)
    setPlaying(Boolean(vid))
    setYtResults(null)
    if (vid) broadcast(vid, song)
    await patch({ action: "set_now_playing", request_id: song.id })
    fetchDashboard()
  }

  const markPlayed = useCallback(
    async (id: string) => {
      await patch({ action: "mark_played", request_id: id })
      fetchDashboard()
    },
    [fetchDashboard],
  )

  const autoMarkDone = useCallback(async () => {
    const song = activeRef.current
    if (!song?.id || autoMarked.current.has(song.id)) return
    autoMarked.current.add(song.id)
    setDoneToast({ id: song.id, title: song.song_title || "Song" })
    setTimeout(() => setDoneToast((t) => (t?.id === song.id ? null : t)), 7000)
    await markPlayed(song.id)
  }, [markPlayed])

  // YouTube IFrame API: load once, then watch for the end of each video so it's marked played.
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(tag)
    }
  }, [])

  const bindPlayer = useCallback(() => {
    const iframe = document.getElementById("stage-active-player") as HTMLIFrameElement | null
    if (!iframe?.contentWindow) return
    iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "stage-active-player", channel: "widget" }), "*")
    const YT = (window as any).YT
    if (YT?.Player) {
      try {
        ytPlayer.current = new YT.Player(iframe, { events: { onStateChange: (e: any) => e?.data === 0 && autoMarkDone() } })
      } catch {
        // already bound
      }
    }
  }, [autoMarkDone])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const p = typeof e.data === "string" ? JSON.parse(e.data) : e.data
        if (p?.event === "onStateChange" && String(p.info) === "0") autoMarkDone()
        if (p?.event === "infoDelivery" && p.info) {
          if (p.info.playerState === 0) autoMarkDone()
          const { currentTime: cur, duration: dur } = p.info
          if (typeof cur === "number" && typeof dur === "number" && dur > 5 && cur >= dur - 4) autoMarkDone()
        }
      } catch {
        // not a YouTube message
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [autoMarkDone])

  useEffect(() => {
    bindPlayer()
    const t = setInterval(() => {
      bindPlayer()
      const p = ytPlayer.current
      if (!p || typeof p.getCurrentTime !== "function") return
      try {
        const cur = p.getCurrentTime()
        const dur = p.getDuration()
        if (dur > 5 && cur >= dur - 4) autoMarkDone()
        const id = activeRef.current?.id
        const now = Date.now()
        if (id && now - lastReport.current > 2000) {
          lastReport.current = now
          patch({ action: "report_playback", request_id: id, position: cur, playing: p.getPlayerState?.() === 1 })
        }
      } catch {
        // player not ready
      }
    }, 1000)
    return () => clearInterval(t)
  }, [videoId, playing, bindPlayer, autoMarkDone])

  // Suggested video search for the song on stage
  useEffect(() => {
    if (activeSong?.song_title) setYtQuery(`${activeSong.song_title} ${activeSong.original_artist || ""} karaoke`.replace(/\s+/g, " ").trim())
  }, [activeSong?.id, activeSong?.song_title, activeSong?.original_artist])

  const loadVideo = async (vid: string) => {
    setVideoId(vid)
    setPlaying(true)
    setYtResults(null)
    broadcast(vid, activeSong)
    if (activeSong?.id) {
      await patch({ action: "attach_youtube", request_id: activeSong.id, youtube_url: `https://www.youtube.com/watch?v=${vid}` })
      fetchDashboard()
    }
  }

  const searchYouTube = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = ytQuery.trim()
    if (!q) return
    const direct = extractYouTubeId(q)
    if (direct) return loadVideo(direct)
    setYtSearching(true)
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`)
      const json = res.ok ? await res.json() : {}
      setYtResults(Array.isArray(json.results) ? json.results : [])
      if (typeof json.api_connected === "boolean") setYtConnected(json.api_connected)
    } catch {
      setYtResults([])
    } finally {
      setYtSearching(false)
    }
  }

  /* ── Setlist & requests ── */

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !data?.activeGig?.id) return
    setAdding(true)
    try {
      await artistPost({
        action: "add_playlist_song",
        event_id: data.activeGig.id,
        song_title: newTitle,
        original_artist: newArtist,
        youtube_url: newUrl,
      })
      setNewTitle("")
      setNewArtist("")
      setNewUrl("")
      setAddOpen(false)
      fetchDashboard()
    } catch {
      // stays open so they can retry
    } finally {
      setAdding(false)
    }
  }

  const removeSong = async (id: string) => {
    await patch({ action: "delete_song", request_id: id })
    fetchDashboard()
  }

  const reorder = (list: any[]) => {
    const updated = list.map((s, i) => ({ ...s, choice_index: i + 1 }))
    setData((d: any) => (d ? { ...d, artistPlaylist: updated } : d))
    if (saveOrderTimer.current) clearTimeout(saveOrderTimer.current)
    saveOrderTimer.current = setTimeout(() => patch({ action: "reorder_entire_playlist", ordered_ids: updated.map((s) => s.id) }), 350)
  }

  const acceptSong = async (id: string) => {
    await patch({ action: "confirm_song", request_id: id, decline_others: true })
    fetchDashboard()
  }
  const declineSong = async (id: string) => {
    await patch({ action: "decline_song", request_id: id })
    fetchDashboard()
  }
  const passBatch = async (id: string) => {
    await patch({ action: "decline_batch", batch_id: id })
    fetchDashboard()
  }

  const settle = async (txId: string, received: boolean) => {
    setSettlingId(txId)
    try {
      await artistPost({ action: received ? "confirm_payment" : "reject_payment", transaction_id: txId }).catch(() => null)
      await fetchDashboard()
    } finally {
      setSettlingId(null)
    }
  }

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBank(true)
    setBankMsg(null)
    try {
      await artistPost({ action: "update_bank_details", ...bank })
      setBankMsg({ ok: true, text: "Saved." })
      fetchDashboard()
    } catch (err) {
      setBankMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." })
    } finally {
      setSavingBank(false)
    }
  }

  const switchShow = (id: string) => {
    setSelectedEventId(id)
    setActiveSong(null)
    setVideoId("")
    setPlaying(false)
    fetchDashboard(id)
    setView("tonight")
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const demoLogin = async () => {
    setLoading(true)
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEMO_ARTIST),
    })
    await fetchDashboard()
  }

  /* ── Derived ── */

  const {
    artist,
    gigs = [],
    activeGig,
    priorityDedications = [],
    upvotedQueue = [],
    artistPlaylist = [],
    pendingBatches = [],
    playedSongs = [],
    transactions = [],
    earningsSummary = { totalRevenue: 0, dedicationRevenue: 0, tipRevenue: 0, pendingCount: 0, pendingAmount: 0 },
  } = data || {}

  // Running order: on stage first, paid dedications, then the artist's own order, then most loved; played last
  const setlist = [...artistPlaylist].sort((a: any, b: any) => {
    const on = (s: any) => (s.id === activeSong?.id && playing) || s.status === "playing"
    if (on(a) !== on(b)) return on(a) ? -1 : 1
    if ((a.status === "played") !== (b.status === "played")) return a.status === "played" ? 1 : -1
    if (isVip(a) !== isVip(b)) return isVip(a) ? -1 : 1
    const ai = a.choice_index > 0 ? a.choice_index : 999
    const bi = b.choice_index > 0 ? b.choice_index : 999
    if (ai !== bi) return ai - bi
    return Number(b.upvotes || 0) - Number(a.upvotes || 0)
  })
  // Requests the artist accepted that aren't already on the setlist
  const crowdPicks = [...priorityDedications, ...upvotedQueue.filter((s: any) => !priorityDedications.some((p: any) => p.id === s.id))]

  const queue = [...crowdPicks.filter(isVip), ...setlist, ...crowdPicks.filter((s: any) => !isVip(s))].filter(
    (s: any, i: number, all: any[]) => all.findIndex((x) => x.id === s.id) === i,
  )
  const activeIdx = queue.findIndex((s: any) => s.id === activeSong?.id)
  const isNext = (s: any) => s.status !== "played" && s.id !== activeSong?.id
  const nextSong = queue.slice(activeIdx + 1).find(isNext) || queue.find(isNext) || null

  // Put something on the stage card on first load (never autoplays)
  useEffect(() => {
    if (activeSong || !data) return
    const pick =
      [...(data.artistPlaylist || []), ...(data.priorityDedications || []), ...(data.upvotedQueue || [])].find(
        (s: any) => s.status === "playing",
      ) ||
      (data.artistPlaylist || []).find((s: any) => s.status !== "played") ||
      (data.priorityDedications || [])[0] ||
      (data.upvotedQueue || [])[0]
    if (pick) {
      setActiveSong(pick)
      setVideoId(videoIdOf(pick))
    }
  }, [data, activeSong])

  const pendingTx = transactions.filter((t: any) => t.status === "pending")
  const paidTx = transactions.filter((t: any) => t.status === "paid")
  const waitingRequests = pendingBatches.filter((b: any) => (b.songs || []).some((s: any) => s.status === "pending_artist"))

  /* ── Signed out / loading ── */

  if (needsAuth) {
    return (
      <div className="admin-noir flex items-center justify-center px-5">
        <div className="admin-panel w-full max-w-sm p-8">
          <div className="dots">
            <i />
          </div>
          <h1 className="title-x mt-4 text-[30px]">Artist portal</h1>
          <p className="fine mt-3 text-[13px]!">Sign in to run tonight&apos;s stage.</p>
          <div className="mt-7 flex flex-col gap-2">
            <Link href="/login" className="btn-light justify-center">
              Sign in
            </Link>
            {DEMO_LOGIN_ENABLED && (
              <button type="button" onClick={demoLogin} className="btn-ghost justify-center">
                Try the demo artist
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="admin-noir flex items-center justify-center">
        <p className="micro text-[#F4EFE6]/50">Loading tonight…</p>
      </div>
    )
  }

  /* ── Shell ── */

  const nav: { id: View; label: string; icon: LucideIcon; badge?: string; alert?: boolean }[] = [
    { id: "tonight", label: "Tonight", icon: Radio, badge: waitingRequests.length ? String(waitingRequests.length) : undefined },
    { id: "shows", label: "Shows", icon: CalendarDays },
    {
      id: "money",
      label: "Money",
      icon: Wallet,
      badge: earningsSummary.pendingCount ? String(earningsSummary.pendingCount) : undefined,
      alert: earningsSummary.pendingCount > 0,
    },
  ]

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {nav.map(({ id, label, icon: Icon, badge, alert }) => (
        <button
          key={id}
          type="button"
          onClick={() => setView(id)}
          className={cn(
            "micro flex items-center gap-3 rounded-full px-4 py-3 text-[10px]! transition",
            view === id ? "bg-[#F4EFE6] text-[#14100a]" : "text-[#F4EFE6]/65 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{label}</span>
          {badge && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[9px]",
                alert ? "bg-[#D92323] text-white" : view === id ? "bg-[#14100a] text-[#F4EFE6]" : "bg-[#F4EFE6]/15 text-[#F4EFE6]",
              )}
            >
              {badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  )

  const stageTools = activeGig && (
    <div className="space-y-1">
      <p className="micro px-4 pb-1 text-[#F4EFE6]/40">Stage</p>
      {[
        { label: ledOpen ? "LED screen on" : "Open LED screen", icon: Tv, onClick: openLedScreen },
        { label: "Table QR", icon: QrCode, onClick: () => setQrOpen(true) },
      ].map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="micro flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[10px]! text-[#F4EFE6]/65 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
      <a
        href={`/live/${activeGig.id}`}
        target="_blank"
        rel="noreferrer"
        className="micro flex items-center gap-3 rounded-full px-4 py-2.5 text-[10px]! text-[#F4EFE6]/65 transition hover:bg-white/[0.06] hover:text-white"
      >
        <ExternalLink className="h-4 w-4" /> Audience view
      </a>
    </div>
  )

  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-xs text-[#F4EFE6]">{artist?.name}</p>
      <p className="truncate text-[11px] text-[#F4EFE6]/45">{artist?.email}</p>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setProfile({
              name: artist?.name || "",
              instagram_handle: artist?.instagram_handle || "",
              avatar_url: artist?.avatar_url || "",
              bio: artist?.bio || "",
            })
            setProfileOpen(true)
          }}
          className="micro flex items-center gap-2 text-[#F4EFE6]/60 transition hover:text-white"
        >
          <UserCheck className="h-3.5 w-3.5" /> Profile
        </button>
        <button type="button" onClick={logout} className="micro flex items-center gap-2 text-[#F4EFE6]/60 transition hover:text-white">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  )

  const brand = (
    <Link href="/" className="block">
      <span className="title-x block text-[26px]">M-</span>
      <span className="micro mt-1 block text-[#F4EFE6]/50">Artist</span>
    </Link>
  )

  /* ── Views ── */

  const paymentsToConfirm = pendingTx.length > 0 && (
    <section className="admin-panel border-[#D92323]/45! p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="micro text-[#ff7a7a]">
          {pendingTx.length} payment{pendingTx.length > 1 ? "s" : ""} to confirm · {rupees(earningsSummary.pendingAmount)}
        </h2>
        <p className="fine">Check your UPI app, then mark what arrived.</p>
      </div>
      <ul className="divide-y divide-white/[0.07]">
        {pendingTx.map((tx: any) => (
          <li key={tx.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-[13px]">
            <span className="title-x w-16 shrink-0 text-[18px]">{rupees(tx.amount)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{tx.payer_name}</p>
              <p className="truncate text-[12px] text-[#F4EFE6]/50">
                {tx.type === "tip" ? "Tip" : tx.song_title || "Dedication"}
                {tx.upi_utr && <span className="ml-2 font-mono">UTR {tx.upi_utr}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={settlingId === tx.id} onClick={() => settle(tx.id, true)} className="btn-light btn-sm disabled:opacity-50">
                Received
              </button>
              <button type="button" disabled={settlingId === tx.id} onClick={() => settle(tx.id, false)} className="btn-ghost btn-sm disabled:opacity-50">
                Not received
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )

  const onStage = activeSong && playing
  const nowPlaying = (
    <Panel
      title={onStage ? "On stage now" : "Ready to play"}
      meta={
        onStage && (
          <span className="micro flex items-center gap-2 text-[#ff7a7a]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D92323] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D92323]" />
            </span>
            Live
          </span>
        )
      }
    >
      <h3 className="title-x truncate text-[24px] sm:text-[30px]">{activeSong?.song_title || "Pick a song"}</h3>
      <p className="mt-2 truncate text-[13px] text-[#F4EFE6]/55">
        {activeSong
          ? [activeSong.original_artist, requester(activeSong) && `for ${requester(activeSong)}`].filter(Boolean).join(" · ") || "Setlist"
          : "Hit play on any song below."}
      </p>

      <div className="mt-5 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        {videoId ? (
          <iframe
            id="stage-active-player"
            key={`${videoId}-${muted}`}
            onLoad={bindPlayer}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=${playing ? 1 : 0}&mute=${muted ? 1 : 0}&enablejsapi=1&rel=0&origin=${
              typeof window !== "undefined" ? window.location.origin : ""
            }`}
            title={activeSong?.song_title || "Karaoke video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Music className="h-6 w-6 text-[#F4EFE6]/30" />
            <p className="fine">{activeSong ? "No video for this song yet. Search for one below." : "Nothing loaded."}</p>
          </div>
        )}
      </div>

      {doneToast && (
        <p className="mt-3 rounded-xl border border-[#F4EFE6]/15 bg-[#F4EFE6]/[0.06] px-3 py-2 text-[12.5px]">
          “{doneToast.title}” marked played.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {nextSong && (
          <button type="button" onClick={() => playSong(nextSong)} className="btn-light min-w-0 flex-1 justify-center sm:flex-none">
            <SkipForward className="h-4 w-4 shrink-0" />
            <span className="truncate">Next · {nextSong.song_title}</span>
          </button>
        )}
        {activeSong?.id && activeSong.status !== "played" && (
          <button type="button" onClick={() => markPlayed(activeSong.id)} className="btn-ghost">
            <Check className="h-4 w-4" /> Done
          </button>
        )}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute video" : "Mute video"}
          title={muted ? "Unmute video" : "Mute video (sing over it)"}
          className={cn("btn-ghost w-[46px] justify-center px-0!", muted && "border-[#D92323]/60! text-[#ff7a7a]")}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {activeSong && (
        <form onSubmit={searchYouTube} className="mt-5 border-t border-white/10 pt-4">
          <span className="micro block text-[#F4EFE6]/45">Wrong video? Search YouTube or paste a link</span>
          <div className="mt-1 flex items-center gap-2">
            <input value={ytQuery} onChange={(e) => setYtQuery(e.target.value)} className="admin-field flex-1" placeholder="Song name karaoke" />
            <button type="submit" disabled={ytSearching} aria-label="Search" className="btn-ghost btn-sm shrink-0">
              <Search className="h-3.5 w-3.5" /> {ytSearching ? "…" : "Find"}
            </button>
          </div>
          {ytResults && (
            <div className="mt-3">
              {ytConnected === false && <p className="fine mb-2">Live search is off (no YouTube key), so these are suggestions.</p>}
              {!ytResults.length ? (
                <p className="fine">No videos found.</p>
              ) : (
                <ul className="max-h-[280px] space-y-1 overflow-y-auto">
                  {ytResults.map((v: any) => (
                    <li key={v.videoId}>
                      <button
                        type="button"
                        onClick={() => loadVideo(v.videoId)}
                        className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-white/[0.05]"
                      >
                        <img
                          src={v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`}
                          alt=""
                          className="h-10 w-16 shrink-0 rounded-md object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{v.title}</span>
                          <span className="block truncate text-[11px] text-[#F4EFE6]/45">
                            {[v.channel, v.duration].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <Play className="h-3.5 w-3.5 shrink-0 text-[#F4EFE6]/60" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setYtResults(null)} className="micro mt-2 text-[#F4EFE6]/45 hover:text-white">
                Close
              </button>
            </div>
          )}
        </form>
      )}
    </Panel>
  )

  const requests = (
    <Panel
      title="Requests"
      meta={<span className="micro text-[#F4EFE6]/45">{waitingRequests.length ? `${waitingRequests.length} waiting` : "All clear"}</span>}
    >
      {!waitingRequests.length ? (
        <p className="fine text-[13px]!">No requests waiting. New ones from the room show up here.</p>
      ) : (
        <ul className="space-y-3">
          {waitingRequests.map((batch: any) => {
            const songs = (batch.songs || []).filter((s: any) => s.status === "pending_artist")
            const paid = Boolean(batch.wants_dedication)
            return (
              <li key={batch.id} className={cn("rounded-2xl border p-3.5", paid ? "border-[#F4EFE6]/45 bg-[#F4EFE6]/[0.05]" : "border-white/[0.08]")}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{batch.requester_name || "Someone in the room"}</span>
                    {paid && <Tag tone="cream">₹50 dedication</Tag>}
                  </div>
                  <button type="button" onClick={() => passBatch(batch.id)} className="micro shrink-0 text-[#F4EFE6]/45 hover:text-[#ff7a7a]">
                    Pass
                  </button>
                </div>
                {songs.length > 1 && <p className="fine mb-1.5">Pick one</p>}
                <ul className="space-y-1">
                  {songs.map((s: any) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => acceptSong(s.id)}
                        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2 text-left transition hover:border-[#F4EFE6]/60 hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px]">{s.song_title}</span>
                          {s.original_artist && <span className="block truncate text-[11.5px] text-[#F4EFE6]/45">{s.original_artist}</span>}
                        </span>
                        <span className="micro flex items-center gap-1 text-[#F4EFE6]/50 group-hover:text-white">
                          <Plus className="h-3.5 w-3.5" /> Accept
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => declineSong(s.id)}
                        aria-label={`Decline ${s.song_title}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F4EFE6]/30 transition hover:text-[#ff7a7a]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )

  const played = playedSongs.length
  const setlistPanel = (
    <Panel
      className="px-3 sm:px-6"
      title="Running order"
      meta={
        <div className="flex items-center gap-4">
          <span className="micro text-[#F4EFE6]/45">
            {played} played · {queue.filter((s: any) => s.status !== "played").length} to go
          </span>
          <button type="button" onClick={() => setAddOpen((o) => !o)} className="btn-ghost btn-sm">
            {addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {addOpen ? "Close" : "Add song"}
          </button>
        </div>
      }
    >
      {addOpen && (
        <form onSubmit={addSong} className="mb-5 grid gap-4 rounded-2xl border border-white/[0.08] p-4 sm:grid-cols-[1.3fr_1fr_1.3fr_auto] sm:items-end">
          <Field label="Song">
            <input className="admin-field" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required autoFocus />
          </Field>
          <Field label="Artist">
            <input className="admin-field" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} />
          </Field>
          <Field label="YouTube link (optional)">
            <input className="admin-field" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          </Field>
          <button type="submit" disabled={adding} className="btn-light btn-sm disabled:opacity-60">
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {crowdPicks.length > 0 && (
        <div className="mb-4">
          <p className="micro mb-1 px-2 text-[#F4EFE6]/45">Accepted from the room</p>
          {crowdPicks.map((s: any) => (
            <SongRow
              key={s.id}
              song={s}
              onStage={Boolean(onStage && s.id === activeSong?.id)}
              draggable={false}
              onPlay={() => playSong(s)}
              onDone={() => markPlayed(s.id)}
            />
          ))}
        </div>
      )}

      {!setlist.length ? (
        <p className="fine px-2 text-[13px]!">No songs on tonight&apos;s setlist yet. Add a few to get started.</p>
      ) : (
        <>
          {crowdPicks.length > 0 && <p className="micro mb-1 px-2 text-[#F4EFE6]/45">Your setlist</p>}
          <Reorder.Group as="div" axis="y" values={setlist} onReorder={reorder} className="space-y-0.5">
            {setlist.map((s: any, i: number) => (
              <SongRow
                key={s.id}
                song={s}
                slot={i + 1}
                onStage={Boolean(onStage && s.id === activeSong?.id)}
                draggable
                onPlay={() => playSong(s)}
                onDone={() => markPlayed(s.id)}
                onRemove={() => removeSong(s.id)}
              />
            ))}
          </Reorder.Group>
        </>
      )}
    </Panel>
  )

  const tonightEarned = Number(activeGig?.tips_amount || 0) + Number(activeGig?.dedications_amount || 0)
  const stats: { label: string; value: string; alert?: boolean; onClick?: () => void }[] = [
    { label: "Played", value: `${played}/${played + queue.filter((s: any) => s.status !== "played").length}` },
    { label: "Requests waiting", value: String(waitingRequests.length), alert: waitingRequests.length > 0 },
    { label: "Upvotes", value: String(activeGig?.total_upvotes || 0) },
    {
      label: earningsSummary.pendingCount ? "To confirm" : "Earned tonight",
      value: earningsSummary.pendingCount ? rupees(earningsSummary.pendingAmount) : rupees(tonightEarned),
      alert: earningsSummary.pendingCount > 0,
      onClick: () => setView("money"),
    },
  ]

  const tonight = !activeGig ? (
    <div className="space-y-8">
      <PageHeader title="No show yet" subtitle="Add tonight's show to open the stage, take requests and put lyrics on the screen." />
      <button type="button" onClick={() => setNewShowOpen(true)} className="btn-light">
        <Plus className="h-4 w-4" /> Add a show
      </button>
    </div>
  ) : (
    <div className="space-y-6">
      <PageHeader
        title={activeGig.title}
        subtitle={[showDate(activeGig.date), activeGig.location_name].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={openLedScreen} className="btn-light btn-sm">
              <Tv className="h-3.5 w-3.5" /> {ledOpen ? "LED screen on" : "LED screen"}
            </button>
            <button type="button" onClick={() => setQrOpen(true)} className="btn-ghost btn-sm">
              <QrCode className="h-3.5 w-3.5" /> Table QR
            </button>
          </>
        }
      />

      {paymentsToConfirm}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="micro text-[#F4EFE6]/50">{s.label}</p>
              <p className={cn("title-x mt-3 text-[24px]", s.alert && "text-[#ff7a7a]!")}>{s.value}</p>
            </>
          )
          return s.onClick ? (
            <button key={s.label} type="button" onClick={s.onClick} className="admin-panel p-4 text-left transition hover:border-[#F4EFE6]/45!">
              {inner}
            </button>
          ) : (
            <div key={s.label} className="admin-panel p-4">
              {inner}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="xl:sticky xl:top-6">{nowPlaying}</div>
        <div className="min-w-0 space-y-6">
          {requests}
          {setlistPanel}
        </div>
      </div>
    </div>
  )

  const shows = (
    <div className="space-y-8">
      <PageHeader
        title="Shows"
        subtitle="Every show you're booked for. Open one to run its stage."
        actions={
          <button
            type="button"
            onClick={() => {
              setShow({ title: "", location_name: "", date: new Date().toISOString().slice(0, 10), ticket_price: "499" })
              setNewShowOpen(true)
            }}
            className="btn-light btn-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add show
          </button>
        }
      />
      <Panel title="All shows" meta={<span className="micro text-[#F4EFE6]/45">{gigs.length}</span>}>
        {!gigs.length ? (
          <p className="fine text-[13px]!">No shows yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.07]">
            {gigs.map((g: any) => {
              const current = g.id === activeGig?.id
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5 text-[13px]">
                  <span className="micro w-32 shrink-0 text-[#F4EFE6]/55">{showDate(g.date) || g.event_date_only}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.title}</p>
                    <p className="truncate text-[12px] text-[#F4EFE6]/45">{g.location_name}</p>
                  </div>
                  <span className="text-[12px] text-[#F4EFE6]/55">
                    ♥ {g.total_upvotes} · {g.dedications_count} dedications · {rupees(Number(g.tips_amount) + Number(g.dedications_amount))}
                  </span>
                  {current ? (
                    <Tag tone="red">Open now</Tag>
                  ) : (
                    <button type="button" onClick={() => switchShow(g.id)} className="btn-ghost btn-sm">
                      Open
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )

  const setB = (k: string) => (e: { target: { value: string } }) => setBank((b) => ({ ...b, [k]: e.target.value }))
  const money = (
    <div className="space-y-8">
      <PageHeader title="Money" subtitle="Dedications and tips paid straight to your UPI. Confirm what arrived, and keep your payout details current." />
      {paymentsToConfirm}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: earningsSummary.totalRevenue },
          { label: "Dedications", value: earningsSummary.dedicationRevenue },
          { label: "Tips", value: earningsSummary.tipRevenue },
        ].map((s) => (
          <div key={s.label} className="admin-panel p-4">
            <p className="micro text-[#F4EFE6]/50">{s.label}</p>
            <p className="title-x mt-3 text-[20px] sm:text-[24px]">{rupees(s.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel title="Received" meta={<span className="micro text-[#F4EFE6]/45">{paidTx.length}</span>}>
          {!paidTx.length ? (
            <p className="fine text-[13px]!">Nothing yet.</p>
          ) : (
            <ul className="max-h-[480px] divide-y divide-white/[0.07] overflow-y-auto">
              {paidTx.map((tx: any) => (
                <li key={tx.id} className="flex items-center gap-4 py-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tx.payer_name}</p>
                    <p className="truncate text-[12px] text-[#F4EFE6]/45">{tx.song_title || tx.note || (tx.type === "tip" ? "Tip" : "Dedication")}</p>
                  </div>
                  <span className="font-mono">{rupees(tx.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Payout details">
          <form onSubmit={saveBank} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="UPI ID">
                <input className="admin-field" value={bank.upi_id ?? ""} onChange={setB("upi_id")} placeholder="yourname@ybl" required />
              </Field>
              <Field label="Account holder">
                <input className="admin-field" value={bank.payee_name ?? ""} onChange={setB("payee_name")} required />
              </Field>
              <Field label="Bank">
                <input className="admin-field" value={bank.bank_name ?? ""} onChange={setB("bank_name")} />
              </Field>
              <Field label="IFSC">
                <input
                  className="admin-field"
                  value={bank.ifsc_code ?? ""}
                  onChange={(e) => setBank((b) => ({ ...b, ifsc_code: e.target.value.toUpperCase() }))}
                />
              </Field>
              <Field label="Account number" className="block sm:col-span-2">
                <input className="admin-field" value={bank.account_number ?? ""} onChange={setB("account_number")} />
              </Field>
              <Field label="Collect with">
                <select className="admin-field" value={bank.upipay_provider ?? "upi_direct"} onChange={setB("upipay_provider")}>
                  <option value="upi_direct">Direct UPI</option>
                  <option value="phonepe">PhonePe Business</option>
                  <option value="paytm">Paytm Business</option>
                </select>
              </Field>
              <Field label="Merchant ID">
                <input className="admin-field" value={bank.upipay_merchant_id ?? ""} onChange={setB("upipay_merchant_id")} />
              </Field>
            </div>
            <div className="flex items-center gap-4">
              <button type="submit" disabled={savingBank} className="btn-light btn-sm disabled:opacity-60">
                {savingBank ? "Saving…" : "Save"}
              </button>
              {bankMsg && <span className={cn("text-[12px]", bankMsg.ok ? "text-[#F4EFE6]/70" : "text-[#ff7a7a]")}>{bankMsg.text}</span>}
            </div>
          </form>
        </Panel>
      </div>
    </div>
  )

  const setP = (k: string) => (e: { target: { value: string } }) => setProfile((p) => ({ ...p, [k]: e.target.value }))
  const setS = (k: string) => (e: { target: { value: string } }) => setShow((s) => ({ ...s, [k]: e.target.value }))

  return (
    <div className="admin-noir">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between gap-8 overflow-y-auto border-r border-white/[0.07] bg-[#0b0a0e]/80 p-6 backdrop-blur-xl lg:flex">
        <div className="space-y-8">
          {brand}
          {navLinks}
          {stageTools}
        </div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#0b0a0e]/85 px-5 py-4 backdrop-blur-xl sm:px-8 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFE6] text-[#14100a]"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          {!menuOpen && (waitingRequests.length > 0 || earningsSummary.pendingCount > 0) && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0b0a0e] bg-[#D92323]" />
          )}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[73px] z-20 flex flex-col justify-between gap-6 overflow-y-auto bg-[#0b0a0e]/95 px-5 py-6 backdrop-blur-xl sm:px-8 lg:hidden">
          <div className="space-y-8">
            {navLinks}
            {stageTools}
          </div>
          {footer}
        </div>
      )}

      <main className="min-w-0 px-5 py-8 sm:px-8 lg:ml-60 lg:px-10 lg:py-10">
        {view === "tonight" && tonight}
        {view === "shows" && shows}
        {view === "money" && money}
      </main>

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

      <FormDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Profile"
        description="What the room sees on your stage page."
        submitLabel="Save"
        onSubmit={async () => {
          await artistPost({ action: "update_profile", ...profile })
          fetchDashboard()
        }}
      >
        <Field label="Name">
          <input className="admin-field" value={profile.name ?? ""} onChange={setP("name")} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram">
            <input className="admin-field" value={profile.instagram_handle ?? ""} onChange={setP("instagram_handle")} placeholder="@handle" />
          </Field>
          <Field label="Photo URL">
            <input className="admin-field" value={profile.avatar_url ?? ""} onChange={setP("avatar_url")} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea className="admin-field min-h-[70px] resize-y" value={profile.bio ?? ""} onChange={setP("bio")} />
        </Field>
      </FormDialog>

      <FormDialog
        open={newShowOpen}
        onClose={() => setNewShowOpen(false)}
        title="Add show"
        description="Starts at 8:30 pm on the day. You can take requests as soon as it's added."
        submitLabel="Add show"
        onSubmit={async () => {
          const json = await artistPost({
            action: "create_gig",
            title: show.title,
            location_name: show.location_name,
            date: new Date(`${show.date}T20:30`).toISOString(),
            ticket_price: Number(show.ticket_price) || 0,
          })
          if (json.id) switchShow(json.id)
        }}
      >
        <Field label="Show name">
          <input className="admin-field" value={show.title ?? ""} onChange={setS("title")} required />
        </Field>
        <Field label="Venue">
          <input className="admin-field" value={show.location_name ?? ""} onChange={setS("location_name")} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className="admin-field" value={show.date ?? ""} onChange={setS("date")} required />
          </Field>
          <Field label="Ticket price (₹)">
            <input type="number" min={0} className="admin-field" value={show.ticket_price ?? ""} onChange={setS("ticket_price")} />
          </Field>
        </div>
      </FormDialog>
    </div>
  )
}

