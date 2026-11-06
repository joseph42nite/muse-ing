"use client"

import * as THREE from "three"
import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { BODY, BODY_WAIST, ember as emberWorld, look, MONKEY_SCALE, mouth as mouthWorld, scroll, smooth, SMASH, walkWeight } from "./store"

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
  d = smax(d, -sdCap(ax, ly, z, 0.36, -0.60, 0.98, 0, -0.60, 1.28, 0.020), 0.028)
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

        const mline = Math.exp(-Math.pow((ly2 + 0.60) / 0.015, 2)) * (1 - smooth(0.32, 0.39, ax)) * smooth(0.94, 1.04, z)
        kr *= 1 - 0.78 * mline
        kg *= 1 - 0.78 * mline
        kb *= 1 - 0.78 * mline

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
    neon: new THREE.MeshBasicMaterial({ color: hdr(4.2, 0.11, 0.06), toneMapped: false }),
    neonSoft: new THREE.MeshBasicMaterial({ color: hdr(1.6, 0.04, 0.03), toneMapped: false }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: hdr(0.78, 0.81, 0.86),
      metalness: 1,
      roughness: 0.17,
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
    boot: new THREE.MeshPhysicalMaterial({
      color: hdr(0.008, 0.008, 0.010),
      roughness: 0.38,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      normalMap: withRepeat(F.grain, 5, 5),
      normalScale: new THREE.Vector2(0.38, 0.38),
      envMap: env,
      envMapIntensity: 0.35,
    }),
    sole: new THREE.MeshStandardMaterial({ color: hdr(0.016, 0.015, 0.017), roughness: 0.88 }),
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

// Outfit palettes, one per entry in LOOKS (store.ts). Only the cloth, boots and neon trim
// change colour; chrome, fur and the guitar stay as they are.
type Rgb = [number, number, number]
type Wardrobe = "coat" | "lapel" | "seamWelt" | "vest" | "lining" | "dressShirt" | "tie" | "pants" | "boot" | "neon" | "neonSoft"
const WARDROBE: Record<Wardrobe, Rgb>[] = [
  {
    coat: [0.011, 0.011, 0.014], lapel: [0.013, 0.013, 0.017], seamWelt: [0.017, 0.018, 0.023], vest: [0.014, 0.014, 0.018],
    lining: [0.055, 0.006, 0.009], dressShirt: [0.27, 0.28, 0.31], tie: [0.13, 0.009, 0.018], pants: [0.015, 0.015, 0.019],
    boot: [0.008, 0.008, 0.010], neon: [4.2, 0.11, 0.06], neonSoft: [1.6, 0.04, 0.03],
  },
  {
    coat: [0.072, 0.007, 0.013], lapel: [0.04, 0.004, 0.008], seamWelt: [0.055, 0.007, 0.011], vest: [0.048, 0.005, 0.009],
    lining: [0.16, 0.085, 0.018], dressShirt: [0.012, 0.012, 0.014], tie: [0.42, 0.23, 0.05], pants: [0.058, 0.006, 0.011],
    boot: [0.009, 0.006, 0.006], neon: [3.6, 1.35, 0.16], neonSoft: [1.4, 0.52, 0.06],
  },
  {
    coat: [0.46, 0.42, 0.35], lapel: [0.39, 0.36, 0.30], seamWelt: [0.34, 0.31, 0.26], vest: [0.42, 0.39, 0.33],
    lining: [0.014, 0.014, 0.018], dressShirt: [0.012, 0.012, 0.015], tie: [0.008, 0.008, 0.010], pants: [0.43, 0.39, 0.33],
    boot: [0.010, 0.010, 0.012], neon: [0.15, 2.0, 3.6], neonSoft: [0.06, 0.75, 1.4],
  },
]

/**
 * Lets the outfit change mid-walk: each cloth material keeps its current colour in `color`
 * and gets the next look's colour in `uWipeTo`. Everything below a noisy front at world
 * height `uWipe` shows the next look, with a band of the next look's neon along the front.
 */
function wardrobe(M: BodyMats) {
  const shared = { uWipe: { value: -100 }, uWipeEdge: { value: new THREE.Color() } }
  const targets = {} as Record<Wardrobe, THREE.Color>
  for (const key of Object.keys(WARDROBE[0]) as Wardrobe[]) {
    const mat = M[key] as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
    const to = (targets[key] = mat.color.clone())
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWipe = shared.uWipe
      sh.uniforms.uWipeEdge = shared.uWipeEdge
      sh.uniforms.uWipeTo = { value: to }
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWipePos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWipePos = (modelMatrix * vec4(transformed, 1.0)).xyz;")
      const lit = sh.fragmentShader.includes("#include <emissivemap_fragment>")
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWipePos;
uniform float uWipe;
uniform vec3 uWipeEdge;
uniform vec3 uWipeTo;
float wipeHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float wipeNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(wipeHash(i), wipeHash(i + vec3(1, 0, 0)), f.x), mix(wipeHash(i + vec3(0, 1, 0)), wipeHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(wipeHash(i + vec3(0, 0, 1)), wipeHash(i + vec3(1, 0, 1)), f.x), mix(wipeHash(i + vec3(0, 1, 1)), wipeHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
float wipeH = vWipePos.y + 0.45 * wipeNoise(vWipePos * 3.2) + 0.15 * wipeNoise(vWipePos * 11.0);
diffuseColor.rgb = mix(diffuseColor.rgb, uWipeTo, step(wipeH, uWipe));
float wipeBand = smoothstep(0.09, 0.0, abs(wipeH - uWipe));` + (lit ? "" : "\ndiffuseColor.rgb += uWipeEdge * wipeBand;")
        )
      if (lit)
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uWipeEdge * wipeBand * 0.35;"
        )
    }
  }
  return {
    worn: 0,
    to: 0,
    start: -1,
    /** Called each frame; returns nothing, drives the uniforms toward look.index. */
    update(time: number) {
      const want = ((look.index % WARDROBE.length) + WARDROBE.length) % WARDROBE.length
      if (this.start < 0) {
        if (want === this.worn) return
        this.to = want
        this.start = time
        for (const key of Object.keys(targets) as Wardrobe[]) targets[key].setRGB(...WARDROBE[want][key], THREE.LinearSRGBColorSpace)
        shared.uWipeEdge.value.setRGB(...WARDROBE[want].neon, THREE.LinearSRGBColorSpace).multiplyScalar(0.6)
      }
      const u = Math.min(1, (time - this.start) / 1.3)
      // From under the soles (y -3) to above the cap (y ~2), with room for the noise
      shared.uWipe.value = lerp(-3.6, 2.9, u * u * (3 - 2 * u))
      if (u >= 1) {
        for (const key of Object.keys(targets) as Wardrobe[]) (M[key] as THREE.MeshBasicMaterial).color.copy(targets[key])
        shared.uWipe.value = -100
        this.worn = this.to
        this.start = -1
      }
    },
  }
}

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
  into.add(ball(L_SH, 0.28, M.chromeDark, [0.95, 0.98, 0.92]))
  for (let p = 0; p < 3; p++) {
    const py = L_SH.y + 0.06 - p * 0.14
    const pauldron = solidClothShell(
      10,
      18,
      (u, v) => {
        const a = lerp(-0.20, 1.85, u)
        const yy = lerp(py + 0.09, py - 0.09, v)
        const r = (0.325 - p * 0.012) * (1 - 0.12 * Math.pow(v - 0.5, 2))
        return v3(L_SH.x - 0.02 + Math.sin(a) * r, yy, L_SH.z + Math.cos(a) * r * 0.92)
      },
      0.020,
      L_SH
    )
    into.add(mesh(pauldron, p === 1 ? M.chromeDark : M.chrome))
  }
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
  const uArmDir = L_EL.clone().sub(L_SH).normalize()
  into.add(mesh(tubeGeometry([L_SH, L_SH.clone().lerp(L_EL, 0.5), L_EL], (t) => lerp(0.28, 0.225, t), 24, 32), M.chromeDark))
  ;[-1, 1].forEach((sideSign) => {
    const midArm = L_SH.clone().lerp(L_EL, 0.5)
    const plate = solidClothShell(
      16,
      14,
      (u, v) => {
        const c = L_SH.clone().lerp(L_EL, lerp(0.14, 0.88, v))
        const a = (sideSign > 0 ? 0.35 : Math.PI - 0.35) + (u - 0.5) * 1.35
        const swell = Math.sin(v * Math.PI) * 0.044
        const r = lerp(0.295, 0.245, v) + swell
        return v3(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)
      },
      0.018,
      midArm
    )
    into.add(mesh(plate, M.chrome))
  })

  into = lElbow
  const elbowDrum = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.28, 28), M.chromeDark)
  elbowDrum.rotation.x = Math.PI / 2
  elbowDrum.position.copy(L_EL)
  into.add(elbowDrum)
  into.add(ball(L_EL, 0.255, M.chrome, [1.05, 0.75, 0.85]))
  into.add(ringAt(L_EL, uArmDir, 0.252, 0.009, M.neon))

  const foreDir = L_WR.clone().sub(L_EL).normalize()
  const foreSide = v3(0, 0, 1).cross(foreDir).normalize()
  const midFore = L_EL.clone().lerp(L_WR, 0.5)
  into.add(mesh(tubeGeometry([L_EL, midFore, L_WR], (t) => lerp(0.24, 0.178, t), 24, 32), M.chromeDark))
  for (let seg = 0; seg < 2; seg++) {
    const v0 = seg === 0 ? 0.10 : 0.52
    const v1 = seg === 0 ? 0.48 : 0.90
    const fPlate = solidClothShell(
      12,
      20,
      (u, v) => {
        const t = lerp(v0, v1, v)
        const c = L_EL.clone().lerp(L_WR, t)
        const a = lerp(-0.65, Math.PI + 0.65, u)
        const r = lerp(0.272, 0.205, t) * (1 + 0.06 * Math.cos(a * 2))
        return v3(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)
      },
      0.018,
      midFore
    )
    into.add(mesh(fPlate, M.chrome))
  }
  ;[-1, 1].forEach((s) => {
    const pA = L_EL.clone().addScaledVector(foreSide, s * 0.19).addScaledVector(foreDir, 0.18)
    const pB = L_WR.clone().addScaledVector(foreSide, s * 0.15).addScaledVector(foreDir, -0.10)
    into.add(mesh(tubeGeometry([pA, pA.clone().lerp(pB, 0.55)], () => 0.028, 12, 8), M.chromeDark))
    into.add(mesh(tubeGeometry([pA.clone().lerp(pB, 0.45), pB], () => 0.018, 10, 8), M.chrome))
  })

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

function bootSDF(x: number, y: number, z: number) {
  let d = sdCap(x, y, z, 0, -0.42, -0.04, 0, -0.28, -0.04, 0.14)
  d = smin(d, sdRB(x, y, z, 0, -0.42, 0.28, 0.22, 0.10, 0.56, 0.08), 0.07)
  d = smin(d, sdRB(x, y, z, 0, -0.43, 0.76, 0.17, 0.075, 0.22, 0.06), 0.05)
  return Math.max(d, -(y + 0.52))
}

function soleSDF(x: number, y: number, z: number) {
  const qx = Math.abs(x) - 0.23 * (1 - 0.28 * smooth(0.38, 0.95, z))
  const qy = Math.abs(y + 0.55) - 0.028
  const qz = Math.abs(z - 0.35) - 0.59
  const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
  const heel = sdRB(x, y, z, 0, -0.58, -0.08, 0.19, 0.045, 0.16, 0.02)
  return Math.min(o - 0.030, heel)
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

  const boot = projectSphere(bootSDF, 88, 64, v3(0, -0.25, 0.25), 1.8)
  const sole = projectSphere(soleSDF, 64, 48, v3(0, -0.56, 0.36), 1.6)
  ;[R_AN, L_AN].forEach((A, i) => {
    const b = new THREE.Group()
    b.position.set(A.x, FLOOR_Y + 0.62 * 0.98, A.z)
    b.rotation.y = BOOT_YAW[i]
    b.scale.setScalar(0.98)
    b.add(mesh(boot.geo, M.boot), mesh(sole.geo, M.sole))
    // Heel and toe contact points, used to keep the stance foot on the floor
    ;[v3(0, -0.6, -0.2), v3(0, -0.58, 0.92)].forEach((p) => {
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

  const bridge = mesh(new THREE.BoxGeometry(0.32, 0.06, 0.04), M.chrome)
  bridge.position.set(0, -0.32, 0.13)
  gtr.add(bridge)
  for (let s = 0; s < 6; s++) {
    const sx = -0.065 + s * 0.026
    const str = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 3.15, 6), M.chrome, false)
    str.position.set(sx, 1.25, 0.105)
    gtr.add(str)
  }

  gtr.position.set(0.38, -2.50, -0.76)
  gtr.rotation.set(0.12, Math.PI + 0.14, 0.54)
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
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || o.userData.marker) items.push(o)
  })
  const rels = items.map((o) => inv.clone().multiply(o.matrixWorld))
  items.forEach((o, i) => {
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

  return { hips: hips.outer, legs: legRig, arms: armRig, skirt, markers, restLow }
}

type Rig = ReturnType<typeof buildRig>

/** Seconds per full gait cycle (two steps) — an unhurried runway pace. */
const STRIDE = 1.3
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const QI = new THREE.Quaternion()
const rotX = (a: number) => new THREE.Quaternion().setFromAxisAngle(X_AXIS, a)
const rotY = (a: number) => new THREE.Quaternion().setFromAxisAngle(Y_AXIS, a)
/** Unit direction hanging down, pitched forward by `pitch` (radians) with a sideways lean. */
const hang = (side: number, pitch: number) => v3(side, -Math.cos(pitch), Math.sin(pitch)).normalize()
const aim = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(from, to)

/**
 * Pose the strut at gait phase `ph`, blended in by `w` (0 = sculpted pose, 1 = full walk):
 * wide hip sway with the free hip dropping, feet crossing onto one line, and loose arms held
 * off the body that trail the legs.
 */
function poseWalk(rig: Rig, ph: number, w: number, rootScale: number) {
  const sway = 0.17 * Math.cos(ph)
  const yaw = 0.17 * Math.sin(ph)
  rig.hips.position.set(POSE.waist.x + sway * w, POSE.waist.y, POSE.waist.z)
  rig.hips.rotation.set(0, yaw * w, 0.13 * Math.cos(ph) * w)

  rig.legs.forEach((L) => {
    const si = ph + (L.s > 0 ? Math.PI : 0)
    const sn = Math.sin(si)
    const pitch = 0.40 * sn
    const bend = 0.08 + 0.95 * Math.pow(Math.max(0, Math.cos(si + 0.6)), 2)
    // Feet cross onto one line under the body, catwalk style
    const lat = (-L.s * 0.04 - sway - L.hipAt.x) / (L.lenT + L.lenS)
    const qHip = aim(L.thighRest, hang(lat, pitch))
    const qShin = aim(L.shinRest, hang(lat, pitch - bend))
    const qKnee = qHip.clone().invert().multiply(qShin)
    const toesUp = sn > 0 ? 0.22 * sn : 0.5 * sn
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
    const swing = 0.05 - 0.42 * Math.sin(si)
    const bend = 0.34 + 0.3 * Math.max(0, swing)
    const qShoulder = aim(A.upperRest, hang(A.s * (0.34 + 0.06 * Math.cos(si)), swing))
    const qFore = aim(A.foreRest, hang(A.s * 0.26, swing + bend))
    const qElbow = qShoulder.clone().invert().multiply(qFore)
    const qWrist = qFore.clone().invert().multiply(rotX(-0.8 * (swing + bend) + 0.25 * Math.sin(si - 0.6)))
    A.shoulder.quaternion.slerpQuaternions(QI, qShoulder, w)
    A.elbow.quaternion.slerpQuaternions(QI, qElbow, w)
    A.wrist.quaternion.slerpQuaternions(QI, qWrist, w)
  })

  // Drop the hips until the lowest heel or toe touches the floor again
  rig.hips.updateMatrixWorld(true)
  let low = Infinity
  for (const m of rig.markers) low = Math.min(low, m.matrixWorld.elements[13])
  rig.hips.position.y += (rig.restLow - low) / rootScale
}

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
    const outfit = wardrobe(M)
    const upper = new THREE.Group()
    const lower = new THREE.Group()
    const gtrBuilt = buildGuitar(M)
    const jacket = buildJacket(M)
    const arms = buildArms(M)
    const legs = buildLegs(M)
    upper.add(jacket, arms.group, buildBelt(M), gtrBuilt.group)
    lower.add(legs.group)
    // Lankier proportions (BODY in store.ts): the torso hangs from the neck and the legs from
    // the waist, both stretched and narrowed. Group-local y is face y - 0.20, so the neck sits
    // at -1.25 and the waist at -4.3.
    const w = BODY.width
    upper.scale.set(1.12 * w, BODY.torso, 1.08 * w)
    upper.position.set(0, POSE.neck.y + 1.25 * BODY.torso, 0.04)
    lower.scale.set(1.12 * w, BODY.legs, 1.08 * w)
    lower.position.set(0, BODY_WAIST + 4.3 * BODY.legs, 0.04)
    HD.outer.scale.setScalar(BODY.head)
    // Longer arms, hanging from the shoulder line (local y -1.75)
    arms.group.scale.y = BODY.arms
    arms.group.position.y = -1.75 * (1 - BODY.arms)
    arms.group.updateMatrix()

    // Hands, boots, buttons and the guitar keep the original sculpt's shape
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

    upper.updateMatrix()
    lower.updateMatrix()
    root.updateMatrixWorld(true)
    const rig = buildRig(root, HIPS, UP.inner, upper.matrix, lower.matrix, legs, arms, jacket)

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
      outfit,
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

  useFrame((state) => {
    const t = scroll.value
    const tt = state.clock.elapsedTime

    // 9-second smoking cycle + scroll exhale (matching face.js)
    const CYCLE = 9
    const ct = tt % CYCLE
    const scrolled = smooth(0, 0.02, t)
    const cycleOn = 1 - scrolled
    const inhale = cycleOn * smooth(0, 1.1, ct) * (1 - smooth(1.6, 2.1, ct))
    const cyclePuff = cycleOn * smooth(2.2, 2.5, ct) * (1 - smooth(3.5, 4.4, ct))
    const longExhale = smooth(0.02, 0.06, t) * (1 - smooth(0.21, 0.28, t))

    built.deform.uDraw.value = inhale
    built.deform.uPuff.value = Math.max(cyclePuff, longExhale)

    const flicker = 0.06 * Math.sin(tt * 17.0 + Math.sin(tt * 5.0) * 2.0)
    const glow = 0.7 + 0.8 * inhale + flicker
    built.emberMat.color.setRGB(3.2 * glow, 0.6 * glow, 0.12 * glow, THREE.LinearSRGBColorSpace)
    built.cigLight.intensity = 0.12 * glow

    // Subtle idle breathing sway around the contrapposto swagger pose; from the
    // full-body reveal until he reaches for the guitar he walks the runway on the spot,
    // shoulders countering the hips and the head held level, chin up.
    const strike = smooth(SMASH.strike[0], SMASH.strike[1], t)
    const walk = walkWeight(t)
    const ph = (tt / STRIDE) * Math.PI * 2
    built.upperPivot.rotation.set(
      POSE.upper.x + Math.sin(tt * 1.2) * 0.004 + 0.14 * strike + walk * (-0.06 + 0.02 * Math.cos(2 * ph)),
      lerp(POSE.upper.y, -0.3 * Math.sin(ph - 0.2), walk) + Math.sin(tt * 0.5) * 0.008,
      lerp(POSE.upper.z, -0.17 * Math.cos(ph - 0.15), walk) + Math.sin(tt * 0.9) * 0.004
    )
    built.headPivot.rotation.set(
      POSE.head.x + Math.sin(tt * 0.7) * 0.006 - 0.04 * longExhale - walk * (0.08 + 0.025 * Math.cos(2 * ph - 0.5)),
      lerp(POSE.head.y, 0.16 * Math.sin(ph - 0.4), walk) + Math.sin(tt * 0.4) * 0.012,
      lerp(POSE.head.z, 0.1 * Math.cos(ph - 0.3), walk)
    )
    poseWalk(built.rig, ph, walk, MONKEY_SCALE)
    built.outfit.update(tt)

    // Scene 6 guitar smash choreography
    const grab = smooth(SMASH.grab[0], SMASH.grab[1], t)
    const wind = smooth(SMASH.windUp[0], SMASH.windUp[1], t)
    built.guitar.position.set(
      lerp(0.38, 0.0, grab) * BODY.width,
      lerp(-2.50, -1.60, grab) * BODY.torso,
      (lerp(-0.76, 1.20, grab) + 1.4 * strike) * BODY.width
    )
    built.guitar.rotation.set(
      0.12 + 0.8 * wind - 2.1 * strike,
      lerp(Math.PI + 0.14, 0, grab),
      lerp(0.54, 0, grab)
    )

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
