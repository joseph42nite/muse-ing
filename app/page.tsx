"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import ShaderBackground from "@/components/shader-background"
import QrCodeModal from "@/components/qr-code-modal"
import {
  MapPin,
  Calendar,
  Mic2,
  QrCode,
  ThumbsUp,
  Sparkles,
  Music,
  Instagram,
  Tv,
  ArrowRight,
  ListMusic,
} from "lucide-react"

interface PublicEvent {
  id: string
  title: string
  description: string | null
  date: string
  event_date_only: string
  location_name: string
  location_slug: string
  ticket_price: number
  artist_id: string | null
  artist_name: string | null
  artist_instagram: string | null
  artist_avatar: string | null
  artist_bio: string | null
  confirmed_songs_count: number
  playlist_songs_count: number
  total_upvotes: number
  priority_dedications_count: number
}

export default function HomePage() {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>("ALL")
  const [qrModalEvent, setQrModalEvent] = useState<PublicEvent | null>(null)

  useEffect(() => {
    fetch("/api/public/events")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const locations = ["ALL", ...Array.from(new Set(events.map((e) => e.location_name?.split("•")[1]?.trim() || e.location_name).filter(Boolean)))]

  const filteredEvents =
    selectedCity === "ALL"
      ? events
      : events.filter((e) => (e.location_name || "").toLowerCase().includes(selectedCity.toLowerCase()))

  return (
    <ShaderBackground>
      <Header />

      <main className="relative z-20 pt-28 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Hero & 2 Main Agenda Options */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white/90 text-xs font-light">
              Interactive Live Gigs • Crowd Song Requests • Stage Karaoke & HDMI LED
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-white leading-tight mb-4">
            Shape the live setlist <span className="font-medium italic text-purple-300">in real time</span>.
          </h1>
          <p className="text-sm sm:text-base text-white/70 font-light leading-relaxed max-w-2xl">
            Discover live gigs happening at venues near you, scan the table QR to explore the artist&apos;s prepared playlist, submit 3 song requests, upvote crowd favorites, or pay ₹50 to dedicate a song with a live shoutout.
          </p>
        </div>

        {/* 2 Primary Options Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          {/* Option 1: Audience / Live Events by Location */}
          <div className="rounded-3xl bg-white/[0.06] backdrop-blur-xl border border-white/15 p-6 sm:p-7 flex flex-col justify-between hover:border-purple-400/50 transition-all shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-medium mb-4">
                <QrCode className="w-3.5 h-3.5" />
                Option 1 • For Audience & Venue Tables
              </div>
              <h2 className="text-2xl font-medium text-white mb-2">
                Live Events by Location & Table QR Requests
              </h2>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed mb-5">
                Sitting at a venue? Pick your event location below or scan the table QR code (matched by{" "}
                <span className="text-white font-medium">Location + Date</span>). See the artist&apos;s Instagram, browse &amp; upvote their prepared playlist, submit 3 song choices, or dedicate a song for ₹50!
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#events-by-location"
                className="px-5 py-2.5 rounded-full bg-white text-black font-medium text-xs hover:bg-white/90 transition flex items-center gap-1.5"
              >
                Explore Events by Location
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <Link
                href="/live?location=toit-indiranagar"
                className="px-5 py-2.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 font-medium text-xs hover:bg-purple-500/30 transition flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                Try Live QR Phone View
              </Link>
            </div>
          </div>

          {/* Option 2: Artist Login & Stage Dashboard */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-950/60 via-black/60 to-amber-950/40 backdrop-blur-xl border border-amber-400/30 p-6 sm:p-7 flex flex-col justify-between hover:border-amber-400/60 transition-all shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-medium mb-4">
                <Mic2 className="w-3.5 h-3.5" />
                Option 2 • For Performing Artists
              </div>
              <h2 className="text-2xl font-medium text-white mb-2">
                Artist Dashboard, Pre-Gig Playlist &amp; HDMI Karaoke
              </h2>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed mb-5">
                Log in to see your automatically scheduled gig location, pre-load the songs you plan to sing with YouTube Karaoke links, confirm 1 of 3 audience requests, view separate <span className="text-amber-300 font-medium">₹50 Dedications</span> &amp; <span className="text-purple-300 font-medium">Upvoted</span> queues, and project to the venue&apos;s HDMI LED screen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black font-semibold text-xs hover:opacity-95 transition flex items-center gap-1.5"
              >
                <Mic2 className="w-3.5 h-3.5" />
                Artist Login
              </Link>
              <Link
                href="/artist"
                className="px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white font-medium text-xs hover:bg-white/20 transition flex items-center gap-1.5"
              >
                <Tv className="w-3.5 h-3.5 text-amber-300" />
                Open Artist Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Section: Multiple Events Happening by Location */}
        <section id="events-by-location" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-300 font-medium mb-1">
                Live &amp; Upcoming Gigs
              </p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">
                Events Happening Across Locations
              </h2>
            </div>

            {/* Location Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setSelectedCity(loc)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                    selectedCity === loc
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/75 hover:bg-white/20"
                  }`}
                >
                  {loc === "ALL" ? "All Locations" : loc}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-3xl bg-white/5 border border-white/10 animate-pulse p-6"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredEvents.map((ev) => {
                const qrHref = `/live?location=${encodeURIComponent(ev.location_slug || "toit-indiranagar")}&date=${encodeURIComponent(ev.event_date_only || "")}`
                return (
                  <div
                    key={ev.id}
                    className="group rounded-3xl bg-black/55 backdrop-blur-2xl border border-white/15 hover:border-purple-400/50 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-2xl"
                  >
                    <div>
                      {/* Location & Date Top Bar */}
                      <div className="p-5 pb-4 border-b border-white/10 bg-white/[0.03]">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live Location QR Active
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-white/70">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            {ev.event_date_only || new Date(ev.date).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-start gap-1.5 text-purple-200 text-xs font-medium">
                          <MapPin className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <span>{ev.location_name || "Main Stage Venue"}</span>
                        </div>
                      </div>

                      {/* Event & Artist Info */}
                      <div className="p-5">
                        <h3 className="text-xl font-medium text-white mb-2 group-hover:text-purple-200 transition-colors">
                          {ev.title}
                        </h3>
                        {ev.description && (
                          <p className="text-xs text-white/65 line-clamp-2 mb-4 leading-relaxed">
                            {ev.description}
                          </p>
                        )}

                        {/* Artist Mini Card */}
                        <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center gap-3 mb-4">
                          <img
                            src={
                              ev.artist_avatar ||
                              "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80"
                            }
                            alt={ev.artist_name || "Artist"}
                            className="w-12 h-12 rounded-full object-cover border border-purple-400/40 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] uppercase tracking-wider text-white/50">
                              Performing Artist
                            </p>
                            <p className="text-sm font-medium text-white truncate">
                              {ev.artist_name || "Featured Live Artist"}
                            </p>
                            {ev.artist_instagram && (
                              <a
                                href={`https://instagram.com/${ev.artist_instagram.replace(/^@/, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-pink-300 hover:text-pink-200 mt-0.5"
                              >
                                <Instagram className="w-3 h-3" />
                                {ev.artist_instagram}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Live Queue & Playlist Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2">
                            <p className="text-sm font-semibold text-white flex items-center justify-center gap-1">
                              <ListMusic className="w-3.5 h-3.5 text-purple-400" />
                              {ev.confirmed_songs_count || 0}
                            </p>
                            <p className="text-[10px] text-white/55">Live Playlist</p>
                          </div>
                          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2">
                            <p className="text-sm font-semibold text-white flex items-center justify-center gap-1">
                              <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                              {ev.total_upvotes || 0}
                            </p>
                            <p className="text-[10px] text-white/55">Upvotes</p>
                          </div>
                          <div className="rounded-xl bg-amber-500/10 border border-amber-400/25 p-2">
                            <p className="text-sm font-semibold text-amber-300 flex items-center justify-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              {ev.priority_dedications_count || 0}
                            </p>
                            <p className="text-[10px] text-amber-200/75">₹50 Shoutouts</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-5 pt-0 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Link
                          href={qrHref}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-white text-black font-medium text-xs hover:bg-white/90 transition flex items-center justify-center gap-1.5"
                        >
                          <Music className="w-3.5 h-3.5" />
                          Join Audience &amp; Request Songs
                        </Link>
                        <button
                          type="button"
                          onClick={() => setQrModalEvent(ev)}
                          title="Show Venue Table QR Code"
                          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                      {ev.ticket_price > 0 && (
                        <Link
                          href={`/book/${ev.id}`}
                          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 text-[11px] text-center transition"
                        >
                          Reserve Entry Ticket • ₹{ev.ticket_price}
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {qrModalEvent && (
        <QrCodeModal
          open={true}
          onClose={() => setQrModalEvent(null)}
          locationName={qrModalEvent.location_name || "Venue"}
          locationSlug={qrModalEvent.location_slug || "toit-indiranagar"}
          eventDateOnly={qrModalEvent.event_date_only || new Date(qrModalEvent.date).toISOString().slice(0, 10)}
          eventTitle={qrModalEvent.title}
          artistName={qrModalEvent.artist_name || undefined}
        />
      )}
    </ShaderBackground>
  )
}
