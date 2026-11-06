// Shared scroll state for the 3D landing. `target` is written from the DOM scroll
// position; `value` is the damped copy that the 3D scene and overlays read.
export const scroll = { target: 0, value: 0 }

/** Uniform scale mapping face.js units (head at y=0, shoe soles at y=-7.65) to world units (head at y=1.5, floor at y=-3.0). */
export const MONKEY_SCALE = 4.5 / 7.65

/** World position of the cigarette ember, kept current by the monkey for the smoke. */
export const ember = { x: 0.44, y: 1.07, z: 1.02 }

/** World position of the monkey's mouth, for the exhale and smoke wordmark. */
export const mouth = { x: 0.04, y: 1.12, z: 0.72 }

/**
 * Body proportions relative to the original sculpt, for a lankier figure: the head shrinks
 * toward the neck, the torso stretches down from the neck, the legs stretch down from the
 * waist, the arms hang longer from the shoulders, the body narrows
 * and the hips widen again below the waist. Hands, boots and the guitar keep their original shape.
 */
export const BODY = { head: 0.86, torso: 1.4, legs: 1.7, arms: 1.2, width: 0.88, hips: 1.16 }

/** Neck and stretched waist heights in face.js units. */
export const BODY_NECK = -1.05
export const BODY_WAIST = BODY_NECK + (-4.1 - BODY_NECK) * BODY.torso

/** World height of the street his soles land on (the leg group's boot pivots sit 0.6076 above its floor at -7.85). */
export const FLOOR = 1.5 + MONKEY_SCALE * (BODY_WAIST + 4.3 * BODY.legs + BODY.legs * (-7.85 + 0.6076) - 0.6076)

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
 * Camera path across the five storyboard scenes (calibrated for 28° vertical FOV), in world
 * units. Almost every shot looks up at him: a worm's-eye close-up, an orbit to a clean side
 * profile for the exhale, the full-body strut from shin height, a drop to the street as he
 * walks up out of frame over the gig list, then round to the front for the smash. Head centre
 * is around y = 1.4, the mouth at (0.04, 1.09, 0.62), the waist at y = -1.6 and the street at FLOOR.
 */
export const CAMERA_KEYS: CamKey[] = [
  { t: 0.0,  p: [0.55, 0.50, 2.35],  l: [0.0, 1.38, 0.35] },    // 1 worm's-eye close-up from under the chin
  { t: 0.08, p: [1.05, 0.62, 2.50],  l: [0.0, 1.34, 0.38] },
  { t: 0.15, p: [3.10, 0.80, 2.45],  l: [-0.20, 1.24, 0.60] },  // orbiting round while he exhales
  { t: 0.23, p: [4.30, 0.75, 0.95],  l: [-0.35, 1.20, 0.85] },  // 2 side profile, the name forms in the smoke in front of him
  { t: 0.27, p: [4.30, 0.75, 0.95],  l: [-0.35, 1.20, 0.85] },
  { t: 0.37, p: [-0.70, -3.55, 20.2], l: [-0.18, -2.15, 0.10] }, // 3 the strut, shin-high camera looking up at him
  { t: 0.52, p: [0.45, -3.10, 12.0],  l: [-0.15, -0.90, 0.10] }, // pushing in to knees-up
  { t: 0.63, p: [0.30, -3.75, 11.5],  l: [0.0, -5.90, 0.0] },    // 4 down to the wet street, he walks up out of frame over the gigs
  { t: 0.75, p: [0.30, -3.85, 10.8],  l: [0.0, -6.00, 0.0] },
  { t: 0.80, p: [5.20, 0.90, 0.50],  l: [0, 0.65, 0] },         // 5 swing round to the front for the smash
  { t: 0.84, p: [0, 0.85, 6.60],     l: [0, 0.65, 0.35] },
  { t: 1.0,  p: [0, 0.85, 6.60],     l: [0, 0.65, 0.35] },
]

/** Where the smoke wordmark settles: the held side-profile shot. */
export const WORDMARK_SHOT = 0.25

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

/** On portrait screens, how far (in screen widths) the side-profile exhale shot is slid left to bring his head in from the edge. */
export const PROFILE_SHIFT = 0.3
export const profileFraming = (t: number) => win(t, 0.12, 0.18, 0.27, 0.31)

/** How strongly the runway walk scene frames him right of centre (0 = centred), leaving the left for its copy. */
export const walkFraming = (t: number) => win(t, 0.33, 0.39, 0.52, 0.58)

// Moments in the final scene, shared by the monkey, the glass and the overlay.
export const SMASH = {
  grab: [0.80, 0.84] as const,
  windUp: [0.83, 0.855] as const,
  strike: [0.86, 0.875] as const,
  crack: [0.874, 0.88] as const,
  form: [0.89, 0.93] as const,
}

/**
 * How far the studio has moved under him, in world units along z. He walks on the spot, so the
 * world travels with his planted boot instead (the floor, light bars and dust read it); this
 * keeps every camera shot and the smoke wordmark where they were framed.
 */
export const travel = { z: 0 }

/** When he walks: from the end of the exhale until he reaches for the guitar. */
export const walkWeight = (t: number) => win(t, 0.29, 0.37, 0.79, 0.82)
