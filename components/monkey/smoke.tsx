"use client"

import * as THREE from "three"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { clamp01, ember, mouth, scroll, smooth } from "./store"

const N = 260

function spriteTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  gr.addColorStop(0, "rgba(255,255,255,0.9)")
  gr.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** Drifting cigarette smoke; thicker puffs during the first exhale. */
export function Smoke() {
  const geo = useRef<THREE.BufferGeometry>(null)
  const sim = useMemo(
    () => ({
      pos: new Float32Array(N * 3).fill(-99),
      vel: Array.from({ length: N }, () => new THREE.Vector3()),
      life: Float32Array.from({ length: N }, () => Math.random()),
    }),
    []
  )
  const map = useMemo(() => spriteTexture(), [])

  useFrame(() => {
    const t = scroll.value
    const active = t < 0.66
    const burst = t > 0.14 && t < 0.28
    const src = burst ? mouth : ember
    const { pos, vel, life } = sim
    for (let i = 0; i < N; i++) {
      life[i] += 0.006
      if (life[i] > 1) {
        if (active && (burst || Math.random() < 0.05)) {
          const s = burst ? 0.05 : 0.012
          pos[i * 3] = src.x
          pos[i * 3 + 1] = src.y
          pos[i * 3 + 2] = src.z
          if (burst) {
            // the exhaled cloud drifts out toward where the word is forming
            const tz = WORD.z + (Math.random() - 0.5) * WORD.width
            const ty = WORD.y + (Math.random() - 0.5) * 0.7
            vel[i].set((WORD.x - src.x) / 110, (ty - src.y) / 110, (tz - src.z) / 110).add({ x: (Math.random() - 0.5) * 0.004, y: (Math.random() - 0.5) * 0.004, z: (Math.random() - 0.5) * 0.004 } as THREE.Vector3)
          } else {
            vel[i].set((Math.random() - 0.5) * s * 1.5, 0.004 + Math.random() * 0.01, 0.008 + Math.random() * s)
          }
          life[i] = 0
        } else {
          pos[i * 3 + 1] = -99
          life[i] = 0.99
        }
      }
      pos[i * 3] += vel[i].x
      pos[i * 3 + 1] += vel[i].y
      pos[i * 3 + 2] += vel[i].z
    }
    if (geo.current) geo.current.attributes.position.needsUpdate = true
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[sim.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.6} map={map} transparent opacity={0.28} depthWrite={false} color={0x9a86c8} sizeAttenuation />
    </points>
  )
}

const vert = /* glsl */ `
  uniform float uMix; uniform float uFade; uniform float uTime; uniform float uPx; uniform vec3 uMouth; uniform vec3 uCenter; uniform float uScale;
  attribute vec3 aStart; attribute vec3 aEnd; attribute float aRand; attribute float aDelay;
  varying float vA; varying float vM; varying float vR;
  void main() {
    // each puff leaves the mouth at its own moment (the word is written m to g) and takes a while to arrive
    float m = clamp((uMix - aDelay * 0.4) / 0.6, 0.0, 1.0);
    float e = m * m * (3.0 - 2.0 * m);
    vec3 target = uCenter + (aEnd - uCenter) * uScale;
    vec3 p = mix(uMouth + aStart, target, e);
    // billow: a rising, swirling stream that eases as the puff reaches its letter
    float fly = sin(m * 3.14159);
    float ph = aRand * 40.0 + uTime * 1.6;
    p.y += fly * (0.35 + aRand * 0.4);
    p.x += cos(ph) * fly * 0.22;
    p.z += sin(ph * 0.8) * fly * 0.22;
    // the letters stay smoke: they keep curling and slowly rise
    float live = 0.03 + 0.05 * (1.0 - e);
    p += vec3(sin(uTime * 1.1 + aRand * 40.0), cos(uTime * 0.9 + aRand * 30.0) * 0.8 + 0.2, sin(uTime * 0.8 + aRand * 20.0)) * live;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * uScale * (0.8 + aRand * 0.8) * mix(2.0, 0.95, e) / -mv.z;
    gl_Position = projectionMatrix * mv;
    vA = uFade * smoothstep(0.0, 0.05, m) * mix(0.2, 0.9, e);
    vM = e;
    vR = aRand;
  }
`
const frag = /* glsl */ `
  varying float vA; varying float vM; varying float vR;
  void main() {
    // soft, unlit smoke puff: a feathered disc, grey-lilac, never bright enough to bloom
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float feather = pow(1.0 - d, 1.1);
    vec3 shade = mix(vec3(0.40, 0.36, 0.54), vec3(0.62, 0.58, 0.74), vM * 0.7 + vR * 0.25);
    gl_FragColor = vec4(shade, vA * feather);
  }
`

const WORD = { x: 1.4, y: 2.3, z: 2.7, width: 3.9 }

function buildWordmark(family: string) {
  const W = 1024
  const H = 280
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = `210px ${family}`
  g.fillText("muse-ing", W / 2, H / 2 + 8)
  const data = g.getImageData(0, 0, W, H).data
  const pts: [number, number][] = []
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y])
    }
  }
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pts[i], pts[j]] = [pts[j], pts[i]]
  }
  const count = Math.min(pts.length, 16000)
  const scale = WORD.width / W
  const start = new Float32Array(count * 3)
  const end = new Float32Array(count * 3)
  const rnd = new Float32Array(count)
  const delay = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const [px, py] = pts[i]
    end[i * 3] = WORD.x
    end[i * 3 + 1] = WORD.y - (py - H / 2) * scale
    end[i * 3 + 2] = WORD.z - (px - W / 2) * scale
    const r = Math.random()
    rnd[i] = r
    delay[i] = Math.min(1, 0.92 * (px / W) + 0.08 * Math.random())
    start[i * 3] = (Math.random() - 0.5) * 0.12
    start[i * 3 + 1] = (Math.random() - 0.5) * 0.08
    start[i * 3 + 2] = Math.random() * 0.15
  }
  return { start, end, rnd, delay, count }
}

/** The exhale: smoke particles drift out then settle into the "muse-ing" wordmark. */
export function Wordmark() {
  const [data, setData] = useState<ReturnType<typeof buildWordmark> | null>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)

  useEffect(() => {
    let cancelled = false
    const probe = document.querySelector(".instrument") as HTMLElement | null
    const family = probe ? getComputedStyle(probe).fontFamily : "Georgia, serif"
    const run = async () => {
      try {
        await document.fonts.load(`210px ${family}`, "muse-ing")
      } catch {
        /* fall back to whatever is available */
      }
      if (!cancelled) setData(buildWordmark(family))
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const uniforms = useMemo(
    () => ({ uMix: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uPx: { value: 120 }, uMouth: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3(WORD.x, WORD.y, WORD.z) }, uScale: { value: 1 } }),
    []
  )

  useFrame((state) => {
    // R3F copies the uniforms prop onto the material, so drive the material's own copy.
    const u = mat.current?.uniforms
    if (!u) return
    const t = scroll.value
    u.uMix.value = clamp01((t - 0.15) / 0.095)
    u.uMouth.value.set(mouth.x, mouth.y, mouth.z)
    u.uFade.value = 1 - smooth(0.355, 0.405, t)
    u.uTime.value = state.clock.elapsedTime
    u.uPx.value = state.size.height * 0.06
    // keep the whole word in frame on narrow screens (about 4.9 units from the held camera)
    u.uScale.value = THREE.MathUtils.clamp((3.37 * state.size.width / state.size.height * 0.8) / WORD.width, 0.4, 1)
  })

  if (!data) return null
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.end, 3]} />
        <bufferAttribute attach="attributes-aStart" args={[data.start, 3]} />
        <bufferAttribute attach="attributes-aEnd" args={[data.end, 3]} />
        <bufferAttribute attach="attributes-aRand" args={[data.rnd, 1]} />
        <bufferAttribute attach="attributes-aDelay" args={[data.delay, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  )
}
