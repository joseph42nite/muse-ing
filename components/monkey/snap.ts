// Section snapping for the scroll story. The visitor scrolls freely; when the scroll comes to
// rest between scenes (where the copy is mid-fade), it glides on to the next scene in the
// direction they were going, then the camera bobs gently as it lands. Any new input during a
// glide hands control straight back to them.
import { landing, STOPS } from "./store"

/** How long the scroll must be still before it settles, in ms. */
const IDLE_MS = 160

const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

/** The stop to settle on from progress p, going in direction dir, or null if p is already held by one. */
export function settleTarget(p: number, dir: number) {
  if (STOPS.some((s) => p >= s.hold[0] - 1e-3 && p <= s.hold[1] + 1e-3)) return null
  const ahead = dir >= 0 ? STOPS.find((s) => s.at > p) : [...STOPS].reverse().find((s) => s.at < p)
  return (ahead ?? STOPS.reduce((a, b) => (Math.abs(b.at - p) < Math.abs(a.at - p) ? b : a))).at
}

/**
 * Starts snapping on the page. `runwayMax` gives the scroll distance the story runs over; past
 * it (the footer) nothing snaps. Returns a `glideTo(progress)` for links and buttons, and a
 * cleanup function.
 */
export function startSnap(runwayMax: () => number) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  let lastY = window.scrollY
  let dir = 0
  let timer = 0
  let raf = 0
  let gliding = false
  let touching = false

  const stopGlide = () => {
    if (!gliding) return
    gliding = false
    cancelAnimationFrame(raf)
  }

  const glideTo = (p: number) => {
    stopGlide()
    clearTimeout(timer)
    const max = runwayMax()
    const from = window.scrollY
    const to = Math.round(Math.min(1, Math.max(0, p)) * max)
    const dist = to - from
    if (Math.abs(dist) < 2) return
    const ms = reduced ? 250 : Math.min(1500, Math.max(650, 380 + Math.abs(dist) * 0.45))
    const start = performance.now()
    gliding = true
    const step = (now: number) => {
      if (!gliding) return
      const u = Math.min(1, (now - start) / ms)
      window.scrollTo(0, from + dist * easeInOutCubic(u))
      if (u < 1) raf = requestAnimationFrame(step)
      else {
        gliding = false
        lastY = window.scrollY
        if (!reduced) {
          landing.at = performance.now()
          landing.dir = Math.sign(dist)
        }
      }
    }
    raf = requestAnimationFrame(step)
  }

  const settle = () => {
    if (touching || gliding) return
    const max = runwayMax()
    const y = window.scrollY
    if (max <= 0 || y > max + 1) return
    const to = settleTarget(y / max, dir)
    if (to !== null) glideTo(to)
  }

  const onScroll = () => {
    if (gliding) return
    const y = window.scrollY
    if (y !== lastY) dir = Math.sign(y - lastY)
    lastY = y
    clearTimeout(timer)
    timer = window.setTimeout(settle, IDLE_MS)
  }
  // Fresh input during a glide is the visitor taking over
  const takeOver = () => stopGlide()
  const onTouchStart = () => {
    touching = true
    stopGlide()
  }
  const onTouchEnd = () => {
    touching = false
    clearTimeout(timer)
    timer = window.setTimeout(settle, IDLE_MS)
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("wheel", takeOver, { passive: true })
  window.addEventListener("keydown", takeOver)
  window.addEventListener("pointerdown", takeOver)
  window.addEventListener("touchstart", onTouchStart, { passive: true })
  window.addEventListener("touchend", onTouchEnd, { passive: true })
  window.addEventListener("touchcancel", onTouchEnd, { passive: true })

  const stop = () => {
    stopGlide()
    clearTimeout(timer)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("wheel", takeOver)
    window.removeEventListener("keydown", takeOver)
    window.removeEventListener("pointerdown", takeOver)
    window.removeEventListener("touchstart", onTouchStart)
    window.removeEventListener("touchend", onTouchEnd)
    window.removeEventListener("touchcancel", onTouchEnd)
  }
  return { glideTo, stop }
}
