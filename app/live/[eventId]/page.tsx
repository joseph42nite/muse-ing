"use client"

import React, { useEffect, useState, useCallback, use } from "react"
import Link from "next/link"
import { autocompleteSongs } from "@/lib/youtube"
import {
  Instagram,
  MapPin,
  Calendar,
  Sparkles,
  ChevronUp,
  Plus,
  Music2,
  CheckCircle2,
  Clock,
  Heart,
  ListMusic,
  Volume2,
  X,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react"

function getOrCreateVoterToken(): string {
  if (typeof window === "undefined") return ""
  const key = "muse_audience_voter_token"
  let tok = window.localStorage.getItem(key)
  if (!tok) {
    tok = "voter_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36)
    window.localStorage.setItem(key, tok)
  }
  return tok
}

export default function AudienceLiveGigPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)

  const [voterToken, setVoterToken] = useState<string>("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "playlist" | "dedications">("all")

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
  const [wantsDedication, setWantsDedication] = useState(false)
  const [dedicatedTo, setDedicatedTo] = useState("")
  const [dedicationMessage, setDedicationMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  // ₹50 Dedication Payment Modal State (Option 2: Pay ₹50 once song is confirmed by artist or from artist playlist)
  const [dedicatingSong, setDedicatingSong] = useState<any | null>(null)
  const [payDedicatedTo, setPayDedicatedTo] = useState("")
  const [payDedicationMsg, setPayDedicationMsg] = useState("")
  const [payRequesterName, setPayRequesterName] = useState("")
  const [payRequesterPhone, setPayRequesterPhone] = useState("")
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

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
        // ignore transient network errors
      } finally {
        setLoading(false)
      }
    },
    [eventId]
  )

  useEffect(() => {
    const tok = getOrCreateVoterToken()
    setVoterToken(tok)
    const savedName = typeof window !== "undefined" ? window.localStorage.getItem("muse_audience_name") || "" : ""
    if (savedName) {
      setRequesterName(savedName)
      setPayRequesterName(savedName)
    }
    fetchGigData(tok)

    const interval = setInterval(() => {
      fetchGigData(tok)
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchGigData])

  const handleUpvote = async (requestId: string) => {
    if (!voterToken) return
    await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_upvote",
        request_id: requestId,
        voter_token: voterToken,
      }),
    })
    fetchGigData(voterToken)
  }

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
          wants_dedication: wantsDedication,
          dedicated_to: wantsDedication ? dedicatedTo : null,
          dedication_message: wantsDedication ? dedicationMessage : null,
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
      setSubmitSuccess(
        wantsDedication
          ? "Your 3 songs were sent to the artist! As soon as the artist confirms which song they can sing, you'll be prompted here to pay ₹50 to pin your dedication to the top!"
          : "Your 3 songs were sent to the artist! Once the artist confirms which one they can sing, it will go live for everyone to upvote."
      )
      setTimeout(() => setSubmitSuccess(null), 8000)
      fetchGigData(voterToken)
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openDedicationPaymentModal = (song: any) => {
    setDedicatingSong(song)
    setPayDedicatedTo(song.dedicated_to || "")
    setPayDedicationMsg(song.dedication_message || "")
    setPayRequesterName(
      song.requester_name && song.requester_name !== "Artist Playlist"
        ? song.requester_name
        : requesterName
    )
    setPayError(null)
  }

  const handlePay50Dedication = async (mode: "instant" | "cashfree") => {
    if (!dedicatingSong) return
    setPayError(null)
    setPaying(true)

    try {
      const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay_dedication_50",
          request_id: dedicatingSong.id,
          dedicated_to: payDedicatedTo,
          dedication_message: payDedicationMsg,
          requester_name: payRequesterName || "Audience Member",
          requester_phone: payRequesterPhone || "9876543210",
          payment_mode: mode,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Payment failed.")

      if (body.payment_url) {
        window.location.href = body.payment_url
        return
      }

      setDedicatingSong(null)
      setSubmitSuccess(
        `₹50 Dedication Confirmed! "${dedicatingSong.song_title}" dedicated to ${payDedicatedTo} is now pinned in the Artist's Priority Dedication Queue!`
      )
      setTimeout(() => setSubmitSuccess(null), 8000)
      fetchGigData(voterToken)
    } catch (err: any) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#07070c] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-white/60">Loading live stage &amp; song queue…</p>
        </div>
      </div>
    )
  }

  if (!data?.event) {
    return (
      <div className="min-h-screen bg-[#07070c] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-medium mb-2">Live Gig Not Found</p>
        <Link href="/" className="text-xs text-purple-300 underline">
          Return to Home
        </Link>
      </div>
    )
  }

  const {
    event,
    priorityDedications = [],
    upvotedQueue = [],
    allConfirmedSongs = [],
    myBatches = [],
    upvotedRequestIds = [],
    nowPlaying,
  } = data

  const artistPlaylistSongs = allConfirmedSongs.filter((s: any) => s.source_type === "artist_playlist")
  const displayedSongs =
    activeTab === "playlist"
      ? artistPlaylistSongs
      : activeTab === "dedications"
        ? priorityDedications
        : allConfirmedSongs

  const instagramClean = (event.artist_instagram || "@museinglive").replace(/^@/, "")

  return (
    <div className="min-h-screen bg-[#07070c] text-white pb-28">
      {/* Mobile-Optimized Container */}
      <div className="max-w-md mx-auto">
        {/* Top Bar: Location + Date QR Verification */}
        <div className="sticky top-0 z-30 bg-[#07070c]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" />
            Events
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[180px]">{event.location_name}</span>
          </div>
          <span className="text-[10px] text-white/50 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-400" />
            {event.event_date_only}
          </span>
        </div>

        <div className="px-4 pt-4 space-y-5">
          {/* 1. FIRST ON TOP: Artist Spotlight Card (Image + Name + Instagram Link) */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/50 via-[#12121e] to-amber-900/30 border border-white/15 p-5 shadow-2xl">
            <div className="flex items-center gap-4">
              <img
                src={
                  event.artist_avatar ||
                  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80"
                }
                alt={event.artist_name || "Artist"}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-400/50 shadow-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full mb-1">
                  Live on Stage
                </span>
                <h1 className="text-xl font-bold text-white leading-snug">
                  {event.artist_name || "Live Performing Artist"}
                </h1>
                <p className="text-xs text-white/65 mt-0.5 line-clamp-2">
                  {event.artist_bio || event.title}
                </p>

                {/* Direct Instagram Link Pill */}
                <a
                  href={`https://instagram.com/${instagramClean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-semibold text-xs shadow-md hover:opacity-95 transition"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  {event.artist_instagram || `@${instagramClean}`}
                </a>
              </div>
            </div>

            {/* Now Singing Live Banner */}
            {nowPlaying && (
              <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 text-emerald-300 animate-pulse" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                      Now Singing on Stage
                    </p>
                    <p className="text-xs font-medium text-white truncate">
                      {nowPlaying.song_title}{" "}
                      {nowPlaying.original_artist ? `• ${nowPlaying.original_artist}` : ""}
                    </p>
                  </div>
                </div>
                {nowPlaying.dedication_payment_status === "paid" && nowPlaying.dedicated_to && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-medium shrink-0">
                    For {nowPlaying.dedicated_to}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Feedback Alert */}
          {submitSuccess && (
            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* 2. Audience Member's Own 3-Song Submissions & Option-2 ₹50 Payment Prompt */}
          {myBatches.length > 0 && (
            <div className="rounded-2xl bg-white/[0.04] border border-purple-400/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" />
                  Your 3-Song Submissions
                </h2>
                <span className="text-[10px] text-white/50">Artist confirms 1 of 3</span>
              </div>

              {myBatches.map((batch: any) => {
                const confirmedSongs = (batch.songs || []).filter((s: any) =>
                  ["confirmed", "playing", "played"].includes(s.status)
                )
                const isPending = confirmedSongs.length === 0 && (batch.songs || []).some((s: any) => s.status === "pending_artist")

                return (
                  <div
                    key={batch.id}
                    className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-2"
                  >
                    {isPending ? (
                      <div className="flex items-center gap-2 text-xs text-amber-300">
                        <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
                        <span>
                          Waiting for artist to confirm which of your 3 songs they can sing…
                        </span>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      {(batch.songs || []).map((s: any) => (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs ${
                            s.status === "confirmed" || s.status === "playing"
                              ? "bg-emerald-500/15 border border-emerald-400/35 text-white"
                              : s.status === "declined"
                                ? "bg-white/[0.02] text-white/35 line-through"
                                : "bg-white/[0.04] text-white/75"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              #{s.choice_index} {s.song_title}
                            </span>
                            {s.original_artist && (
                              <span className="text-white/50"> • {s.original_artist}</span>
                            )}
                          </div>

                          {s.status === "pending_artist" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                              Reviewing
                            </span>
                          )}

                          {(s.status === "confirmed" || s.status === "playing") && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-medium">
                                Artist Confirmed!
                              </span>
                              {s.dedication_payment_status === "paid" ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-semibold">
                                  ₹50 Priority Active
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openDedicationPaymentModal(s)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 text-black font-semibold text-[11px] hover:opacity-95 cursor-pointer shadow"
                                >
                                  Pay ₹50 for Shoutout
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 3. Filter Tabs: All Live Queue vs Artist's Prepared Playlist vs ₹50 Dedications */}
          <div>
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/10 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === "all"
                    ? "bg-white text-black shadow"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Live Queue ({allConfirmedSongs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("playlist")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === "playlist"
                    ? "bg-purple-500 text-white shadow"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                Artist Playlist ({artistPlaylistSongs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("dedications")}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === "dedications"
                    ? "bg-amber-400 text-black font-semibold shadow"
                    : "text-amber-300/80 hover:text-amber-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Dedications ({priorityDedications.length})
              </button>
            </div>

            {activeTab === "playlist" && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-400/25 text-xs text-purple-200">
                These are songs <strong>{event.artist_name}</strong> has prepared for tonight&apos;s setlist! Upvote the ones you want to hear next, or tap <strong>Dedicate (₹50)</strong> to dedicate any song with a live name shoutout.
              </div>
            )}

            {/* Scrollable Confirmed Songs Feed */}
            <div className="space-y-3">
              {displayedSongs.map((song: any) => {
                const hasUpvoted = upvotedRequestIds.includes(song.id)
                const isPaidDedication = song.dedication_payment_status === "paid"
                const isAwaitingPayment = song.dedication_payment_status === "awaiting_payment"
                const isArtistPlaylist = song.source_type === "artist_playlist"

                return (
                  <div
                    key={song.id}
                    className={`rounded-2xl p-4 transition border ${
                      isPaidDedication
                        ? "bg-gradient-to-r from-amber-500/15 via-[#161310] to-orange-500/10 border-amber-400/50 shadow-lg shadow-amber-500/5"
                        : song.status === "playing"
                          ? "bg-emerald-500/15 border-emerald-400/50"
                          : "bg-white/[0.04] border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {song.status === "playing" && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black font-bold text-[10px] uppercase tracking-wider">
                            Now Singing
                          </span>
                        )}
                        {isPaidDedication && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-semibold text-[10px]">
                            <Sparkles className="w-3 h-3" />
                            ₹50 Priority Dedication
                          </span>
                        )}
                        {isArtistPlaylist ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px]">
                            <ListMusic className="w-3 h-3" />
                            Artist&apos;s Prepared Playlist
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px]">
                            Confirmed Crowd Request • {song.requester_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Song Title & Artist + Upvote Button */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-white truncate">
                          {song.song_title}
                        </h3>
                        {song.original_artist && (
                          <p className="text-xs text-white/60 truncate">{song.original_artist}</p>
                        )}
                      </div>

                      {/* Uptick / Upvote Button */}
                      <button
                        type="button"
                        onClick={() => handleUpvote(song.id)}
                        className={`px-3.5 py-2 rounded-2xl border flex flex-col items-center justify-center min-w-[60px] transition cursor-pointer shrink-0 ${
                          hasUpvoted
                            ? "bg-purple-500 border-purple-300 text-white shadow-lg shadow-purple-500/30"
                            : "bg-white/5 hover:bg-white/15 border-white/15 text-white"
                        }`}
                      >
                        <ChevronUp className={`w-4 h-4 -mb-0.5 ${hasUpvoted ? "stroke-[3]" : ""}`} />
                        <span className="text-xs font-bold">{song.upvotes || 0}</span>
                      </button>
                    </div>

                    {/* Paid Dedication Callout Banner */}
                    {isPaidDedication && song.dedicated_to && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-xs">
                        <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          Dedicated to: <span className="text-white">{song.dedicated_to}</span>
                        </p>
                        {song.dedication_message && (
                          <p className="text-[11px] text-amber-100/80 mt-0.5 italic">
                            &ldquo;{song.dedication_message}&rdquo; — {song.requester_name}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Option 2: Awaiting ₹50 Payment or Dedicate Any Confirmed Song */}
                    {!isPaidDedication && (
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                        {isAwaitingPayment && song.dedicated_to ? (
                          <span className="text-[11px] text-amber-300">
                            Artist confirmed! Complete ₹50 to call out <strong>{song.dedicated_to}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/50">
                            Want the artist to call out someone&apos;s name for this song?
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openDedicationPaymentModal(song)}
                          className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 font-medium text-[11px] flex items-center gap-1 shrink-0 cursor-pointer transition"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Dedicate • ₹50
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar: Put in a 3-Song Request */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#07070c] via-[#07070c]/95 to-transparent pt-4 pb-5 px-4">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              setSubmitError(null)
              setShowRequestModal(true)
            }}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-500 text-black font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:opacity-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Request a Song (Submit 3 Song Choices)
          </button>
        </div>
      </div>

      {/* Modal 1: Submit 3 Songs so Artist Can Confirm Which One They Can Sing */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#11111a] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-purple-300 font-semibold">
                  3-Song Artist Confirmation Rule
                </span>
                <h3 className="text-lg font-semibold">Submit 3 Song Options</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/65 mb-4 leading-relaxed">
              Give <strong>{event.artist_name}</strong> 3 song options so they can confirm the one they can perform best. Once confirmed, it goes live for everyone to upvote!
            </p>

            <form onSubmit={handleSubmit3Songs} className="space-y-3.5">
              <div>
                <label className="block text-xs text-white/80 mb-1">Your Name / Table</label>
                <input
                  type="text"
                  required
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="e.g., Rahul (Table 5)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/35 focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* 3 Required Song Inputs with Smart Autocomplete */}
              {[
                {
                  idx: 1,
                  title: song1Title,
                  setTitle: setSong1Title,
                  artist: song1Artist,
                  setArtist: setSong1Artist,
                  placeholder: "e.g., Kesariya",
                },
                {
                  idx: 2,
                  title: song2Title,
                  setTitle: setSong2Title,
                  artist: song2Artist,
                  setArtist: setSong2Artist,
                  placeholder: "e.g., Tum Se Hi",
                },
                {
                  idx: 3,
                  title: song3Title,
                  setTitle: setSong3Title,
                  artist: song3Artist,
                  setArtist: setSong3Artist,
                  placeholder: "e.g., Yellow - Coldplay",
                },
              ].map((item) => {
                const suggestions =
                  item.title.trim().length >= 2
                    ? autocompleteSongs(item.title).filter(
                        (s) => s.songTitle.toLowerCase() !== item.title.trim().toLowerCase()
                      )
                    : []
                return (
                  <div
                    key={item.idx}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-300">
                        Song Choice #{item.idx} *
                      </span>
                      <span className="text-[10px] text-white/40">Required</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={item.title}
                        onChange={(e) => item.setTitle(e.target.value)}
                        placeholder={`Song #${item.idx} Title (${item.placeholder})`}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-purple-400"
                      />
                      <input
                        type="text"
                        value={item.artist}
                        onChange={(e) => item.setArtist(e.target.value)}
                        placeholder="Original Artist (optional)"
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    {suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suggestions.slice(0, 3).map((sug) => (
                          <button
                            key={`${sug.songTitle}-${sug.originalArtist}`}
                            type="button"
                            onClick={() => {
                              item.setTitle(sug.songTitle)
                              item.setArtist(sug.originalArtist)
                            }}
                            className="px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/30 text-[10px] text-purple-200 cursor-pointer transition"
                          >
                            ✨ {sug.songTitle} • <span className="text-white/70">{sug.originalArtist}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Optional Dedication Toggle (Option 2: Pay ₹50 after artist confirms!) */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantsDedication}
                    onChange={(e) => setWantsDedication(e.target.checked)}
                    className="mt-1 accent-amber-400"
                  />
                  <div>
                    <span className="text-xs font-semibold text-amber-200 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Dedicate this song with a Live Name Shoutout (₹50 Priority)
                    </span>
                    <span className="block text-[11px] text-white/65 mt-0.5">
                      You only pay ₹50 <strong>after</strong> the artist confirms which of your 3 songs they can sing!
                    </span>
                  </div>
                </label>

                {wantsDedication && (
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] text-amber-200 mb-1">
                        Dedicated To (Name for the Artist to Call Out on Mic) *
                      </label>
                      <input
                        type="text"
                        required={wantsDedication}
                        value={dedicatedTo}
                        onChange={(e) => setDedicatedTo(e.target.value)}
                        placeholder="e.g., Ananya (Happy Birthday!)"
                        className="w-full px-3 py-2 rounded-lg bg-black/50 border border-amber-400/40 text-xs text-white placeholder-white/35 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-amber-200 mb-1">
                        Short Shoutout Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={dedicationMessage}
                        onChange={(e) => setDedicationMessage(e.target.value)}
                        placeholder="e.g., From everyone at Table 5!"
                        className="w-full px-3 py-2 rounded-lg bg-black/50 border border-amber-400/40 text-xs text-white placeholder-white/35 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {submitError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition cursor-pointer"
              >
                {submitting ? "Sending 3 Songs to Artist..." : "Send 3 Songs for Artist Confirmation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Complete ₹50 Dedication Payment (Once Confirmed by Artist) */}
      {dedicatingSong && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#141218] border-t sm:border border-amber-400/40 rounded-t-3xl sm:rounded-3xl p-5 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                ₹50 Priority Song Dedication
              </div>
              <button
                type="button"
                onClick={() => setDedicatingSong(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-emerald-300 font-medium">
                ✓ Confirmed by {event.artist_name}
              </p>
              <p className="text-base font-bold text-white mt-0.5">{dedicatingSong.song_title}</p>
              {dedicatingSong.original_artist && (
                <p className="text-xs text-white/60">{dedicatingSong.original_artist}</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-amber-200 mb-1">
                  Who are you dedicating this song to? (Name to be called out) *
                </label>
                <input
                  type="text"
                  required
                  value={payDedicatedTo}
                  onChange={(e) => setPayDedicatedTo(e.target.value)}
                  placeholder="e.g., Riya Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-amber-400/40 text-sm text-white placeholder-white/35 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-white/75 mb-1">Your Name (From)</label>
                <input
                  type="text"
                  value={payRequesterName}
                  onChange={(e) => setPayRequesterName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-white/35 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-white/75 mb-1">
                  Shoutout Message for the Artist &amp; Venue LED Screen
                </label>
                <input
                  type="text"
                  value={payDedicationMsg}
                  onChange={(e) => setPayDedicationMsg(e.target.value)}
                  placeholder="e.g., Happy Birthday Riya! Have the best night!"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-white/35 focus:outline-none"
                />
              </div>
            </div>

            {payError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                {payError}
              </p>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={paying}
                onClick={() => handlePay50Dedication("instant")}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition cursor-pointer shadow-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                {paying ? "Processing ₹50..." : "Pay ₹50 & Pin to Artist's Priority Dedication Queue"}
              </button>
              <button
                type="button"
                disabled={paying}
                onClick={() => handlePay50Dedication("cashfree")}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-[11px] transition cursor-pointer"
              >
                Pay ₹50 via Cashfree Payment Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
