"use client"

import React, { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Tv,
  Sparkles,
  Maximize2,
  QrCode,
  Volume2,
  Heart,
  ThumbsUp,
  ExternalLink,
} from "lucide-react"

function LedScreenContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get("eventId") || "gig-koramangala-tonight"

  const [gigData, setGigData] = useState<any>(null)
  const [videoId, setVideoId] = useState<string>("")
  const [activeSong, setActiveSong] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/gigs/${encodeURIComponent(eventId)}`, { cache: "no-store" })
        if (res.ok) {
          const json = await res.json()
          setGigData(json)
          if (json.nowPlaying) {
            setActiveSong((prev: any) => prev || json.nowPlaying)
            if (json.nowPlaying.youtube_video_id) {
              setVideoId((prev) => prev || json.nowPlaying.youtube_video_id)
            }
          } else if (json.event?.active_karaoke_Floor_video_id) {
            setVideoId((prev) => prev || json.event.active_karaoke_Floor_video_id)
          }
        }
      } catch {
        // ignore
      }
    }

    fetchState()
    const interval = setInterval(fetchState, 3000)

    let bc: BroadcastChannel | null = null
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("muse_led_screen")
      bc.onmessage = (ev) => {
        const msg = ev.data
        if (msg?.type === "LOAD_KARAOKE") {
          if (msg.videoId) setVideoId(msg.videoId)
          if (msg.song) setActiveSong(msg.song)
          if (typeof msg.muted === "boolean") setMuted(msg.muted)
        }
      }
    }

    return () => {
      clearInterval(interval)
      if (bc) bc.close()
    }
  }, [eventId])

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const event = gigData?.event
  const displaySong = activeSong || gigData?.nowPlaying || gigData?.priorityDedications?.[0] || gigData?.upvotedQueue?.[0]
  const currentVideoId = videoId || displaySong?.youtube_video_id || event?.active_karaoke_Floor_video_id || "sFMRqxCexDk"

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden select-none">
      {/* Top Stage Header */}
      <div className="relative z-20 flex items-center justify-between px-8 py-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <div className="flex items-center gap-4">
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            HDMI VENUE LED DISPLAY CONNECTED
          </div>
          {event && (
            <div className="text-sm text-white/80">
              <span className="font-semibold text-white">{event.artist_name}</span> • {event.location_name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentVideoId && (
            <a
              href={`https://www.youtube.com/watch?v=${currentVideoId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white/85 flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Pop Out Direct YouTube
            </a>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-4 py-1.5 rounded-xl bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {isFullscreen ? "Exit Fullscreen" : "Full Screen on Venue LED"}
          </button>
        </div>
      </div>

      {/* Center YouTube Karaoke Player */}
      <div className="flex-1 flex items-center justify-center px-8 py-2 relative z-10">
        <div className="w-full h-[72vh] rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-neutral-950 relative">
          {currentVideoId ? (
            <iframe
              key={`${currentVideoId}-${muted ? "muted" : "audio"}`}
              src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1`}
              title="Venue LED Karaoke Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <Tv className="w-16 h-16 text-purple-400 mb-3 opacity-60" />
              <p className="text-xl font-medium">Venue LED Screen Ready</p>
              <p className="text-sm text-white/50 mt-1">
                Select any song on the Artist Dashboard to project Karaoke lyrics here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Live Shoutout & Upvote Ticker Bar */}
      <div className="relative z-20 px-8 py-5 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col md:flex-row items-center justify-between gap-4">
        {displaySong ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
              <Volume2 className="w-6 h-6 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-purple-300 font-bold">
                  Now Singing
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/80">
                  <ThumbsUp className="w-3 h-3 text-emerald-400" />
                  {displaySong.upvotes || 0} Upvotes
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {displaySong.song_title}{" "}
                {displaySong.original_artist && (
                  <span className="text-white/60 font-normal text-lg">
                    • {displaySong.original_artist}
                  </span>
                )}
              </h2>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Prominent ₹50 Dedication Callout on Venue LED Screen */}
        {displaySong?.dedication_payment_status === "paid" && displaySong?.dedicated_to && (
          <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-500/25 border-2 border-amber-400/60 flex items-center gap-3 shadow-xl">
            <Sparkles className="w-6 h-6 text-amber-300 shrink-0 animate-bounce" />
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Live Song Dedication
              </p>
              <p className="text-base font-bold text-white">
                Dedicated to <span className="text-amber-300">{displaySong.dedicated_to}</span>{" "}
                <span className="text-xs font-normal text-white/75">
                  (from {displaySong.requester_name})
                </span>
              </p>
              {displaySong.dedication_message && (
                <p className="text-xs text-amber-100/90 italic">
                  &ldquo;{displaySong.dedication_message}&rdquo;
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scan QR on Table Prompt */}
        {event && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/15 rounded-2xl px-4 py-2.5">
            <QrCode className="w-7 h-7 text-purple-300 shrink-0" />
            <div className="text-right">
              <p className="text-xs font-semibold text-white">Scan Table QR to Request &amp; Upvote</p>
              <p className="text-[11px] text-purple-300 font-mono">
                /live?location={event.location_slug}&amp;date={event.event_date_only}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArtistLedScreenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LedScreenContent />
    </Suspense>
  )
}
