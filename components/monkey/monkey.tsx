"use client"

import * as THREE from "three"
import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BODY, BODY_WAIST, ember as emberWorld, MONKEY_SCALE, mouth as mouthWorld, scroll, smooth, SMASH, travel, walkWeight } from "./store"

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const sat = (v: number) => clamp(v, 0, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const hdr = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(i: number, j: number, k: number) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function vnoise(x: number, y: number, z: number) {
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

function fbm3(x: number, y: number, z: number, oct: number) {
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

const crease = (f: number, w: number) => {
  const g = f - Math.round(f)
  return Math.exp(-(g * g) / (w * w))
}

function sdE(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const x = (px - cx) / rx
  const y = (py - cy) / ry
  const z = (pz - cz) / rz
  const k0 = Math.sqrt(x * x + y * y + z * z)
  const k1 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz))
  return k1 < 1e-6 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

function sdCap(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
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

function sdRB(px: number, py: number, pz: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number) {
  const qx = Math.abs(px - cx) - hx + r
  const qy = Math.abs(py - cy) - hy + r
  const qz = Math.abs(pz - cz) - hz + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)

const smirk = (x: number) => 0.085 * smooth(-0.12, 0.42, x)

function headSDF(x: number, y: number, z: number) {
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
  d = smin(d, sdE(x, y, z, 0, -0.76, 0.60, 0.50, 0.32, 0.48), 0.2)
  d = smin(d, sdCap(x, y, z, 0, -0.75, -0.08, 0, -1.75, -0.10, 0.44), 0.24)
  return Math.max(d, -(y + 1.65))
}

function earGeometry() {
  const NR = 28
  const NT = 72
  const RY = 0.38
  const RZ = 0.29
  const front = (r: number) => {
    const rim = 0.82
    return r < rim
      ? 0.048 - 0.085 * (1 - (r / rim) * (r / rim))
      : 0.048 * Math.cos((((r - rim) / (1 - rim)) * Math.PI) / 2)
  }
  const back = (r: number) => -0.038 * Math.sqrt(Math.max(0, 1 - r * r))
  const P: number[] = []
  const I: number[] = []
  const vert = (r: number, th: number, isFront: boolean) => {
    const sy = Math.sin(th)
    const cz = Math.cos(th)
    const ry = RY * (sy < 0 ? 1.08 : 0.95)
    const y = ry * r * sy
    const z = RZ * r * cz
    let x = isFront ? front(r) : back(r)
    if (isFront) {
      x += 0.022 * Math.exp(-Math.pow((r - 0.58) / 0.09, 2)) * smooth(0.3, -0.65, cz)
      x += 0.020 * Math.exp(-Math.pow((r - 0.42) / 0.10, 2)) * smooth(-0.1, 0.55, cz) * smooth(0.1, -0.4, sy)
    }
    P.push(x, y, z)
  }
  for (const f of [true, false]) {
    for (let i = 0; i <= NR; i++) {
      for (let j = 0; j < NT; j++) {
        vert(Math.max(i / NR, 0.001), (j / NT) * Math.PI * 2, f)
      }
    }
  }
  const at = (f: number, i: number, j: number) => f * (NR + 1) * NT + i * NT + (j % NT)
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < NR; i++) {
      for (let j = 0; j < NT; j++) {
        const a = at(f, i, j)
        const b = at(f, i + 1, j)
        const c = at(f, i + 1, j + 1)
        const d = at(f, i, j + 1)
        if (f === 0) I.push(a, b, c, a, c, d)
        else I.push(a, c, b, a, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
  g.setIndex(I)
  g.computeVertexNormals()
  return g
}

function projectSphere(sdf: (x: number, y: number, z: number) => number, W: number, H: number, o: THREE.Vector3, tMax: number) {
  const g = new THREE.SphereGeometry(1, W, H)
  const pos = g.attributes.position
  const T = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i)
    const dy = pos.getY(i)
    const dz = pos.getZ(i)
    let t = tMax
    let d = sdf(o.x + dx * t, o.y + dy * t, o.z + dz * t)
    for (let k = 0; k < 160 && d > 1e-4; k++) {
      t -= Math.max(d * 0.8, 0.002)
      if (t <= 0.01) {
        t = 0.01
        break
      }
      d = sdf(o.x + dx * t, o.y + dy * t, o.z + dz * t)
    }
    let lo = t
    let hi = Math.min(t + 0.02, tMax)
    for (let k = 0; k < 14; k++) {
      const m = (lo + hi) * 0.5
      if (sdf(o.x + dx * m, o.y + dy * m, o.z + dz * m) < 0) lo = m
      else hi = m
    }
    t = (lo + hi) * 0.5
    T[i] = t
    pos.setXYZ(i, o.x + dx * t, o.y + dy * t, o.z + dz * t)
  }
  g.computeVertexNormals()
  return { geo: g, T }
}

function skinMask(x: number, y: number, z: number) {
  const front = smooth(0.18, 0.46, z)
  const top = smooth(0.26, 0.50, y)
  const noise = (vnoise(x * 7, y * 7, 4.4) - 0.5) * 0.12
  const upper = Math.hypot(x / 0.68, (y - 0.12) / 0.46)
  const lower = Math.hypot(x / 0.48, (y + 0.44) / 0.44)
  const e = smin(upper, lower, 0.34) + noise * (0.4 + 0.6 * top)
  return (1 - smooth(lerp(0.76, 0.64, top), lerp(1.02, 1.10, top), e)) * front
}

function paintSkin(proj: { geo: THREE.BufferGeometry; T: Float32Array }, W: number, H: number, o: THREE.Vector3, TW: number, TH: number) {
  const T = proj.T
  const cosP = new Float32Array(TW)
  const sinP = new Float32Array(TW)
  for (let c = 0; c < TW; c++) {
    const ph = ((c + 0.5) / TW) * Math.PI * 2
    cosP[c] = Math.cos(ph)
    sinP[c] = Math.sin(ph)
  }

  const N = TW * TH
  const height = new Float32Array(N)
  const albedo = new Uint8Array(N * 4)
  const rough = new Uint8Array(N * 4)
  const fur = new Uint8Array(N * 4)

  for (let r = 0; r < TH; r++) {
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
      const k = r * TW + c
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
          0.34 *
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
        w += 0.26 * crease(x * 54 + 0.35 * Math.sin(ly * 30), 0.2) * lips
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
        const mline = Math.exp(-Math.pow((ly2 + 0.60) / 0.024, 2)) * lipSpan
        const mshade = Math.exp(-Math.pow((ly2 + 0.60) / 0.06, 2)) * lipSpan
        const mdark = 1 - Math.min(0.95, 0.9 * mline + 0.32 * mshade)
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
  return { albedo, normal, rough, fur }
}

function poreMap(size: number) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y * size + x] = vnoise(x * 0.35, y * 0.35, 1.7) * 0.6 + vnoise(x * 0.09, y * 0.09, 4.2) * 0.4
    }
  }
  const out = new Uint8Array(size * size * 4)
  const S = 1.6
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const du = (h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)]) * S
      const dv = (h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]) * S
      const il = 1 / Math.hypot(du, dv, 1)
      const p = (y * size + x) * 4
      out[p] = (-du * il * 0.5 + 0.5) * 255
      out[p + 1] = (-dv * il * 0.5 + 0.5) * 255
      out[p + 2] = (il * 0.5 + 0.5) * 255
      out[p + 3] = 255
    }
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

function dataTex(arr: Uint8Array, W: number, H: number, o?: { srgb?: boolean }) {
  const t = new THREE.DataTexture(arr, W, H, THREE.RGBAFormat)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  if (o?.srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x020203)
  const panel = (w: number, h: number, c: THREE.Color, pos: number[], look: number[]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })
    )
    m.position.set(pos[0], pos[1], pos[2])
    m.lookAt(look[0], look[1], look[2])
    env.add(m)
  }
  panel(6, 4, hdr(5, 5, 5.2), [-5, 6, 5], [0, 0, 0])
  panel(3, 8, hdr(1.4, 1.4, 1.5), [-6, 1, -5], [0, 0, 0])
  panel(3, 8, hdr(1.6, 1.6, 1.7), [6, 1.5, -5], [0, 0, 0])
  panel(10, 0.6, hdr(2.4, 0.25, 0.2), [0, -1, 7], [0, 0, 0])
  panel(20, 20, hdr(0.06, 0.06, 0.07), [0, -8, 0], [0, 0, 0])
  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(env, 0.02)
  pm.dispose()
  return rt.texture
}

const O = new THREE.Vector3(0, -0.1, 0.15)
const SEG_W = 256
const SEG_H = 192

const DEFORM_GLSL = [
  "uniform float uDraw; uniform float uPuff;",
  "vec3 muzzleDeform(vec3 p){",
  "  float ax = abs(p.x);",
  "  vec3 c = (vec3(ax, p.y, p.z) - vec3(0.42, -0.36, 0.68)) / vec3(0.17, 0.16, 0.2);",
  "  float ch = exp(-dot(c, c));",
  "  float inward = ch * (0.035 * uDraw - 0.016 * uPuff);",
  "  p.x -= sign(p.x) * inward * 0.8; p.z -= inward * 0.4;",
  "  float lip = exp(-pow(ax / 0.3, 4.0)) * exp(-pow((p.y + 0.62) / 0.13, 2.0)) * smoothstep(0.9, 1.05, p.z);",
  "  p.x *= 1.0 - 0.1 * uDraw * lip;",
  "  p.z += 0.025 * uDraw * lip + 0.01 * uPuff * lip;",
  "  p.y -= 0.024 * uPuff * lip * smoothstep(-0.6, -0.7, p.y);",
  "  return p;",
  "}",
].join("\n")

const FUR_VS = [
  DEFORM_GLSL,
  "uniform float uLevel; uniform float uLen; uniform float uDroop; uniform sampler2D tFur;",
  "varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDens;",
  "void main(){",
  "  vUv = uv;",
  "  vec4 f = texture2D(tFur, uv);",
  "  float len = uLen * (0.25 + f.g);",
  "  vec3 p = muzzleDeform(position) + normal * len * uLevel;",
  "  vec3 lie = normalize(mix(vec3(0.0, -0.95, -0.55), vec3(0.0, 0.15, -1.0), f.b));",
  "  p += lie * len * uLevel * uLevel * uDroop;",
  "  vec4 w = modelMatrix * vec4(p, 1.0);",
  "  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vDens = f.r;",
  "  gl_Position = projectionMatrix * viewMatrix * w;",
  "}",
].join("\n")

const FUR_FS = [
  "uniform float uLevel; uniform vec2 uRep; uniform float uGuard; uniform float uRad;",
  "uniform vec3 uKeyDir; uniform vec3 uKey; uniform vec3 uAmb; uniform vec3 uRim; uniform vec3 uRoot; uniform vec3 uTip;",
  "varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDens;",
  "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }",
  "void main(){",
  "  if (vDens < 0.03) discard;",
  "  vec2 g = vUv * uRep;",
  "  vec2 cell = floor(g); vec2 fr = fract(g) - 0.5;",
  "  fr += (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.52;",
  "  if (hash(cell + 11.3) > smoothstep(0.0, 0.85, vDens)) discard;",
  "  float h = hash(cell);",
  "  if (uGuard > 0.5) {",
  "    if (hash(cell + 23.1) < 0.84) discard;",
  "    h = 0.45 + 0.55 * h;",
  "  } else {",
  "    h *= 0.65 + 0.35 * hash(floor(cell / 5.0) + 5.0);",
  "  }",
  "  if (h < uLevel) discard;",
  "  float rad = uRad * (1.0 - uLevel * 0.82) * mix(0.22, 1.0, smoothstep(0.05, 0.75, vDens));",
  "  if (dot(fr, fr) > rad * rad) discard;",
  "  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);",
  "  float diff = pow(clamp(dot(N, uKeyDir) * 0.5 + 0.5, 0.0, 1.0), 1.8);",
  "  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);",
  "  vec3 base = mix(uRoot, uTip, pow(uLevel, 1.25));",
  "  vec3 c = base * (uAmb + uKey * diff) + uRim * rim * pow(uLevel, 1.35);",
  "  c *= mix(0.42, 1.0, uLevel);",
  "  gl_FragColor = vec4(c, 1.0);",
  "}",
].join("\n")

function rayHit(sdf: (x: number, y: number, z: number) => number, ox: number, oy: number, oz: number, dx: number, dz: number, tMax: number) {
  let t = tMax
  for (let k = 0; k < 200; k++) {
    const d = sdf(ox + dx * t, oy, oz + dz * t)
    if (d < 1e-4) break
    t -= Math.max(d * 0.8, 0.002)
    if (t < 0.01) return 0.01
  }
  return t
}

function mouthCorner(x: number, y: number) {
  let z = 2
  for (let k = 0; k < 240; k++) {
    const d = headSDF(x, y, z)
    if (d < 1e-4) break
    z -= Math.max(d * 0.8, 0.002)
  }
  return new THREE.Vector3(x, y, z)
}

const FLOOR_Y = -7.85

function tiledNormal(size: number, heightAt: (u: number, v: number, x: number, y: number) => number, strength: number) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y * size + x] = heightAt(x / size, y / size, x, y)
    }
  }
  const out = new Uint8Array(size * size * 4)
  const S = strength
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const du = (h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)]) * S
      const dv = (h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]) * S
      const il = 1 / Math.hypot(du, dv, 1)
      const p = (y * size + x) * 4
      out[p] = (-du * il * 0.5 + 0.5) * 255
      out[p + 1] = (-dv * il * 0.5 + 0.5) * 255
      out[p + 2] = (il * 0.5 + 0.5) * 255
      out[p + 3] = 255
    }
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

const withRepeat = (tex: THREE.DataTexture, u: number, v: number) => {
  const t = tex.clone()
  t.repeat.set(u, v)
  t.needsUpdate = true
  return t
}

function fabrics() {
  const wool = tiledNormal(
    256,
    (u, v, x, y) =>
      0.5 + 0.24 * Math.sin(u * Math.PI * 2 * 42) * Math.cos(v * Math.PI * 2 * 42) + (vnoise(x * 0.6, y * 0.6, 1.4) - 0.5) * 0.35,
    1.7
  )
  const twill = tiledNormal(
    256,
    (u, v, x, y) => {
      const diag = 0.28 * Math.sin((u * 28 + v * 28) * Math.PI * 2)
      const stripe = 0.18 * Math.pow(Math.max(0, Math.cos(u * Math.PI * 2 * 16)), 12)
      return 0.5 + diag + stripe + (vnoise(x * 0.5, y * 0.5, 2.3) - 0.5) * 0.22
    },
    1.9
  )
  const poplin = tiledNormal(
    256,
    (u, v, x, y) =>
      0.5 + 0.15 * Math.sin(u * Math.PI * 2 * 64) * Math.sin(v * Math.PI * 2 * 64) + (vnoise(x * 0.8, y * 0.8, 3.7) - 0.5) * 0.18,
    1.1
  )
  const grain = tiledNormal(
    256,
    (_u, _v, x, y) => vnoise(x * 0.35, y * 0.35, 4.4) * 0.6 + vnoise(x * 0.08, y * 0.08, 5.1) * 0.4,
    2.0
  )
  return { wool, twill, poplin, grain }
}

function bodyMaterials(env: THREE.Texture) {
  const F = fabrics()
  const armorWear = wearMaps(11, 0.17, 0.5, 90)
  const chromeWear = wearMaps(23, 0.82, 0.55, 30)
  const brassWear = wearMaps(37, 0.7, 0.7, 20)
  return {
    F,
    coat: new THREE.MeshPhysicalMaterial({
      color: hdr(0.011, 0.011, 0.014),
      roughness: 0.75,
      metalness: 0.02,
      sheen: 0.10,
      sheenRoughness: 0.58,
      sheenColor: hdr(0.022, 0.024, 0.032),
      normalMap: withRepeat(F.wool, 8, 16),
      normalScale: new THREE.Vector2(0.75, 0.75),
      envMap: env,
      envMapIntensity: 0.36,
      side: THREE.DoubleSide,
    }),
    lapel: new THREE.MeshPhysicalMaterial({
      color: hdr(0.013, 0.013, 0.017),
      roughness: 0.68,
      metalness: 0.03,
      sheen: 0.14,
      sheenRoughness: 0.52,
      sheenColor: hdr(0.028, 0.032, 0.042),
      normalMap: withRepeat(F.wool, 5, 10),
      normalScale: new THREE.Vector2(0.62, 0.62),
      envMap: env,
      envMapIntensity: 0.40,
      side: THREE.DoubleSide,
    }),
    seamWelt: new THREE.MeshPhysicalMaterial({
      color: hdr(0.017, 0.018, 0.023),
      roughness: 0.58,
      metalness: 0.04,
      sheen: 0.18,
      sheenRoughness: 0.45,
      sheenColor: hdr(0.035, 0.038, 0.050),
      envMap: env,
      envMapIntensity: 0.44,
      side: THREE.DoubleSide,
    }),
    vest: new THREE.MeshPhysicalMaterial({
      color: hdr(0.014, 0.014, 0.018),
      roughness: 0.72,
      metalness: 0.03,
      sheen: 0.10,
      sheenRoughness: 0.55,
      sheenColor: hdr(0.024, 0.026, 0.034),
      normalMap: withRepeat(F.twill, 6, 10),
      normalScale: new THREE.Vector2(0.68, 0.68),
      envMap: env,
      envMapIntensity: 0.38,
      side: THREE.DoubleSide,
    }),
    lining: new THREE.MeshStandardMaterial({
      color: hdr(0.055, 0.006, 0.009),
      emissive: hdr(0.010, 0.001, 0.001),
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
    dressShirt: new THREE.MeshPhysicalMaterial({
      color: hdr(0.27, 0.28, 0.31),
      roughness: 0.62,
      metalness: 0.01,
      clearcoat: 0.03,
      normalMap: withRepeat(F.poplin, 8, 8),
      normalScale: new THREE.Vector2(0.32, 0.32),
      envMap: env,
      envMapIntensity: 0.32,
      side: THREE.DoubleSide,
    }),
    tie: new THREE.MeshPhysicalMaterial({
      color: hdr(0.13, 0.009, 0.018),
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.22,
      clearcoatRoughness: 0.28,
      normalMap: withRepeat(F.twill, 8, 12),
      normalScale: new THREE.Vector2(0.28, 0.28),
      envMap: env,
      envMapIntensity: 0.65,
      side: THREE.DoubleSide,
    }),
    button: new THREE.MeshPhysicalMaterial({
      color: hdr(0.018, 0.018, 0.022),
      roughness: 0.26,
      metalness: 0.45,
      clearcoat: 0.75,
      envMap: env,
      envMapIntensity: 0.85,
    }),
    // Cyber arm: gloss graphite armour plates over a dark synthetic-muscle core
    // Graphite paint over bare metal: the wear map darkens the base to graphite and leaves
    // chips and scratches at the full, bright metal colour
    armor: new THREE.MeshPhysicalMaterial({
      color: hdr(0.3, 0.31, 0.33),
      map: armorWear.map,
      metalness: 0.85,
      roughness: 1,
      roughnessMap: armorWear.rough,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMap: env,
      envMapIntensity: 1.5,
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: hdr(0.62, 0.4, 0.14),
      map: brassWear.map,
      metalness: 1,
      roughness: 1,
      roughnessMap: brassWear.rough,
      envMap: env,
      envMapIntensity: 1.2,
    }),
    armorCore: new THREE.MeshPhysicalMaterial({
      color: hdr(0.012, 0.01, 0.012),
      metalness: 0.6,
      roughness: 0.5,
      sheen: 0.4,
      sheenRoughness: 0.4,
      sheenColor: hdr(0.25, 0.02, 0.02),
      normalMap: withRepeat(F.twill, 3, 12),
      normalScale: new THREE.Vector2(0.6, 0.6),
      envMap: env,
      envMapIntensity: 0.6,
    }),
    fiber: new THREE.MeshPhysicalMaterial({
      color: hdr(0.09, 0.012, 0.014),
      emissive: hdr(0.06, 0.004, 0.004),
      metalness: 0.3,
      roughness: 0.3,
      clearcoat: 0.8,
      envMap: env,
      envMapIntensity: 0.9,
    }),
    neon: new THREE.MeshBasicMaterial({ color: hdr(4.2, 0.11, 0.06), toneMapped: false }),
    neonSoft: new THREE.MeshBasicMaterial({ color: hdr(1.6, 0.04, 0.03), toneMapped: false }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: hdr(0.78, 0.81, 0.86),
      map: chromeWear.map,
      metalness: 1,
      roughness: 1,
      roughnessMap: chromeWear.rough,
      clearcoat: 0.6,
      clearcoatRoughness: 0.14,
      envMap: env,
      envMapIntensity: 1.4,
    }),
    chromeDark: new THREE.MeshPhysicalMaterial({
      color: hdr(0.065, 0.070, 0.082),
      metalness: 0.92,
      roughness: 0.32,
      clearcoat: 0.28,
      envMap: env,
      envMapIntensity: 1.0,
    }),
    pants: new THREE.MeshPhysicalMaterial({
      color: hdr(0.015, 0.015, 0.019),
      roughness: 0.78,
      metalness: 0.02,
      clearcoat: 0,
      normalMap: withRepeat(F.twill, 7, 14),
      normalScale: new THREE.Vector2(0.62, 0.62),
      envMap: env,
      envMapIntensity: 0.35,
    }),
    strap: new THREE.MeshPhysicalMaterial({
      color: hdr(0.012, 0.011, 0.012),
      roughness: 0.42,
      clearcoat: 0.35,
      normalMap: withRepeat(F.grain, 4, 8),
      normalScale: new THREE.Vector2(0.4, 0.4),
      envMap: env,
      envMapIntensity: 0.55,
    }),
    // Polished calf: a fine grain under a high-gloss shine
    boot: new THREE.MeshPhysicalMaterial({
      color: hdr(0.009, 0.008, 0.009),
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      normalMap: withRepeat(F.grain, 7, 7),
      normalScale: new THREE.Vector2(0.14, 0.14),
      envMap: env,
      envMapIntensity: 0.7,
    }),
    // Dark leather sole edge, burnished
    sole: new THREE.MeshPhysicalMaterial({
      color: hdr(0.022, 0.014, 0.01),
      roughness: 0.62,
      envMap: env,
      envMapIntensity: 0.2,
    }),
    furHand: new THREE.MeshStandardMaterial({
      color: hdr(0.016, 0.015, 0.014),
      roughness: 0.84,
      normalMap: withRepeat(F.wool, 6, 6),
    }),
    skinHand: new THREE.MeshPhysicalMaterial({
      color: hdr(0.075, 0.046, 0.034),
      roughness: 0.54,
      clearcoat: 0.08,
      envMap: env,
      envMapIntensity: 0.28,
    }),
    guitarWood: new THREE.MeshPhysicalMaterial({
      color: hdr(0.026, 0.013, 0.009),
      roughness: 0.24,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      envMap: env,
      envMapIntensity: 0.9,
    }),
  }
}

type BodyMats = ReturnType<typeof bodyMaterials>

function tubeGeometry(pts: THREE.Vector3[], radius: (t: number, th: number) => number, radial: number, seg: number) {
  const raw = [pts[0].clone()]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceToSquared(raw[raw.length - 1]) > 1e-6) raw.push(pts[i].clone())
  }
  if (raw.length === 2) {
    raw.splice(1, 0, raw[0].clone().lerp(raw[1], 0.5).add(v3(1e-4, 1e-4, -1e-4)))
  }
  const clean = raw.map((p, i) => {
    const c = p.clone()
    c.x += Math.sin(i * 1.7 + 0.3) * 1e-4
    c.z += Math.cos(i * 2.3 + 0.7) * 1e-4
    return c
  })
  const curve = new THREE.CatmullRomCurve3(clean, false, "centripetal")
  const fr = curve.computeFrenetFrames(seg, false)
  const P: number[] = []
  const UV: number[] = []
  const I: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const c = curve.getPointAt(t)
    let n = fr.normals[i]
    let b = fr.binormals[i]
    if (
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      !Number.isFinite(n.z) ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.y) ||
      !Number.isFinite(b.z)
    ) {
      n = v3(1, 0, 0)
      b = v3(0, 0, 1)
    }
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2
      const r = radius(t, th)
      const cx = Math.cos(th)
      const sx = Math.sin(th)
      P.push(c.x + (cx * n.x + sx * b.x) * r, c.y + (cx * n.y + sx * b.y) * r, c.z + (cx * n.z + sx * b.z) * r)
      UV.push(j / radial, t)
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = a + radial + 1
      I.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2))
  g.setIndex(I)
  g.computeVertexNormals()
  return g
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadow?: boolean) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = shadow !== false
  m.receiveShadow = true
  return m
}

function ball(p: THREE.Vector3, r: number, mat: THREE.Material, s?: number[]) {
  const m = mesh(new THREE.SphereGeometry(1, 32, 24), mat)
  m.position.copy(p)
  m.scale.set(r * (s ? s[0] : 1), r * (s ? s[1] : 1), r * (s ? s[2] : 1))
  return m
}

function ringAt(p: THREE.Vector3, d: THREE.Vector3, r: number, tube: number, mat: THREE.Material) {
  const m = mesh(new THREE.TorusGeometry(r, tube, 10, 48), mat, false)
  m.position.copy(p)
  m.quaternion.setFromUnitVectors(v3(0, 0, 1), d.clone().normalize())
  return m
}

function surfaceAlong(sdf: (x: number, y: number, z: number) => number, o: THREE.Vector3, d: THREE.Vector3, tMax: number) {
  let t = tMax
  for (let k = 0; k < 240; k++) {
    const dd = sdf(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)
    if (dd < 1e-4) break
    t -= Math.max(dd * 0.8, 0.002)
  }
  return o.clone().addScaledVector(d, t)
}

function solidClothShell(
  NR: number,
  NC: number,
  pointAt: (u: number, v: number, c: number, r: number) => THREE.Vector3,
  thickness: number,
  radialCenter?: THREE.Vector3
) {
  const stride = NC + 1
  const count = (NR + 1) * stride
  const outP = new Array<THREE.Vector3>(count)
  const N = new Array<THREE.Vector3>(count)
  for (let r = 0; r <= NR; r++) {
    const v = r / NR
    for (let c = 0; c <= NC; c++) {
      outP[r * stride + c] = pointAt(c / NC, v, c, r)
    }
  }
  const dU = new THREE.Vector3()
  const dV = new THREE.Vector3()
  let orientVotes = 0
  for (let r = 0; r <= NR; r++) {
    const r0 = Math.max(0, r - 1)
    const r1 = Math.min(NR, r + 1)
    for (let c = 0; c <= NC; c++) {
      const c0 = Math.max(0, c - 1)
      const c1 = Math.min(NC, c + 1)
      const p = outP[r * stride + c]
      dU.subVectors(outP[r * stride + c1], outP[r * stride + c0])
      dV.subVectors(outP[r1 * stride + c], outP[r0 * stride + c])
      const n = new THREE.Vector3().crossVectors(dV, dU)
      if (n.lengthSq() < 1e-10) n.set(0, 0, 1)
      else n.normalize()
      const refX = radialCenter ? p.x - radialCenter.x : p.x
      const refZ = radialCenter ? p.z - radialCenter.z : p.z + 0.05
      if (n.x * refX + n.z * refZ >= 0) orientVotes++
      else orientVotes--
      N[r * stride + c] = n
    }
  }
  const flip = orientVotes < 0
  if (flip) {
    for (let i = 0; i < count; i++) N[i].negate()
  }

  const P: number[] = []
  const UV: number[] = []
  const I: number[] = []
  for (let pass = 0; pass < 2; pass++) {
    const off = pass === 0 ? 0 : -thickness
    for (let r = 0; r <= NR; r++) {
      for (let c = 0; c <= NC; c++) {
        const idx = r * stride + c
        const p = outP[idx]
        const n = N[idx]
        P.push(p.x + n.x * off, p.y + n.y * off, p.z + n.z * off)
        UV.push(c / NC, r / NR)
      }
    }
  }
  const quad = (a: number, b: number, c: number, d: number, rev: boolean) => {
    if (rev) I.push(a, c, b, a, d, c)
    else I.push(a, b, c, a, c, d)
  }
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      const a = r * stride + c
      const b = a + 1
      const d = a + stride
      const e = d + 1
      quad(a, d, e, b, flip)
      quad(count + a, count + b, count + e, count + d, flip)
    }
  }
  for (let c = 0; c < NC; c++) {
    const t0 = c
    const t1 = c + 1
    quad(t0, t1, count + t1, count + t0, flip)
    const b0 = NR * stride + c
    const b1 = b0 + 1
    quad(b1, b0, count + b0, count + b1, flip)
  }
  for (let r = 0; r < NR; r++) {
    const l0 = r * stride
    const l1 = (r + 1) * stride
    quad(l1, l0, count + l0, count + l1, flip)
    const r0 = r * stride + NC
    const r1 = (r + 1) * stride + NC
    quad(r0, r1, count + r1, count + r0, flip)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2))
  g.setIndex(I)
  g.computeVertexNormals()
  return g
}

function torsoCrossSection(y: number, a: number, extraRx?: number, extraRz?: number) {
  const sx = Math.sin(a)
  const cz = Math.cos(a)
  const neckTaper = smooth(-1.62, -1.00, y)
  const chestFullness = smooth(-3.9, -1.5, y) * (1 - 0.68 * neckTaper)
  const waistTaper = Math.exp(-Math.pow((y + 3.60) / 0.70, 2))
  const hipFlare = smooth(-3.60, -4.35, y)
  const rx = 0.92 + 0.16 * chestFullness - 0.44 * neckTaper - 0.04 * waistTaper + 0.05 * hipFlare + (extraRx || 0)
  const rzFront = 0.53 + 0.09 * chestFullness - 0.18 * neckTaper - 0.03 * waistTaper + 0.03 * hipFlare + (extraRz || 0)
  const rzBack = 0.48 + 0.06 * chestFullness - 0.14 * neckTaper - 0.03 * waistTaper + 0.04 * hipFlare + (extraRz || 0)
  const rz = cz >= 0 ? rzFront : rzBack
  const sq = 1 + 0.06 * chestFullness * Math.sin(a * 2) * Math.sin(a * 2)
  return v3(sx * rx * sq, y, -0.04 + cz * rz * sq)
}

function buildJacket(M: BodyMats) {
  const g = new THREE.Group()

  const shirtBib = solidClothShell(
    24,
    24,
    (u, v) => {
      const y = lerp(-1.08, -2.42, v)
      const maxA = lerp(0.40, 0.46, smooth(0, 0.4, v))
      const a = lerp(-maxA, maxA, u)
      const p = torsoCrossSection(y, a, -0.038, -0.024)
      const placket = Math.abs(p.x) < 0.038 ? 0.005 : 0
      p.z += placket
      return p
    },
    0.012
  )
  g.add(mesh(shirtBib, M.dressShirt))

  const shirtStand = solidClothShell(
    10,
    32,
    (u, v) => {
      const a = lerp(-0.80, 0.80, u)
      const y = lerp(-0.98, -1.28, v)
      return torsoCrossSection(y, a, -0.035, -0.020)
    },
    0.012
  )
  g.add(mesh(shirtStand, M.dressShirt))

  ;[-1, 1].forEach((s) => {
    const wingGeo = solidClothShell(
      16,
      26,
      (u, v) => {
        const a = s * lerp(0.025, 0.64, u)
        const yTop = -1.00 - 0.04 * Math.cos(u * Math.PI * 0.5)
        const uPeak = 0.45
        const tri = u <= uPeak ? smooth(0, 1, u / uPeak) : 1 - smooth(0, 1, (u - uPeak) / (1 - uPeak))
        const yBot = lerp(-1.12, -1.62, tri)
        const y = lerp(yTop, yBot, v)
        const base = torsoCrossSection(y, a, -0.028, -0.016)
        const lift = 0.012 + 0.020 * v * (0.35 + 0.65 * tri)
        base.z += lift * Math.cos(a * 0.55)
        base.x += s * lift * 0.45 * Math.sin(Math.abs(a) * 0.55)
        return base
      },
      0.014
    )
    g.add(mesh(wingGeo, M.dressShirt))
  })

  {
    const knotGeo = solidClothShell(
      14,
      18,
      (u, v) => {
        const uu = (u - 0.5) * 2
        const y = lerp(-1.06, -1.34, v)
        const w = lerp(0.092, 0.052, Math.pow(v, 0.85))
        const x = uu * w
        const baseZ = torsoCrossSection(y, 0, -0.038, -0.024).z
        const dome = Math.sqrt(Math.max(0, 1 - uu * uu * 0.88)) * lerp(0.048, 0.034, v)
        const wrapFold = 0.004 * Math.sin(uu * 2.5 + v * 3.0)
        return v3(x, y, baseZ + 0.018 + dome + wrapFold)
      },
      0.020
    )
    g.add(mesh(knotGeo, M.tie))

    const bladeGeo = solidClothShell(
      28,
      20,
      (u, v) => {
        const uu = (u - 0.5) * 2
        const y = lerp(-1.31, -2.38, v)
        const belly = smooth(0, 0.58, v)
        const w = lerp(0.050, 0.148, belly)
        const x = uu * w
        const baseZ = torsoCrossSection(y, x * 0.70, -0.038, -0.024).z
        const arch = Math.sqrt(Math.max(0, 1 - uu * uu * 0.85)) * 0.024
        const dimple = -0.012 * Math.exp(-Math.pow(uu / 0.30, 2)) * (1 - smooth(0, 0.52, v))
        const tuckIn = -0.045 * smooth(-1.92, -2.32, y)
        return v3(x, y, baseZ + 0.018 + arch + dimple + tuckIn)
      },
      0.012
    )
    g.add(mesh(bladeGeo, M.tie))
  }

  const vestSurfaceAt = (s: number, u: number, v: number) => {
    const vNeckT = clamp(u / 0.22, 0, 1)
    const armholeScoop = Math.exp(-Math.pow((u - 0.46) / 0.14, 2))
    const yTop =
      u <= 0.22
        ? lerp(-2.26, -1.18, Math.pow(vNeckT, 0.88))
        : -1.18 - 0.50 * armholeScoop - 0.04 * smooth(0.22, 1.0, u)

    const yBot = u < 0.16 ? lerp(-3.98, -4.42, smooth(0, 0.16, u)) : lerp(-4.42, -4.12, smooth(0.16, 0.48, u))
    const y = lerp(yTop, yBot, v)

    const aMin = u < 0.04 && y < -2.22 && y > -3.96 ? (s < 0 ? 0.012 : -0.015) : s * 0.010
    const a = aMin + s * u * Math.PI
    const p = torsoCrossSection(y, a, 0.018, 0.018)

    const shSlope = (1 - v) * 0.16 * Math.exp(-Math.pow((u - 0.24) / 0.12, 2))
    p.y -= shSlope

    const frontFactor = Math.exp(-Math.pow(u / 0.26, 2)) * smooth(-2.22, -2.45, y) * smooth(-4.02, -3.72, y)
    const buttonPull = 0.010 * Math.cos(((y + 2.40) * Math.PI * 2) / 0.34) * frontFactor
    const overlap = (s < 0 ? 0.012 : 0.002) * Math.exp(-Math.pow(u / 0.07, 2))
    p.z += buttonPull + overlap
    return p
  }

  ;[-1, 1].forEach((s) => {
    const vestPanel = solidClothShell(44, 38, (u, v) => vestSurfaceAt(s, u, v), 0.024)
    g.add(mesh(vestPanel, M.vest))

    const vCollar = solidClothShell(
      8,
      24,
      (u, v) => {
        const uu = u * 0.22
        const p = vestSurfaceAt(s, uu, v * 0.058)
        p.z += 0.014 * Math.sin(v * Math.PI)
        return p
      },
      0.014
    )
    g.add(mesh(vCollar, M.seamWelt))

    ;[
      { u0: 0.065, u1: 0.215, v0: 0.73, tilt: -0.022 },
      { u0: 0.075, u1: 0.195, v0: 0.36, tilt: -0.028 },
    ].forEach((pk) => {
      const welt = solidClothShell(
        5,
        14,
        (u, v) => {
          const uu = lerp(pk.u0, pk.u1, u)
          const vv = pk.v0 + u * pk.tilt + (v - 0.5) * 0.028
          const p = vestSurfaceAt(s, uu, vv)
          p.z += 0.016 * Math.sin(v * Math.PI)
          return p
        },
        0.012
      )
      g.add(mesh(welt, M.seamWelt))
    })
  })

  for (const by of [-2.40, -2.74, -3.08, -3.42, -3.76]) {
    const bp = torsoCrossSection(by, 0, 0.018, 0.018)
    bp.z += 0.038
    const btn = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.018, 20), M.button)
    btn.rotation.x = Math.PI / 2
    btn.position.copy(bp)
    g.add(btn)
  }

  const coatPointAt = (u: number, v: number) => {
    const yokeT = smooth(0, 0.085, v)
    const bodyV = clamp((v - 0.085) / 0.915, 0, 1)
    const y = v <= 0.085 ? lerp(-1.18, -1.52, yokeT) : lerp(-1.52, -6.28, bodyV)

    const chestT = smooth(-3.8, -1.4, y)
    const waistT = Math.exp(-Math.pow((y + 3.65) / 0.70, 2))
    const skirtT = smooth(-3.65, -6.28, y)
    const billow = Math.pow(skirtT, 0.92)

    const ALeft = 0.38 + 0.02 * smooth(-1.18, -3.65, y) + 0.24 * Math.pow(skirtT, 0.95)
    const pocketPart = 0.34 * smooth(-2.15, -3.85, y) * (1 - 0.22 * smooth(-4.8, -6.28, y))
    const ARight = ALeft + pocketPart
    const a = lerp(ALeft, Math.PI * 2 - ARight, u)
    const sx = Math.sin(a)
    const cz = Math.cos(a)
    const ax = Math.abs(sx)

    const sideReach = sx < 0 ? 0.38 : 0.22
    const shHead = Math.exp(-Math.pow((y + 1.68) / 0.55, 2)) * Math.pow(ax, 1.15)
    const rxYoke = lerp(0.62, 1.02 + sideReach * ax, yokeT)
    const rxBody =
      1.02 +
      (sx < 0 ? 0.26 : 0.14) * ax * smooth(-3.5, -1.5, y) +
      0.16 * shHead +
      0.08 * chestT -
      0.02 * waistT +
      0.88 * billow * (0.36 + 0.64 * ax)
    const rx = v <= 0.085 ? rxYoke : rxBody

    const rzYoke = lerp(0.48, 0.58, yokeT)
    const rzBody = 0.58 + 0.06 * chestT - 0.02 * waistT + 0.30 * billow
    const rz = v <= 0.085 ? rzYoke : rzBody

    const shDrop = v <= 0.085 ? yokeT * ax * 0.04 : 0.04 * ax * Math.exp(-Math.pow((y + 1.52) / 0.35, 2))
    const frontEdgeDist = Math.min(u, 1 - u)
    const torsoDrape = 0.012 * Math.sin(u * Math.PI * 8) * smooth(-1.6, -3.6, y) * (1 - skirtT)
    const pleatWave = Math.sin(u * Math.PI * 7) * smooth(0, 0.06, frontEdgeDist)
    const flute = billow * (0.11 * pleatWave + 0.05 * Math.cos(a * 4))
    const hemWave = Math.pow(skirtT, 2.2) * 0.08 * pleatWave
    const sweepBack = billow * 0.14 * (1 - cz) * 0.5
    const wingLift = billow * 0.12 * Math.pow(ax, 1.4) + hemWave

    const rightPocketZone = smooth(0.65, 0.98, u) * smooth(-2.15, -3.75, y) * (1 - 0.28 * smooth(-4.85, -6.28, y))
    const pocketPushZ = -0.32 * rightPocketZone
    const pocketPushX = -0.15 * rightPocketZone

    const x = sx * (rx + flute + torsoDrape) + pocketPushX
    const py = y - shDrop + wingLift
    const z = -0.05 + cz * (rz + flute * 0.6 + torsoDrape) - sweepBack + pocketPushZ
    return v3(x, py, z)
  }

  const coatShell = solidClothShell(72, 84, coatPointAt, 0.040)
  const coatMesh = mesh(coatShell, M.coat)
  coatMesh.userData.skirt = true
  g.add(coatMesh)

  const liningShell = solidClothShell(
    44,
    56,
    (u, v) => {
      const p = coatPointAt(0.02 + u * 0.96, 0.35 + v * 0.63)
      const n = v3(p.x, 0, p.z + 0.05).normalize()
      return p.addScaledVector(n, -0.043)
    },
    0.006
  )
  const liningMesh = mesh(liningShell, M.lining, false)
  liningMesh.userData.skirt = true
  g.add(liningMesh)

  ;[-1, 1].forEach((s) => {
    const lapelPointAt = (u: number, v: number) => {
      const y = lerp(-1.36, -3.72, v)
      const tCoat = clamp(0.085 + ((y - -1.52) / (-6.28 - -1.52)) * 0.915, 0.04, 0.98)
      const uIn = s > 0 ? 0 : 1
      const stepOut = smooth(0, 0.055, v)
      const taperDown = 1 - smooth(0.07, 1.0, v)
      const widthU = (0.018 + 0.054 * stepOut) * Math.pow(taperDown, 0.82)
      const uCoat = clamp(uIn + s * u * widthU, 0, 1)
      const base = coatPointAt(uCoat, tCoat)
      const roll = Math.sin(u * Math.PI * 0.72)
      const lift = 0.018 + 0.028 * roll * taperDown + 0.016 * u * stepOut * taperDown
      base.z += lift
      base.x += s * u * 0.038 * stepOut * taperDown
      return base
    }
    const lapelGeo = solidClothShell(36, 16, lapelPointAt, 0.024)
    g.add(mesh(lapelGeo, M.lapel))

    const lapelEdgePts: THREE.Vector3[] = []
    for (let r = 0; r <= 36; r++) {
      lapelEdgePts.push(lapelPointAt(1, r / 36).add(v3(0, 0, 0.005)))
    }
    g.add(mesh(tubeGeometry(lapelEdgePts, () => 0.008, 8, 48), M.seamWelt, false))

    const flapGeo = solidClothShell(
      8,
      16,
      (u, v) => {
        const uCoat = s > 0 ? lerp(0.035, 0.135, u) : lerp(0.965, 0.865, u)
        const vCoat = lerp(0.50, 0.532, v) + u * 0.008
        const p = coatPointAt(uCoat, vCoat)
        p.z += 0.018 + 0.006 * Math.sin(v * Math.PI)
        return p
      },
      0.016
    )
    g.add(mesh(flapGeo, M.lapel))
  })

  for (const vBtn of [0.44, 0.54]) {
    const bp = coatPointAt(0.975, vBtn)
    bp.z += 0.024
    const btn = mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.018, 20), M.button)
    btn.rotation.x = Math.PI / 2
    btn.position.copy(bp)
    g.add(btn)
  }

  {
    const colNR = 18
    const colNC = 64
    const collarPointAt = (u: number, v: number) => {
      const s = u < 0.5 ? 1 : -1
      const distFromFront = Math.min(u, 1 - u)
      const wingZone = smooth(0.24, 0, distFromFront)

      const uClamped = clamp(0.005 + u * 0.99, 0.005, 0.995)
      const a = lerp(0.38, Math.PI * 2 - 0.38, uClamped)
      const sx = Math.sin(a)
      const cz = Math.cos(a)

      const baseX = lerp(sx * 0.62, s * 0.46, wingZone)
      const baseY = lerp(-1.20, -1.42, wingZone)
      const baseZ = lerp(-0.05 + cz * 0.48, 0.52, wingZone)

      const topX = lerp(sx * 0.70, s * 1.02, Math.pow(wingZone, 0.85))
      const topY = lerp(-0.74, -1.08, Math.pow(wingZone, 0.90))
      const topZ = lerp(-0.05 + cz * 0.54, 0.48, wingZone)

      const roll = Math.sin(v * Math.PI) * 0.025 * wingZone
      return v3(lerp(baseX, topX, v) + s * roll, lerp(baseY, topY, v) + roll * 0.5, lerp(baseZ, topZ, v) + roll)
    }
    const collarGeo = solidClothShell(colNR, colNC, collarPointAt, 0.024)
    g.add(mesh(collarGeo, M.lapel))

    const leftEdge: THREE.Vector3[] = []
    const topEdge: THREE.Vector3[] = []
    const rightEdge: THREE.Vector3[] = []
    for (let r = 0; r <= colNR; r++) {
      const v = r / colNR
      leftEdge.push(collarPointAt(0, v).add(v3(0.004, 0, 0.006)))
      rightEdge.push(collarPointAt(1, v).add(v3(-0.004, 0, 0.006)))
    }
    for (let c = 1; c < colNC; c++) {
      topEdge.push(collarPointAt(c / colNC, 1).add(v3(0, 0.004, 0.004)))
    }
    const rimPath = leftEdge.concat(topEdge, rightEdge.reverse())
    g.add(mesh(tubeGeometry(rimPath, () => 0.010, 12, 136), M.neon, false))
  }

  return g
}

const R_SH_CAP = v3(-0.92, -1.68, -0.02)
const R_SH = v3(-1.22, -1.84, -0.04)
const R_EL = v3(-1.62, -2.90, -0.16)
const R_WR = v3(-0.94, -3.96, 0.22)
const L_SH = v3(1.22, -1.66, 0.03)
const L_EL = v3(1.60, -2.86, -0.10)
const L_WR = v3(1.48, -4.14, 0.30)

/** A spur gear in the xy plane, centred on the origin: trapezoid teeth, an axle hole and lightening holes. */
function gearGeometry(teeth: number, r: number, thick: number) {
  const shape = new THREE.Shape()
  const root = r * 0.8
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    const pts = [
      [root, a],
      [r, a + step * 0.18],
      [r, a + step * 0.42],
      [root, a + step * 0.6],
    ]
    pts.forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr
      const y = Math.sin(aa) * rr
      if (i === 0 && k === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
  }
  shape.closePath()
  const hole = (cx: number, cy: number, hr: number) => {
    const h = new THREE.Path()
    h.absarc(cx, cy, hr, 0, Math.PI * 2, true)
    shape.holes.push(h)
  }
  hole(0, 0, r * 0.18)
  for (let k = 0; k < 4; k++) hole(Math.cos((k * Math.PI) / 2 + 0.4) * r * 0.5, Math.sin((k * Math.PI) / 2 + 0.4) * r * 0.5, r * 0.14)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.2,
    bevelSize: thick * 0.15,
    bevelSegments: 1,
    curveSegments: 8,
  })
  g.translate(0, 0, -thick / 2)
  return g
}

/** A gear facing along `axis` at `at`, on a pivot that stays live after pinning so it can turn. */
function gearAt(at: THREE.Vector3, axis: THREE.Vector3, teeth: number, r: number, mat: THREE.Material, spin: number) {
  const pivot = new THREE.Group()
  pivot.userData.pivot = true
  pivot.position.copy(at)
  pivot.quaternion.setFromUnitVectors(v3(0, 0, 1), axis.clone().normalize())
  const gear = mesh(gearGeometry(teeth, r, r * 0.22), mat)
  gear.userData.spin = spin
  gear.rotation.z = spin * 0.7
  pivot.add(gear, mesh(new THREE.CylinderGeometry(r * 0.17, r * 0.17, r * 0.4, 16).rotateX(Math.PI / 2), mat))
  return pivot
}

/**
 * Wear for a veteran's armour, as a colour multiplier and a roughness map. Plates map the whole
 * texture, so the borders are their edges: that is where the paint is chipped back to bare metal
 * and grime collects; scratches and dirt cover the rest.
 */
function wearMaps(seed: number, base: number, grime: number, chips: number) {
  const S = 512
  const make = () => {
    const c = document.createElement("canvas")
    c.width = c.height = S
    return [c, c.getContext("2d")!] as const
  }
  const [colC, col] = make()
  const [rghC, rgh] = make()
  const rnd = mulberry32(seed)
  const grey = (v: number, a = 1) => `rgba(${v * 255},${v * 255},${v * 255},${a})`
  col.fillStyle = grey(base)
  col.fillRect(0, 0, S, S)
  rgh.fillStyle = grey(0.24)
  rgh.fillRect(0, 0, S, S)
  const nearEdge = () => {
    const e = rnd() * 4
    const along = rnd() * S
    const inset = Math.pow(rnd(), 2) * 34
    return e < 1 ? [along, inset] : e < 2 ? [along, S - inset] : e < 3 ? [inset, along] : [S - inset, along]
  }
  // Grime, gathering towards the edges
  for (let i = 0; i < 70; i++) {
    const [x, y] = rnd() < 0.6 ? nearEdge() : [rnd() * S, rnd() * S]
    const rr = 18 + rnd() * 80
    const gc = col.createRadialGradient(x, y, 0, x, y, rr)
    gc.addColorStop(0, `rgba(0,0,0,${grime * (0.4 + rnd() * 0.5)})`)
    gc.addColorStop(1, "rgba(0,0,0,0)")
    col.fillStyle = gc
    col.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    const gr = rgh.createRadialGradient(x, y, 0, x, y, rr)
    gr.addColorStop(0, "rgba(255,255,255,0.35)")
    gr.addColorStop(1, "rgba(255,255,255,0)")
    rgh.fillStyle = gr
    rgh.fillRect(x - rr, y - rr, rr * 2, rr * 2)
  }
  // Scratches, mostly running along the limb
  for (let i = 0; i < 220; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const a = Math.PI / 2 + (rnd() - 0.5) * 1.4
    const len = 8 + Math.pow(rnd(), 2) * 140
    const w = 0.5 + rnd() * 1.3
    const bright = 0.35 + rnd() * 0.5
    col.strokeStyle = grey(1, bright * 0.7)
    col.lineWidth = w
    col.beginPath()
    col.moveTo(x, y)
    col.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    col.stroke()
    rgh.strokeStyle = grey(0.62, 0.8)
    rgh.lineWidth = w + 0.6
    rgh.beginPath()
    rgh.moveTo(x, y)
    rgh.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    rgh.stroke()
  }
  // Chipped paint at the edges, down to bare metal
  for (let i = 0; i < chips; i++) {
    const [x, y] = nearEdge()
    const rr = 2 + Math.pow(rnd(), 1.5) * 14
    const sides = 5 + Math.floor(rnd() * 4)
    col.fillStyle = grey(0.9 + rnd() * 0.1)
    rgh.fillStyle = grey(0.42)
    ;[col, rgh].forEach((ctx) => {
      ctx.beginPath()
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2
        const q = rr * (0.45 + rnd() * 0.75)
        if (k === 0) ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q)
        else ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q)
      }
      ctx.closePath()
      ctx.fill()
    })
  }
  // Fine dirt
  for (let i = 0; i < 2600; i++) {
    col.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.3})`
    col.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
  }
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  }
  return { map: tex(colC), rough: tex(rghC) }
}

/** A frame along a limb segment from A to B: axis `d`, forward `f` (towards +z) and outward `o` (towards +x). */
function limbFrame(A: THREE.Vector3, B: THREE.Vector3) {
  const d = B.clone().sub(A).normalize()
  const f = v3(0, 0, 1).addScaledVector(d, -d.z).normalize()
  const o = new THREE.Vector3().crossVectors(d, f)
  if (o.x < 0) o.negate()
  const len = A.distanceTo(B)
  /** Point at fraction `t` along the limb, angle `th` round it (0 front, π/2 outer, π back) and radius `r`. */
  const at = (t: number, th: number, r: number) =>
    A.clone()
      .addScaledVector(d, t * len)
      .addScaledVector(f, Math.cos(th) * r)
      .addScaledVector(o, Math.sin(th) * r)
  return { d, f, o, len, at, mid: A.clone().lerp(B, 0.5) }
}

/** A muscle bulge centred at (t0, th0) along and round a limb. */
const muscle = (t: number, th: number, t0: number, th0: number, wt: number, wth: number) => {
  const dth = Math.atan2(Math.sin(th - th0), Math.cos(th - th0))
  return Math.exp(-Math.pow((t - t0) / wt, 2) - Math.pow(dth / wth, 2))
}

/** Upper arm: deltoid cap, biceps in front, the triceps' long and lateral heads behind. */
const upperArmR = (t: number, th: number) =>
  lerp(0.31, 0.25, t) +
  0.12 * muscle(t, th, 0.06, Math.PI / 2, 0.17, 1.2) +
  0.13 * muscle(t, th, 0.5, 0, 0.17, 0.8) +
  0.1 * muscle(t, th, 0.34, Math.PI, 0.18, 0.75) +
  0.07 * muscle(t, th, 0.26, 2.25, 0.13, 0.5) -
  0.06 * smooth(0.72, 1.0, t)

/** Forearm: wide at the elbow with the brachioradialis, extensors and flexors, narrowing to the wrist. */
const foreArmR = (t: number, th: number) =>
  lerp(0.27, 0.16, Math.pow(Math.max(0, t), 0.8)) +
  0.11 * muscle(t, th, 0.17, 0.9, 0.16, 0.6) +
  0.08 * muscle(t, th, 0.24, 2.1, 0.18, 0.65) +
  0.09 * muscle(t, th, 0.2, -1.2, 0.18, 0.8)

/**
 * Cyber limb segment: a dark synthetic-muscle core, armour plates laid over each muscle
 * group with chamfered edges, red light in the seams between them, and bare artificial
 * muscle fibres along the inside of the limb.
 */
function cyberLimb(
  M: BodyMats,
  frame: ReturnType<typeof limbFrame>,
  R: (t: number, th: number) => number,
  plates: { t: [number, number]; th: [number, number]; mat: THREE.Material; lift?: number }[],
  seams: { th: number; t: [number, number] }[],
  fibers: [number, number]
) {
  const g = new THREE.Group()
  g.add(
    mesh(
      solidClothShell(28, 40, (u, v) => frame.at(lerp(-0.02, 1.02, v), u * Math.PI * 2, R(v, u * Math.PI * 2) * 0.9), 0.01, frame.mid),
      M.armorCore
    )
  )
  plates.forEach(({ t: [t0, t1], th: [a0, a1], mat, lift = 1 }) => {
    const shell = solidClothShell(
      18,
      26,
      (u, v) => {
        const t = lerp(t0, t1, v)
        const th = lerp(a0, a1, u)
        // Edges roll down towards the core so each plate reads as a separate piece
        const edge = Math.min(u * (a1 - a0), (1 - u) * (a1 - a0), v * (t1 - t0) * 4, (1 - v) * (t1 - t0) * 4)
        // Shallow dents from years of knocks
        const dent = 0.012 * Math.sin(t * 23 + th * 7) * Math.sin(th * 11 - t * 9) - 0.02 * muscle(t, th, 0.62, 0.4, 0.06, 0.25)
        return frame.at(t, th, R(t, th) * lift * (0.955 + 0.045 * smooth(0, 0.14, edge)) * (1 + dent))
      },
      0.022,
      frame.mid
    )
    g.add(mesh(shell, mat))
  })
  seams.forEach(({ th, t: [t0, t1] }) => {
    const pts = Array.from({ length: 14 }, (_, i) => {
      const t = lerp(t0, t1, i / 13)
      return frame.at(t, th, R(t, th) * 0.93)
    })
    g.add(mesh(tubeGeometry(pts, () => 0.007, 6, 40), M.neonSoft, false))
  })
  const [f0, f1] = fibers
  for (let k = 0; k < 6; k++) {
    const th0 = -Math.PI / 2 + (k - 2.5) * 0.17
    const pts = Array.from({ length: 16 }, (_, i) => {
      const t = lerp(f0, f1, i / 15)
      const th = th0 + 0.05 * Math.sin(t * 9 + k)
      return frame.at(t, th, R(t, th) * 0.93)
    })
    g.add(mesh(tubeGeometry(pts, (t) => 0.017 + 0.009 * Math.sin(t * Math.PI), 8, 40), M.fiber, false))
  }
  return g
}

function buildArms(M: BodyMats) {
  const g = new THREE.Group()
  // Rigid pieces are sorted into the joint they ride on, so the rig can pin them to bones.
  const rHand = new THREE.Group()
  const lShoulder = new THREE.Group()
  const lElbow = new THREE.Group()
  const lHand = new THREE.Group()
  g.add(rHand, lShoulder, lElbow, lHand)
  let into = g

  const rMidFore = v3(-1.32, -3.48, 0.05)
  const rPath = [R_SH_CAP, R_SH, R_SH.clone().lerp(R_EL, 0.50).add(v3(-0.04, 0, -0.02)), R_EL, rMidFore, R_WR]
  const sleeveProfile = (t: number, th: number) => {
    const capGrow = smooth(0, 0.15, t)
    const baseR = lerp(0.16, 0.355, capGrow) * lerp(1.0, 0.68, Math.pow(clamp((t - 0.15) / 0.85, 0, 1), 0.82))
    const bicepDrape = 0.020 * Math.sin(t * 22 + th * 2) * smooth(0.15, 0.42, t) * (1 - smooth(0.50, 0.82, t))
    const elbowZone = Math.exp(-Math.pow((t - 0.56) / 0.17, 2))
    const elbowCrease =
      0.044 *
      elbowZone *
      (0.68 * Math.sin(t * 52 + Math.cos(th) * 2.4) + 0.32 * Math.cos(t * 32 - Math.sin(th) * 3.0)) *
      (0.58 + 0.42 * Math.cos(th))
    const cuffLip = 0.014 * smooth(0.92, 0.98, t)
    return baseR + bicepDrape + elbowCrease + cuffLip
  }
  const rSleeve = mesh(tubeGeometry(rPath, sleeveProfile, 36, 116), M.coat)
  g.add(rSleeve)

  into = rHand
  const rFore = R_WR.clone().sub(rMidFore).normalize()
  for (let k = 0; k < 3; k++) {
    const btnPos = R_WR.clone().addScaledVector(rFore, -0.26 + k * 0.080).add(v3(-0.21, -0.04, 0.06))
    const b = mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.012, 14), M.button)
    b.rotation.set(0.4, 0.2, 1.1)
    b.position.copy(btnPos)
    into.add(b)
  }

  into.add(
    mesh(
      tubeGeometry([R_WR.clone().addScaledVector(rFore, -0.02), R_WR.clone().addScaledVector(rFore, 0.12)], () => 0.210, 28, 14),
      M.dressShirt
    )
  )

  const rPalm = R_WR.clone().addScaledVector(rFore, 0.22).add(v3(0.04, -0.02, -0.02))
  into.add(ball(rPalm, 0.185, M.furHand, [0.88, 1.15, 0.56]))
  const rTh0 = rPalm.clone().add(v3(0.11, 0.04, 0.06))
  const rTh1 = rTh0.clone().add(v3(0.05, -0.09, 0.02))
  into.add(ball(rTh0, 0.044, M.furHand))
  into.add(mesh(tubeGeometry([rTh0, rTh1], (t) => 0.040 - 0.008 * t, 10, 8), M.skinHand))

  into = g
  const pocketWelt = solidClothShell(
    8,
    20,
    (u, v) => {
      const pTop = rPalm.clone().add(v3(0.13, -0.02, 0.07))
      const pBot = rPalm.clone().add(v3(-0.14, -0.22, 0.03))
      const base = pTop.lerp(pBot, u)
      base.x += (v - 0.5) * 0.045
      base.y -= (v - 0.5) * 0.045
      base.z += 0.022 + 0.012 * Math.sin(v * Math.PI)
      return base
    },
    0.020
  )
  into.add(mesh(pocketWelt, M.pants))

  into = lShoulder
  // Shoulder socket, mostly hidden in the coat's armhole
  into.add(ball(L_SH, 0.25, M.armorCore, [0.95, 0.98, 0.92]))
  into = g
  const leftArmholeCuff = solidClothShell(
    8,
    24,
    (u, v) => {
      const th = lerp(-0.30, Math.PI + 0.30, u)
      const r = 0.335
      return v3(L_SH.x - 0.10 + v * 0.08 + Math.sin(th) * 0.04, L_SH.y + 0.05 + Math.sin(th) * r, L_SH.z + Math.cos(th) * r * 0.92)
    },
    0.022,
    L_SH
  )
  into.add(mesh(leftArmholeCuff, M.lapel))
  into.add(ringAt(L_SH.clone().add(v3(0.02, -0.06, 0)), v3(0.86, -0.48, 0.04), 0.315, 0.008, M.neonSoft))

  into = lShoulder
  const upperFrame = limbFrame(L_SH, L_EL)
  /** Outward surface normal at angle `th` round a limb. */
  const outward = (fr: ReturnType<typeof limbFrame>, th: number) =>
    fr.f.clone().multiplyScalar(Math.cos(th)).addScaledVector(fr.o, Math.sin(th))
  into.add(
    cyberLimb(
      M,
      upperFrame,
      upperArmR,
      [
        { t: [0.0, 0.3], th: [-1.9, 3.6], mat: M.armor, lift: 1.03 }, // deltoid cap
        { t: [0.33, 0.9], th: [-1.0, 0.72], mat: M.armor }, // biceps
        { t: [0.33, 0.52], th: [0.78, 1.95], mat: M.chrome }, // lateral strip, cut short over the gear window
        { t: [0.3, 0.9], th: [2.07, 3.9], mat: M.armor }, // triceps
      ],
      [
        { th: 0.75, t: [0.35, 0.52] },
        { th: 2.01, t: [0.33, 0.88] },
        { th: -1.06, t: [0.35, 0.88] },
      ],
      [0.12, 0.92]
    )
  )
  // Gear window on the outside of the upper arm
  into.add(
    gearAt(upperFrame.at(0.64, 1.15, upperArmR(0.64, 1.15) * 0.9), outward(upperFrame, 1.15), 12, 0.13, M.brass, 1),
    gearAt(upperFrame.at(0.8, 1.3, upperArmR(0.8, 1.3) * 0.9), outward(upperFrame, 1.3), 9, 0.09, M.chromeDark, -1.4)
  )

  into = lElbow
  into.add(ball(L_EL, 0.24, M.armorCore))
  const foreDir = L_WR.clone().sub(L_EL).normalize()
  const fore = limbFrame(L_EL, L_WR)
  into.add(
    cyberLimb(
      M,
      fore,
      foreArmR,
      [
        { t: [-0.1, 0.1], th: [2.3, 4.0], mat: M.chrome, lift: 1.12 }, // elbow cap
        { t: [0.04, 0.47], th: [0.1, 2.75], mat: M.armor }, // brachioradialis and extensors, short of the gear window
        { t: [0.04, 0.55], th: [-2.6, -0.05], mat: M.armor }, // flexors
        { t: [0.12, 0.62], th: [2.85, 3.55], mat: M.chrome, lift: 1.04 }, // ulna ridge
        { t: [0.64, 0.97], th: [-3.0, 3.0], mat: M.chrome, lift: 1.06 }, // wrist sleeve
      ],
      [
        { th: 0.02, t: [0.06, 0.58] },
        { th: 2.8, t: [0.08, 0.6] },
      ],
      [0.1, 0.6]
    )
  )
  into.add(ringAt(fore.at(0.64, 0, 0), foreDir, foreArmR(0.64, 0) * 1.03, 0.007, M.neon))
  // Exposed elbow drive: a brass gear meshed with a dark steel one, turned to face forward
  const elbowFace = fore.o.clone().multiplyScalar(0.45).addScaledVector(fore.f, 0.9).normalize()
  into.add(
    gearAt(L_EL.clone().addScaledVector(elbowFace, 0.21), elbowFace, 14, 0.15, M.brass, 0.8),
    gearAt(L_EL.clone().addScaledVector(elbowFace, 0.2).addScaledVector(fore.d, 0.22), elbowFace, 9, 0.09, M.chromeDark, -1.25)
  )
  // Forearm window above the wrist
  into.add(
    gearAt(fore.at(0.555, 0.85, foreArmR(0.555, 0.85) * 0.88), outward(fore, 0.85), 11, 0.1, M.brass, -1.1),
    gearAt(fore.at(0.545, 0.2, foreArmR(0.545, 0.2) * 0.88), outward(fore, 0.2), 8, 0.072, M.chromeDark, 1.6)
  )

  into = lHand
  into.add(ball(L_WR, 0.195, M.chromeDark, [1.0, 0.82, 0.88]))
  into.add(ringAt(L_WR, foreDir, 0.200, 0.014, M.chrome))
  into.add(ringAt(L_WR.clone().addScaledVector(foreDir, 0.03), foreDir, 0.192, 0.008, M.neonSoft))

  const lPalm = L_WR.clone().addScaledVector(foreDir, 0.25).add(v3(-0.02, 0, 0.03))
  into.add(ball(lPalm, 0.195, M.chromeDark, [0.90, 1.20, 0.65]))
  const dorsalPlate = solidClothShell(
    8,
    10,
    (u, v) => {
      const x = lPalm.x + 0.042 + 0.024 * Math.sin(u * Math.PI)
      const y = lPalm.y + lerp(0.17, -0.18, v)
      const z = lPalm.z + lerp(-0.12, 0.12, u)
      return v3(x, y, z)
    },
    0.022,
    lPalm
  )
  into.add(mesh(dorsalPlate, M.chrome))

  for (let i = 0; i < 4; i++) {
    const zOff = 0.125 - i * 0.078
    const spreadZ = 0.030 - i * 0.019
    const len = i === 1 ? 1.08 : i === 2 ? 1.02 : i === 0 ? 0.94 : 0.82
    const k0 = lPalm.clone().add(v3(-0.01, -0.20, zOff))
    const k1 = k0.clone().add(v3(-0.04, -0.17 * len, spreadZ + 0.02))
    const k2 = k1.clone().add(v3(-0.07, -0.14 * len, spreadZ))
    const k3 = k2.clone().add(v3(-0.08, -0.11 * len, -0.02))
    into.add(ball(k0, 0.042, M.chromeDark))
    into.add(mesh(tubeGeometry([k0, k1], () => 0.037, 12, 6), M.chrome))
    into.add(ball(k1, 0.036, M.chromeDark))
    into.add(mesh(tubeGeometry([k1, k2], () => 0.032, 12, 6), M.chrome))
    into.add(ball(k2, 0.030, M.chromeDark))
    into.add(mesh(tubeGeometry([k2, k3], (t) => lerp(0.029, 0.020, t), 10, 6), M.chrome))
  }
  const th0 = lPalm.clone().add(v3(-0.11, -0.04, 0.15))
  const th1 = th0.clone().add(v3(-0.08, -0.16, 0.07))
  const th2 = th1.clone().add(v3(-0.05, -0.13, -0.01))
  into.add(ball(th0, 0.048, M.chromeDark))
  into.add(mesh(tubeGeometry([th0, th1], () => 0.042, 12, 6), M.chrome))
  into.add(ball(th1, 0.040, M.chromeDark))
  into.add(mesh(tubeGeometry([th1, th2], (t) => lerp(0.037, 0.025, t), 12, 6), M.chrome))

  return { group: g, rSleeve, rHand, lShoulder, lElbow, lHand }
}

const R_AN = v3(-0.64, -7.48, -0.03)
const L_AN = v3(0.80, -7.48, 0.16)

/**
 * The shoe's footprint as a 2D distance in plan (x across, z forward): a narrow rounded heel
 * blending into a wider ball and an almond toe, grown by `grow` (the sole's welt).
 */
function shoePlan(x: number, z: number, grow = 0) {
  const ell = (cz: number, rx: number, rz: number) => (Math.hypot(x / (rx + grow), (z - cz) / (rz + grow)) - 1) * Math.min(rx, rz)
  return smin(ell(0.02, 0.152, 0.22), ell(0.5, 0.212, 0.48), 0.16)
}

/** Underside of the upper: flat under the heel, springing up toward the toe. */
const shoeBase = (z: number) => -0.52 + 0.045 * Math.pow(smooth(0.62, 1.0, z), 1.6)

/** Top line of the upper: the collar at the back, sloping down the instep onto a low toe box. */
const shoeTop = (z: number) => lerp(-0.2, -0.345, smooth(0.1, 0.62, z)) - 0.075 * Math.pow(smooth(0.68, 1.0, z), 1.4)

/** A fine seam: a narrow slot near the surface where `line` (distance to the seam) is small. */
const seam = (d: number, line: number, w = 0.006) => Math.max(d, -Math.max(Math.abs(line) - w, -d - 0.012))

/**
 * A polished leather Oxford: the footprint extruded between the sole and the top line with
 * rounded edges, an ankle filling the collar, a toe cap, a heel counter and a closed laced
 * throat stitched in.
 */
function bootSDF(x: number, y: number, z: number) {
  const top = shoeTop(z)
  const base = shoeBase(z)
  const hh = (top - base) / 2
  const rc = Math.min(0.11, hh * 0.92)
  const qx = shoePlan(x, z) + rc
  const qy = Math.abs(y - (top + base) / 2) - hh + rc
  let d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc
  d = smin(d, sdCap(x, y, z, 0, -0.36, -0.02, 0, -0.2, -0.04, 0.135), 0.06)
  d = Math.max(d, base - y)
  // Toe cap straight across the ball, curving back at the sides
  d = seam(d, z - 0.69 + 0.9 * x * x)
  // Heel counter, rising from the sole to the collar at the back
  d = seam(d, y + 0.42 - 0.35 * Math.max(0, 0.12 - z) - 0.25 * Math.max(0, z - 0.12), 0.005)
  // The laced throat: two facings meeting down the middle, and the vamp seam across their foot
  if (z > 0.1 && z < 0.47) {
    d = seam(d, x, 0.003)
    d = seam(d, Math.abs(x) - 0.078 - 0.12 * Math.max(0, z - 0.38), 0.004)
  }
  if (Math.abs(x) < 0.09) d = seam(d, z - 0.47, 0.004)
  return d
}

/** Leather sole with a slim welt round the upper and a stacked heel block under the back. */
function soleSDF(x: number, y: number, z: number) {
  const base = shoeBase(z)
  const plan = shoePlan(x, z, 0.014)
  const slab = Math.max(plan, Math.abs(y - (base - 0.022)) - 0.022) - 0.004
  const heelPlan = Math.max(shoePlan(x, z, 0.012), z - 0.13)
  const heel = Math.max(heelPlan, Math.abs(y + 0.59) - 0.035) - 0.004
  return Math.min(slab, heel)
}

/** Surface height of the upper at (x, z), found by stepping down onto it from above. */
function shoeSurface(x: number, z: number) {
  let lo = -0.55
  let hi = 0
  for (let k = 0; k < 28; k++) {
    const m = (lo + hi) / 2
    if (bootSDF(x, m, z) < 0) lo = m
    else hi = m
  }
  return lo
}

/** Five straight lace bars across the throat, sitting on the facings. */
function laceGeometry() {
  const bars: THREE.BufferGeometry[] = []
  ;[0.16, 0.22, 0.28, 0.34, 0.4].forEach((z) => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const x = lerp(-0.066, 0.066, i / 8)
      pts.push(v3(x, shoeSurface(x, z) + 0.008, z))
    }
    bars.push(tubeGeometry(pts, () => 0.0085, 6, 16))
  })
  return mergeGeometries(bars)!
}

/** Centerline of a trouser leg (s = -1 right, +1 left) from the hip (v = 0) to the ankle (v = 1). */
const legCenter = (s: number, v: number) =>
  s < 0
    ? v3(-lerp(0.27, 0.64, Math.pow(v, 0.82)), lerp(-3.96, -7.54, v), -0.06 + 0.05 * Math.sin(v * Math.PI * 0.75) - 0.03 * v)
    : v3(
        lerp(0.27, 0.80, Math.pow(v, 0.78)) + 0.03 * Math.sin(v * Math.PI),
        lerp(-3.96, -7.54, v),
        -0.05 + 0.14 * Math.sin(v * Math.PI * 0.72) + 0.16 * v
      )

const BOOT_YAW = [-0.18, 0.34]

function buildLegs(M: BodyMats) {
  const g = new THREE.Group()
  const legs: THREE.Mesh[] = []
  const boots: THREE.Group[] = []

  const upperTrousers = solidClothShell(
    14,
    48,
    (u, v) => {
      const a = lerp(-Math.PI, Math.PI, u)
      const sx = Math.sin(a)
      const cz = Math.cos(a)
      const y = lerp(-3.82, -4.28, v)
      const rx = lerp(0.78, 0.72, v)
      const rz = lerp(0.36, 0.34, v)
      return v3(sx * rx, y, -0.06 + cz * rz)
    },
    0.016
  )
  g.add(mesh(upperTrousers, M.pants))

  ;[-1, 1].forEach((s) => {
    const legGeo = solidClothShell(
      56,
      44,
      (u, v) => {
        const a = lerp(-Math.PI, Math.PI, u)
        const sx = Math.sin(a)
        const cz = Math.cos(a)
        const { x: cx, y, z: cz0 } = legCenter(s, v)

        const isInner = s * sx < 0
        const crotchClamp = isInner ? 0.08 * (1 - smooth(0.06, 0.22, v)) * Math.abs(sx) : 0
        const rPocketBulge =
          s < 0 && sx < -0.3 && cz > 0.1 ? 0.055 * Math.exp(-Math.pow((v - 0.08) / 0.09, 2)) * -sx * cz : 0
        const rx = lerp(0.46, 0.38, Math.pow(v, 0.82)) + crotchClamp + rPocketBulge
        const rz = lerp(0.41, 0.37, Math.pow(v, 0.76)) + rPocketBulge * 0.8

        const frontCrease = 0.038 * Math.pow(Math.max(0, cz), 10) * smooth(0.08, 0.24, v)
        const backCrease = 0.020 * Math.pow(Math.max(0, -cz), 10)
        const upperPleats = 0.022 * smooth(0.05, 0.15, v) * (1 - smooth(0.18, 0.58, v)) * Math.max(0, cz) * Math.cos(sx * 10)
        const kneeFold = 0.015 * Math.exp(-Math.pow((v - 0.48) / 0.13, 2)) * Math.sin(v * 34 + cz * 2)
        const shoeBreak =
          0.048 * smooth(0.82, 1.0, v) * Math.max(0, cz) + 0.016 * smooth(0.80, 1.0, v) * Math.sin(v * 26 + cz * 2)

        const rX = rx + upperPleats * 0.4 + kneeFold * 0.5
        const rZ = rz + frontCrease + backCrease + upperPleats + kneeFold + shoeBreak
        return v3(cx + sx * rX, y, cz0 + cz * rZ)
      },
      0.018,
      v3(s * 0.52, -5.8, 0)
    )
    const leg = mesh(legGeo, M.pants)
    legs.push(leg)
    g.add(leg)
  })

  const boot = projectSphere(bootSDF, 128, 96, v3(0, -0.4, 0.36), 1.8)
  const sole = projectSphere(soleSDF, 96, 48, v3(0, -0.56, 0.36), 1.6)
  const laces = laceGeometry()
  ;[R_AN, L_AN].forEach((A, i) => {
    const b = new THREE.Group()
    b.position.set(A.x, FLOOR_Y + 0.62 * 0.98, A.z)
    b.rotation.y = BOOT_YAW[i]
    b.scale.setScalar(0.98)
    b.add(mesh(boot.geo, M.boot), mesh(sole.geo, M.sole), mesh(laces, M.strap))
    // Heel and ball contact points, used to keep the stance foot on the floor: it lands on
    // the back of the heel and pushes off the ball, the toe springing up ahead of it
    ;[v3(0, -0.62, -0.17), v3(0, -0.565, 0.62)].forEach((p) => {
      const mark = new THREE.Object3D()
      mark.position.copy(p)
      mark.userData.marker = true
      b.add(mark)
    })
    boots.push(b)
    g.add(b)
  })
  return { group: g, legs, boots }
}

function buildBelt(M: BodyMats) {
  const g = new THREE.Group()
  const belt: THREE.Vector3[] = []
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2
    const sx = Math.sin(a)
    const cz = Math.cos(a)
    belt.push(v3(sx * 0.84, -4.02, -0.03 + cz * 0.44))
  }
  belt.push(belt[0].clone().add(v3(0.001, 0, 0)))
  g.add(mesh(tubeGeometry(belt, () => 0.032, 10, 96), M.strap))
  return g
}

/** Guitar-local strap buttons: the upper horn (uppermost while he plays) and the tail. */
const STRAP_BUTTONS = [v3(-0.55, 0.45, -0.02), v3(0, -1.24, -0.02)]

/**
 * A leather strap for the playing pose, in the upper body's local space: from the tail button
 * round his right hip, diagonally up his back, over the left shoulder and down his chest to the
 * horn button. Each point is found by casting a ray at the coat so it lies on the surface.
 */
function buildStrap(M: BodyMats, upper: THREE.Object3D, coat: THREE.Object3D, horn: THREE.Vector3, tail: THREE.Vector3) {
  const targets: THREE.Object3D[] = []
  coat.traverse((o) => {
    if (o instanceof THREE.Mesh) targets.push(o)
  })
  const ray = new THREE.Raycaster()
  const out: { p: THREE.Vector3; n: THREE.Vector3 }[] = []
  /** Cast from `from` along `dir` (upper-local) and keep the hit, lifted off the cloth. */
  const onCoat = (from: THREE.Vector3, dir: THREE.Vector3) => {
    const o = upper.localToWorld(from.clone())
    const d = upper.localToWorld(from.clone().add(dir)).sub(o).normalize()
    ray.set(o, d)
    const hit = ray.intersectObjects(targets, false)[0]
    if (!hit) return
    const n = dir.clone().normalize().negate()
    out.push({ p: upper.worldToLocal(hit.point.clone()).addScaledVector(n, 0.035), n })
  }
  const SHOULDER = v3(0.66, -1.32, 0)
  const HIP = v3(-0.8, -3.85, 0)
  out.push({ p: tail.clone(), n: v3(0, 0, 1) })
  onCoat(v3(-3, HIP.y + 0.05, 0.35), v3(1, 0, 0)) // round the right hip
  for (let i = 0; i <= 7; i++) {
    const k = i / 7 // up the back
    onCoat(v3(lerp(HIP.x, SHOULDER.x, k), lerp(HIP.y, SHOULDER.y, k), -3), v3(0, 0, 1))
  }
  onCoat(v3(SHOULDER.x + 0.06, 2, -0.05), v3(0, -1, 0)) // over the shoulder
  for (let i = 0; i <= 5; i++) {
    const k = i / 5 // down the chest
    onCoat(v3(lerp(SHOULDER.x, horn.x + 0.08, k), lerp(SHOULDER.y, horn.y + 0.25, k), 3), v3(0, 0, -1))
  }
  out.push({ p: horn.clone(), n: v3(0, 0, 1) })

  const curve = new THREE.CatmullRomCurve3(
    out.map((o) => o.p),
    false,
    "centripetal"
  )
  const N = 120
  const P: number[] = []
  const I: number[] = []
  const UV: number[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const src = out[Math.min(out.length - 1, Math.round(t * (out.length - 1)))].n
    const side = new THREE.Vector3().crossVectors(tan, src).normalize().multiplyScalar(0.075)
    P.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z)
    UV.push(0, t * 8, 1, t * 8)
    if (i < N) {
      const a = i * 2
      I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2))
  g.setIndex(I)
  g.computeVertexNormals()
  // Worn cognac leather, so the strap reads against the black coat
  const leather = (M.strap as THREE.MeshPhysicalMaterial).clone()
  leather.color = hdr(0.16, 0.06, 0.025)
  leather.roughness = 0.6
  leather.clearcoat = 0.15
  leather.side = THREE.DoubleSide
  return mesh(g, leather)
}

function buildGuitar(M: BodyMats) {
  const g = new THREE.Group()
  const gtr = new THREE.Group()

  const bodySDF = (x: number, y: number, z: number) => {
    const lower = sdE(x, y, z, 0, -0.52, 0, 0.86, 0.72, 0.16)
    const upper = sdE(x, y, z, 0, 0.28, 0, 0.64, 0.54, 0.15)
    const waist = sdE(Math.abs(x), y, z, 0.72, -0.06, 0, 0.26, 0.28, 0.30)
    let d = smin(lower, upper, 0.22)
    d = smax(d, -waist, 0.12)
    return Math.max(d, Math.abs(z) - 0.13)
  }
  const bodyGeo = projectSphere(bodySDF, 96, 72, v3(0, -0.15, 0), 2.2).geo
  gtr.add(mesh(bodyGeo, M.guitarWood))

  const rimPts: THREE.Vector3[] = []
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const p = surfaceAlong(bodySDF, v3(0, -0.15, 0), v3(Math.sin(a), Math.cos(a), 0), 2)
    rimPts.push(v3(p.x, p.y, 0.125))
  }
  rimPts.push(rimPts[0].clone().add(v3(0.001, 0, 0)))
  gtr.add(mesh(tubeGeometry(rimPts, () => 0.012, 8, 96), M.dressShirt, false))

  const neck = mesh(new THREE.BoxGeometry(0.17, 2.35, 0.07), M.guitarWood)
  neck.position.set(0, 1.55, 0.03)
  const board = mesh(new THREE.BoxGeometry(0.18, 2.38, 0.025), M.coat)
  board.position.set(0, 1.55, 0.075)
  gtr.add(neck, board)

  for (let f = 0; f < 18; f++) {
    const fy = 0.55 + f * 0.115 * (1 - f * 0.012)
    const fret = mesh(new THREE.BoxGeometry(0.182, 0.008, 0.012), M.chrome, false)
    fret.position.set(0, fy, 0.090)
    gtr.add(fret)
  }

  ;[-0.22, -0.78].forEach((py) => {
    const ring = mesh(new THREE.BoxGeometry(0.42, 0.22, 0.035), M.coat)
    ring.position.set(0, py, 0.13)
    const coilA = mesh(new THREE.BoxGeometry(0.36, 0.08, 0.048), M.chrome)
    coilA.position.set(0, py + 0.042, 0.13)
    const coilB = mesh(new THREE.BoxGeometry(0.36, 0.08, 0.048), M.chrome)
    coilB.position.set(0, py - 0.042, 0.13)
    gtr.add(ring, coilA, coilB)
  })

  const head = new THREE.Group()
  head.position.set(0, 2.72, 0.065)
  head.rotation.x = -0.18
  const hPlate = mesh(new THREE.BoxGeometry(0.24, 0.54, 0.045), M.coat)
  hPlate.position.set(0, 0.26, 0)
  head.add(hPlate)
  ;[-1, 1].forEach((s) => {
    for (let k = 0; k < 3; k++) {
      const py = 0.12 + k * 0.14
      const post = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), M.chrome, false)
      post.rotation.x = Math.PI / 2
      post.position.set(s * 0.085, py, 0.03)
      const peg = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10), M.chrome, false)
      peg.rotation.z = Math.PI / 2
      peg.position.set(s * 0.145, py, 0.01)
      const button = ball(v3(s * 0.19, py, 0.01), 0.024, M.chrome, [0.6, 1.3, 0.4])
      head.add(post, peg, button)
    }
  })
  gtr.add(head)

  // Strap buttons: on the upper horn and at the tail
  STRAP_BUTTONS.forEach((b) => gtr.add(ball(b, 0.035, M.chrome)))

  const bridge = mesh(new THREE.BoxGeometry(0.32, 0.06, 0.04), M.chrome)
  bridge.position.set(0, -0.32, 0.13)
  gtr.add(bridge)
  for (let s = 0; s < 6; s++) {
    const sx = -0.065 + s * 0.026
    const str = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 3.15, 6), M.chrome, false)
    str.position.set(sx, 1.25, 0.105)
    gtr.add(str)
  }

  // Sized for his lankier build; position and rotation are set every frame while he plays
  gtr.scale.setScalar(1.2)
  g.add(gtr)

  return { group: g, guitar: gtr }
}

const POSE = {
  waist: v3(0, BODY_WAIST, 0),
  upper: { x: -0.022, y: 0.11, z: 0.028 },
  neck: v3(0, -1.05, 0),
  head: { x: 0.018, y: -0.07, z: -0.032 },
}

function pivotGroup(pivot: THREE.Vector3, rot: { x: number; y: number; z: number }) {
  const outer = new THREE.Group()
  outer.position.copy(pivot)
  outer.rotation.set(rot.x, rot.y, rot.z)
  const inner = new THREE.Group()
  inner.position.copy(pivot).negate()
  outer.add(inner)
  return { outer, inner }
}

// Walk rig: bones at the hips, knees, ankles, shoulders, elbows and wrists. The cloth
// shells (trousers, right sleeve, coat skirt) are skinned to them; rigid parts (boots,
// hands, the chrome arm) are pinned to the bone they ride on. With every bone at rest
// the body is exactly the sculpted contrapposto pose.

type Influence = [number, number][]

function skinTo(src: THREE.Mesh, bones: THREE.Bone[], weigh: (p: THREE.Vector3) => Influence) {
  const geo = src.geometry
  const pos = geo.attributes.position
  const idx = new Uint16Array(pos.count * 4)
  const wt = new Float32Array(pos.count * 4)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const inf = weigh(p)
      .filter(([, w]) => w > 1e-4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    const sum = inf.reduce((acc, [, w]) => acc + w, 0)
    inf.forEach(([b, w], k) => {
      idx[i * 4 + k] = b
      wt[i * 4 + k] = w / sum
    })
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4))
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wt, 4))

  const sm = new THREE.SkinnedMesh(geo, src.material)
  sm.castShadow = src.castShadow
  sm.receiveShadow = src.receiveShadow
  sm.frustumCulled = false
  sm.position.copy(src.position)
  sm.quaternion.copy(src.quaternion)
  sm.scale.copy(src.scale)
  src.parent!.add(sm)
  src.removeFromParent()
  sm.updateMatrixWorld(true)
  sm.bind(new THREE.Skeleton(bones), sm.matrixWorld)
  return sm
}

/** Segment i of the chain (nodes[i] → nodes[i+1]) belongs to bone i, blended over radius[i] around node i+1. */
function chainWeights(nodes: THREE.Vector3[], radius: number[]) {
  const cum = [0]
  for (let i = 1; i < nodes.length; i++) cum.push(cum[i - 1] + nodes[i].distanceTo(nodes[i - 1]))
  const ab = new THREE.Vector3()
  const ap = new THREE.Vector3()
  return (p: THREE.Vector3): Influence => {
    let best = Infinity
    let arc = 0
    for (let i = 0; i < nodes.length - 1; i++) {
      ab.subVectors(nodes[i + 1], nodes[i])
      ap.subVectors(p, nodes[i])
      const t = sat(ap.dot(ab) / ab.lengthSq())
      const d = ap.addScaledVector(ab, -t).lengthSq()
      if (d < best) {
        best = d
        arc = lerp(cum[i], cum[i + 1], t)
      }
    }
    const out: Influence = []
    let prev = 1
    radius.forEach((r, i) => {
      const f = smooth(cum[i + 1] - r, cum[i + 1] + r, arc)
      out.push([i, prev - f])
      prev = f
    })
    out.push([radius.length, prev])
    return out
  }
}

/** Re-parent every mesh (and contact marker) under `obj` onto bone `b`, baking its current placement into the geometry. */
function pinTo(b: THREE.Object3D, obj: THREE.Object3D) {
  const inv = b.matrixWorld.clone().invert()
  const items: THREE.Object3D[] = []
  const underPivot = (o: THREE.Object3D) => {
    for (let p = o.parent; p && p !== obj; p = p.parent) if (p.userData.pivot) return true
    return false
  }
  obj.traverse((o) => {
    if (underPivot(o)) return
    if ((o as THREE.Mesh).isMesh || o.userData.marker || o.userData.pivot) items.push(o)
  })
  const rels = items.map((o) => inv.clone().multiply(o.matrixWorld))
  items.forEach((o, i) => {
    if (o.userData.pivot) {
      // Moving parts (gears) keep a live transform so they can spin, and stay round under the body stretch
      rels[i].decompose(o.position, o.quaternion, o.scale)
      o.scale.setScalar(Math.cbrt(Math.abs(rels[i].determinant())))
      b.add(o)
      return
    }
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh
      m.geometry = m.geometry.clone().applyMatrix4(rels[i])
      m.position.set(0, 0, 0)
    } else {
      o.position.setFromMatrixPosition(rels[i])
    }
    o.quaternion.identity()
    o.scale.set(1, 1, 1)
    b.add(o)
  })
}

function newBone(parent: THREE.Object3D, at: THREE.Vector3, parentAt: THREE.Vector3) {
  const b = new THREE.Bone()
  b.position.copy(at).sub(parentAt)
  parent.add(b)
  return b
}

const ZERO = new THREE.Vector3()

function buildRig(
  root: THREE.Object3D,
  hips: { outer: THREE.Group; inner: THREE.Group },
  spineParent: THREE.Object3D,
  bodyMatrix: THREE.Matrix4,
  legMatrix: THREE.Matrix4,
  legs: ReturnType<typeof buildLegs>,
  arms: ReturnType<typeof buildArms>,
  jacket: THREE.Object3D
) {
  const at = (p: THREE.Vector3) => p.clone().applyMatrix4(bodyMatrix)
  const atLeg = (p: THREE.Vector3) => p.clone().applyMatrix4(legMatrix)

  const pelvisAt = POSE.waist.clone()
  const pelvis = newBone(hips.inner, pelvisAt, ZERO)
  const legRig = [-1, 1].map((s, i) => {
    const H = legCenter(s, 0.05)
    const K = legCenter(s, 0.48)
    const A = i ? L_AN : R_AN
    const h = atLeg(H)
    const k = atLeg(K)
    const a = atLeg(A)
    const hip = newBone(pelvis, h, pelvisAt)
    const knee = newBone(hip, k, h)
    const ankle = newBone(knee, a, k)
    return {
      s,
      i,
      hip,
      knee,
      ankle,
      hipAt: h,
      lenT: k.distanceTo(h),
      lenS: a.distanceTo(k),
      thighRest: k.clone().sub(h).normalize(),
      shinRest: a.clone().sub(k).normalize(),
      chain: [v3(H.x * 0.4, -3.5, H.z), H, K, A, A.clone().add(v3(0, -0.6, 0))],
    }
  })

  const spine = newBone(spineParent, ZERO, ZERO)
  const armRig = (
    [
      [-1, R_SH, R_EL, R_WR],
      [1, L_SH, L_EL, L_WR],
    ] as [number, THREE.Vector3, THREE.Vector3, THREE.Vector3][]
  ).map(([s, S, E, W]) => {
    const sh = at(S.clone().applyMatrix4(arms.group.matrix))
    const el = at(E.clone().applyMatrix4(arms.group.matrix))
    const wr = at(W.clone().applyMatrix4(arms.group.matrix))
    const shoulder = newBone(spine, sh, ZERO)
    const elbow = newBone(shoulder, el, sh)
    const wrist = newBone(elbow, wr, el)
    return {
      s,
      shoulder,
      elbow,
      wrist,
      upperRest: el.clone().sub(sh).normalize(),
      foreRest: wr.clone().sub(el).normalize(),
    }
  })
  const skirt = legRig.map((L) => newBone(spine, L.hipAt, ZERO))

  root.updateMatrixWorld(true)

  legRig.forEach((L) => {
    skinTo(legs.legs[L.i], [pelvis, L.hip, L.knee, L.ankle], chainWeights(L.chain, [0.18, 0.22, 0.12]))
  })
  const markers: THREE.Object3D[] = []
  legs.boots.forEach((b, i) => {
    b.traverse((o) => {
      if (o.userData.marker) markers.push(o)
    })
    pinTo(legRig[i].ankle, b)
  })

  const [R, L] = armRig
  skinTo(
    arms.rSleeve,
    [spine, R.shoulder, R.elbow, R.wrist],
    chainWeights([R_SH_CAP, R_SH, R_EL, R_WR, R_WR.clone().lerp(R_EL, -0.3)], [0.2, 0.2, 0.05])
  )
  pinTo(R.wrist, arms.rHand)
  pinTo(L.shoulder, arms.lShoulder)
  pinTo(L.elbow, arms.lElbow)
  pinTo(L.wrist, arms.lHand)

  // The coat skirt hangs from the chest and swings with the thigh on its side
  const skirtMeshes: THREE.Mesh[] = []
  jacket.traverse((o) => {
    if (o.userData.skirt) skirtMeshes.push(o as THREE.Mesh)
  })
  skirtMeshes.forEach((m) =>
    skinTo(m, [spine, skirt[0], skirt[1]], (p) => {
      const k = 0.9 * smooth(-4.0, -6.3, p.y)
      const right = smooth(0.3, -0.3, p.x)
      return [
        [0, 1 - k],
        [1, k * right],
        [2, k * (1 - right)],
      ]
    })
  )

  root.updateMatrixWorld(true)
  const restLow = Math.min(...markers.map((m) => m.matrixWorld.elements[13]))

  return { hips: hips.outer, legs: legRig, arms: armRig, skirt, markers, restLow, plant: { boot: -1, z: [] as number[] } }
}

type Rig = ReturnType<typeof buildRig>

/** Seconds per full gait cycle (two steps) — an unhurried runway pace. */
const STRIDE = 1.9
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const QI = new THREE.Quaternion()
const rotX = (a: number) => new THREE.Quaternion().setFromAxisAngle(X_AXIS, a)
const rotY = (a: number) => new THREE.Quaternion().setFromAxisAngle(Y_AXIS, a)
/** Unit direction hanging down, pitched forward by `pitch` (radians) with a sideways lean. */
const hang = (side: number, pitch: number) => v3(side, -Math.cos(pitch), Math.sin(pitch)).normalize()
const aim = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(from, to)

/**
 * How far the toes point up off the floor (radians) at leg phase `si`, as a foot rolls through
 * a step: it lands on the heel toes-up, rolls flat and stays flat while the body passes over,
 * peels the heel up to push off the toes, hangs toes-down as it kicks back, then reaches
 * forward toes-up for the next heel strike.
 */
function footPitch(si: number) {
  const TWO_PI = Math.PI * 2
  const p = (((si + Math.PI / 2) % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI
  const STRIKE = 0.28
  const PUSH = -0.55
  if (p >= 0.5) {
    const u = (p - 0.5) / 0.5
    return STRIKE * (1 - smooth(0, 0.18, u)) + PUSH * Math.pow(smooth(0.5, 1, u), 1.5)
  }
  const v = p / 0.5
  return PUSH + (STRIKE - PUSH) * smooth(0.12, 0.85, v) - 0.15 * Math.sin(Math.PI * Math.min(1, v / 0.3))
}

/**
 * Pose the walk at gait phase `ph`, blended in by `w` (0 = sculpted pose, 1 = full walk), after
 * the reference: the weight shifts clearly onto each standing leg, which stays nearly straight;
 * the free foot kicks back high off the floor, knee bent to about a right angle and toes
 * pointing down; feet land under the hips, drifting slightly inward, toes turned out.
 */
function poseWalk(rig: Rig, ph: number, w: number, rootScale: number) {
  const sway = 0.08 * Math.cos(ph)
  const yaw = 0.06 * Math.sin(ph)
  rig.hips.position.set(POSE.waist.x + sway * w, POSE.waist.y, POSE.waist.z)
  rig.hips.rotation.set(0, yaw * w, 0.06 * Math.cos(ph) * w)

  rig.legs.forEach((L) => {
    const si = ph + (L.s > 0 ? Math.PI : 0)
    const sn = Math.sin(si)
    const pitch = 0.24 * sn
    // The free foot kicks back just after toe-off (knee to about 70 degrees); the standing
    // knee stays almost straight
    const bend = 0.05 + 1.2 * Math.pow(Math.max(0, Math.cos(si + 0.9)), 2.2)
    // Feet land under the hips, drifting slightly inward
    const lat = (L.s * 0.16 - 0.6 * sway - L.hipAt.x) / (L.lenT + L.lenS)
    const qHip = aim(L.thighRest, hang(lat, pitch))
    const qShin = aim(L.shinRest, hang(lat, pitch - bend))
    const qKnee = qHip.clone().invert().multiply(qShin)
    // Heel strike, flat foot, heel rise and toe-off, then toes down through the kick back
    const toesUp = footPitch(si)
    const qFoot = rotY(-yaw).multiply(rotX(-toesUp)).multiply(rotY(-BOOT_YAW[L.i] + L.s * 0.1))
    const qAnkle = qShin.clone().invert().multiply(qFoot)
    L.hip.quaternion.slerpQuaternions(QI, qHip, w)
    L.knee.quaternion.slerpQuaternions(QI, qKnee, w)
    L.ankle.quaternion.slerpQuaternions(QI, qAnkle, w)
    rig.skirt[L.i].quaternion.slerpQuaternions(QI, rotX(-0.7 * pitch), w)
  })

  rig.arms.forEach((A) => {
    // Arms trail the legs a beat behind, held out from the coat with soft elbows
    const si = ph + (A.s > 0 ? Math.PI : 0) - 0.45
    const swing = 0.05 - 0.34 * Math.sin(si)
    const bend = 0.34 + 0.3 * Math.max(0, swing)
    const qShoulder = aim(A.upperRest, hang(A.s * (0.24 + 0.04 * Math.cos(si)), swing))
    const qFore = aim(A.foreRest, hang(A.s * 0.18, swing + bend))
    const qElbow = qShoulder.clone().invert().multiply(qFore)
    const qWrist = qFore.clone().invert().multiply(rotX(-0.8 * (swing + bend) + 0.25 * Math.sin(si - 0.6)))
    A.shoulder.quaternion.slerpQuaternions(QI, qShoulder, w)
    A.elbow.quaternion.slerpQuaternions(QI, qElbow, w)
    A.wrist.quaternion.slerpQuaternions(QI, qWrist, w)
  })

  // Drop the hips until the lowest heel or toe touches the floor again
  rig.hips.updateMatrixWorld(true)
  let low = Infinity
  let contact = 0
  const z: number[] = []
  rig.markers.forEach((m, k) => {
    // Two contact markers per boot, heel then toe
    const y = m.matrixWorld.elements[13]
    z[k] = m.matrixWorld.elements[14]
    if (y < low) {
      low = y
      contact = k
    }
  })
  rig.hips.position.y += (rig.restLow - low) / rootScale

  // He walks on the spot, so the planted boot sweeps backwards under him; move the world with
  // whichever point of it is on the floor (the heel as it lands, the toe as it pushes off) so
  // that point stays put and he reads as walking rather than gliding
  const stance = contact >> 1
  if (rig.plant.boot === stance && rig.plant.z.length) travel.z += (z[contact] - rig.plant.z[contact]) * w
  rig.plant.boot = stance
  rig.plant.z = z
}

/** The rotation taking the frame (a, plane normal na) onto (b, plane normal nb). */
function frameTurn(a: THREE.Vector3, na: THREE.Vector3, b: THREE.Vector3, nb: THREE.Vector3) {
  const basis = (x: THREE.Vector3, z: THREE.Vector3) => {
    const zz = z.clone().addScaledVector(x, -z.dot(x)).normalize()
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(zz, x), zz))
  }
  return basis(b, nb).multiply(basis(a, na).invert())
}

/**
 * Two-bone IK: bend arm `A` so its wrist reaches `target` (in the spine bone's space) with the
 * elbow bending towards `pole` (a direction, or with `poleIsPoint` a point the elbow should
 * rest near), blended over the current pose by `w`. `flex` tips the hand at the wrist.
 */
function reach(A: Rig["arms"][number], target: THREE.Vector3, pole: THREE.Vector3, flex: number, w: number, poleIsPoint = false) {
  const S = A.shoulder.position
  if (poleIsPoint) pole = pole.clone().sub(S)
  const a = A.elbow.position.length()
  const b = A.wrist.position.length()
  const toT = target.clone().sub(S)
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.995)
  const dir = toT.normalize()
  const along = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - along * along))
  const bendDir = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize()
  const E = S.clone().addScaledVector(dir, along).addScaledVector(bendDir, h)
  const T = S.clone().addScaledVector(dir, d)
  // Turn each bone so the arm keeps its natural bending plane from the sculpted pose, not just
  // its direction: then the elbow always flexes the anatomical way, its point on the outside
  const u = E.clone().sub(S).normalize()
  const f = T.sub(E).normalize()
  const n = new THREE.Vector3().crossVectors(u, f)
  if (n.lengthSq() < 1e-6) n.crossVectors(u, bendDir)
  n.normalize()
  const restN = new THREE.Vector3().crossVectors(A.upperRest, A.foreRest).normalize()
  const qShoulder = frameTurn(A.upperRest, restN, u, n)
  const qFore = frameTurn(A.foreRest, restN, f, n)
  const qElbow = qShoulder.clone().invert().multiply(qFore)
  A.shoulder.quaternion.slerp(qShoulder, w)
  A.elbow.quaternion.slerp(qElbow, w)
  A.wrist.quaternion.slerp(rotX(flex), w)
}

/**
 * Where he holds the guitar while playing, in the original sculpt's upper-body units (see BODY):
 * at belly height with the neck running out to his left just above level and angled a little
 * forward, the way players hold it, so the fretting forearm reaches forward. That puts the strings
 * and the frets by the nut about 70-75% of an arm's length from each shoulder, so both elbows
 * bend to roughly a right angle (closer and his long arms have to wing out; further and they
 * lock straight).
 */
const PLAY = { pos: v3(-0.1, -3.6, 1.25), rot: new THREE.Euler(-0.12, -0.38, -1.43) }
const CHORDS = [0, 0.42, 0.18, 0.58]
// Which way each elbow bends, from its own shoulder in the spine's space (x towards his left,
// y up, z forward). While playing the strumming elbow sits out over the guitar's top corner at
// belly height, a little forward, so the forearm drops onto the strings near the bridge
// (further back hides the arm in the coat, higher becomes a chicken wing); the fretting
// elbow drops towards his hip so the forearm angles up and out to the neck. For the smash they swing out to lift it.
const ELBOW_PLAY_R = v3(-0.75, -0.5, 0.4).normalize()
const ELBOW_PLAY_L = v3(0, -1, 0.35).normalize()
const ELBOW_LIFT_R = v3(-0.65, -0.55, 0.3).normalize()
const ELBOW_LIFT_L = v3(0.65, -0.55, 0.3).normalize()

export default function Monkey() {
  const { gl } = useThree()

  const built = useMemo(() => {
    const env = buildEnvironment(gl)
    const deform = { uDraw: { value: 0 }, uPuff: { value: 0 } }

    const root = new THREE.Group()
    root.position.set(0, 1.5, 0)
    root.scale.setScalar(MONKEY_SCALE)

    const HIPS = pivotGroup(POSE.waist, { x: 0, y: 0, z: 0 })
    const UP = pivotGroup(POSE.waist, POSE.upper)
    const HD = pivotGroup(POSE.neck, POSE.head)
    root.add(HIPS.outer)
    HIPS.inner.add(UP.outer)
    UP.inner.add(HD.outer)
    const headGroup = HD.inner

    // 1. Sculpted Head & Procedural Skin
    const TW = 2048
    const TH = 1024
    const proj = projectSphere(headSDF, SEG_W, SEG_H, O, 2.8)
    const maps = paintSkin(proj, SEG_W, SEG_H, O, TW, TH)
    const headGeo = proj.geo

    const map = dataTex(maps.albedo, TW, TH, { srgb: true })
    const normalMap = dataTex(maps.normal, TW, TH)
    const roughnessMap = dataTex(maps.rough, TW, TH)
    const furTex = dataTex(maps.fur, TW, TH)

    const skin = new THREE.MeshPhysicalMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughnessMap,
      roughness: 1,
      metalness: 0,
      clearcoat: 0.1,
      clearcoatRoughness: 0.45,
      clearcoatNormalMap: normalMap,
      envMap: env,
      envMapIntensity: 0.26,
    })
    skin.onBeforeCompile = (sh) => {
      sh.uniforms.uDraw = deform.uDraw
      sh.uniforms.uPuff = deform.uPuff
      sh.vertexShader =
        DEFORM_GLSL +
        "\n" +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed = muzzleDeform(transformed);")
    }
    const headMesh = new THREE.Mesh(headGeo, skin)
    headMesh.castShadow = headMesh.receiveShadow = true
    headGroup.add(headMesh)

    // 2. Sculpted Chimpanzee Ears
    const eGeo = earGeometry()
    const eMat = new THREE.MeshPhysicalMaterial({
      color: hdr(0.085, 0.052, 0.036),
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.45,
      normalMap: poreMap(256),
      normalScale: new THREE.Vector2(1.1, 1.1),
      envMap: env,
      envMapIntensity: 0.22,
      side: THREE.DoubleSide,
    })
    const earsGroup = new THREE.Group()
    ;[-1, 1].forEach((s) => {
      const e = new THREE.Mesh(eGeo, eMat)
      e.position.set(s * 0.95, 0.07, -0.03)
      e.rotation.set(-0.05, s * 1.08, s * -0.12)
      e.scale.set(s * 1.04, 1.06, 1.02)
      e.castShadow = e.receiveShadow = true
      earsGroup.add(e)
    })
    headGroup.add(earsGroup)

    // 3. 54-Layer Shell Fur (Undercoat + Silver-Tipped Guard Hairs)
    const buildShellGroup = (NS: number, own: Record<string, { value: unknown }>, order: number) => {
      const g = new THREE.Group()
      const shared = {
        tFur: { value: furTex },
        uKeyDir: { value: new THREE.Vector3(-0.55, 0.7, 0.45).normalize() },
        uKey: { value: hdr(1.3, 1.3, 1.38) },
        uAmb: { value: hdr(0.08, 0.08, 0.09) },
        uDraw: deform.uDraw,
        uPuff: deform.uPuff,
        ...own,
      }
      for (let i = 0; i < NS; i++) {
        const u = { ...shared, uLevel: { value: (i + 1) / NS } }
        const m = new THREE.Mesh(
          headGeo,
          new THREE.ShaderMaterial({
            uniforms: u,
            vertexShader: FUR_VS,
            fragmentShader: FUR_FS,
          })
        )
        m.renderOrder = order + i
        g.add(m)
      }
      return g
    }
    const furGroup = new THREE.Group()
    furGroup.add(
      buildShellGroup(
        28,
        {
          uLen: { value: 0.065 },
          uDroop: { value: 0.55 },
          uRep: { value: new THREE.Vector2(920, 460) },
          uGuard: { value: 0 },
          uRad: { value: 0.48 },
          uRim: { value: hdr(0.52, 0.54, 0.60) },
          uRoot: { value: hdr(0.007, 0.007, 0.008) },
          uTip: { value: hdr(0.055, 0.055, 0.062) },
        },
        1
      )
    )
    furGroup.add(
      buildShellGroup(
        26,
        {
          uLen: { value: 0.14 },
          uDroop: { value: 1.25 },
          uRep: { value: new THREE.Vector2(480, 240) },
          uGuard: { value: 1 },
          uRad: { value: 0.19 },
          uRim: { value: hdr(1.45, 1.48, 1.6) },
          uRoot: { value: hdr(0.015, 0.015, 0.018) },
          uTip: { value: hdr(0.46, 0.47, 0.52) },
        },
        40
      )
    )
    headGroup.add(furGroup)

    // 4. Swept-Back Silver Wisps
    {
      const pos = headGeo.attributes.position
      const nrm = headGeo.attributes.normal
      const rnd = mulberry32(41)
      const pts: number[] = []
      const col: number[] = []
      const p = new THREE.Vector3()
      const n = new THREE.Vector3()
      const d = new THREE.Vector3()
      const flow = new THREE.Vector3()
      const counts = { beard: 0, cheek: 0, crown: 0 }
      const want = { beard: 420, cheek: 280, crown: 260 }
      for (let tries = 0; tries < 240000; tries++) {
        if (counts.beard >= want.beard && counts.cheek >= want.cheek && counts.crown >= want.crown) break
        const i = (rnd() * pos.count) | 0
        p.fromBufferAttribute(pos, i)
        n.fromBufferAttribute(nrm, i)
        const m = skinMask(p.x, p.y, p.z)
        let kind: "beard" | "cheek" | "crown" | null = null
        if (p.y < -0.42 && p.y > -1.08 && p.z > -0.15 && m < 0.35) kind = "beard"
        else if (p.y > -0.42 && p.y < 0.48 && p.z > 0.02 && m > 0.02 && m < 0.55) kind = "cheek"
        else if (p.y > 0.42 && m < 0.28) kind = "crown"
        if (!kind || counts[kind] >= want[kind]) continue
        counts[kind]++

        if (kind === "crown") {
          flow.set(Math.sign(p.x) * 0.25, -0.15, -0.95).normalize()
        } else if (kind === "cheek") {
          flow.set(Math.sign(p.x) * 0.20, -0.85, -0.48).normalize()
        } else {
          flow.set(-Math.sign(p.x) * 0.12, -0.82, -0.55).normalize()
        }
        flow.addScaledVector(n, -flow.dot(n)).normalize()
        const lift = kind === "crown" ? 0.22 : kind === "cheek" ? 0.26 : 0.20
        d.copy(flow).addScaledVector(n, lift)
        d.x += (rnd() - 0.5) * 0.22
        d.y += (rnd() - 0.5) * 0.18
        d.z += (rnd() - 0.5) * 0.22
        d.normalize()
        const len = kind === "beard" ? 0.085 + rnd() * 0.095 : kind === "cheek" ? 0.065 + rnd() * 0.085 : 0.08 + rnd() * 0.10
        const segs = 7
        const curl = (rnd() - 0.5) * 0.18
        const q = p.clone().addScaledVector(n, 0.008)
        const silver = 0.38 + rnd() * 0.48
        for (let s = 0; s < segs; s++) {
          const a = q.clone()
          const t0 = s / segs
          const t1 = (s + 1) / segs
          d.lerp(flow, 0.28)
          d.y -= 0.03
          d.x += curl * 0.08
          d.normalize()
          q.addScaledVector(d, len / segs)
          pts.push(a.x, a.y, a.z, q.x, q.y, q.z)
          const c0 = lerp(0.03, silver, t0 * t0)
          const c1 = lerp(0.03, silver, t1 * t1)
          col.push(c0, c0, c0 * 1.06, c1, c1, c1 * 1.06)
        }
      }
      const wg = new THREE.BufferGeometry()
      wg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
      wg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
      const wisps = new THREE.LineSegments(
        wg,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.48, depthWrite: false })
      )
      headGroup.add(wisps)
    }

    // 5. Cyber Visor & Laser Eye Beam
    {
      const A = 1.38
      const NA = 120
      const yC = 0.115
      const HT = 0.23
      const DEP = 0.075
      const CZ = 0.10
      const R: number[] = []
      for (let i = 0; i <= NA; i++) {
        const a = -A + (2 * A * i) / NA
        const sx = Math.sin(a)
        const cz = Math.cos(a)
        let m = 0
        for (const yy of [yC - HT * 0.3, yC, yC + HT * 0.3]) m = Math.max(m, rayHit(headSDF, 0, yy, CZ, sx, cz, 2.5))
        R.push(m)
      }
      const Rs = R.map((_, i) => {
        let m = 0
        for (let k = -2; k <= 2; k++) m = Math.max(m, R[clamp(i + k, 0, NA)])
        return m
      })
      const box = (arr: number[], w: number) =>
        arr.map((_, i) => {
          let s = 0
          let n = 0
          for (let k = -w; k <= w; k++) {
            s += arr[clamp(i + k, 0, NA)]
            n++
          }
          return s / n
        })
      const Rb = box(box(Rs, 6), 6)
      const Rf = Rb.map((r, i) => {
        const a = -A + (2 * A * i) / NA
        return r + 0.018 + 0.045 * smooth(0.55, 1.15, Math.abs(a))
      })

      const P: number[] = []
      const idx: number[] = []
      const endT = (i: number) => smooth(0, 10, i) * smooth(NA, NA - 10, i)
      const bridgeDip = (a: number) =>
        -0.026 * Math.exp(-Math.pow(a / 0.22, 2)) + 0.018 * Math.exp(-Math.pow((Math.abs(a) - 0.38) / 0.24, 2))
      const ring = (rOff: number, y: number, isBot: boolean) =>
        Rf.map((r, i) => {
          const a = -A + (2 * A * i) / NA
          const e = endT(i)
          const dip = isBot ? bridgeDip(a) * e : -0.008 * Math.exp(-Math.pow(a / 0.35, 2)) * e
          const yy = yC + (y - yC) * (0.38 + 0.62 * Math.sqrt(e)) + dip
          const rr = r + rOff - (1 - e) * 0.022
          return [Math.sin(a) * rr, yy, CZ + Math.cos(a) * rr]
        })
      const quadStrip = (a: number[][], b: number[][]) => {
        const base = P.length / 3
        for (let i = 0; i <= NA; i++) {
          P.push(...a[i])
          P.push(...b[i])
        }
        for (let i = 0; i < NA; i++) {
          const k = base + i * 2
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
        }
      }
      const oT = ring(0, yC + HT / 2, false)
      const oB = ring(0, yC - HT / 2, true)
      const iT = ring(-DEP, yC + HT / 2, false)
      const iB = ring(-DEP, yC - HT / 2, true)
      const cT = ring(-0.014, yC + HT / 2 + 0.014, false)
      const cB = ring(-0.014, yC - HT / 2 - 0.014, true)
      quadStrip(cT, oT)
      quadStrip(oT, oB)
      quadStrip(oB, cB)
      quadStrip(iT, cT)
      quadStrip(cB, iB)
      quadStrip(iB, iT)
      const vg = new THREE.BufferGeometry()
      vg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
      vg.setIndex(idx)
      vg.computeVertexNormals()

      const shell = new THREE.Mesh(
        vg,
        new THREE.MeshPhysicalMaterial({
          color: hdr(0.014, 0.005, 0.007),
          roughness: 0.14,
          metalness: 0.35,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMap: env,
          envMapIntensity: 1.15,
          side: THREE.DoubleSide,
        })
      )
      shell.castShadow = shell.receiveShadow = true

      const frameMat = new THREE.MeshPhysicalMaterial({
        color: hdr(0.018, 0.018, 0.022),
        roughness: 0.38,
        metalness: 0.75,
        clearcoat: 0.4,
        envMap: env,
        envMapIntensity: 0.9,
      })
      const fP: number[] = []
      const fIdx: number[] = []
      const fQuad = (a: number[][], b: number[][]) => {
        const base = fP.length / 3
        for (let i = 0; i <= NA; i++) {
          fP.push(...a[i])
          fP.push(...b[i])
        }
        for (let i = 0; i < NA; i++) {
          const k = base + i * 2
          fIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
        }
      }
      fQuad(ring(0.004, yC + HT / 2 + 0.022, false), ring(0.004, yC + HT / 2 - 0.006, false))
      fQuad(ring(0.004, yC - HT / 2 + 0.006, true), ring(0.004, yC - HT / 2 - 0.020, true))
      const fg = new THREE.BufferGeometry()
      fg.setAttribute("position", new THREE.Float32BufferAttribute(fP, 3))
      fg.setIndex(fIdx)
      fg.computeVertexNormals()
      const frameMesh = new THREE.Mesh(fg, frameMat)

      const visor = new THREE.Group()
      visor.add(shell, frameMesh)
      ;[-1, 1].forEach((s) => {
        const idxSide = s < 0 ? 11 : NA - 11
        const a = -A + (2 * A * idxSide) / NA
        const r = Rf[idxSide]
        const px = Math.sin(a) * r
        const pz = CZ + Math.cos(a) * r
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.028, 24), frameMat)
        pod.position.set(px, yC, pz)
        pod.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(Math.sin(a), 0, Math.cos(a)).normalize())
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.034, 20), frameMat)
        cap.position.copy(pod.position)
        cap.quaternion.copy(pod.quaternion)
        visor.add(pod, cap)
      })

      const GA = 0.82
      const G: number[] = []
      const gi: number[] = []
      const gb = Math.round((NA * (A - GA)) / (2 * A))
      const ge = NA - gb
      for (let i = gb; i <= ge; i++) {
        const a = -A + (2 * A * i) / NA
        const r = Rf[i] + 0.004
        const e = clamp(Math.min(i - gb, ge - i) / 8, 0, 1)
        const k = 1 - e
        const hBeam = 0.0135 * Math.sqrt(Math.max(0.01, 1 - k * k))
        G.push(
          Math.sin(a) * r,
          yC + hBeam,
          CZ + Math.cos(a) * r,
          Math.sin(a) * r,
          yC - hBeam,
          CZ + Math.cos(a) * r
        )
      }
      for (let i = 0; i < ge - gb; i++) {
        const k = i * 2
        gi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
      }
      const gg = new THREE.BufferGeometry()
      gg.setAttribute("position", new THREE.Float32BufferAttribute(G, 3))
      gg.setIndex(gi)
      const bar = new THREE.Mesh(
        gg,
        new THREE.MeshBasicMaterial({ color: hdr(8.5, 0.14, 0.06), side: THREE.DoubleSide, toneMapped: false })
      )
      visor.add(bar)
      headGroup.add(visor)

      const frontZ = CZ + Rf[NA >> 1]
      const redLight = new THREE.PointLight(0xff2a24, 0.22, 1.4 * MONKEY_SCALE, 1.4)
      redLight.position.set(0, 0.06, frontZ + 0.18)
      headGroup.add(redLight)
    }

    // 6. Cigarette, Ember & Mouth Anchors
    const R = 0.028
    const L = 0.6
    const F = 0.17
    const corner = mouthCorner(0.3, -0.63 + smirk(0.3))
    const dir = new THREE.Vector3(0.84, -0.14, 0.52).normalize()
    const cigGroup = new THREE.Group()
    cigGroup.position.copy(corner).addScaledVector(dir, -0.045)
    cigGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

    const cyl = (r0: number, r1: number, h: number, y: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 28, 1), mat)
      m.position.y = y
      m.castShadow = true
      m.receiveShadow = true
      cigGroup.add(m)
      return m
    }
    cyl(R * 1.02, R * 1.02, F, F / 2, new THREE.MeshStandardMaterial({ color: hdr(0.012, 0.012, 0.014), roughness: 0.7 }))
    cyl(
      R * 1.04,
      R * 1.04,
      0.01,
      F - 0.012,
      new THREE.MeshBasicMaterial({ color: hdr(2.2, 0.06, 0.04), toneMapped: false })
    )
    cyl(R, R, L - F, F + (L - F) / 2, new THREE.MeshStandardMaterial({ color: hdr(0.62, 0.61, 0.6), roughness: 0.75 }))
    const emberMat = new THREE.MeshBasicMaterial({ color: hdr(3.2, 0.6, 0.12), toneMapped: false })
    cyl(R * 1.005, R * 0.96, 0.016, L + 0.008, emberMat)
    cyl(R * 0.95, R * 0.8, 0.04, L + 0.036, new THREE.MeshStandardMaterial({ color: hdr(0.09, 0.09, 0.09), roughness: 1 }))

    const tipAnchor = new THREE.Group()
    tipAnchor.position.set(0, L + 0.06, 0)
    cigGroup.add(tipAnchor)

    const cigLight = new THREE.PointLight(0xff5a28, 0.12, 0.9 * MONKEY_SCALE, 1.4)
    tipAnchor.add(cigLight)

    headGroup.add(cigGroup)

    const mouthAnchor = new THREE.Group()
    mouthAnchor.position.copy(mouthCorner(0.04, -0.64).add(new THREE.Vector3(0, 0, 0.03)))
    headGroup.add(mouthAnchor)

    // 7. 1970s Formal Suit, Swagger Pose Arms, Contrapposto Trousers & Sunburst Les Paul Guitar
    const M = bodyMaterials(env)
    const upper = new THREE.Group()
    const lower = new THREE.Group()
    const gtrBuilt = buildGuitar(M)
    const jacket = buildJacket(M)
    const arms = buildArms(M)
    const legs = buildLegs(M)
    const belt = buildBelt(M)
    upper.add(jacket, arms.group, belt, gtrBuilt.group)
    lower.add(legs.group)
    // Lankier proportions (BODY in store.ts): the torso hangs from the neck and the legs from
    // the waist, both stretched and narrowed. Group-local y is face y - 0.20, so the neck sits
    // at -1.25 and the waist at -4.3.
    const w = BODY.width
    upper.scale.set(1.12 * w, BODY.torso, 1.08 * w)
    upper.position.set(0, POSE.neck.y + 1.25 * BODY.torso, 0.04)
    lower.scale.set(1.12 * w * BODY.hips, BODY.legs, 1.08 * w)
    lower.position.set(0, BODY_WAIST + 4.3 * BODY.legs, 0.04)
    HD.outer.scale.setScalar(BODY.head)
    // Longer arms, hanging from the shoulder line (local y -1.75)
    arms.group.scale.y = BODY.arms
    arms.group.position.y = -1.75 * (1 - BODY.arms)
    arms.group.updateMatrix()

    // Hands, boots, buttons and the guitar keep the original sculpt's shape
    // Wider hips: the coat, waistcoat and belt flare out from the waist (local y -3.6) to
    // the hips (-4.6) and stay wide down the skirt, matching the wider trousers below
    const flared = new Set<THREE.BufferGeometry>()
    upper.updateMatrixWorld(true)
    const upperInv = upper.matrixWorld.clone().invert()
    ;[jacket, belt].forEach((part) =>
      part.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.material === M.button || flared.has(o.geometry)) return
        flared.add(o.geometry)
        const toUpper = upperInv.clone().multiply(o.matrixWorld)
        const toLocal = toUpper.clone().invert()
        const pos = o.geometry.attributes.position as THREE.BufferAttribute
        const p = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(toUpper)
          p.x *= lerp(1, BODY.hips, smooth(-3.6, -4.6, p.y))
          p.applyMatrix4(toLocal)
          pos.setXYZ(i, p.x, p.y, p.z)
        }
        pos.needsUpdate = true
        o.geometry.computeBoundingSphere()
      })
    )

    const keepTorso = v3(1 / w, 1 / BODY.torso, 1 / w)
    const keepHand = keepTorso.clone().multiply(v3(1, 1 / BODY.arms, 1))
    ;([[arms.rHand, R_WR], [arms.lHand, L_WR]] as const).forEach(([hand, W]) => {
      hand.scale.copy(keepHand)
      hand.position.copy(W).sub(W.clone().multiply(keepHand))
    })
    legs.boots.forEach((b) => b.scale.set(0.98 / w, 0.98 / BODY.legs, 0.98 / w))
    gtrBuilt.group.scale.copy(keepTorso)
    jacket.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.material !== M.button) return
      o.updateMatrix()
      const pos = new THREE.Vector3().setFromMatrixPosition(o.matrix)
      o.matrix.setPosition(0, 0, 0).premultiply(new THREE.Matrix4().makeScale(keepTorso.x, keepTorso.y, keepTorso.z)).setPosition(pos)
      o.matrixAutoUpdate = false
    })

    UP.inner.add(upper)
    HIPS.inner.add(lower)

    // Guitar strap, laid over the coat for the playing pose (see PLAY)
    root.updateMatrixWorld(true)
    const playQ = new THREE.Quaternion().setFromEuler(PLAY.rot)
    const onBody = (b: THREE.Vector3) => b.clone().multiplyScalar(1.2).applyQuaternion(playQ).multiply(keepTorso).add(PLAY.pos)
    const strap = buildStrap(M, upper, jacket, onBody(STRAP_BUTTONS[0]), onBody(STRAP_BUTTONS[1]))
    upper.add(strap)

    upper.updateMatrix()
    lower.updateMatrix()
    root.updateMatrixWorld(true)
    const rig = buildRig(root, HIPS, UP.inner, upper.matrix, lower.matrix, legs, arms, jacket)
    const gears: THREE.Object3D[] = []
    root.traverse((o) => {
      if (o.userData.spin) gears.push(o)
    })

    return {
      root,
      upperPivot: UP.outer,
      headPivot: HD.outer,
      deform,
      emberMat,
      cigLight,
      tipAnchor,
      mouthAnchor,
      guitar: gtrBuilt.guitar,
      rig,
      gears,
      fret: 0,
      strap,
    }
  }, [gl])

  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    built.root.updateMatrixWorld(true)
    built.tipAnchor.getWorldPosition(tmp)
    emberWorld.x = tmp.x
    emberWorld.y = tmp.y
    emberWorld.z = tmp.z
    built.mouthAnchor.getWorldPosition(tmp)
    mouthWorld.x = tmp.x
    mouthWorld.y = tmp.y
    mouthWorld.z = tmp.z
  }, [built, tmp])

  useFrame((state, delta) => {
    const t = scroll.value
    const tt = state.clock.elapsedTime

    // 9-second smoking cycle + scroll exhale (matching face.js)
    const CYCLE = 9
    const ct = tt % CYCLE
    // He keeps smoking through the hero, until the long exhale takes over
    const cycleOn = 1 - smooth(0.012, 0.03, t)
    const inhale = cycleOn * smooth(0, 1.1, ct) * (1 - smooth(1.6, 2.1, ct))
    const cyclePuff = cycleOn * smooth(2.2, 2.5, ct) * (1 - smooth(3.5, 4.4, ct))
    const longExhale = smooth(0.02, 0.06, t) * (1 - smooth(0.21, 0.28, t))

    built.deform.uDraw.value = inhale
    built.deform.uPuff.value = Math.max(cyclePuff, longExhale)

    const flicker = 0.06 * Math.sin(tt * 17.0 + Math.sin(tt * 5.0) * 2.0)
    const glow = 0.7 + 0.8 * inhale + flicker
    built.emberMat.color.setRGB(3.2 * glow, 0.6 * glow, 0.12 * glow, THREE.LinearSRGBColorSpace)
    built.cigLight.intensity = 0.12 * glow

    // Standing, he is alive but unhurried: a slow breath, a gentle weight shift and a look
    // around. From the full-body reveal until he reaches for the guitar he walks the runway on
    // the spot; the shoulders counter the hips (less than empty-handed, both hands are on the
    // guitar) and the head cancels most of the torso's sway so his gaze stays steady, chin up.
    // Everything keeps one beat: a down-up strum per step, the downstroke landing as an accent
    // that dips the right shoulder, gives the chest a little and nods the head.
    const strike = smooth(SMASH.strike[0], SMASH.strike[1], t)
    const walk = walkWeight(t)
    const idle = 1 - walk
    const grab = smooth(SMASH.grab[0], SMASH.grab[1], t)
    const playing = 1 - grab
    const ph = (tt / STRIDE) * Math.PI * 2
    const groove = 2 * ph
    const accent = Math.pow(Math.max(0, Math.sin(groove + 0.4)), 3)
    const breath = Math.sin((tt / 4.2) * Math.PI * 2)
    const torsoYaw = -0.09 * Math.sin(ph - 0.2)
    const torsoRoll = -0.05 * Math.cos(ph - 0.15)
    built.upperPivot.rotation.set(
      POSE.upper.x + 0.01 * breath + 0.14 * strike + walk * (-0.04 + 0.01 * Math.cos(2 * ph)) +
        playing * (-0.035 + 0.012 * accent),
      lerp(POSE.upper.y, torsoYaw, walk) + idle * 0.03 * Math.sin(tt * 0.27 + 0.8),
      lerp(POSE.upper.z, torsoRoll, walk) + idle * 0.015 * Math.sin(tt * 0.42) + playing * 0.018 * Math.sin(groove)
    )
    built.headPivot.rotation.set(
      POSE.head.x - 0.006 * breath - 0.04 * longExhale - walk * (0.06 + 0.01 * Math.cos(2 * ph)) +
        idle * 0.025 * Math.sin(tt * 0.47 + 0.4) + playing * 0.02 * accent,
      lerp(POSE.head.y, -0.8 * torsoYaw, walk) + idle * (0.07 * Math.sin(tt * 0.31) + 0.03 * Math.sin(tt * 0.77 + 1.3)),
      lerp(POSE.head.z, -0.8 * torsoRoll - 0.8 * playing * 0.018 * Math.sin(groove), walk) + idle * 0.025 * Math.sin(tt * 0.36 + 2.0)
    )
    // He plays the guitar slung across his front; for the smash he lifts it by the neck,
    // winds up and strikes. Positions are in the sculpt's units, stretched to the body.
    // Hanging on its strap it lags each step a little and dips on the downstroke; the hands
    // follow it.
    const wind = smooth(SMASH.windUp[0], SMASH.windUp[1], t)
    const swing = playing * (walk * 0.03 * Math.sin(ph + 0.7) + idle * 0.012 * Math.sin(tt * 0.8))
    built.guitar.position.set(
      lerp(PLAY.pos.x, 0.0, grab) * BODY.width,
      (lerp(PLAY.pos.y, -1.6, grab) - playing * 0.025 * accent) * BODY.torso,
      (lerp(PLAY.pos.z, 1.2, grab) + 1.4 * strike) * BODY.width
    )
    built.guitar.rotation.set(
      lerp(PLAY.rot.x, 0.12, grab) + 0.8 * wind - 2.1 * strike,
      lerp(PLAY.rot.y, 0, grab) + playing * walk * 0.035 * Math.sin(ph),
      lerp(PLAY.rot.z, 0, grab) + swing
    )

    // The strap only fits the playing pose; it comes off as he lifts the guitar for the smash
    built.strap.visible = grab < 0.02

    poseWalk(built.rig, ph, walk, MONKEY_SCALE)

    // Hands on the guitar, in its local frame (strings along +y, the neck's underside towards
    // +x while he plays, the face towards +z): the right hand strums across the strings by the
    // bridge on the beat, the wrist snapping through each stroke and lifting off the strings on
    // the way up; the chrome left comes up under the neck, thumb behind, presses in on the
    // accents and slides to a new open chord every two strides, up by the headstock.
    // For the smash both hands slide up the neck to grip it.
    const strum = Math.sin(groove)
    const chord = CHORDS[Math.floor(ph / (4 * Math.PI)) % CHORDS.length]
    built.fret += (chord - built.fret) * Math.min(1, delta * 9)
    const spine = built.rig.arms[0].shoulder.parent!
    const toSpine = spine.matrixWorld.clone().invert().multiply(built.guitar.matrixWorld)
    const onGuitar = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(toSpine)
    const [R, L] = built.rig.arms
    reach(
      R,
      onGuitar(lerp(0.2 + 0.14 * strum, 0.02, grab), lerp(-0.78, 0.75, grab), lerp(0.3 + 0.06 * Math.max(0, Math.cos(groove)), -0.12, grab)),
      ELBOW_PLAY_R.clone().lerp(ELBOW_LIFT_R, grab),
      lerp(-0.45 + 0.3 * Math.cos(groove), 0.2, grab),
      1
    )
    reach(
      L,
      onGuitar(lerp(0.2 - 0.03 * accent, -0.05, grab), lerp(2.4 + 0.3 * built.fret, 1.55, grab), lerp(-0.04, -0.06, grab)),
      ELBOW_PLAY_L.clone().lerp(ELBOW_LIFT_L, grab),
      lerp(0.5, 0.25, grab),
      1
    )

    // Arm gears tick over slowly at rest and drive harder while he walks
    const gearDt = Math.min(delta, 0.05)
    for (const g of built.gears) g.rotation.z += gearDt * g.userData.spin * (0.35 + 1.4 * walk)

    built.tipAnchor.getWorldPosition(tmp)
    emberWorld.x = tmp.x
    emberWorld.y = tmp.y
    emberWorld.z = tmp.z

    built.mouthAnchor.getWorldPosition(tmp)
    mouthWorld.x = tmp.x
    mouthWorld.y = tmp.y
    mouthWorld.z = tmp.z
  })

  return <primitive object={built.root} />
}
