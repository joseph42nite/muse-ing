"use client"

import { useEffect, useState } from "react"
import SiteMenu, { type MenuTarget } from "@/components/site-menu"

interface MuseLoadingScreenProps {
  /** Whether data is still loading from the server */
  isLoading?: boolean
  /** Minimum time on screen in ms, so the title decode and fold always play through */
  minDurationMs?: number
  /** What's loading, under the progress bar (default "Tuning the room"). What Muse-ing does cycles beside it */
  label?: string
  /** On the landing, glide the film to a section instead of following the menu's links */
  onPick?: (t: MenuTarget) => void
}

/**
 * The loading screen, cut from the landing's first shot: the studio-red room, MUSE-ING decoding in
 * through block glyphs, then folding to M- with LIVE MUSIC underneath. See design.md §3 (scene 1).
 */

const WORD = "MUSE-ING"
const GLYPH_STEPS = [0.4, 0.28, 0.18, 0.34] // the landing's █▓▒░ flicker, as block opacities
const DECODE_MS = 900 // letters resolve left to right over this time
const FOLD_AT_MS = 1350 // then USE and ING slide away, leaving M-
const FADE_MS = 450
// A page can swap one loading screen for another (the live portal shows one while fetching, then
// one for its intro). If a new one mounts right after the last went away, carry on from where it was.
let lastStart = 0
let lastSeen = 0

const FEATURES = ["Live setlist", "Crowd upvotes", "₹50 dedications", "Stage screen", "Table booking"]

export default function MuseLoadingScreen({ isLoading = false, minDurationMs = 2600, label, onPick }: MuseLoadingScreenProps) {
  const [elapsed, setElapsed] = useState(0)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [gone, setGone] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
    const now = performance.now()
    const start = now - lastSeen < 400 ? lastStart : now
    lastStart = start
    let raf = 0
    const tick = () => {
      const t = performance.now() - start
      lastSeen = performance.now()
      setElapsed(t)
      if (t < FOLD_AT_MS + 200) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const done = setTimeout(() => setMinTimeElapsed(true), Math.max(0, minDurationMs - (now - start)))
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
      lastSeen = performance.now()
    }
  }, [minDurationMs])

  // Cycle the feature line once a second while we wait.
  const [feature, setFeature] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFeature((f) => (f + 1) % FEATURES.length), 1000)
    return () => clearInterval(id)
  }, [])

  const leaving = !isLoading && minTimeElapsed
  useEffect(() => {
    if (!leaving) {
      setGone(false)
      return
    }
    const id = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(id)
  }, [leaving])
  if (gone) return null

  const resolved = reduced ? WORD.length : Math.floor((elapsed / DECODE_MS) * WORD.length)
  const folded = reduced || elapsed >= FOLD_AT_MS
  // Progress fills towards 90% over the minimum time and completes once loading is done.
  const progress = leaving ? 1 : Math.min(0.9, elapsed / Math.max(minDurationMs, 1))

  // An unresolved letter is a flickering cream block the size of the letter it becomes, so the
  // title never reflows (block glyphs fall back to another font at this size).
  const letter = (ch: string, i: number) => {
    if (i >= resolved) {
      const step = (i + Math.floor(elapsed / 70)) % GLYPH_STEPS.length
      return (
        <span className="relative inline-block">
          <span className="invisible">{ch}</span>
          <span
            aria-hidden
            className="absolute inset-x-[6%] bottom-[8%] top-[10%] bg-[#F4EFE6]"
            style={{ opacity: GLYPH_STEPS[step] }}
          />
        </span>
      )
    }
    return ch
  }
  // M | USE | - | ING: the middle and tail collapse to leave M-
  const fold = (from: number, to: number) => (
    <span
      className="inline-block overflow-hidden whitespace-nowrap align-bottom"
      style={{
        maxWidth: folded ? 0 : "6em",
        opacity: folded ? 0 : 1,
        // The letters fade out first, then the gap closes, so there's no ghost of USE and ING
        transition: "opacity 220ms ease-out, max-width 700ms cubic-bezier(0.65,0,0.35,1) 120ms",
      }}
    >
      {WORD.slice(from, to)
        .split("")
        .map((ch, k) => (
          <span key={k}>{letter(ch, from + k)}</span>
        ))}
    </span>
  )

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Muse-ing"
      className="fixed inset-0 z-[100] flex select-none flex-col overflow-hidden bg-[#070709] text-[#F4EFE6] transition-opacity ease-in-out"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: leaving ? "none" : "auto" }}
    >
      {/* The red studio: backdrop gradient from the landing and a floor glow */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(85%_70%_at_50%_42%,#9e0a14_0%,#6b0510_38%,#170306_78%,#070709_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[38vh] bg-[radial-gradient(70%_100%_at_50%_100%,rgba(122,10,18,0.55),transparent_70%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-7 pt-7 sm:px-12 sm:pt-10">
        <div className="dots">
          <i />
        </div>
        <p className="micro text-[#F4EFE6]/60 max-md:hidden">Live music · Real-time setlists</p>
        <SiteMenu onPick={onPick} />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5">
        <h1
          aria-hidden
          className="title-x whitespace-nowrap text-center text-[clamp(40px,14vw,220px)] leading-[0.82] [text-shadow:0_18px_60px_rgba(0,0,0,0.45)]"
        >
          <span>{letter("M", 0)}</span>
          {fold(1, 4)}
          <span>{letter("-", 4)}</span>
          {fold(5, 8)}
        </h1>
        <p
          className="micro mt-5 text-[11px] tracking-[0.42em] text-[#F4EFE6] transition-opacity duration-500 sm:mt-7 sm:text-[13px]"
          style={{ opacity: resolved >= WORD.length ? 1 : 0 }}
        >
          Live music
        </p>
      </div>

      <footer className="relative z-10 px-5 pb-8 sm:px-12 sm:pb-10">
        <div className="h-px w-full bg-[#F4EFE6]/15">
          <div
            className="h-px bg-[#F4EFE6] transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="micro text-[#F4EFE6]/60">
            {label ?? "Tuning the room"} <span className="tabular-nums text-[#F4EFE6]/85">{Math.round(progress * 100)}%</span>
          </p>
          <p key={feature} className="micro animate-[muse-fade_1s_ease-in-out] text-[#F4EFE6]/80">
            {FEATURES[feature]}
          </p>
        </div>
      </footer>
    </div>
  )
}
