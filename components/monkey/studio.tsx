"use client"

import * as THREE from "three"
import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { MeshReflectorMaterial } from "@react-three/drei"
import { FLOOR, GLITCH_GLYPHS, scroll, smooth, travel } from "./store"

/*
 * The studio he stands in, after the reference: a seamless deep-red backdrop that glows in the
 * middle of the frame and falls away to near-black at the edges under film grain, a glossy red
 * floor that softly mirrors him and fades into the backdrop, white light bars floating at
 * every depth, and dust in the air. The giant hero title hangs here too, behind his head.
 */

function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/**
 * Screen-space backdrop: a radial red glow, vignette and moving grain, wherever the camera points.
 * The sphere rides on the camera so it never falls past the far plane, however far back the shot is.
 */
export function Backdrop() {
  const { size } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }), [])
  useFrame((state, dt) => {
    uniforms.uTime.value += dt
    uniforms.uRes.value.set(state.gl.domElement.width, state.gl.domElement.height)
    mesh.current?.position.copy(state.camera.position)
  })
  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[60, 32, 16]} />
      <shaderMaterial
        key={size.width}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader="void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
        fragmentShader={`
          uniform float uTime;
          uniform vec2 uRes;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main(){
            vec2 uv = gl_FragCoord.xy / uRes;
            vec2 q = (uv - vec2(0.5, 0.52)) * vec2(uRes.x / uRes.y, 1.0);
            float r = length(q);
            vec3 core = vec3(0.62, 0.035, 0.05);
            vec3 mid = vec3(0.42, 0.02, 0.035);
            vec3 edge = vec3(0.09, 0.005, 0.012);
            vec3 c = mix(core, mid, smoothstep(0.0, 0.55, r));
            c = mix(c, edge, smoothstep(0.45, 1.25, r));
            // Film grain, fresh every frame
            c += (hash(uv * uRes + fract(uTime * 7.0) * 100.0) - 0.5) * 0.05;
            gl_FragColor = vec4(c, 1.0);
          }
        `}
      />
    </mesh>
  )
}

/** Radial alpha so the floor fades into the backdrop instead of ending at a hard edge. */
function floorFade() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, "#fff")
  gr.addColorStop(0.45, "#ddd")
  gr.addColorStop(1, "#000")
  g.fillStyle = gr
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/** Worn studio-floor finish: faint speckle, scuffs and panel seams, so you can see it move under him. */
function floorWear() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  const r = rand(41)
  g.fillStyle = "rgb(205,205,205)"
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const v = 150 + r() * 105
    g.fillStyle = `rgba(${v},${v},${v},0.5)`
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
  g.strokeStyle = "rgba(120,120,120,0.35)"
  for (let i = 0; i < 70; i++) {
    const x = r() * 512
    const y = r() * 512
    const a = r() * Math.PI
    const len = 10 + r() * 60
    g.lineWidth = 0.6 + r() * 1.4
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  g.fillStyle = "rgba(90,90,90,0.55)"
  g.fillRect(0, 0, 512, 3)
  g.fillRect(0, 0, 3, 512)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const FLOOR_R = 34
/** Floor finish tiles across the floor's diameter. */
const FLOOR_TILES = 12

/** Glossy red studio floor: a soft, blurred mirror of him and the light bars, travelling under his boots. */
export function StudioFloor() {
  const { size } = useThree()
  const fade = useMemo(() => floorFade(), [])
  const wear = useMemo(() => {
    const t = floorWear()
    t.repeat.set(FLOOR_TILES, FLOOR_TILES)
    return t
  }, [])
  useFrame(() => {
    // Keep the finish locked to the world as it travels with his planted boot
    wear.offset.y = (FLOOR_TILES * travel.z) / (FLOOR_R * 2)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, 0]} receiveShadow>
      <circleGeometry args={[FLOOR_R, 64]} />
      <MeshReflectorMaterial
        map={wear}
        alphaMap={fade}
        transparent
        resolution={size.width < 700 ? 512 : 1024}
        blur={[260, 80]}
        mixBlur={0.9}
        mixStrength={3.2}
        mixContrast={1.1}
        mirror={0.6}
        roughness={0.55}
        metalness={0.3}
        color="#7a0a12"
        depthScale={0}
      />
    </mesh>
  )
}

/** White light bars hanging in the air at every depth, drifting and turning slowly. */
export function LightBars() {
  const group = useRef<THREE.Group>(null)
  const bars = useMemo(() => {
    const r = rand(17)
    return Array.from({ length: 16 }, () => {
      // Keep them off the line between the face-shot cameras and his head
      let x = (r() - 0.5) * 16
      const z = -9 + r() * 10
      if (z > -1.5 && Math.abs(x) < 2.2) x = Math.sign(x || 1) * (2.2 + r() * 3)
      return {
        pos: new THREE.Vector3(x, -4 + r() * 9, z),
        rot: new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI),
        len: 1.4 + r() * 3.2,
        spin: (r() - 0.5) * 0.25,
        bob: r() * Math.PI * 2,
      }
    })
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.3), toneMapped: false }), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current?.children.forEach((m, i) => {
      const b = bars[i]
      // They travel with the floor as he walks, wrapping round; bars near the middle stay
      // behind the face-shot cameras
      const near = Math.abs(b.pos.x) < 2.2
      const z0 = -14
      const span = (near ? -1.5 : 1.5) - z0
      const z = z0 + ((((b.pos.z + travel.z - z0) % span) + span) % span)
      m.position.set(b.pos.x, b.pos.y + Math.sin(t * 0.35 + b.bob) * 0.25 + scroll.value * 2.5 * ((i % 3) - 1), z)
      m.rotation.set(b.rot.x + t * b.spin, b.rot.y, b.rot.z + t * b.spin * 0.6)
    })
  })
  return (
    <group ref={group}>
      {bars.map((b, i) => (
        <mesh key={i} material={mat}>
          <capsuleGeometry args={[0.045, b.len, 4, 10]} />
        </mesh>
      ))}
    </group>
  )
}

/** Fine dust floating in the studio light. */
export function Dust() {
  const ref = useRef<THREE.Points>(null)
  const N = 500
  const pos = useMemo(() => {
    const r = rand(29)
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) a.set([(r() - 0.5) * 18, -5 + r() * 11, -10 + r() * 13], i * 3)
    return a
  }, [])
  const lastTravel = useRef(0)
  useFrame((_, dt) => {
    const g = ref.current?.geometry.attributes.position
    if (!g) return
    const a = g.array as Float32Array
    const dz = travel.z - lastTravel.current
    lastTravel.current = travel.z
    for (let i = 0; i < N; i++) {
      a[i * 3 + 1] += dt * 0.08
      if (a[i * 3 + 1] > 6) a[i * 3 + 1] -= 11
      // Drift past him with the floor as he walks, wrapping round
      a[i * 3 + 2] += dz
      if (a[i * 3 + 2] < -10) a[i * 3 + 2] += 13
      if (a[i * 3 + 2] > 3) a[i * 3 + 2] -= 13
    }
    g.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={0xffd6d6} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  )
}

/** Title plate canvas height: the word on top, the smaller line under it (width is 2048). */
const TITLE_H = 900
/** Baselines (middle of the letters) for the word and the line under it, in canvas pixels. */
const WORD_Y = 290
const SUB_Y = 468

/** How far below the top of the frame the title plate starts, as a share of the frame height (the overlay's hairline sits under it). */
const TITLE_TOP = 0.09
/** Widest the title plate may get, as a share of the frame height (keeps it legible on wide screens). */
const TITLE_MAX_H = 0.95
/** On wide screens, where the plate is capped, it starts higher up, so the word and the line under it clear his head. */
const TITLE_TOP_WIDE = 0.03

/**
 * The giant hero title, hung behind his head on a plate that faces the camera across the top of
 * the frame, so the head covers part of it like the reference. It glitches in on load: each
 * letter flickers through broken block glyphs and snaps into place at its own moment. Then, as
 * you start to scroll, the word folds into its logo: the letters after the dash slide into it
 * and vanish, then the M slides right over the letters up to the dash, swallowing them,
 * leaving "M-" centred in the frame. A smaller line (`sub`) sits under the word and stays put.
 */
export function BackTitle({ text, sub = "" }: { text: string; sub?: string }) {
  const { camera } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const dash = text.indexOf("-")
  const cv = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 2048
    c.height = TITLE_H
    return c
  }, [])
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [cv])
  const anim = useRef({ ready: false, start: 0, last: "", family: "Arial Black" })

  useEffect(() => {
    const display = getComputedStyle(document.body).getPropertyValue("--font-display").trim()
    const family = `${display || "Archivo"}, "Arial Black", sans-serif`
    document.fonts
      .load(`800 expanded 200px ${family}`, text + sub)
      .catch(() => {})
      .finally(() => {
        anim.current.family = family
        anim.current.ready = true
        anim.current.start = performance.now() + 450
      })
  }, [text, sub])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const t = scroll.value
    const vis = 1 - smooth(0.06, 0.11, t)
    m.visible = vis > 0.01
    ;(m.material as THREE.MeshBasicMaterial).opacity = vis

    // Hang the plate behind his head, square to the camera, across the top of the frame
    const cam = camera as THREE.PerspectiveCamera
    const D = 7
    const h = 2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const w = h * cam.aspect
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
    // Full width on phones, but capped by the frame height on wide screens: otherwise the dark
    // word runs out into the near-black vignette at the edges and the line under it drops down
    // behind his head. Keep TITLE_MAX_H in step with the overlay's hairline (overlay.tsx).
    const wide = w * 0.96 > h * TITLE_MAX_H
    const plateW = wide ? h * TITLE_MAX_H : w * 0.96
    const plateH = plateW * (cv.height / cv.width)
    const top = wide ? TITLE_TOP_WIDE : TITLE_TOP
    m.position.copy(cam.position).addScaledVector(fwd, D).addScaledVector(up, h / 2 - plateH / 2 - h * top)
    m.quaternion.copy(cam.quaternion)
    m.scale.set(plateW, plateH, 1)

    if (!anim.current.ready) return

    // Glitch-in: each letter settles at its own moment
    const p = (performance.now() - anim.current.start) / 1300
    const glitch = (str: string, seed: number) =>
      [...str].map((ch, i) => {
        if (ch === " ") return ch
        const settle = 0.15 + ((((i + seed) * 7919) % 13) / 13) * 0.75
        return p >= settle ? ch : p < 0 ? " " : Math.random() < 0.18 ? ch : GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)]
      })
    const glyphs = glitch(text, 0)
    const subGlyphs = glitch(sub, 5).join("")
    // Fold into the logo on scroll: the tail into the dash, then the dash into the word
    const fold = smooth(0.005, 0.05, t)
    const a = smooth(0, 0.5, fold)
    const b = smooth(0.5, 1, fold)
    const key = glyphs.join("") + subGlyphs + a.toFixed(3) + b.toFixed(3)
    if (key === anim.current.last) return
    anim.current.last = key

    const g = cv.getContext("2d")!
    const fontPx = 300
    g.font = `800 expanded ${fontPx}px ${anim.current.family}`
    if ("fontStretch" in g) (g as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "expanded"
    // Lay the word out letter by letter, scaled to fit, using the real letters' widths
    const widths = [...text].map((ch) => g.measureText(ch).width)
    const total = widths.reduce((s, x) => s + x, 0)
    const k = Math.min(1, (cv.width * 0.94) / total)
    const left: number[] = []
    widths.reduce((x, wd, i) => ((left[i] = x), x + wd * k), 0)
    const right = (i: number) => left[i] + widths[i] * k
    const tailShift = a * (right(text.length - 1) - right(dash))
    // The word starts centred as a whole; once folded, "M-" sits centred on its own
    const ox = (cv.width - right(text.length - 1)) / 2
    const wM = widths[0] * k
    const wDash = widths[dash] * k
    const mEnd = (cv.width - wM - wDash) / 2 - ox
    // The M slides right into the dash, and the dash eases over so the pair ends up centred
    const mL = left[0] + b * (mEnd - left[0])
    const dashL = left[dash] + b * (mEnd + wM - left[dash])
    const mR = mL + wM

    g.clearRect(0, 0, cv.width, cv.height)
    // The smaller line tucked under the word, in off-white and widely tracked; it stays put while the word folds
    if (sub) {
      g.save()
      g.font = `800 expanded 118px ${anim.current.family}`
      if ("fontStretch" in g) (g as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "expanded"
      if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "26px"
      g.fillStyle = "#f4efe6"
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillText(subGlyphs, cv.width / 2, SUB_Y, cv.width * 0.9)
      g.restore()
      g.font = `800 expanded ${fontPx}px ${anim.current.family}`
    }
    g.save()
    g.translate(ox, WORD_Y)
    g.scale(k, k)
    g.fillStyle = "#0c0204"
    g.textBaseline = "middle"
    const draw = (i: number, x: number) => g.fillText(glyphs[i], x / k, 0)
    // The letters between the M and the dash, swallowed by the M as it slides over them
    if (b < 1) {
      g.save()
      g.beginPath()
      g.rect(mR / k, -1e4, Math.max(0, dashL - mR) / k, 2e4)
      g.clip()
      for (let i = 1; i < dash; i++) draw(i, left[i])
      g.restore()
    }
    draw(0, mL)
    // The letters after the dash, sliding into it and vanishing past its far edge (where it
    // stood before it moved, so they stay gone once the dash slides back into the word)
    if (a < 1) {
      g.save()
      g.beginPath()
      g.rect(right(dash) / k, -1e4, 1e5, 2e4)
      g.clip()
      for (let i = dash + 1; i < text.length; i++) draw(i, left[i] - tailShift)
      g.restore()
    }
    draw(dash, dashL)
    g.restore()
    tex.needsUpdate = true
  })

  return (
    <mesh ref={mesh} renderOrder={-5} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
