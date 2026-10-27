"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import Overlay from "./overlay"
import { clamp01, scroll } from "./store"

const Stage = dynamic(() => import("./stage"), { ssr: false })
// The original 2D landing page is the fallback for phones, reduced motion and no-WebGL browsers.
const Classic = dynamic(() => import("@/app/classic/page"), { ssr: false })

const SCROLL_LENGTH_VH = 800

function canWebGL() {
  try {
    const c = document.createElement("canvas")
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

export default function Experience() {
  const [mode, setMode] = useState<"pending" | "3d" | "classic">("pending")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // ?mode=3d or ?mode=classic forces a version, otherwise pick by device.
    const forced = new URLSearchParams(window.location.search).get("mode")
    const wide = window.matchMedia("(min-width: 600px)").matches
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (forced === "classic") setMode("classic")
    else if (forced === "3d") setMode(canWebGL() ? "3d" : "classic")
    else setMode(wide && !calm && canWebGL() ? "3d" : "classic")
  }, [])

  useEffect(() => {
    if (mode !== "3d") return
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scroll.target = max > 0 ? clamp01(window.scrollY / max) : 0
    }
    onScroll()
    scroll.value = scroll.target
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [mode])

  const jump = useCallback((p: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * clamp01(p), behavior: "smooth" })
  }, [])

  if (mode === "classic") return <Classic />

  return (
    <div className="relative bg-[#0a0b24]" style={{ height: `${SCROLL_LENGTH_VH}vh` }}>
      <div className="sticky top-0 h-screen w-screen overflow-hidden">
        {mode === "3d" && <Stage onReady={() => setReady(true)} />}
        {mode === "3d" && <Overlay jump={jump} />}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0a0b24] text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F4EFE6]/70 transition-opacity duration-700 ${
            ready ? "opacity-0" : "opacity-100"
          }`}
        >
          Warming up the amps…
        </div>
      </div>
    </div>
  )
}
