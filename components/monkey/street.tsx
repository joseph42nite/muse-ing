"use client"

import * as THREE from "three"
import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { MeshReflectorMaterial } from "@react-three/drei"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { FLOOR, scroll } from "./store"

/*
 * The rain-soaked street he walks down: a road running along z (he walks towards +z, the
 * street recedes behind him), raised sidewalks, and a row of buildings on each side with
 * lit shopfronts, awnings, AC units, pipes, fire escapes and cables strung across.
 * Everything is drawn in code; geometry is merged per material to keep draw calls low.
 */

/** Half-width of the road, the sidewalk's outer edge (the facades), and how far the street runs. */
const ROAD = 4
const FACADE = 7
const Z_NEAR = 26
const Z_FAR = -72
const KERB = 0.15

/** Shopfront and neon trim colours: warm interiors with magenta and cyan accents. */
const GLOWS = [0xffb15c, 0xff8a3d, 0xff4fa0, 0x45d6ff, 0xffd08a]

function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return [c, c.getContext("2d")!] as const
}

function texture(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Wet asphalt: dark aggregate, tar-sealed cracks and a worn dashed centre line. One tile is 8 x 12 units. */
function asphaltTexture() {
  const [c, g] = canvas(512, 768)
  const r = rand(31)
  g.fillStyle = "#2e2d36"
  g.fillRect(0, 0, 512, 768)
  for (let i = 0; i < 14000; i++) {
    const v = 30 + r() * 40
    g.fillStyle = `rgba(${v},${v},${v + 6},${0.35 + r() * 0.4})`
    g.fillRect(r() * 512, r() * 768, 1 + r() * 2, 1 + r() * 2)
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * 512
    const y = r() * 768
    const rr = 30 + r() * 110
    const gr = g.createRadialGradient(x, y, 0, x, y, rr)
    gr.addColorStop(0, `rgba(10,10,14,${0.25 + r() * 0.3})`)
    gr.addColorStop(1, "rgba(10,10,14,0)")
    g.fillStyle = gr
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
  }
  g.strokeStyle = "rgba(8,8,10,0.85)"
  for (let i = 0; i < 18; i++) {
    let x = r() * 512
    let y = r() * 768
    let a = r() * Math.PI * 2
    g.lineWidth = 1 + r() * 2.5
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 14; k++) {
      a += (r() - 0.5) * 0.9
      x += Math.cos(a) * 14
      y += Math.sin(a) * 14
      g.lineTo(x, y)
    }
    g.stroke()
  }
  // Centre line: two worn dashes per tile
  for (let k = 0; k < 2; k++) {
    const y0 = 60 + k * 384
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(214,196,140,${0.25 + r() * 0.45})`
      g.fillRect(250 + r() * 12, y0 + r() * 220, 1 + r() * 3, 1 + r() * 3)
    }
  }
  return c
}

/**
 * Puddles as a roughness map for the reflector: low values mirror sharply, high values blur.
 * Water gathers towards the kerbs, with scattered pools across the road.
 */
function puddleTexture() {
  const [c, g] = canvas(512, 768)
  const r = rand(53)
  g.fillStyle = "rgb(150,150,150)"
  g.fillRect(0, 0, 512, 768)
  const pool = (x: number, y: number, rr: number, sx: number) => {
    for (let k = 0; k < 5; k++) {
      const ox = x + (r() - 0.5) * rr
      const oy = y + (r() - 0.5) * rr * 1.6
      const q = rr * (0.5 + r() * 0.6)
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, q)
      gr.addColorStop(0, "rgba(40,40,40,0.9)")
      gr.addColorStop(0.6, "rgba(40,40,40,0.55)")
      gr.addColorStop(1, "rgba(40,40,40,0)")
      g.save()
      g.translate(ox, oy)
      g.scale(sx, 1)
      g.translate(-ox, -oy)
      g.fillStyle = gr
      g.fillRect(ox - q, oy - q, q * 2, q * 2)
      g.restore()
    }
  }
  for (let i = 0; i < 9; i++) pool(18 + r() * 30, r() * 768, 40 + r() * 40, 0.6)
  for (let i = 0; i < 9; i++) pool(494 - r() * 30, r() * 768, 40 + r() * 40, 0.6)
  for (let i = 0; i < 4; i++) pool(80 + r() * 352, r() * 768, 18 + r() * 26, 1.3)
  return c
}

/** Rain pocks for the reflector's distortion: tiny rings, scrolled every frame so the water shivers. */
function rippleTexture() {
  const [c, g] = canvas(256, 256)
  const r = rand(71)
  g.fillStyle = "#000"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 160; i++) {
    const x = r() * 256
    const y = r() * 256
    const rr = 1.5 + r() * 6
    g.strokeStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`
    g.lineWidth = 0.6 + r()
    g.beginPath()
    g.arc(x, y, rr, 0, Math.PI * 2)
    g.stroke()
  }
  return c
}

/** Wet concrete paving slabs for the sidewalks. One tile is 3 x 3 units. */
function pavingTexture() {
  const [c, g] = canvas(256, 256)
  const r = rand(97)
  g.fillStyle = "#34323c"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 3000; i++) {
    const v = 40 + r() * 30
    g.fillStyle = `rgba(${v},${v},${v + 8},0.5)`
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2)
  }
  g.strokeStyle = "rgba(14,13,18,0.9)"
  g.lineWidth = 3
  for (let k = 0; k <= 2; k++) {
    g.beginPath()
    g.moveTo(0, k * 128)
    g.lineTo(256, k * 128)
    g.moveTo(k * 128, 0)
    g.lineTo(k * 128, 256)
    g.stroke()
  }
  return c
}

/** Grimy upper-storey facade: concrete with streaks, rows of mostly dark windows, a few lit. One tile is 4 x 4 units. */
function facadeTextures() {
  const W = 256
  const H = 256
  const [bc, b] = canvas(W, H)
  const [gc, g] = canvas(W, H)
  const r = rand(113)
  b.fillStyle = "#1c1a26"
  b.fillRect(0, 0, W, H)
  for (let i = 0; i < 60; i++) {
    const x = r() * W
    b.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`
    b.fillRect(x, r() * H * 0.3, 2 + r() * 6, H * (0.3 + r() * 0.7))
  }
  g.fillStyle = "#000"
  g.fillRect(0, 0, W, H)
  const tones = ["#ffb347", "#ffc98a", "#ff9a5c", "#8fd8ff", "#ff7ac0"]
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      const lit = r() < 0.45
      const col = tones[Math.floor(r() * tones.length)]
      const px = 18 + x * 80
      const py = 26 + y * 128
      b.fillStyle = "#0b0a12"
      b.fillRect(px - 4, py - 4, 60, 84)
      b.fillStyle = lit ? col : "#121019"
      b.fillRect(px, py, 52, 76)
      if (lit) {
        g.fillStyle = col
        g.fillRect(px, py, 52, 76)
        b.fillStyle = "rgba(0,0,0,0.35)"
        b.fillRect(px + 25, py, 3, 76)
      }
    }
  }
  return { map: texture(bc, true, [1, 1]), glow: texture(gc, true, [1, 1]) }
}

/** Corrugated roll-down shutter. */
function shutterTexture() {
  const [c, g] = canvas(64, 256)
  for (let y = 0; y < 256; y += 8) {
    const gr = g.createLinearGradient(0, y, 0, y + 8)
    gr.addColorStop(0, "#5b5966")
    gr.addColorStop(0.5, "#3a3843")
    gr.addColorStop(1, "#24222b")
    g.fillStyle = gr
    g.fillRect(0, y, 64, 8)
  }
  return texture(c, true, [1, 1])
}

/** Words and colours for the vertical neon blade signs. */
const SIGN_WORDS = ["LIVE", "BAR", "24H", "NOODLES", "HOTEL", "KARAOKE", "RAMEN", "CLUB", "MUSE", "JAZZ", "PAWN", "OPEN"]
const SIGN_COLORS = ["#ff3fa4", "#2fe6ff", "#ffb347", "#7dff6a", "#b46bff"]

/** A vertical neon sign face: letters stacked down a dark panel, glowing in their tube colour. */
function signTexture(word: string, color: string) {
  const H = 64 * word.length + 48
  const [c, g] = canvas(96, H)
  g.fillStyle = "#07060b"
  g.fillRect(0, 0, 96, H)
  g.strokeStyle = color
  g.lineWidth = 3
  g.shadowColor = color
  g.shadowBlur = 10
  g.strokeRect(6, 6, 84, H - 12)
  g.font = "900 54px Arial Black, Arial, sans-serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  for (let pass = 0; pass < 2; pass++) {
    g.shadowBlur = pass ? 4 : 18
    g.fillStyle = pass ? "#fff6fb" : color
    ;[...word].forEach((ch, i) => g.fillText(ch, 48, 52 + i * 64))
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { tex: t, aspect: H / 96 }
}

type Sign = { x: number; y: number; z: number; s: number; word: number; color: number; flicker: boolean }

type Parts = Record<string, THREE.BufferGeometry[]>

/** Box geometry placed at (x, y, z), optionally rotated about z, with its UVs scaled to world size / tile. */
function box(parts: Parts, key: string, size: [number, number, number], at: [number, number, number], tile?: number, rotZ = 0) {
  const geo = new THREE.BoxGeometry(...size)
  if (tile) {
    // Tile along the face's own extent so windows and slabs keep their size on any box
    const uv = geo.attributes.uv
    const n = geo.attributes.normal
    for (let i = 0; i < uv.count; i++) {
      const sx = Math.abs(n.getX(i)) > 0.5 ? size[2] : size[0]
      uv.setXY(i, uv.getX(i) * (sx / tile), uv.getY(i) * (size[1] / tile))
    }
  }
  if (rotZ) geo.rotateZ(rotZ)
  geo.translate(...at)
  ;(parts[key] ??= []).push(geo)
}

/** Lay out both sides of the street. */
function buildStreet() {
  const parts: Parts = {}
  const signs: Sign[] = []
  const r = rand(211)
  const y0 = FLOOR + KERB
  for (const s of [-1, 1]) {
    let z = Z_NEAR
    while (z > Z_FAR) {
      const w = 4.5 + r() * 4
      const zc = z - w / 2
      const H = 10 + r() * 16
      const shop = 3.8
      const depth = 7
      const xc = s * (FACADE + depth / 2)

      // Upper storeys flush with the sidewalk; the ground floor set back for the shopfront
      box(parts, "facade", [depth, H - shop, w - 0.08], [xc, y0 + shop + (H - shop) / 2, zc], 4)
      box(parts, "dark", [depth - 0.5, shop, w - 0.08], [xc + s * 0.25, y0 + shop / 2, zc])
      // Cornice and the slab over the shopfront
      box(parts, "trim", [0.35, 0.3, w], [s * (FACADE + 0.05), y0 + H - 0.15, zc])
      box(parts, "trim", [0.6, 0.35, w], [s * (FACADE + 0.1), y0 + shop, zc])
      // Pillars either side of the shopfront
      for (const e of [-1, 1]) box(parts, "trim", [0.55, shop, 0.4], [s * (FACADE + 0.2), y0 + shop / 2, zc + e * (w / 2 - 0.25)])

      if (r() < 0.72) {
        // Lit shopfront: a glowing window band over a dark stall riser, mullions across it
        const glow = `glow${Math.floor(r() * GLOWS.length)}`
        box(parts, glow, [0.05, shop - 1.4, w - 1.0], [s * (FACADE + 0.45), y0 + 0.9 + (shop - 1.4) / 2, zc])
        box(parts, "dark", [0.1, 0.9, w - 1.0], [s * (FACADE + 0.45), y0 + 0.45, zc])
        for (let m = 1; m < 3; m++) box(parts, "trim", [0.08, shop - 1.4, 0.07], [s * (FACADE + 0.42), y0 + 0.9 + (shop - 1.4) / 2, zc - w / 2 + 0.5 + ((w - 1) * m) / 3])
        if (r() < 0.65) {
          // Awning angled down over the sidewalk, neon along its front edge
          const reach = 1.5
          box(parts, "awning", [reach, 0.06, w - 0.6], [s * (FACADE - reach / 2 + 0.1), y0 + shop - 0.45, zc], undefined, s * 0.32)
          box(parts, `glow${Math.floor(r() * GLOWS.length)}`, [0.08, 0.08, w - 0.6], [s * (FACADE - reach + 0.14), y0 + shop - 0.94, zc])
        }
      } else {
        box(parts, "shutter", [0.06, shop - 0.3, w - 1.0], [s * (FACADE + 0.45), y0 + (shop - 0.3) / 2, zc], 2.5)
      }

      // Vertical neon blade signs sticking out over the sidewalk: one on every building, often two
      for (let k = r() < 0.5 ? 2 : 1; k > 0; k--) {
        signs.push({
          x: s * (FACADE - 0.75),
          y: y0 + shop + 0.4 + r() * Math.max(0.5, H - shop - 8),
          z: zc + (k === 2 ? -1 : 1) * (w / 2 - 1.2) * r(),
          s,
          word: Math.floor(r() * SIGN_WORDS.length),
          color: Math.floor(r() * SIGN_COLORS.length),
          flicker: r() < 0.18,
        })
      }

      // AC units hanging off the upper storeys
      const acs = 1 + Math.floor(r() * 4)
      for (let k = 0; k < acs; k++) {
        const ay = y0 + shop + 1.4 + r() * (H - shop - 2.6)
        const az = zc + (r() - 0.5) * (w - 1.4)
        box(parts, "metal", [0.6, 0.55, 0.85], [s * (FACADE - 0.3), ay, az])
        box(parts, "dark", [0.02, 0.4, 0.6], [s * (FACADE - 0.61), ay, az])
      }
      // Drainpipe down one corner
      if (r() < 0.7) {
        const pz = zc + (r() < 0.5 ? -1 : 1) * (w / 2 - 0.15)
        const pipe = new THREE.CylinderGeometry(0.07, 0.07, H, 8)
        pipe.translate(s * (FACADE - 0.12), y0 + H / 2, pz)
        ;(parts.metal ??= []).push(pipe)
      }
      // Fire escape: platforms with a rail every few storeys
      if (r() < 0.35) {
        for (let fy = y0 + shop + 2.6; fy < y0 + H - 1.5; fy += 3.2) {
          box(parts, "iron", [1.0, 0.06, w * 0.55], [s * (FACADE - 0.5), fy, zc])
          box(parts, "iron", [0.04, 0.9, w * 0.55], [s * (FACADE - 0.98), fy + 0.45, zc])
          box(parts, "iron", [1.0, 0.04, 0.04], [s * (FACADE - 0.5), fy + 0.9, zc - w * 0.27])
          box(parts, "iron", [1.0, 0.04, 0.04], [s * (FACADE - 0.5), fy + 0.9, zc + w * 0.27])
        }
      }
      z -= w
    }
  }

  // A cross-block closing the far end of the street, so it fades into fog instead of open sky
  box(parts, "facade", [FACADE * 2 + 14, 34, 6], [0, y0 + 17, Z_FAR - 3], 4)

  // Cables sagging across the street between the facades
  const cable: THREE.BufferGeometry[] = []
  for (let k = 0; k < 14; k++) {
    const z = Z_NEAR - 6 - r() * (Z_NEAR - Z_FAR - 10)
    const h = y0 + 7 + r() * 6
    const zb = z + (r() - 0.5) * 4
    const pts = Array.from({ length: 16 }, (_, i) => {
      const u = i / 15
      return new THREE.Vector3(THREE.MathUtils.lerp(-FACADE, FACADE, u), h - Math.sin(u * Math.PI) * (0.6 + r() * 0.3), THREE.MathUtils.lerp(z, zb, u))
    })
    cable.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 5))
  }
  parts.cable = cable

  const merged: Record<string, THREE.BufferGeometry> = {}
  for (const [k, list] of Object.entries(parts)) merged[k] = mergeGeometries(list)!
  return { merged, signs }
}

/** The blade signs, both faces lit; a few buzz and drop out like failing tubes. */
function Signs({ signs }: { signs: Sign[] }) {
  const faces = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof signTexture>>()
    return signs.map((sg) => {
      const key = `${sg.word}-${sg.color}`
      if (!cache.has(key)) cache.set(key, signTexture(SIGN_WORDS[sg.word], SIGN_COLORS[sg.color]))
      const f = cache.get(key)!
      const mat = new THREE.MeshBasicMaterial({ map: f.tex, toneMapped: false, color: new THREE.Color(2.6, 2.6, 2.6) })
      return { mat, height: 1.1 * f.aspect * 0.9 }
    })
  }, [signs])
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x15141b, roughness: 0.5, metalness: 0.6 }), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    signs.forEach((sg, i) => {
      if (!sg.flicker) return
      const on = Math.sin(t * 23 + i * 7) > -0.6 && Math.sin(t * 1.3 + i) > -0.85
      faces[i].mat.color.setScalar(on ? 2.6 : 0.15)
    })
  })
  return (
    <>
      {signs.map((sg, i) => {
        const h = faces[i].height
        return (
          <group key={i} position={[sg.x, sg.y + h / 2, sg.z]}>
            <mesh material={frame}>
              <boxGeometry args={[1.25, h + 0.14, 0.1]} />
            </mesh>
            {[1, -1].map((side) => (
              <mesh key={side} material={faces[i].mat} position={[0, 0, side * 0.056]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                <planeGeometry args={[1.1, h]} />
              </mesh>
            ))}
            <mesh material={frame} position={[sg.s * 0.68, h / 2 - 0.1, 0]}>
              <boxGeometry args={[0.12, 0.08, 0.08]} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** True while the street is on screen low enough for its reflections to show: the strut and the gigs. */
const reflecting = (t: number) => t > 0.28 && t < 0.8

export default function Street() {
  const { size } = useThree()
  const reflector = useRef<THREE.Mesh>(null)
  const plain = useRef<THREE.Mesh>(null)

  const tex = useMemo(() => {
    const roadLen = Z_NEAR - Z_FAR
    return {
      asphalt: texture(asphaltTexture(), true, [1, roadLen / 12]),
      puddles: texture(puddleTexture(), false, [1, roadLen / 12]),
      ripples: texture(rippleTexture(), false, [6, (roadLen / 8) * 6]),
      paving: texture(pavingTexture(), true, [1, roadLen / 3]),
      facade: facadeTextures(),
      shutter: shutterTexture(),
    }
  }, [])

  const { merged: geos, signs } = useMemo(() => buildStreet(), [])

  const mats = useMemo(() => {
    const m: Record<string, THREE.Material> = {
      facade: new THREE.MeshStandardMaterial({
        map: tex.facade.map,
        emissiveMap: tex.facade.glow,
        emissive: 0xffffff,
        emissiveIntensity: 1.4,
        roughness: 0.85,
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.9 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x24222c, roughness: 0.6, metalness: 0.3 }),
      awning: new THREE.MeshStandardMaterial({ color: 0x1a1220, roughness: 0.7, side: THREE.DoubleSide }),
      shutter: new THREE.MeshStandardMaterial({ map: tex.shutter, roughness: 0.55, metalness: 0.5 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x4a4852, roughness: 0.45, metalness: 0.6 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x151319, roughness: 0.5, metalness: 0.6 }),
      cable: new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.6 }),
    }
    GLOWS.forEach((c, i) => {
      m[`glow${i}`] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 3.6, toneMapped: false })
    })
    return m
  }, [tex])

  // Rain keeps the water shivering; the full mirror only renders while the street is on screen
  useFrame((_, dt) => {
    tex.ripples.offset.y -= dt * 0.35
    tex.ripples.offset.x += dt * 0.05
    const on = reflecting(scroll.value)
    if (reflector.current) reflector.current.visible = on
    if (plain.current) plain.current.visible = !on
  })

  const roadLen = Z_NEAR - Z_FAR
  const roadZ = (Z_NEAR + Z_FAR) / 2
  const small = size.width < 700

  return (
    <group>
      {/* Road: a blurred mirror, sharp in the puddles */}
      <mesh ref={reflector} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, roadZ]} receiveShadow>
        <planeGeometry args={[ROAD * 2, roadLen]} />
        <MeshReflectorMaterial
          map={tex.asphalt}
          roughnessMap={tex.puddles}
          distortionMap={tex.ripples}
          distortion={0.08}
          resolution={small ? 512 : 1024}
          blur={[420, 120]}
          mixBlur={1.4}
          mixStrength={10}
          mixContrast={1.15}
          mirror={0.55}
          roughness={1}
          metalness={0.35}
          color="#8a8796"
          depthScale={0}
        />
      </mesh>
      {/* The same road without the extra render pass, for the face shots */}
      <mesh ref={plain} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, roadZ]} receiveShadow visible={false}>
        <planeGeometry args={[ROAD * 2, roadLen]} />
        <meshStandardMaterial map={tex.asphalt} roughnessMap={tex.puddles} roughness={0.6} metalness={0.5} color="#6a6776" />
      </mesh>
      {/* Sidewalks and kerbs */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * (ROAD + FACADE) / 2, FLOOR + KERB, roadZ]} receiveShadow>
            <planeGeometry args={[FACADE - ROAD, roadLen]} />
            <meshStandardMaterial map={tex.paving} roughnessMap={tex.puddles} roughness={0.55} metalness={0.25} />
          </mesh>
          <mesh position={[s * (ROAD + 0.06), FLOOR + KERB / 2, roadZ]}>
            <boxGeometry args={[0.12, KERB, roadLen]} />
            <meshStandardMaterial color={0x45434d} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Manhole cover in the road behind him */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.6, FLOOR + 0.005, -6]}>
        <circleGeometry args={[0.55, 28]} />
        <meshStandardMaterial color={0x1d1c22} roughness={0.35} metalness={0.8} />
      </mesh>
      {Object.entries(geos).map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k]} />
      ))}
      <Signs signs={signs} />
    </group>
  )
}
