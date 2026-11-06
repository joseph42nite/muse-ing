"use client"

import * as THREE from "three"
import { useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import Monkey from "./monkey"
import { Smoke, Wordmark } from "./smoke"
import { FLOOR, PROFILE_SHIFT, profileFraming, sampleCamera, scroll, smooth, SMASH, walkFraming, win } from "./store"

const GLASS_Z = 1.8

function Rig() {
  const { camera, size } = useThree()
  useFrame((_, dt) => {
    scroll.value = THREE.MathUtils.damp(scroll.value, scroll.target, 4.5, Math.min(dt, 0.05))
    const { p, l } = sampleCamera(scroll.value)
    camera.position.set(p[0], p[1], p[2])
    camera.lookAt(l[0], l[1], l[2])

    // Slide the frame without changing the perspective: on landscape screens he walks right of
    // centre; on portrait ones the side profile is pulled in from the right edge
    const shift =
      size.width > size.height * 1.1
        ? 0.14 * walkFraming(scroll.value)
        : size.width < size.height * 0.85
          ? -PROFILE_SHIFT * profileFraming(scroll.value)
          : 0
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(shift) > 0.001) cam.setViewOffset(size.width, size.height, -shift * size.width, 0, size.width, size.height)
    else if (cam.view?.enabled) cam.clearViewOffset()
  })
  return null
}

function Lights() {
  const rim = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (rim.current) rim.current.intensity = 18 + Math.sin(state.clock.elapsedTime * 2) * 2
  })
  return (
    <>
      <hemisphereLight args={[0x2a2a30, 0x050505, 0.45]} />
      <directionalLight
        position={[-9.8, 12.6, 8.4]}
        intensity={2.2}
        color={0xffffff}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[3, 0.2, 3]} intensity={0.32} color={0xc9d2ff} />
      <directionalLight position={[-3.2, 1.2, -3]} intensity={1.3} color={0xffffff} />
      <directionalLight position={[3.4, 2, -2.8]} intensity={1.6} color={0xffffff} />
      <pointLight ref={rim} position={[-4, 2, -3]} color={0xb04aff} intensity={18} distance={16} decay={1.6} />
      <pointLight position={[3, 1, 4]} color={0xffa040} intensity={8} distance={10} decay={1.8} />
    </>
  )
}

function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Painted-night sky: deep indigo overhead, bruised violet at the horizon, a scatter of stars. */
function Sky() {
  const stars = useMemo(() => {
    const r = rand(5)
    const a = new Float32Array(260 * 3)
    for (let i = 0; i < 260; i++) {
      const th = r() * Math.PI * 2
      const ph = Math.acos(0.15 + r() * 0.85)
      a.set([Math.sin(ph) * Math.cos(th) * 66, Math.cos(ph) * 66, Math.sin(ph) * Math.sin(th) * 66], i * 3)
    }
    return a
  }, [])
  return (
    <>
      <mesh>
        <sphereGeometry args={[70, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          vertexShader="varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          fragmentShader="varying float vY; void main(){ vec3 hor=vec3(0.29,0.16,0.47); vec3 mid=vec3(0.10,0.09,0.31); vec3 top=vec3(0.025,0.04,0.14); float t=clamp(vY,0.0,1.0); vec3 c=mix(hor,mid,smoothstep(0.0,0.35,t)); c=mix(c,top,smoothstep(0.3,0.9,t)); gl_FragColor=vec4(c,1.0); }"
        />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.35} color={0xd8dcff} fog={false} transparent opacity={0.8} depthWrite={false} />
      </points>
    </>
  )
}

/** Dark indigo facade with a grid of lit amber windows; a second map holds only the windows, for the glow. */
function windowTextures() {
  const W = 128
  const H = 256
  const cols = 8
  const rows = 16
  const base = document.createElement("canvas")
  const glow = document.createElement("canvas")
  for (const c of [base, glow]) {
    c.width = W
    c.height = H
  }
  const b = base.getContext("2d")!
  const g = glow.getContext("2d")!
  b.fillStyle = "#17143f"
  b.fillRect(0, 0, W, H)
  g.fillStyle = "#000"
  g.fillRect(0, 0, W, H)
  const r = rand(77)
  const cw = W / cols
  const ch = H / rows
  const tones = ["#ffb347", "#ffc266", "#ff9a3c", "#ffd98a", "#7a6cff"]
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = r() < 0.14
      const col = tones[Math.floor(r() * (lit ? 4 : 1))]
      b.fillStyle = lit ? col : "#0d0b2b"
      g.fillStyle = col
      b.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 6)
      if (lit) g.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 6)
    }
  }
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: mk(base, true), glow: mk(glow, true) }
}

/** Art-deco towers: stepped setbacks, lit windows, a spire on the tall ones. */
function City() {
  const tex = useMemo(() => windowTextures(), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.8, toneMapped: false }),
    [tex]
  )
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1b1747, roughness: 0.8 }), [])
  const towers = useMemo(() => {
    const r = rand(21)
    const geo = (w: number, h: number, d: number) => {
      const g = new THREE.BoxGeometry(w, h, d)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 3.2), uv.getY(i) * (h / 5))
      return g
    }
    return Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2 + r() * 0.1
      const rad = 27 + r() * 16
      const w = 4 + r() * 3.5
      const h = 16 + r() * 26
      const tiers = [
        { w, h: h * 0.55, y: 0 },
        { w: w * 0.78, h: h * 0.28, y: h * 0.55 },
        { w: w * 0.54, h: h * 0.17, y: h * 0.83 },
      ]
      return {
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        rot: -a,
        spire: h > 22 ? h * 0.12 : 0,
        top: h,
        tiers: tiers.map((t) => ({ ...t, geo: geo(t.w, t.h, t.w) })),
      }
    })
  }, [])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={0x1d1a4a} roughness={0.28} metalness={0.55} />
      </mesh>
      {towers.map((t, i) => (
        <group key={i} position={[t.x, FLOOR, t.z]} rotation={[0, t.rot, 0]}>
          {t.tiers.map((tier, j) => (
            <mesh key={j} geometry={tier.geo} material={mat} position={[0, tier.y + tier.h / 2, 0]} />
          ))}
          {t.spire > 0 && (
            <mesh material={roof} position={[0, t.top + t.spire / 2, 0]}>
              <coneGeometry args={[0.5, t.spire, 4]} />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}

/** Street lamp: dark iron pole, amber glow head. Optionally throws real light. */
function Lamp({ x, z, lit = false }: { x: number; z: number; lit?: boolean }) {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0d0c24, roughness: 0.5, metalness: 0.5 }), [])
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffc266, emissive: 0xffa23a, emissiveIntensity: 3, toneMapped: false }), [])
  return (
    <group position={[x, FLOOR, z]}>
      <mesh material={iron} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 0.4, 10]} />
      </mesh>
      <mesh material={iron} position={[0, 2.8, 0]}>
        <cylinderGeometry args={[0.07, 0.13, 5.2, 10]} />
      </mesh>
      <mesh material={iron} position={[0, 5.5, 0]}>
        <cylinderGeometry args={[0.28, 0.18, 0.16, 10]} />
      </mesh>
      <mesh material={glow} position={[0, 5.85, 0]}>
        <sphereGeometry args={[0.32, 16, 12]} />
      </mesh>
      <mesh material={iron} position={[0, 6.2, 0]}>
        <coneGeometry args={[0.4, 0.28, 10]} />
      </mesh>
      {lit && <pointLight position={[0, 5.6, 0]} color={0xffa23a} intensity={45} distance={16} decay={1.7} />}
    </group>
  )
}

/** A line of paper lanterns strung across the street, Japanese-night style. */
function Lanterns() {
  const items = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ x: -6 + i * 2, y: 3.4 - Math.sin((i / 6) * Math.PI) * -0.0 - Math.sin((i / 6) * Math.PI) * 0.5 })),
    []
  )
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff5a1a, emissiveIntensity: 2.2, toneMapped: false }), [])
  const cap = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0d0c24, roughness: 0.6 }), [])
  return (
    <group position={[0, 0, -4.2]}>
      {items.map((l, i) => (
        <group key={i} position={[l.x, l.y, 0]}>
          <mesh material={body} scale={[0.3, 0.42, 0.3]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh material={cap} position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 10]} />
          </mesh>
          <mesh material={cap} position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Thin slanted rain, wrapping around the camera's patch of street. */
function Rain() {
  const N = 700
  const ref = useRef<THREE.LineSegments>(null)
  const pos = useMemo(() => {
    const r = rand(9)
    const a = new Float32Array(N * 6)
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 26
      const y = r() * 14 - 3
      const z = (r() - 0.5) * 26
      a.set([x, y, z, x + 0.05, y - 0.5, z], i * 6)
    }
    return a
  }, [])
  useFrame((_, dt) => {
    const g = ref.current?.geometry.attributes.position
    if (!g) return
    const a = g.array as Float32Array
    const fall = 16 * Math.min(dt, 0.05)
    for (let i = 0; i < N; i++) {
      const k = i * 6
      a[k + 1] -= fall
      a[k + 4] -= fall
      if (a[k + 4] < -3) {
        a[k + 1] += 14
        a[k + 4] += 14
      }
    }
    g.needsUpdate = true
  })
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={0xaab4ff} transparent opacity={0.3} depthWrite={false} />
    </lineSegments>
  )
}

/** Stacked vertical shop signs that flicker on behind the monkey as the camera swings round for the smash. */
function NeonSign() {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = scroll.value
    const on = win(t, 0.76, 0.8, 0.86, 0.89)
    if (group.current) group.current.visible = on > 0.01
    const flick = on > 0.2 ? 0.85 + Math.sin(state.clock.elapsedTime * 38) * 0.15 * (on < 0.95 ? 1 : 0.3) : 0
    group.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && "emissiveIntensity" in m) m.emissiveIntensity = 1.8 * on * flick
    })
  })
  const colors = [0xffa23a, 0xff5c8a, 0x5cc8ff, 0xffa23a]
  const frame = 0.07
  return (
    <group ref={group} position={[-3.6, 1.1, -1.4]} rotation={[0, 0.9, 0]}>
      <mesh>
        <boxGeometry args={[0.04, 3.4, 0.04]} />
        <meshStandardMaterial color={0x0d0c24} />
      </mesh>
      {colors.map((c, i) => {
        const y = 1.2 - i * 0.8
        return (
          <group key={i} position={[0.48, y, 0]}>
            {[
              [0, 0.34, 0.9, frame],
              [0, -0.34, 0.9, frame],
              [-0.45, 0, frame, 0.7],
              [0.45, 0, frame, 0.7],
            ].map(([x, yy, sx, sy], k) => (
              <mesh key={k} position={[x, yy, 0]}>
                <boxGeometry args={[sx, sy, 0.06]} />
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0} toneMapped={false} />
              </mesh>
            ))}
            {[-0.16, 0, 0.16].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <boxGeometry args={[0.07, 0.32 + (i % 2) * 0.1, 0.04]} />
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function crackTexture() {
  const W = 1024
  const H = 640
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!
  const cx = W / 2
  const cy = H * 0.55
  g.strokeStyle = "rgba(255,255,255,0.95)"
  g.lineCap = "round"
  const rays = 22
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + Math.random() * 0.15
    let x = cx
    let y = cy
    let ang = a
    const len = 260 + Math.random() * 460
    g.lineWidth = 2.2
    g.beginPath()
    g.moveTo(x, y)
    for (let d = 0; d < len; d += 28) {
      ang += (Math.random() - 0.5) * 0.28
      x += Math.cos(ang) * 28
      y += Math.sin(ang) * 28
      g.lineTo(x, y)
      if (Math.random() < 0.12) {
        g.save()
        g.lineWidth = 1
        g.moveTo(x, y)
        g.lineTo(x + Math.cos(ang + 0.9) * 60, y + Math.sin(ang + 0.9) * 60)
        g.restore()
        g.moveTo(x, y)
      }
    }
    g.stroke()
  }
  for (let r = 40; r < 340; r += 70) {
    g.lineWidth = 1.2
    g.beginPath()
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const rr = r + (Math.random() - 0.5) * 22
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr * 0.8
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Invisible "screen" in front of the monkey that cracks when the guitar lands. */
function Glass() {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const map = useMemo(() => crackTexture(), [])
  useFrame(() => {
    const t = scroll.value
    if (mat.current) mat.current.opacity = 0.95 * smooth(SMASH.crack[0], SMASH.crack[1], t) * (1 - smooth(0.985, 1.0, t) * 0.4)
  })
  return (
    <mesh position={[0, 0.8, GLASS_Z]}>
      <planeGeometry args={[7.4, 4.6]} />
      <meshBasicMaterial ref={mat} map={map} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export default function Stage({ onReady }: { onReady?: () => void }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 28, near: 0.1, far: 80, position: [2.09, 1.20, 1.35] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
    >
      <color attach="background" args={["#2a1d52"]} />
      <fog attach="fog" args={["#2a1d52", 14, 62]} />
      <Rig />
      <Lights />
      <Sky />
      <City />
      <Lamp x={7} z={-4} lit />
      <Lamp x={-8} z={-7} lit />
      <Lamp x={-9} z={4} />
      <Lamp x={8} z={6} />
      <Lanterns />
      <Rain />
      <Monkey />
      <Smoke />
      <Wordmark />
      <NeonSign />
      <Glass />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.85} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
