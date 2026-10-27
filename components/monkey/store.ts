// Shared scroll state for the 3D landing. `target` is written from the DOM scroll
// position; `value` is the damped copy that the 3D scene and overlays read.
export const scroll = { target: 0, value: 0 }

/** World position of the cigarette ember, kept current by the monkey for the smoke. */
export const ember = { x: 0.42, y: 0.97, z: 1.85 }

/** World position of the monkey's mouth, for the exhale. */
export const mouth = { x: 0.26, y: 1.0, z: 1.1 }

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 0 → 1 between a and b, holds 1 until c, back to 0 by d. */
export const win = (t: number, a: number, b: number, c: number, d: number) =>
  smooth(a, b, t) * (1 - smooth(c, d, t))

export type Vec3 = [number, number, number]
export interface CamKey {
  t: number
  p: Vec3
  l: Vec3
}

/**
 * Camera path across the six storyboard scenes.
 * Monkey sits at the origin facing +z; the head is around y = 1.5.
 */
export const CAMERA_KEYS: CamKey[] = [
  { t: 0.0, p: [3.7, 1.6, 2.5], l: [0, 1.4, 0.8] }, // 1 close-up profile
  { t: 0.12, p: [4.0, 1.7, 3.0], l: [0, 1.4, 1.4] },
  { t: 0.2, p: [5.6, 1.85, 3.5], l: [0, 1.5, 2.4] }, // pulling back while he exhales
  { t: 0.3, p: [6.2, 1.9, 3.6], l: [0, 1.5, 2.6] }, // 2 pulled back, wordmark in smoke
  { t: 0.34, p: [6.2, 1.9, 3.6], l: [0, 1.4, 2.6] },
  { t: 0.41, p: [-4.2, 1.6, 3.4], l: [0, 1.4, 0.5] }, // 3 whip to the other side
  { t: 0.52, p: [-3.2, 1.5, 2.6], l: [0, 1.4, 0.6] },
  { t: 0.6, p: [-5.2, 0.0, 8.6], l: [0, -0.25, 0] }, // 4 outfit, pull back and tilt down
  { t: 0.7, p: [5.0, 0.2, 8.8], l: [0, -0.25, 0] },
  { t: 0.78, p: [5.5, 0.8, -6.5], l: [0, 0.5, -0.4] }, // 5 around to the guitar
  { t: 0.86, p: [0.6, 0.6, -8.0], l: [0, 0.3, -0.3] },
  { t: 0.9, p: [7.5, 1.2, 0.5], l: [0, 0.9, 0] }, // 6 swing round to the front
  { t: 0.93, p: [0, 1.2, 8.0], l: [0, 0.9, 0.6] },
  { t: 1.0, p: [0, 1.2, 8.0], l: [0, 0.9, 0.6] },
]

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

export function sampleCamera(t: number): { p: Vec3; l: Vec3 } {
  const keys = CAMERA_KEYS
  if (t <= keys[0].t) return { p: keys[0].p, l: keys[0].l }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t <= b.t) {
      const u = smooth(0, 1, (t - a.t) / (b.t - a.t || 1))
      return {
        p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)],
        l: [lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u)],
      }
    }
  }
  const last = keys[keys.length - 1]
  return { p: last.p, l: last.l }
}

// Moments in the final scene, shared by the monkey, the glass and the overlay.
export const SMASH = {
  windUp: [0.92, 0.94] as const,
  strike: [0.945, 0.958] as const,
  crack: [0.957, 0.962] as const,
  form: [0.968, 0.99] as const,
}
