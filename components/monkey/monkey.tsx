"use client"

import * as THREE from "three"
import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import { ember as emberWorld, mouth as mouthWorld, scroll, smooth, SMASH, win, type Vec3 } from "./store"

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
const neon = (c = 0xe4262c, i = 2.4) => std({ color: c, emissive: c, emissiveIntensity: i, toneMapped: false })

// Noir palette, after 90s animated Gotham: cool indigo shadows, warm amber light, a navy trench and a fedora.
const AMBER = 0xffa23a
const M = {
  fur: std({ color: 0x3b312c, roughness: 0.92 }),
  furLight: std({ color: 0x55463d, roughness: 0.9 }),
  skin: new THREE.MeshPhysicalMaterial({ color: 0x8a7365, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.5 }),
  skinDark: std({ color: 0x5e4a40, roughness: 0.55 }),
  crease: std({ color: 0x33261f, roughness: 0.6 }),
  lip: new THREE.MeshPhysicalMaterial({ color: 0x6f5649, roughness: 0.4, clearcoat: 0.5 }),
  lens: new THREE.MeshPhysicalMaterial({ color: 0x07070f, roughness: 0.1, metalness: 0.6, clearcoat: 1 }),
  hat: std({ color: 0x17172f, roughness: 0.8 }),
  hatBand: std({ color: 0x6b2a3a, roughness: 0.6 }),
  ember: neon(AMBER),
  amber: neon(AMBER, 0.3),
  amberSoft: neon(AMBER, 0.15),
  lining: std({ color: 0x5a2a4a, emissive: 0x2a0f2a, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.BackSide }),
  white: std({ color: 0xe9e7e0, roughness: 0.4 }),
  chrome: std({ color: 0xd9b36a, metalness: 0.85, roughness: 0.3 }),
  chromeDark: std({ color: 0x7a6a4a, metalness: 0.9, roughness: 0.38 }),
  jacket: std({ color: 0x151a3d, roughness: 0.55, metalness: 0.15 }),
  jacketOuter: std({ color: 0x151a3d, roughness: 0.55, metalness: 0.15, side: THREE.FrontSide }),
  jacketHi: std({ color: 0x252c5c, roughness: 0.6, metalness: 0.12 }),
  shirt: std({ color: 0xcfc9bd, roughness: 0.8 }),
  pants: std({ color: 0x1b1a40, roughness: 0.75 }),
  strapDark: std({ color: 0x25234a, roughness: 0.5 }),
  boot: std({ color: 0x0b0b16, roughness: 0.3, metalness: 0.4 }),
  wood: std({ color: 0x2b1b13, roughness: 0.5 }),
  guitar: std({ color: 0x7d4521, emissive: 0x2a1207, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.1 }),
  black: std({ color: 0x0a0a12, roughness: 0.4 }),
  strap: std({ color: 0x6b4426, roughness: 0.7 }),
  wisp: std({ color: 0x9a8a7a, roughness: 0.8 }),
  fuzz: std({ color: 0x4a3d35, roughness: 0.95 }),
}

const sphereGeo = new THREE.SphereGeometry(1, 32, 24)
const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20)
const hairGeo = new THREE.CylinderGeometry(0.35, 1, 1, 4).translate(0, 0.5, 0)

function Sph({ p, s = [1, 1, 1], m, r = [0, 0, 0] }: { p: Vec3; s?: Vec3; m: THREE.Material; r?: Vec3 }) {
  return <mesh geometry={sphereGeo} material={m} position={p} scale={s} rotation={r} />
}
function Box({ p, s, m, r = [0, 0, 0] }: { p: Vec3; s: Vec3; m: THREE.Material; r?: Vec3 }) {
  return <mesh geometry={boxGeo} material={m} position={p} scale={s} rotation={r} />
}
function Cyl({ p, s, m, r = [0, 0, 0] }: { p: Vec3; s: Vec3; m: THREE.Material; r?: Vec3 }) {
  return <mesh geometry={cylGeo} material={m} position={p} scale={s} rotation={r} />
}
function Ring({ p, radius, tube = 0.03, m, r = [Math.PI / 2, 0, 0] }: { p: Vec3; radius: number; tube?: number; m: THREE.Material; r?: Vec3 }) {
  return (
    <mesh material={m} position={p} rotation={r}>
      <torusGeometry args={[radius, tube, 10, 40]} />
    </mesh>
  )
}
function Arc({ p, radius, arc, tube = 0.012, m, r = [0, 0, 0] }: { p: Vec3; radius: number; arc: number; tube?: number; m: THREE.Material; r?: Vec3 }) {
  return (
    <mesh material={m} position={p} rotation={r}>
      <torusGeometry args={[radius, tube, 6, 24, arc]} />
    </mesh>
  )
}

// Place a unit cylinder (and its end joints) between two points.
const UP = new THREE.Vector3(0, 1, 0)
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
function placeSeg(o: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  if (!o) return
  const d = tmpA.subVectors(b, a)
  const len = d.length()
  o.position.copy(a).addScaledVector(d, 0.5)
  o.quaternion.setFromUnitVectors(UP, tmpB.copy(d).normalize())
  o.scale.set(r, len, r)
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function Seg({ a, b, r, m }: { a: THREE.Vector3; b: THREE.Vector3; r: number; m: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => placeSeg(ref.current, a, b, r), [a, b, r])
  return <mesh ref={ref} geometry={cylGeo} material={m} />
}

// Deterministic RNG so the fur looks the same every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Instanced hairs on an ellipsoid, oriented along the surface normal. */
function Fur({
  center,
  radii,
  count,
  len,
  m,
  keep,
  seed,
  thickness = 0.012,
  lift = 0.35,
}: {
  center: Vec3
  radii: Vec3
  count: number
  len: [number, number]
  m: THREE.Material
  keep: (n: THREE.Vector3) => boolean
  seed: number
  thickness?: number
  lift?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = rng(seed)
    const o = new THREE.Object3D()
    const n = new THREE.Vector3()
    const jitter = new THREE.Vector3()
    const flow = new THREE.Vector3()
    const dir = new THREE.Vector3()
    let i = 0
    let guard = 0
    while (i < count && guard < count * 20) {
      guard++
      const u = rand() * 2 - 1
      const th = rand() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      n.set(s * Math.cos(th), u, s * Math.sin(th))
      if (!keep(n)) continue
      o.position.set(center[0] + n.x * radii[0], center[1] + n.y * radii[1], center[2] + n.z * radii[2])
      // comb the hair: mostly tangent to the surface, flowing down and back
      flow.set(0, -1, -0.7)
      flow.addScaledVector(n, -flow.dot(n))
      jitter.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5)
      dir.copy(flow.normalize()).addScaledVector(n, lift).add(jitter).normalize()
      o.quaternion.setFromUnitVectors(UP, dir)
      const l = len[0] + rand() * (len[1] - len[0])
      o.scale.set(thickness, l, thickness)
      o.updateMatrix()
      mesh.setMatrixAt(i++, o.matrix)
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
  }, [center, radii, count, len, keep, seed, thickness, lift])
  return <instancedMesh ref={ref} args={[hairGeo, m, count]} frustumCulled={false} />
}

const CRANIUM: { c: Vec3; r: Vec3 } = { c: [0, 0.1, -0.1], r: [0.95, 0.9, 0.95] }
const JAW: { c: Vec3; r: Vec3 } = { c: [0, -0.6, 0.45], r: [0.64, 0.38, 0.55] }
const notFace = (n: THREE.Vector3) => !(n.z > 0.35 && n.y < 0.62)
const topWisps = (n: THREE.Vector3) => Math.abs(n.x) > 0.8 && n.y > -0.2 && n.y < 0.35 && n.z < 0.2
const jawFuzz = (n: THREE.Vector3) => !(n.z > 0.55 && n.y > -0.35)

const TEMPLES = [-1, 1].map((s) => ({ a: v(s * 0.5, 0.14, 0.93), b: v(s * 0.94, 0.1, 0.12) }))

function Head({ mouthRef }: { mouthRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0, 1.5, 0]} rotation={[-0.07, -0.06, 0.05]}>
      {/* skull, jaw, face plate */}
      <Sph p={CRANIUM.c} s={CRANIUM.r} m={M.fur} />
      <Sph p={JAW.c} s={JAW.r} m={M.fur} />
      <Sph p={[0, -0.02, 0.5]} s={[0.72, 0.64, 0.5]} m={M.skin} />
      <Sph p={[0, 0.3, 0.68]} s={[0.8, 0.16, 0.34]} m={M.skinDark} />
      {/* muzzle and nose */}
      <Sph p={[0, -0.36, 0.76]} s={[0.56, 0.4, 0.44]} m={M.skin} />
      <Sph p={[0, -0.08, 1.02]} s={[0.21, 0.13, 0.1]} m={M.skin} />
      <Sph p={[-0.075, -0.15, 1.1]} s={[0.05, 0.035, 0.03]} m={M.crease} />
      <Sph p={[0.075, -0.15, 1.1]} s={[0.05, 0.035, 0.03]} m={M.crease} />
      {/* wrinkles: under the brim, across the forehead, around the muzzle */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Arc p={[s * 0.33, -0.36, 1.04]} radius={0.22} arc={Math.PI * 0.45} m={M.crease} r={[0, s * 0.5, s > 0 ? Math.PI * 0.25 : Math.PI * 0.3]} />
        </group>
      ))}
      {[0.44, 0.5, 0.56].map((y) => (
        <Arc key={y} p={[0, y - 0.55, 0.86]} radius={0.55} arc={Math.PI * 0.4} m={M.crease} r={[-0.25, 0, Math.PI * 0.3]} />
      ))}

      {/* smug smirk: thick lips, one corner up, a few teeth showing */}
      <group rotation={[0, 0, 0.07]}>
        <mesh material={M.lip} position={[0, -0.43, 1.1]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.8]}>
          <capsuleGeometry args={[0.07, 0.46, 6, 16]} />
        </mesh>
        <mesh material={M.lip} position={[0, -0.56, 1.06]} rotation={[0, 0, Math.PI / 2]} scale={[1.1, 1, 0.9]}>
          <capsuleGeometry args={[0.095, 0.4, 6, 16]} />
        </mesh>
        <Box p={[-0.14, -0.49, 1.1]} s={[0.2, 0.05, 0.04]} m={M.white} />
        <Box p={[-0.14, -0.49, 1.115]} s={[0.004, 0.05, 0.02]} m={M.crease} />
        <Box p={[-0.07, -0.49, 1.115]} s={[0.004, 0.05, 0.02]} m={M.crease} />
      </group>

      {/* big ears */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.98, 0.02, -0.02]} rotation={[0, s * 0.35, s * -0.1]}>
          <Sph p={[0, 0, 0]} s={[0.1, 0.33, 0.27]} m={M.skin} />
          <Sph p={[s * 0.035, 0, 0.02]} s={[0.06, 0.24, 0.19]} m={M.skinDark} />
          <Arc p={[s * 0.07, 0.02, 0.02]} radius={0.18} arc={Math.PI * 1.2} tube={0.02} m={M.skin} r={[0, s * Math.PI / 2, -0.5]} />
        </group>
      ))}

      {/* fedora: shadowed brim low over the eyes, crown, amber-trimmed band */}
      <group position={[0, 0.5, 0.05]} rotation={[-0.14, 0, 0.04]}>
        <mesh material={M.hat}>
          <cylinderGeometry args={[1.3, 1.3, 0.035, 56]} />
        </mesh>
        <mesh material={M.hat} position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.78, 0.93, 0.56, 40]} />
        </mesh>
        <mesh material={M.hatBand} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.945, 0.955, 0.13, 40]} />
        </mesh>
        <mesh material={M.amber} position={[0, 0.175, 0]}>
          <cylinderGeometry args={[0.93, 0.94, 0.012, 40]} />
        </mesh>
        <Box p={[0, 0.56, 0]} s={[0.5, 0.02, 0.9]} m={M.hat} />
      </group>

      {/* fur: wispy backlit strands on top and by the ears, short fuzz everywhere else */}
      <Fur center={CRANIUM.c} radii={CRANIUM.r} count={45} len={[0.1, 0.22]} m={M.wisp} keep={topWisps} seed={7} thickness={0.004} lift={0.9} />
      <Fur center={CRANIUM.c} radii={CRANIUM.r} count={2600} len={[0.035, 0.07]} m={M.fuzz} keep={notFace} seed={11} thickness={0.007} />
      <Fur center={JAW.c} radii={JAW.r} count={1200} len={[0.035, 0.08]} m={M.fuzz} keep={jawFuzz} seed={23} thickness={0.007} />
      <Fur center={JAW.c} radii={JAW.r} count={24} len={[0.08, 0.14]} m={M.wisp} keep={(n) => n.y < -0.3 || Math.abs(n.x) > 0.75} seed={31} thickness={0.0035} lift={0.5} />

      {/* where the cigarette sits in the smirk's corner */}
      <group ref={mouthRef} position={[0.26, -0.5, 1.08]} />

      {/* old round shades: brass rims, dark glossy lenses, wire temples */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.3, 0.14, 0.97]} rotation={[0, s * 0.22, 0]}>
          <mesh material={M.lens} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.035, 32]} />
          </mesh>
          <Ring p={[0, 0, 0.012]} radius={0.205} tube={0.022} m={M.chrome} r={[0, 0, 0]} />
        </group>
      ))}
      <Box p={[0, 0.17, 1.0]} s={[0.2, 0.025, 0.025]} m={M.chrome} />
      {TEMPLES.map((t, i) => (
        <Seg key={i} a={t.a} b={t.b} r={0.014} m={M.chrome} />
      ))}
    </group>
  )
}

function Guitar() {
  return (
    <group>
      <Cyl p={[0, -1.7, 0]} s={[0.52, 0.16, 0.52]} m={M.guitar} r={[Math.PI / 2, 0, 0]} />
      <Cyl p={[0, -1.15, 0]} s={[0.38, 0.16, 0.38]} m={M.guitar} r={[Math.PI / 2, 0, 0]} />
      <Cyl p={[0, -1.43, 0]} s={[0.3, 0.16, 0.3]} m={M.guitar} r={[Math.PI / 2, 0, 0]} />
      <Cyl p={[0, -1.45, 0.095]} s={[0.15, 0.015, 0.15]} m={M.black} r={[Math.PI / 2, 0, 0]} />
      <Box p={[0.14, -1.78, 0.095]} s={[0.22, 0.3, 0.012]} m={M.black} />
      {[-1.3, -1.5, -1.7].map((y) => (
        <Box key={y} p={[0, y, 0.1]} s={[0.36, 0.05, 0.03]} m={M.chrome} />
      ))}
      <Box p={[0, -1.95, 0.1]} s={[0.3, 0.04, 0.03]} m={M.chrome} />
      <Box p={[0, -0.1, 0]} s={[0.13, 2.1, 0.06]} m={M.wood} />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[0, -0.9 + i * 0.17, 0.035]} s={[0.14, 0.012, 0.01]} m={M.chrome} />
      ))}
      <Box p={[0, 1.08, 0]} s={[0.24, 0.42, 0.06]} m={M.guitar} />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Sph p={[-0.13, 0.98 + i * 0.12, 0]} s={[0.035, 0.035, 0.035]} m={M.chrome} />
          <Sph p={[0.13, 0.98 + i * 0.12, 0]} s={[0.035, 0.035, 0.035]} m={M.chrome} />
        </group>
      ))}
      {[-0.04, -0.02, 0, 0.02, 0.04].map((x) => (
        <Box key={x} p={[x, -0.1, 0.045]} s={[0.004, 2.0, 0.004]} m={M.chrome} />
      ))}
    </group>
  )
}

/** Cropped trench over a collared shirt: popped collar, quilted yokes, open front. */
function Jacket() {
  const collarArc = 3.9
  return (
    <group>
      {/* shirt underneath, with collar points */}
      <RoundedBox args={[1.7, 1.85, 0.92]} radius={0.25} smoothness={4} position={[0, -0.35, 0]} material={M.shirt} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.12, 0.5, 0.47]} s={[0.2, 0.06, 0.16]} m={M.shirt} r={[0.4, 0, s * -0.6]} />
      ))}
      <Box p={[0, 0.0, 0.468]} s={[0.1, 0.7, 0.014]} m={M.hatBand} />
      <Box p={[0, 0.37, 0.472]} s={[0.14, 0.12, 0.03]} m={M.hatBand} />

      {/* jacket halves, cropped above the belt, open down the front */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <RoundedBox args={[0.93, 1.3, 1.04]} radius={0.22} smoothness={4} position={[s * 0.56, -0.02, 0]} material={M.jacket} />
          {/* ribbed hem */}
          <RoundedBox args={[0.93, 0.18, 1.08]} radius={0.07} smoothness={3} position={[s * 0.56, -0.7, 0]} material={M.jacketHi} />
          {[0, 1, 2].map((i) => (
            <Box key={i} p={[s * 0.56, -0.74 + i * 0.05, 0.545]} s={[0.85, 0.008, 0.01]} m={M.jacket} />
          ))}
          <Box p={[s * 0.56, -0.6, 0.53]} s={[0.86, 0.025, 0.02]} m={M.amber} />
          {/* front opening piping */}
          <Box p={[s * 0.11, -0.05, 0.525]} s={[0.025, 1.25, 0.02]} m={M.amber} />
          {/* quilted shoulder yoke */}
          <RoundedBox args={[0.88, 0.32, 1.12]} radius={0.13} smoothness={3} position={[s * 0.92, 0.5, 0]} material={M.jacketHi} />
          {[0, 1, 2].map((i) => (
            <Box key={i} p={[s * 0.92, 0.42 + i * 0.08, 0.565]} s={[0.78, 0.01, 0.01]} m={M.jacket} />
          ))}
          <Box p={[s * 0.92, 0.67, 0]} s={[0.76, 0.022, 0.96]} m={M.amberSoft} />
          {/* chest pocket flap */}
          <Box p={[s * 0.6, 0.18, 0.53]} s={[0.36, 0.1, 0.03]} m={M.jacketHi} r={[0, 0, s * 0.06]} />
        </group>
      ))}
      {/* back panel and glowing emblem */}
      <RoundedBox args={[1.9, 1.3, 0.4]} radius={0.15} smoothness={3} position={[0, -0.02, -0.33]} material={M.jacket} />
      <Ring p={[0, 0.05, -0.535]} radius={0.28} tube={0.025} m={M.amber} r={[0, 0, 0]} />
      <Box p={[0, 0.05, -0.54]} s={[0.05, 0.5, 0.02]} m={M.amber} />
      <Box p={[0, 0.05, -0.54]} s={[0.36, 0.05, 0.02]} m={M.amber} r={[0, 0, 0.7]} />

      {/* the popped collar, plum lining inside */}
      <mesh material={M.jacketOuter} position={[0, 0.88, -0.02]}>
        <cylinderGeometry args={[0.8, 0.56, 0.62, 40, 1, true, Math.PI - collarArc / 2, collarArc]} />
      </mesh>
      <mesh material={M.lining} position={[0, 0.88, -0.02]}>
        <cylinderGeometry args={[0.8, 0.56, 0.62, 40, 1, true, Math.PI - collarArc / 2, collarArc]} />
      </mesh>
      <mesh material={M.amber} position={[0, 1.19, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.012, 6, 40, collarArc]} />
      </mesh>

      {/* brass pin on the lapel */}
      <Box p={[0.6, 0.3, 0.535]} s={[0.16, 0.05, 0.01]} m={M.chrome} />
      <Box p={[0.6, 0.3, 0.542]} s={[0.1, 0.012, 0.01]} m={M.amber} />
    </group>
  )
}

// Pose, in the upper body's frame. Right is -x, left is +x (he faces +z).
const R_SHOULDER = v(-1.02, 0.42, 0)
const R_ELBOW_POCKET = v(-1.34, -0.42, -0.12)
const R_HAND_POCKET = v(-0.78, -1.08, 0.38)
const L_SHOULDER = v(1.02, 0.42, 0)
const L_ELBOW = v(1.36, -0.42, 0.02)
const L_HAND = v(1.22, -1.12, 0.24)

const L_UPPER_LEN = L_SHOULDER.distanceTo(L_ELBOW)
const L_FORE_LEN = L_ELBOW.distanceTo(L_HAND)
const L_POLE = v(0.8, -0.7, -0.3)

const R_ELBOW_GRAB = v(-1.45, 0.25, -0.2)

const GUITAR_REST = v(0, 0.3, -0.64)
const GUITAR_GRAB = v(-0.5, 0.95, -0.45)

export default function Monkey() {
  const root = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const mouthRef = useRef<THREE.Group>(null)
  const cig = useRef<THREE.Group>(null)
  const lUpper = useRef<THREE.Mesh>(null)
  const lFore = useRef<THREE.Mesh>(null)
  const lElbow = useRef<THREE.Group>(null)
  const lHand = useRef<THREE.Group>(null)
  const emberRef = useRef<THREE.Mesh>(null)
  const rUpper = useRef<THREE.Mesh>(null)
  const rFore = useRef<THREE.Mesh>(null)
  const rElbow = useRef<THREE.Group>(null)
  const rHand = useRef<THREE.Group>(null)
  const tmp = useMemo(
    () => ({
      hand: new THREE.Vector3(),
      elbow: new THREE.Vector3(),
      world: new THREE.Vector3(),
      mouth: new THREE.Vector3(),
      target: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      perp: new THREE.Vector3(),
      held: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      heldRot: new THREE.Euler(-0.5, 0.3, 0),
    }),
    []
  )

  useFrame((state) => {
    const t = scroll.value
    const time = state.clock.elapsedTime

    // Smash choreography: hand comes up, lifts the guitar over the shoulder, winds up, strikes.
    const grab = smooth(0.9, 0.935, t)
    const wind = smooth(SMASH.windUp[0], SMASH.windUp[1], t)
    const strike = smooth(SMASH.strike[0], SMASH.strike[1], t)
    if (pivot.current) {
      pivot.current.position.lerpVectors(GUITAR_REST, GUITAR_GRAB, grab)
      pivot.current.rotation.x = 0.7 * wind - (0.7 + 1.45) * strike
    }
    if (tilt.current) tilt.current.rotation.z = -0.3 * (1 - grab)

    // Right arm: hand in pocket, then up to the guitar grip.
    const hand = tmp.hand.lerpVectors(R_HAND_POCKET, pivot.current ? pivot.current.position : GUITAR_GRAB, grab)
    const elbow = tmp.elbow.lerpVectors(R_ELBOW_POCKET, R_ELBOW_GRAB, grab)
    placeSeg(rUpper.current, R_SHOULDER, elbow, 0.3)
    placeSeg(rFore.current, elbow, hand, 0.21)
    rElbow.current?.position.copy(elbow)
    rHand.current?.position.copy(hand)

    if (root.current) {
      root.current.position.z = 0.5 * smooth(0.945, 0.96, t)
      root.current.rotation.y = -0.1 + Math.sin(time * 0.5) * 0.025
    }
    if (upper.current) {
      // slow, cocky breathing sway
      upper.current.rotation.z = 0.045 + Math.sin(time * 0.9) * 0.008
      upper.current.rotation.x = -0.04 + Math.sin(time * 1.4) * 0.006 + 0.12 * strike
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 0.35) * 0.05
      head.current.rotation.x = Math.sin(time * 0.7) * 0.015
    }
    // The exhale: left hand comes up, plucks the cigarette from his mouth, holds it out while he blows.
    const exhale = win(t, 0.15, 0.19, 0.26, 0.3)
    if (head.current) head.current.rotation.x -= 0.16 * exhale
    if (body.current && mouthRef.current && lUpper.current && lFore.current) {
      mouthRef.current.updateWorldMatrix(true, false)
      mouthRef.current.getWorldPosition(tmp.world)
      mouthWorld.x = tmp.world.x
      mouthWorld.y = tmp.world.y
      mouthWorld.z = tmp.world.z
      const mouth = body.current.worldToLocal(tmp.mouth.copy(tmp.world))
      const reach = smooth(0.07, 0.12, t)
      const pull = smooth(0.13, 0.18, t)
      const back = smooth(0.34, 0.42, t)
      const target = tmp.target.copy(L_HAND)
      target.lerp(tmp.hand.set(mouth.x + 0.1, mouth.y - 0.04, mouth.z + 0.3), reach)
      target.lerp(tmp.hand.set(1.0, 0.9, 1.35), pull)
      target.lerp(L_HAND, back)
      // two-bone solve for the elbow, bending out and down
      const reachLen = L_SHOULDER.distanceTo(target)
      const a = L_UPPER_LEN
      const b = L_FORE_LEN
      const dist = Math.min(reachLen, a + b - 0.01)
      const dir = tmp.dir.subVectors(target, L_SHOULDER).normalize()
      const x = (dist * dist + a * a - b * b) / (2 * dist)
      const h = Math.sqrt(Math.max(a * a - x * x, 0))
      const perp = tmp.perp.copy(L_POLE).addScaledVector(dir, -L_POLE.dot(dir)).normalize()
      const lE = tmp.elbow.copy(L_SHOULDER).addScaledVector(dir, x).addScaledVector(perp, h)
      placeSeg(lUpper.current, L_SHOULDER, lE, 0.3)
      placeSeg(lFore.current, lE, target, 0.21)
      lElbow.current?.position.copy(lE)
      lHand.current?.position.copy(target)

      if (cig.current) {
        // held between the fingers once plucked; before that it rides in the mouth
        const axis = tmp.axis.set(0, 0, 1).applyEuler(tmp.heldRot)
        tmp.held.copy(target).addScaledVector(axis, -0.3)
        const taken = smooth(0.12, 0.15, t)
        cig.current.position.copy(mouth).lerp(tmp.held, taken)
        cig.current.rotation.set(0.18 + (tmp.heldRot.x - 0.18) * taken, 0.28 + (tmp.heldRot.y - 0.28) * taken, 0)
      }
    }
    if (cig.current) cig.current.scale.setScalar(1 - smooth(0.62, 0.66, t))
    if (emberRef.current) {
      const mat = emberRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 2 + Math.sin(time * 5) * 0.8
      emberRef.current.getWorldPosition(tmp.world)
      emberWorld.x = tmp.world.x
      emberWorld.y = tmp.world.y
      emberWorld.z = tmp.world.z
    }
  })

  // Legs: weight on the right leg, left leg relaxed, knee out, foot turned.
  const legs = useMemo(
    () => ({
      r: { hip: v(-0.44, -1.32, 0), knee: v(-0.5, -2.1, 0.06), ankle: v(-0.52, -2.78, 0) },
      l: { hip: v(0.44, -1.28, 0), knee: v(0.66, -2.02, 0.3), ankle: v(0.78, -2.76, 0.18) },
    }),
    []
  )

  return (
    <group ref={root}>
      {/* long trench skirt: hangs from the hips to the knees, open down the front */}
      <group position={[0, -1.85, 0]} scale={[1, 1, 0.8]}>
        <mesh material={M.jacket}>
          <cylinderGeometry args={[0.98, 1.3, 1.4, 40, 1, true, 0.4, Math.PI * 2 - 0.8]} />
        </mesh>
        <mesh material={M.lining}>
          <cylinderGeometry args={[0.97, 1.29, 1.4, 40, 1, true, 0.4, Math.PI * 2 - 0.8]} />
        </mesh>
      </group>

      {/* hips, belt, legs */}
      <RoundedBox args={[1.62, 0.5, 0.96]} radius={0.2} smoothness={3} position={[0, -1.38, 0]} material={M.pants} />
      <Box p={[0, -1.2, 0]} s={[1.72, 0.15, 1.0]} m={M.black} />
      <Box p={[0, -1.2, 0.5]} s={[0.3, 0.18, 0.03]} m={M.chrome} />
      <Box p={[0, -1.2, 0.52]} s={[0.12, 0.06, 0.01]} m={M.amber} />
      {(["r", "l"] as const).map((side) => {
        const L = legs[side]
        const s = side === "r" ? -1 : 1
        return (
          <group key={side}>
            <Seg a={L.hip} b={L.knee} r={0.4} m={M.pants} />
            <Seg a={L.knee} b={L.ankle} r={0.34} m={M.pants} />
            <Sph p={[L.knee.x, L.knee.y, L.knee.z]} s={[0.33, 0.33, 0.33]} m={M.pants} />
            {/* cargo pocket and straps */}
            <Box p={[L.hip.x + s * 0.32, -1.72, L.hip.z + 0.05]} s={[0.1, 0.42, 0.42]} m={M.pants} r={[0, 0, s * -0.05]} />
            <Box p={[(L.hip.x + L.knee.x) / 2, -1.95, (L.hip.z + L.knee.z) / 2]} s={[0.78, 0.06, 0.78]} m={M.strapDark} />
            {/* chunky boot */}
            <group position={[L.ankle.x, -2.8, L.ankle.z + 0.14]} rotation={[0, side === "l" ? 0.4 : -0.08, 0]}>
              <RoundedBox args={[0.74, 0.46, 1.12]} radius={0.15} smoothness={3} material={M.boot} />
              <Box p={[0, -0.2, 0]} s={[0.76, 0.06, 1.14]} m={M.black} />
              <Box p={[0, 0.1, 0.4]} s={[0.5, 0.04, 0.3]} m={M.chromeDark} />
            </group>
          </group>
        )
      })}

      {/* upper body leans back a touch; pivots at the waist */}
      <group position={[0, -1.2, 0]}>
        <group ref={upper}>
          <group ref={body} position={[0, 1.2, 0]}>
            <group ref={head}>
              <Head mouthRef={mouthRef} />
            </group>
            {/* thick neck */}
            <Cyl p={[0, 0.66, 0.05]} s={[0.5, 0.5, 0.5]} m={M.fur} />
            <Jacket />

            {/* guitar strap across the chest */}
            <Seg a={v(0.82, 0.62, 0.5)} b={v(-0.78, -0.95, 0.56)} r={0.05} m={M.strap} />
            <Seg a={v(0.82, 0.62, 0.55)} b={v(-0.78, -0.95, 0.61)} r={0.012} m={M.amberSoft} />

            {/* right arm: sleeve, pushed-up cuff, fur forearm; driven per frame */}
            <Sph p={[R_SHOULDER.x, R_SHOULDER.y, R_SHOULDER.z]} s={[0.36, 0.36, 0.36]} m={M.jacket} />
            <mesh ref={rUpper} geometry={cylGeo} material={M.jacket} />
            <group ref={rElbow}>
              <Sph p={[0, 0, 0]} s={[0.29, 0.29, 0.29]} m={M.jacketHi} />
              <Ring p={[0, -0.05, 0]} radius={0.26} tube={0.06} m={M.jacketHi} r={[Math.PI / 2, 0, 0.3]} />
            </group>
            <mesh ref={rFore} geometry={cylGeo} material={M.fur} />
            <group ref={rHand}>
              <Sph p={[0, 0, 0]} s={[0.2, 0.22, 0.2]} m={M.skin} />
            </group>

            {/* left arm: trench sleeve, driven per frame; it plucks the cigarette in the exhale */}
            <Sph p={[L_SHOULDER.x, L_SHOULDER.y, L_SHOULDER.z]} s={[0.36, 0.36, 0.36]} m={M.jacket} />
            <mesh ref={lUpper} geometry={cylGeo} material={M.jacket} />
            <group ref={lElbow}>
              <Sph p={[0, 0, 0]} s={[0.29, 0.29, 0.29]} m={M.jacketHi} />
            </group>
            <mesh ref={lFore} geometry={cylGeo} material={M.fur} />
            <group ref={lHand}>
              <Sph p={[0, 0, 0]} s={[0.2, 0.22, 0.2]} m={M.skin} />
            </group>

            {/* cigarette: sits in the smirk, then travels with the hand */}
            <group ref={cig} position={[0.26, 1.0, 1.08]} rotation={[0.18, 0.28, 0]}>
              <mesh material={M.white} position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.032, 0.032, 0.72, 10]} />
              </mesh>
              <mesh material={M.amberSoft} position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 0.1, 10]} />
              </mesh>
              <mesh ref={emberRef} material={M.ember} position={[0, 0, 0.73]} geometry={sphereGeo} scale={0.05} />
            </group>

            {/* guitar slung on his back; pivot is the grip, swing rotates about x */}
            <group ref={pivot} position={[GUITAR_REST.x, GUITAR_REST.y, GUITAR_REST.z]}>
              <group ref={tilt} scale={1.22}>
                <Guitar />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
