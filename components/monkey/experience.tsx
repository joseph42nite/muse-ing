"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import Footer from "./footer"
import Overlay from "./overlay"
import { clamp01, scroll } from "./store"

const Stage = dynamic(() => import("./stage"), { ssr: false })

const SCROLL_LENGTH_VH = 560

function canWebGL() {
  try {
    const c = document.createElement("canvas")
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

export default function Experience() {
  const [hasWebGL, setHasWebGL] = useState(false)
  const [ready, setReady] = useState(false)
  const runway = useRef<HTMLDivElement>(null)
  // The scroll story runs over the runway only; the footer scrolls in after it ends
  const runwayMax = () => (runway.current?.offsetHeight ?? document.documentElement.scrollHeight) - window.innerHeight

  useEffect(() => {
    const ok = canWebGL()
    setHasWebGL(ok)
    if (!ok) setReady(true)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const max = runwayMax()
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
  }, [])

  const jump = useCallback((p: number) => {
    const max = runwayMax()
    window.scrollTo({ top: max * clamp01(p), behavior: "smooth" })
  }, [])

  return (
    <>
    <div ref={runway} className="relative bg-[#070709]" style={{ height: `${SCROLL_LENGTH_VH}vh` }}>
      <div className="sticky top-0 h-screen w-screen overflow-hidden">
        {hasWebGL && <Stage onReady={() => setReady(true)} />}
        <Overlay jump={jump} />
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#070709] text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F4EFE6]/70 transition-opacity duration-700 ${
            ready ? "opacity-0" : "opacity-100"
          }`}
        >
          Sculpting…
        </div>
      </div>
    </div>
    <Footer jump={jump} />
    </>
  )
}
