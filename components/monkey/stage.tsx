"use client"

import * as THREE from "three"
import { useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import Monkey from "./monkey"
import { BackTitle, Backdrop, Dust, LightBars, StudioFloor } from "./studio"
import { Smoke } from "./smoke"
import { FLOOR, landing, PROFILE_SHIFT, profileFraming, sampleCamera, scroll, smooth, SMASH, walkFraming } from "./store"

const GLASS_Z = 1.8

function Rig() {
  const { camera, size } = useThree()
  useFrame((_, dt) => {
    scroll.value = THREE.MathUtils.damp(scroll.value, scroll.target, 4.5, Math.min(dt, 0.05))
    const { p, l } = sampleCamera(scroll.value)
    // Landing on a scene, the camera dips past it and floats back up, settling over a second
    const k = (performance.now() - landing.at) / 1000
    const dist = Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2])
    const bob = landing.at > 0 && k < 1.4 ? 0.012 * dist * landing.dir * Math.sin(k * Math.PI * 2) * Math.exp(-3.2 * k) : 0
    camera.position.set(p[0], p[1] - bob, p[2])
    camera.lookAt(l[0], l[1] - bob, l[2])

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
      {/* The warm light the two lit street lamps used to throw on him, kept without the lamps */}
      <pointLight position={[7, FLOOR + 5.6, -4]} color={0xffa23a} intensity={45} distance={16} decay={1.7} />
      <pointLight position={[-8, FLOOR + 5.6, -7]} color={0xffa23a} intensity={45} distance={16} decay={1.7} />
    </>
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

export default function Stage({ onReady, active = true }: { onReady?: () => void; active?: boolean }) {
  return (
    <Canvas
      shadows
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ fov: 28, near: 0.1, far: 80, position: [2.09, 1.20, 1.35] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Rig />
      <Lights />
      {/* A red studio after the reference: backdrop, glossy floor, floating light bars, dust */}
      <Backdrop />
      <StudioFloor />
      <LightBars />
      <Dust />
      <BackTitle text="MUSE-ING" sub="LIVE MUSIC" />
      <Monkey onReady={onReady} />
      <Smoke />
      <Glass />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.85} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
