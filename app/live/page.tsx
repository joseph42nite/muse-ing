"use client"

import React, { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { MapPin, Calendar, QrCode, Music, ArrowLeft } from "lucide-react"

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
      <div className="min-h-screen bg-[#07070c] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mb-4 animate-pulse">
          <QrCode className="w-6 h-6 text-purple-300" />
        </div>
        <p className="text-base font-medium">Connecting to Venue Location QR…</p>
        <p className="text-xs text-white/55 mt-1">
          Matching location {locationSlug ? `"${locationSlug}"` : ""} {dateParam ? `on ${dateParam}` : ""}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07070c] text-white p-5 max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs mb-3">
        <QrCode className="w-3.5 h-3.5" />
        Select Your Venue Location
      </div>
      <h1 className="text-2xl font-semibold mb-1">Where are you tuning in from?</h1>
      <p className="text-xs text-white/60 mb-6">
        Pick your current venue location to see the artist&apos;s playlist, upvote songs, or submit 3 song requests.
      </p>

      <div className="space-y-3">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={`/live/${ev.id}?location=${encodeURIComponent(ev.location_slug || "")}&date=${encodeURIComponent(ev.event_date_only || "")}`}
            className="block p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 hover:border-purple-400/50 transition"
          >
            <div className="flex items-center justify-between text-xs text-purple-300 mb-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {ev.location_name}
              </span>
              <span className="flex items-center gap-1 text-white/50">
                <Calendar className="w-3 h-3" />
                {ev.event_date_only}
              </span>
            </div>
            <p className="text-base font-medium text-white">{ev.title}</p>
            <p className="text-xs text-white/65 mt-1 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-amber-400" />
              Artist: {ev.artist_name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function LiveQrPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07070c]" />}>
      <LiveQrResolver />
    </Suspense>
  )
}
