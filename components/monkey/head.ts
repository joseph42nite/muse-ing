// The monkey's sculpted head and its painted skin: plain math with no three.js or React, so it
// runs the same on the main thread and in the head workers (head.worker.ts).
import { clamp, clamp01 as sat, lerp, smooth } from "./store"

export function hash3(i: number, j: number, k: number) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

export function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  let xf = x - xi
  let yf = y - yi
  let zf = z - zi
  xf = xf * xf * (3 - 2 * xf)
  yf = yf * yf * (3 - 2 * yf)
  zf = zf * zf * (3 - 2 * zf)
  const a = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf)
  const b = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf)
  const c = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf)
  const d = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf)
  return lerp(lerp(a, b, yf), lerp(c, d, yf), zf)
}

export function fbm3(x: number, y: number, z: number, oct: number) {
  let a = 0.5
  let f = 1
  let s = 0
  let m = 0
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f)
    m += a
    a *= 0.5
    f *= 2.03
  }
  return s / m
}

export const crease = (f: number, w: number) => {
  const g = f - Math.round(f)
  return Math.exp(-(g * g) / (w * w))
}

export function sdE(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const x = (px - cx) / rx
  const y = (py - cy) / ry
  const z = (pz - cz) / rz
  const k0 = Math.sqrt(x * x + y * y + z * z)
  const k1 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz))
  return k1 < 1e-6 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

export function sdCap(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const pax = px - ax
  const pay = py - ay
  const paz = pz - az
  const bax = bx - ax
  const bay = by - ay
  const baz = bz - az
  const h = sat((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))
  const dx = pax - bax * h
  const dy = pay - bay * h
  const dz = paz - baz * h
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
}

export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)

export const smirk = (x: number) => 0.085 * smooth(-0.12, 0.42, x)
/** Where the cigarette sits along the lip slit, right of centre. */
export const CIG_X = 0.3

export function headSDF(x: number, y: number, z: number) {
  const ax = Math.abs(x)
  let d = sdE(x, y, z, 0, 0.08, -0.22, 0.92, 0.86, 0.96)
  d = smin(d, sdE(x, y, z, 0, 0.38, 0.22, 0.64, 0.28, 0.52), 0.2)
  d = smax(d, -sdE(ax, y, z, 0.98, 0.2, 0.12, 0.18, 0.25, 0.32), 0.16)
  d = smin(d, sdE(x, y, z, 0, -0.02, 0.38, 0.76, 0.58, 0.55), 0.22)
  d = smin(d, sdCap(ax, y, z, 0.62, 0.26, 0.52, 0, 0.31, 0.88, 0.17), 0.1)
  d = smax(d, -sdE(ax, y, z, 0.28, 0.11, 0.88, 0.19, 0.12, 0.15), 0.07)
  d = smin(d, sdE(ax, y, z, 0.46, -0.07, 0.62, 0.24, 0.18, 0.22), 0.13)

  d = smin(d, sdE(x, y, z, 0, -0.40, 0.79, 0.49, 0.39, 0.51), 0.18)

  d = smax(d, -sdE(x, y, z, 0, 0.06, 1.02, 0.16, 0.055, 0.06), 0.04)
  d = smin(d, sdCap(x, y, z, 0, 0.14, 0.88, 0, -0.02, 1.03, 0.068), 0.075)
  d = smin(d, sdE(x, y, z, 0, -0.09, 1.09, 0.14, 0.095, 0.09), 0.06)
  d = smin(d, sdCap(x, y, z, 0, -0.01, 1.04, 0, -0.16, 1.15, 0.060), 0.05)
  d = smin(d, sdCap(ax, y, z, 0.055, -0.01, 1.05, 0.175, -0.15, 1.07, 0.076), 0.055)
  d = smin(d, sdE(ax, y, z, 0.185, -0.145, 1.04, 0.072, 0.065, 0.07), 0.045)

  const nx = (ax - 0.090) * 0.90 + (y + 0.122) * 0.42
  const ny = -(ax - 0.090) * 0.42 + (y + 0.122) * 0.90
  const nz = z - 1.135
  d = smax(d, -sdE(nx, ny, nz, 0, 0, 0, 0.046, 0.062, 0.080), 0.018)

  const ly = y - smirk(x)
  d = smin(d, sdE(x, ly, z, 0, -0.41, 1.09, 0.41, 0.24, 0.24), 0.09)
  d = smax(d, -sdCap(0, y, z, 0, -0.20, 1.16, 0, -0.42, 1.24, 0.022) - ax * 0.45, 0.025)
  d = smin(d, sdE(x, ly, z, 0, -0.70, 1.05, 0.34, 0.11, 0.21), 0.06)
  // The lip slit: a groove deep and wide enough for the mesh to hold, running out to the corners
  d = smax(d, -sdCap(ax, ly, z, 0.38, -0.60, 0.96, 0, -0.60, 1.30, 0.036), 0.022)
  // The lips part around the cigarette in the right corner of the slit
  d = smax(d, -sdE(x, ly, z, CIG_X, -0.6, 1.19, 0.075, 0.04, 0.1), 0.02)
  d = smin(d, sdE(x, y, z, 0, -0.76, 0.60, 0.50, 0.32, 0.48), 0.2)
  d = smin(d, sdCap(x, y, z, 0, -0.75, -0.08, 0, -1.75, -0.10, 0.44), 0.24)
  return Math.max(d, -(y + 1.65))
}

/** Where the head's rays start, its mesh resolution and its skin map size. */
export const HEAD_O = { x: 0, y: -0.1, z: 0.15 }
export const SEG_W = 256
export const SEG_H = 192
export const SKIN_W = 2048
export const SKIN_H = 1024
const HEAD_T_MAX = 2.8

/**
 * Sphere-traces inward along one direction from tMax to the surface of `sdf`, then bisects to
 * pin it down. Returns the distance from the origin along the ray.
 */
export function traceSurface(sdf: (x: number, y: number, z: number) => number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number) {
  let t = tMax
  let d = sdf(ox + dx * t, oy + dy * t, oz + dz * t)
  for (let k = 0; k < 160 && d > 1e-4; k++) {
    t -= Math.max(d * 0.8, 0.002)
    if (t <= 0.01) {
      t = 0.01
      break
    }
    d = sdf(ox + dx * t, oy + dy * t, oz + dz * t)
  }
  let lo = t
  let hi = Math.min(t + 0.02, tMax)
  for (let k = 0; k < 14; k++) {
    const m = (lo + hi) * 0.5
    if (sdf(ox + dx * m, oy + dy * m, oz + dz * m) < 0) lo = m
    else hi = m
  }
  return (lo + hi) * 0.5
}

/**
 * Head-mesh ray distances for vertices i0..i1, in the vertex order of three.js
 * SphereGeometry(1, SEG_W, SEG_H): rows from top to bottom, each row round from phi = 0.
 */
export function traceHead(i0: number, i1: number) {
  const T = new Float32Array(i1 - i0)
  for (let i = i0; i < i1; i++) {
    const iy = Math.floor(i / (SEG_W + 1))
    const ix = i - iy * (SEG_W + 1)
    const ph = (ix / SEG_W) * Math.PI * 2
    const th = (iy / SEG_H) * Math.PI
    T[i - i0] = traceSurface(headSDF, HEAD_O.x, HEAD_O.y, HEAD_O.z, -Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th), HEAD_T_MAX)
  }
  return T
}

export function skinMask(x: number, y: number, z: number) {
  const front = smooth(0.18, 0.46, z)
  const top = smooth(0.26, 0.50, y)
  const noise = (vnoise(x * 7, y * 7, 4.4) - 0.5) * 0.12
  const upper = Math.hypot(x / 0.68, (y - 0.12) / 0.46)
  const lower = Math.hypot(x / 0.48, (y + 0.44) / 0.44)
  const e = smin(upper, lower, 0.34) + noise * (0.4 + 0.6 * top)
  return (1 - smooth(lerp(0.76, 0.64, top), lerp(1.02, 1.10, top), e)) * front
}

/**
 * Paints rows r0..r1 of the head's skin maps (albedo, roughness, fur control and a height
 * field for the normal map) from the head mesh's ray distances T. Rows are independent, so
 * the work splits across workers.
 */
export function paintSkinRows(T: Float32Array, r0: number, r1: number) {
  const W = SEG_W, H = SEG_H, TW = SKIN_W, TH = SKIN_H, o = HEAD_O
  const cosP = new Float32Array(TW)
  const sinP = new Float32Array(TW)
  for (let c = 0; c < TW; c++) {
    const ph = ((c + 0.5) / TW) * Math.PI * 2
    cosP[c] = Math.cos(ph)
    sinP[c] = Math.sin(ph)
  }

  const N = TW * (r1 - r0)
  const height = new Float32Array(N)
  const albedo = new Uint8Array(N * 4)
  const rough = new Uint8Array(N * 4)
  const fur = new Uint8Array(N * 4)

  for (let r = r0; r < r1; r++) {
    const vrow = 1 - (r + 0.5) / TH
    const th = vrow * Math.PI
    const st = Math.sin(th)
    const ct = Math.cos(th)
    const fy = vrow * H
    const iy = Math.min(H - 1, fy | 0)
    const wy = fy - iy
    for (let c = 0; c < TW; c++) {
      const fx = ((c + 0.5) / TW) * W
      const ix = Math.min(W - 1, fx | 0)
      const wx = fx - ix
      const i00 = iy * (W + 1) + ix
      const t = lerp(lerp(T[i00], T[i00 + 1], wx), lerp(T[i00 + W + 1], T[i00 + W + 2], wx), wy)
      const x = o.x - cosP[c] * st * t
      const y = o.y + ct * t
      const z = o.z + sinP[c] * st * t
      const ax = Math.abs(x)
      const k = (r - r0) * TW + c
      const p = k * 4

      const m = skinMask(x, y, z)
      let h = 0
      let cav = 0
      let rg = 0.88

      const streak = hash3((x * 70) | 0, (y * 9 + z * 6) | 0, (z * 70) | 0)
      const hf = (streak - 0.5) * 0.32

      if (m > 0.001) {
        let w = 0
        const fh = (y - 0.35 + 0.22 * x * x) * 16
        w +=
          0.48 *
          crease(fh, 0.15) *
          smooth(0.31, 0.37, y) *
          (1 - smooth(0.58, 0.68, y)) *
          (1 - smooth(0.32, 0.56, ax)) *
          (0.55 + 0.45 * vnoise(x * 6, y * 2, 3.1))
        const ro = Math.hypot((ax - 0.27) * 1.1, (y - 0.11) / 0.82) + (vnoise(x * 9, y * 9, 1.3) - 0.5) * 0.045
        w +=
          0.36 *
          crease((ro - 0.15) * 18, 0.17) *
          smooth(0.14, 0.19, ro) *
          (1 - smooth(0.34, 0.44, ro)) *
          smooth(0.06, -0.02, y) *
          (0.45 + 0.55 * vnoise(x * 5, y * 3, 7.7))
        const cr = Math.hypot(ax - 0.58, y - 0.10)
        const ca = Math.atan2(y - 0.10, ax - 0.58)
        w += 0.32 * crease(ca * 2.6, 0.16) * smooth(0.03, 0.08, cr) * (1 - smooth(0.16, 0.26, cr))
        w += 0.28 * crease(y * 34, 0.16) * (1 - smooth(0.07, 0.14, ax)) * smooth(-0.02, 0.05, y) * (1 - smooth(0.22, 0.28, y))
        const lipFan = (x / (0.78 - (y + 0.38) * 0.45)) * 22 + (vnoise(x * 8, y * 5, 6.1) - 0.5) * 0.9
        w +=
          0.2 *
          crease(lipFan, 0.17) *
          (0.45 + 0.55 * vnoise(x * 5, y * 3, 4.2)) *
          smooth(-0.60, -0.52, y) *
          (1 - smooth(-0.20, -0.14, y)) *
          (1 - smooth(0.28, 0.42, ax)) *
          smooth(0.88, 1.02, z)
        const fm = (y + 0.22 + 0.28 * x * x) * 15
        w +=
          0.18 *
          crease(fm + (vnoise(x * 6, y * 4, 2.2) - 0.5) * 1.1, 0.15) *
          (0.35 + 0.65 * vnoise(x * 4.5, y * 2, 9.4)) *
          smooth(-0.54, -0.46, y) *
          (1 - smooth(-0.22, -0.16, y)) *
          (1 - smooth(0.26, 0.40, ax))
        w += 0.20 * Math.exp(-Math.pow(x / 0.036, 2)) * smooth(-0.56, -0.46, y) * (1 - smooth(-0.20, -0.15, y))
        const nl = Math.hypot(ax - 0.74, y + 0.34)
        w += 0.58 * Math.exp(-Math.pow((nl - 0.54) / 0.038, 2)) * smooth(-0.70, -0.58, y) * (1 - smooth(-0.08, -0.02, y))
        const ly = y - smirk(x)
        const lips = (1 - smooth(0.30, 0.40, ax)) * smooth(-0.82, -0.75, ly) * (1 - smooth(-0.52, -0.48, ly)) * smooth(0.94, 1.04, z)
        w += 0.12 * crease(x * 54 + 0.35 * Math.sin(ly * 30), 0.2) * lips
        // The slit between the lips: a sharp dark crease, the upper lip rolling over it
        const slit = Math.max(
          Math.exp(-Math.pow((ly + 0.6) / 0.014, 2)) * (1 - smooth(0.33, 0.4, ax)) * smooth(0.92, 1.0, z),
          Math.exp(-(Math.pow((x - CIG_X) / 0.05, 2) + Math.pow((ly + 0.6) / 0.03, 2)))
        )
        w += 1.1 * slit + 0.25 * Math.exp(-Math.pow((ly + 0.575) / 0.03, 2)) * slit
        w += 0.48 * Math.exp(-Math.pow((Math.hypot(x - 0.38, y + 0.55) - 0.055) / 0.018, 2)) * smooth(0.24, 0.32, x)
        const chin = smooth(-0.78, -0.88, y) * (1 - smooth(0.26, 0.42, ax))
        const bumps = fbm3(x * 26, y * 26, z * 26, 3)

        const pores = vnoise(x * 155, y * 155, z * 155) - 0.5
        const broad = fbm3(x * 7, y * 7, z * 7, 3) - 0.5

        h = -w * 0.56 + pores * 0.065 + broad * 0.12 + (bumps - 0.5) * 0.22 * chin
        cav = sat(w * 0.95)

        const noseWing = Math.exp(-Math.pow(Math.hypot(x / 1.2, (y + 0.10) / 0.7) / 0.18, 2))
        const cheekHi = Math.exp(-Math.pow(Math.hypot(ax - 0.36, y + 0.06) / 0.22, 2))
        rg = 0.48 + cav * 0.24 - noseWing * 0.14 - cheekHi * 0.10 - lips * 0.22 + pores * 0.06
        // No shine down inside the slit, so it reads as a dark line even under the lights
        rg = lerp(rg, 0.95, Math.min(1, slit * 1.4))

        const skinBlend = smooth(0.12, 0.52, m)
        h = lerp(hf, h, skinBlend)
        rg = lerp(0.88, rg, skinBlend)
      } else {
        h = hf
      }
      height[k] = h

      const fv = 13 + (streak - 0.5) * 11
      let sr = fv + 1
      let sg = fv
      let sb = fv
      if (m > 0.001) {
        const mottle = fbm3(x * 4.5, y * 4.5, z * 4.5, 3)
        let kr = 116 + (mottle - 0.5) * 24
        let kg = 84 + (mottle - 0.5) * 18
        let kb = 66 + (mottle - 0.5) * 14
        const muzzleWarm = Math.exp(-Math.pow(Math.hypot(x / 0.42, (y + 0.30) / 0.34), 2)) * smooth(0.9, 1.08, z)
        kr += muzzleWarm * 14
        kg += muzzleWarm * 9
        kb += muzzleWarm * 5

        const dark = 1 - 0.64 * cav
        kr *= dark
        kg *= dark * 0.95
        kb *= dark * 0.90

        const nx = (ax - 0.090) * 0.90 + (y + 0.122) * 0.42
        const ny = -(ax - 0.090) * 0.42 + (y + 0.122) * 0.90
        const nostrilCav = Math.exp(-((nx * nx) / (0.044 * 0.044) + (ny * ny) / (0.060 * 0.060))) * smooth(1.04, 1.11, z)
        kr = lerp(kr, 12, nostrilCav * 0.94)
        kg = lerp(kg, 9, nostrilCav * 0.94)
        kb = lerp(kb, 8, nostrilCav * 0.94)

        const ly2 = y - smirk(x)
        const lipTone = (1 - smooth(0.30, 0.40, ax)) * smooth(-0.82, -0.75, ly2) * (1 - smooth(-0.54, -0.50, ly2))
        kr = lerp(kr, 96, lipTone * 0.45)
        kg = lerp(kg, 66, lipTone * 0.45)
        kb = lerp(kb, 56, lipTone * 0.45)

        // A dark line inside the slit with a soft shadow either side of it
        const lipSpan = (1 - smooth(0.34, 0.41, ax)) * smooth(0.92, 1.02, z)
        const gap = Math.exp(-(Math.pow((x - CIG_X) / 0.055, 2) + Math.pow((ly2 + 0.6) / 0.034, 2)))
        const mline = Math.max(Math.exp(-Math.pow((ly2 + 0.60) / 0.018, 2)) * lipSpan, gap)
        const mshade = Math.exp(-Math.pow((ly2 + 0.60) / 0.05, 2)) * lipSpan
        const mdark = 1 - Math.min(0.97, 0.97 * mline + 0.4 * mshade)
        kr *= mdark
        kg *= mdark
        kb *= mdark

        const sock = Math.exp(-Math.pow(Math.hypot(ax - 0.28, (y - 0.11) / 0.7) / 0.2, 2))
        kr *= 1 - 0.38 * sock
        kg *= 1 - 0.38 * sock
        kb *= 1 - 0.38 * sock

        const skinColorBlend = smooth(0.32, 0.68, m)
        sr = lerp(fv + 1, kr, skinColorBlend)
        sg = lerp(fv, kg, skinColorBlend)
        sb = lerp(fv, kb, skinColorBlend)
      }
      albedo[p] = clamp(sr, 0, 255)
      albedo[p + 1] = clamp(sg, 0, 255)
      albedo[p + 2] = clamp(sb, 0, 255)
      albedo[p + 3] = 255

      const rv = clamp(rg, 0.05, 1) * 255
      rough[p] = rough[p + 1] = rough[p + 2] = rv
      rough[p + 3] = 255

      const len = 0.48 + 0.48 * smooth(0.32, 0.82, y) + 0.42 * smooth(-0.32, -0.78, y) * (1 - smooth(0.65, 0.95, z))
      const dens = (1 - smooth(0.06, 0.38, m)) * (1 - smooth(-1.00, -1.24, y))
      const edge = 0.20 + 0.80 * (1 - smooth(0.02, 0.36, m))
      fur[p] = sat(dens) * 255
      fur[p + 1] = sat(len * edge) * 255
      fur[p + 2] = sat(smooth(0.28, 0.50, y) * smooth(0.10, 0.45, z)) * 255
      fur[p + 3] = 255
    }
  }
  return { height, albedo, rough, fur }
}

/** Tangent-space normal map from the painted height field. */
export function normalFromHeight(height: Float32Array) {
  const TW = SKIN_W, TH = SKIN_H, N = TW * TH
  const normal = new Uint8Array(N * 4)
  const S = 3.2
  for (let r = 0; r < TH; r++) {
    const rU = Math.min(TH - 1, r + 1)
    const rD = Math.max(0, r - 1)
    for (let c = 0; c < TW; c++) {
      const cR = (c + 1) % TW
      const cL = (c - 1 + TW) % TW
      const du = (height[r * TW + cR] - height[r * TW + cL]) * S
      const dv = (height[rU * TW + c] - height[rD * TW + c]) * S
      const il = 1 / Math.hypot(du, dv, 1)
      const p = (r * TW + c) * 4
      normal[p] = (-du * il * 0.5 + 0.5) * 255
      normal[p + 1] = (-dv * il * 0.5 + 0.5) * 255
      normal[p + 2] = (il * 0.5 + 0.5) * 255
      normal[p + 3] = 255
    }
  }
  return normal
}
