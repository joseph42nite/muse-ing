"use client"

import React, { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { MapPin, Calendar, QrCode, Music, ArrowLeft, Disc3 } from "lucide-react"

function LiveQrResolver() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationSlug = searchParams.get("location")
  const dateParam = searchParams.get("date")

  const [events, setEvents] = useState<any[]>([])
  const [resolving, setResolving] = useState(true)

  useEffect(() => {
    if (locationSlug) {
      const qs = new URLSearchParams()
      qs.set("location", locationSlug)
      if (dateParam) qs.set("date", dateParam)

      fetch(`/api/public/events?${qs.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.matchedEvent?.id) {
            router.replace(
              `/live/${data.matchedEvent.id}?location=${encodeURIComponent(locationSlug)}${
                dateParam ? `&date=${encodeURIComponent(dateParam)}` : ""
              }`
            )
          } else {
            return fetch("/api/public/events")
              .then((r2) => r2.json())
              .then((d2) => {
                setEvents(d2.events || [])
                setResolving(false)
              })
          }
        })
        .catch(() => setResolving(false))
    } else {
      fetch("/api/public/events")
        .then((r) => r.json())
        .then((data) => {
          setEvents(data.events || [])
          setResolving(false)
        })
        .catch(() => setResolving(false))
    }
  }, [locationSlug, dateParam, router])

  if (resolving) {
    return (
      <div className="min-h-screen bg-[#F4EFE6] text-[#181615] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#181615]/5 border border-[#181615]/10 flex items-center justify-center mb-4 animate-pulse shadow-sm">
          <QrCode className="w-6 h-6 text-[#D92323]" />
        </div>
        <p className="text-base font-serif text-[#181615]">
          Connecting to Live Stage QR…
        </p>
        <p className="text-xs text-[#5C5650] mt-1 font-mono">
          {locationSlug ? `${locationSlug}` : ""} {dateParam ? `• ${dateParam}` : ""}
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#F4EFE6] text-[#181615] flex flex-col justify-between overflow-hidden">
      {/* Warm ambient radial vignette overlay matching landing page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-55"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,252,245,0.7) 0%, rgba(235,227,213,0.5) 70%, rgba(219,208,190,0.7) 100%)",
        }}
      />

      <div className="relative z-10 p-6 sm:p-8 max-w-lg mx-auto w-full flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-[#181615] text-[#181615] hover:text-white border border-[#181615]/10 text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>

            <Link
              href="/"
              aria-label="muse-ing home"
              className="group flex items-center transition-transform duration-300 hover:scale-110 cursor-pointer select-none"
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

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/5 border border-[#181615]/10 text-[#D92323] text-xs mb-3 font-semibold uppercase tracking-wider">
            <Disc3 className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Select Live Venue</span>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-normal tracking-tight mb-2 text-[#181615]"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            Where are you tuning in from?
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5650] mb-6 leading-relaxed">
            Select your venue to view tonight&apos;s live playlists, vote on songs, or send requests to the artist.
          </p>

          <div className="space-y-3.5">
            {events.map((ev) => (
              <Link
                key={ev.id}
                href={`/live/${ev.id}?location=${encodeURIComponent(ev.location_slug || "")}&date=${encodeURIComponent(ev.event_date_only || "")}`}
                className="block p-5 rounded-2xl bg-white border-2 border-white shadow-[0_12px_32px_-6px_rgba(24,22,21,0.12),0_4px_12px_-2px_rgba(24,22,21,0.06)] hover:shadow-[0_20px_45px_-8px_rgba(24,22,21,0.2)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 group"
              >
                <div className="flex items-center justify-between text-xs text-[#5C5650] mb-2 font-mono">
                  <span className="flex items-center gap-1.5 text-[#181615] font-sans font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#D92323] animate-ping" />
                    <MapPin className="w-3.5 h-3.5 text-[#D92323]" />
                    {ev.location_name}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5">
                    <Calendar className="w-3 h-3 text-[#5C5650]" />
                    {ev.event_date_only}
                  </span>
                </div>
                <p
                  className="text-xl sm:text-2xl text-[#181615] group-hover:text-[#D92323] transition-colors mt-1 font-normal leading-snug"
                  style={{ fontFamily: "var(--font-instrument-serif), serif" }}
                >
                  {ev.title}
                </p>
                <p className="text-xs text-[#5C5650] mt-1.5 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-[#D92323]" />
                  Artist: <strong className="text-[#181615] font-semibold">{ev.artist_name}</strong>
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-8 text-center">
          <p className="text-[11px] text-[#5C5650]/60 font-mono tracking-wider uppercase">
            Powered by Muse-ing Live Engine
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LiveQrPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4EFE6]" />}>
      <LiveQrResolver />
    </Suspense>
  )
}
