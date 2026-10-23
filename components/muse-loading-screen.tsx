"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, Play, Sparkles, Music2, Radio, Tv } from "lucide-react"

interface MuseLoadingScreenProps {
  /** Whether data is still loading from the server */
  isLoading?: boolean
  /** Minimum cinematic intro duration in ms so the 3-phase animation is always visible */
  minDurationMs?: number
  /** Optional subtitle shown at the final convergence */
  label?: string
}

const FLOATING_CARDS = [
  {
    id: "card-player",
    type: "player",
    title: "Stage Backing Audio",
    subtitle: "Arjun Mehta • Live Unplugged",
    img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80",
    // Phase 1 (Spread out in 3D space) -> Phase 2 (Clustered tightly in center sphere)
    startX: -240,
    startY: 130,
    startScale: 1.15,
    midX: -55,
    midY: 38,
    midScale: 0.72,
    zIndex: 30,
    delay: 0,
  },
  {
    id: "card-events",
    type: "events",
    title: "Live Gig Discovery",
    subtitle: "Toit Brewhouse • Bengaluru",
    img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
    startX: 290,
    startY: -150,
    startScale: 1.1,
    midX: 68,
    midY: -42,
    midScale: 0.7,
    zIndex: 28,
    delay: 0.06,
  },
  {
    id: "card-dedication",
    type: "dedication",
    title: "Priority Dedication",
    subtitle: "₹50 Paid • Table Shoutout",
    img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80",
    startX: -260,
    startY: -130,
    startScale: 0.95,
    midX: -78,
    midY: -36,
    midScale: 0.68,
    zIndex: 32,
    delay: 0.1,
  },
  {
    id: "card-portrait",
    type: "portrait",
    title: "Live Crowd Requests",
    subtitle: "Real-Time Table Voting",
    img: "/live-crowd-request.jpg",
    startX: 90,
    startY: 170,
    startScale: 1.08,
    midX: 16,
    midY: 56,
    midScale: 0.78,
    zIndex: 35,
    delay: 0.08,
  },
  {
    id: "card-waveform",
    type: "waveform",
    title: "HDMI Screen Sync",
    subtitle: "Stage Lyrics & Chords Display",
    img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80",
    startX: 250,
    startY: 80,
    startScale: 0.96,
    midX: 82,
    midY: 22,
    midScale: 0.66,
    zIndex: 26,
    delay: 0.14,
  },
  {
    id: "card-upipay",
    type: "upipay",
    title: "UPIPay Direct • 0% Fee",
    subtitle: "Instant Settlement to Bank",
    img: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&auto=format&fit=crop&q=80",
    startX: -60,
    startY: -180,
    startScale: 0.9,
    midX: 10,
    midY: -68,
    midScale: 0.65,
    zIndex: 24,
    delay: 0.12,
  },
  {
    id: "card-mini-1",
    type: "mini",
    title: "Audience Song Queue",
    subtitle: "Curated by Live Upvotes",
    img: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&auto=format&fit=crop&q=80",
    startX: -360,
    startY: 20,
    startScale: 0.75,
    midX: -105,
    midY: 6,
    midScale: 0.56,
    zIndex: 18,
    delay: 0.16,
  },
  {
    id: "card-mini-2",
    type: "mini",
    title: "3-Song Batches",
    subtitle: "Audience Vote Decides Next",
    img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80",
    startX: 350,
    startY: -20,
    startScale: 0.78,
    midX: 102,
    midY: -12,
    midScale: 0.56,
    zIndex: 19,
    delay: 0.18,
  },
]

const FLOATING_LABELS = [
  { text: "Live Setlist", startX: -280, startY: -85, midX: -95, midY: -52, size: "text-xl sm:text-2xl" },
  { text: "Stage Manager", startX: 270, startY: 135, midX: 88, midY: 48, size: "text-2xl sm:text-3xl" },
  { text: "Artist Portal", startX: -230, startY: -155, midX: -65, midY: -82, size: "text-lg sm:text-xl" },
  { text: "Audience Upvotes", startX: 220, startY: -95, midX: 92, midY: -28, size: "text-lg sm:text-xl" },
  { text: "₹50 Dedications", startX: -310, startY: 75, midX: -112, midY: 28, size: "text-lg sm:text-xl" },
  { text: "UPIPay Direct", startX: -30, startY: 210, midX: -22, midY: 92, size: "text-base sm:text-lg" },
  { text: "HDMI Lyrics", startX: 140, startY: -195, midX: 38, midY: -88, size: "text-sm sm:text-base" },
  { text: "3-Song Batches", startX: -140, startY: 185, midX: -58, midY: 78, size: "text-sm sm:text-base" },
]

export default function MuseLoadingScreen({
  isLoading = false,
  minDurationMs = 2600,
}: MuseLoadingScreenProps) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [phase, setPhase] = useState<"spread" | "cluster" | "implode">("spread")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("cluster"), 950)
    const t2 = setTimeout(() => setPhase("implode"), 2150)
    const t3 = setTimeout(() => setMinTimeElapsed(true), minDurationMs)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [minDurationMs])

  const visible = isLoading || !minTimeElapsed

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="muse-pinterest-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] bg-[#F4EFE6] text-[#181615] overflow-hidden flex items-center justify-center select-none"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            perspective: "1200px",
          }}
        >
          {/* Subtle Warm Editorial Paper Grain & Vignette */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,252,245,0.7) 0%, rgba(235,227,213,0.5) 60%, rgba(219,208,190,0.75) 100%)",
            }}
          />

          {/* Subtle radial depth glow in the center during cluster phase */}
          <motion.div
            animate={{
              scale: phase === "spread" ? 0.6 : phase === "cluster" ? 1 : 0.2,
              opacity: phase === "spread" ? 0.25 : phase === "cluster" ? 0.55 : 0,
            }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 w-[380px] h-[380px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(217,35,35,0.12) 0%, rgba(212,175,55,0.14) 40%, rgba(244,239,230,0) 70%)",
              filter: "blur(30px)",
            }}
          />

          {/* 1. FLOATING BULLETED TYPOGRAPHY LABELS (• Habit Tracker / • Task Manager / • Sales Portal style) */}
          {FLOATING_LABELS.map((item, idx) => {
            const targetX =
              phase === "spread" ? item.startX : phase === "cluster" ? item.midX : 0
            const targetY =
              phase === "spread" ? item.startY : phase === "cluster" ? item.midY : 0
            const targetScale =
              phase === "spread" ? 1 : phase === "cluster" ? 0.78 : 0.05
            const targetOpacity =
              phase === "spread" ? 0.92 : phase === "cluster" ? 0.88 : 0

            return (
              <motion.div
                key={item.text}
                initial={{
                  x: item.startX * 1.45,
                  y: item.startY * 1.45,
                  scale: 0.4,
                  opacity: 0,
                }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: targetScale,
                  opacity: targetOpacity,
                }}
                transition={{
                  duration: phase === "implode" ? 0.45 : 0.95,
                  delay: idx * 0.03,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute pointer-events-none flex items-center gap-2 whitespace-nowrap z-20"
              >
                <span className="w-2 h-2 rounded-full bg-[#D92323] inline-block shadow-[0_0_8px_rgba(217,35,35,0.45)]" />
                <span className={`${item.size} font-normal tracking-tight text-[#181615]/90 font-sans`}>
                  {item.text}
                </span>
              </motion.div>
            )
          })}

          {/* 2. FLOATING UI CARDS (Music Player, Event Tickets, Golden Dedications, Portrait Cards) */}
          {FLOATING_CARDS.map((card) => {
            const targetX =
              phase === "spread" ? card.startX : phase === "cluster" ? card.midX : 0
            const targetY =
              phase === "spread" ? card.startY : phase === "cluster" ? card.midY : 0
            const targetScale =
              phase === "spread"
                ? card.startScale
                : phase === "cluster"
                ? card.midScale
                : 0.08
            const targetOpacity = phase === "implode" ? 0 : 1

            return (
              <motion.div
                key={card.id}
                initial={{
                  x: card.startX * 1.6,
                  y: card.startY * 1.6,
                  scale: 0.35,
                  opacity: 0,
                }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: targetScale,
                  opacity: targetOpacity,
                }}
                transition={{
                  duration: phase === "implode" ? 0.45 : 1.0,
                  delay: card.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ zIndex: card.zIndex }}
                className="absolute pointer-events-none"
              >
                {card.type === "player" && (
                  <div className="w-48 rounded-2xl bg-white border border-[#181615]/10 p-3 shadow-[0_20px_45px_rgba(24,22,21,0.14)]">
                    <div className="relative h-32 rounded-xl overflow-hidden mb-2.5">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <div>
                          <p className="text-xs font-bold text-white leading-tight">
                            {card.title}
                          </p>
                          <p className="text-[10px] text-white/75">{card.subtitle}</p>
                        </div>
                      </div>
                    </div>
                    {/* Waveform bar */}
                    <div className="flex items-center justify-between gap-1 px-1">
                      <div className="flex items-center gap-[2px] h-4">
                        {[45, 80, 60, 100, 70, 90, 50, 85, 65, 95, 55, 75, 40, 60].map(
                          (h, i) => (
                            <span
                              key={i}
                              className={`w-[2px] rounded-full ${
                                i < 9 ? "bg-[#D92323]" : "bg-[#181615]/20"
                              }`}
                              style={{ height: `${h}%` }}
                            />
                          )
                        )}
                      </div>
                      <span className="w-6 h-6 rounded-full bg-[#181615] text-[#F4EFE6] flex items-center justify-center">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </span>
                    </div>
                  </div>
                )}

                {card.type === "events" && (
                  <div className="w-56 rounded-2xl bg-white text-[#181615] p-3.5 shadow-[0_20px_45px_rgba(24,22,21,0.14)] border border-[#181615]/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Upcoming Gigs
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#D92323] text-white text-[9px] font-bold">
                        Tickets Live
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-[#181615] truncate">
                      {card.title}
                    </p>
                    <p className="text-[10px] text-neutral-600">{card.subtitle}</p>
                    <div className="flex gap-1.5 pt-1">
                      <span className="px-2 py-1 rounded-lg bg-[#F4EFE6] text-[9px] font-semibold text-[#181615]">
                        Live Setlist
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-[#F4EFE6] text-[9px] font-semibold text-[#181615]">
                        Table QR
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-red-50 text-[#D92323] text-[9px] font-bold">
                        ₹50 Shoutout
                      </span>
                    </div>
                  </div>
                )}

                {card.type === "dedication" && (
                  <div className="w-48 rounded-2xl bg-white border border-amber-300/80 p-3 shadow-[0_20px_45px_rgba(24,22,21,0.14)] space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-800 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" /> {card.title}
                      </span>
                    </div>
                    <div className="h-20 rounded-xl overflow-hidden relative">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-600">
                      <span className="truncate">{card.subtitle}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#181615] text-[#F4EFE6] font-bold shrink-0">
                        Pick
                      </span>
                    </div>
                  </div>
                )}

                {card.type === "portrait" && (
                  <div className="w-40 h-52 rounded-2xl overflow-hidden relative shadow-[0_20px_45px_rgba(24,22,21,0.18)] border border-[#181615]/15 bg-white p-1">
                    <div className="w-full h-full rounded-xl overflow-hidden relative">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-3">
                        <span className="self-end px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-bold text-white">
                          LIVE
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{card.title}</p>
                          <p className="text-[10px] text-[#E4EA7A] font-semibold">
                            {card.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {card.type === "waveform" && (
                  <div className="w-48 rounded-2xl bg-white text-[#181615] border border-[#181615]/10 p-3 shadow-[0_20px_45px_rgba(24,22,21,0.14)] space-y-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="w-9 h-9 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#181615] truncate">{card.title}</p>
                        <p className="text-[10px] text-neutral-500 truncate">{card.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-600 pt-1 border-t border-neutral-100">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Tv className="w-3 h-3 text-[#D92323]" /> HDMI Sync
                      </span>
                      <span className="text-[#D92323] font-mono font-bold">31 Votes</span>
                    </div>
                  </div>
                )}

                {(card.type === "upipay" || card.type === "mini") && (
                  <div className="w-40 rounded-2xl bg-white text-[#181615] p-2.5 shadow-[0_16px_36px_rgba(24,22,21,0.12)] flex items-center gap-2.5 border border-[#181615]/10">
                    <img
                      src={card.img}
                      alt={card.title}
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#181615] truncate">
                        {card.title}
                      </p>
                      <p className="text-[9px] text-neutral-500 truncate">{card.subtitle}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}

          {/* 3. CENTER CONVERGENCE BRAND CORE */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: phase === "cluster" || phase === "implode" ? 1 : 0,
              scale: phase === "implode" ? 1.15 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#181615] text-[#F4EFE6] shadow-[0_12px_40px_rgba(24,22,21,0.35)] border border-[#181615]/20 flex items-center justify-center select-none"
          >
            <span
              className="instrument text-4xl sm:text-5xl text-white select-none inline-flex items-center justify-center translate-x-[4px] -translate-y-[5px] leading-none"
              style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
            >
              <span>m</span>
              <span className="text-[#D92323]">-</span>
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
