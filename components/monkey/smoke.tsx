"use client"

import * as THREE from "three"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { ember, MONKEY_SCALE, mouth, PROFILE_SHIFT, sampleCamera, scroll, smooth, WORDMARK_SHOT } from "./store"

const S = MONKEY_SCALE

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOISE = /* glsl */ `
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
`

const SMOKE_VS = /* glsl */ `
  uniform float uT; uniform vec3 uTip; uniform float uPx;
  attribute float aSeed; attribute float aOff;
  varying float vA; varying float vSeed; varying float vAge;
  void main(){
    float life = 6.5;
    float age = fract(uT / life + aOff);
    float t = age * life;
    vec3 p = uTip;
    p.y += (t * 0.09 + t * t * 0.006) * ${S.toFixed(4)};
    p.x += (t * 0.075 + sin(t * 0.8 + aSeed * 6.28) * 0.016 * t) * ${S.toFixed(4)};
    p.z += (t * 0.02 + cos(t * 0.6 + aSeed * 12.0) * 0.016 * t) * ${S.toFixed(4)};
    float sw = (0.006 + t * 0.022) * ${S.toFixed(4)};
    p.x += sin(t * 1.7 + aSeed * 40.0) * sw;
    p.z += cos(t * 1.3 + aSeed * 23.0) * sw;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * (0.016 + t * 0.045) * ${S.toFixed(4)} / -mv.z;
    gl_Position = projectionMatrix * mv;
    vA = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.25, 1.0, age));
    vSeed = aSeed; vAge = age;
  }
`

const EXHALE_VS = /* glsl */ `
  uniform float uT; uniform float uStart; uniform float uScrollAge; uniform vec3 uMouth; uniform float uPx;
  attribute float aSeed; attribute float aOff;
  varying float vA; varying float vSeed; varying float vAge;
  void main(){
    float life = 3.2;
    float age = uScrollAge > -50.0 ? (uScrollAge - aOff * 1.0) : (uT - (uStart + aOff * 1.0));
    float k = clamp(age / life, 0.0, 1.0);
    vec3 dir = normalize(vec3((aSeed - 0.5) * 0.7, -0.2 + aSeed * 0.15, 1.0));
    vec3 p = uMouth + dir * 0.45 * ${S.toFixed(4)} * (1.0 - exp(-max(age, 0.0) * 1.7));
    p += vec3(0.05 * age, 0.04 * age + 0.03 * age * age, 0.0) * ${S.toFixed(4)};
    float sw = (0.01 + max(age, 0.0) * 0.05) * ${S.toFixed(4)};
    p.x += sin(age * 1.9 + aSeed * 30.0) * sw;
    p.y += cos(age * 1.5 + aSeed * 17.0) * sw * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = (age < 0.0 || age > life) ? 0.0 : smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.25, 1.0, k));
    gl_PointSize = vA > 0.0 ? uPx * (0.035 + max(age, 0.0) * 0.085) * ${S.toFixed(4)} / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
    vSeed = aSeed; vAge = k;
  }
`

const SMOKE_FS = /* glsl */ `
  uniform float uAlpha;
  varying float vA; varying float vSeed; varying float vAge;
  ${NOISE}
  void main(){
    vec2 pc = gl_PointCoord - 0.5;
    float r = length(pc);
    if (r > 0.5) discard;
    float a = vSeed * 6.2831 + vAge * 2.5;
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * pc;
    float f = n(q * 3.0 + vSeed * 17.0) * 0.6 + n(q * 7.0 + vSeed * 5.0) * 0.4;
    float alpha = smoothstep(0.5, 0.0, r) * smoothstep(0.32, 0.8, f) * vA * uAlpha;
    gl_FragColor = vec4(0.6, 0.6, 0.64, alpha);
  }
`

function puffGeometry(N: number, seed: number, spread: boolean) {
  const r = mulberry32(seed)
  const pos = new Float32Array(N * 3)
  const sd = new Float32Array(N)
  const off = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    sd[i] = r()
    off[i] = spread ? i / N + r() / N : r()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("aSeed", new THREE.BufferAttribute(sd, 1))
  g.setAttribute("aOff", new THREE.BufferAttribute(off, 1))
  return g
}

const pxPerUnit = (state: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) =>
  state.gl.domElement.height /
  (2 * Math.tan(THREE.MathUtils.degToRad((state.camera as THREE.PerspectiveCamera).fov) / 2))

/** The cigarette's thin rising stream and the breath he pushes out of his lips (both on the 9s smoking cycle and on scroll). */
export function Smoke() {
  const stream = useRef<THREE.ShaderMaterial>(null)
  const breath = useRef<THREE.ShaderMaterial>(null)
  const streamGeo = useMemo(() => puffGeometry(150, 7, true), [])
  const breathGeo = useMemo(() => puffGeometry(90, 19, false), [])
  const streamU = useMemo(
    () => ({
      uT: { value: 0 },
      uTip: { value: new THREE.Vector3() },
      uPx: { value: 1000 },
      uAlpha: { value: 0.14 },
    }),
    []
  )
  const breathU = useMemo(
    () => ({
      uT: { value: 0 },
      uStart: { value: -99 },
      uScrollAge: { value: -99 },
      uMouth: { value: new THREE.Vector3() },
      uPx: { value: 1000 },
      uAlpha: { value: 0.16 },
    }),
    []
  )

  useFrame((state) => {
    const t = scroll.value
    const tt = state.clock.elapsedTime
    const px = pxPerUnit(state)
    const s = stream.current?.uniforms
    const b = breath.current?.uniforms
    if (s) {
      s.uT.value = tt
      s.uTip.value.set(ember.x, ember.y, ember.z)
      s.uPx.value = px
      s.uAlpha.value = 0.14 * (1 - smooth(0.80, 0.84, t))
    }
    if (b) {
      const CYCLE = 9
      const scrolled = smooth(0, 0.02, t)
      b.uT.value = tt
      b.uStart.value = scrolled > 0.5 ? -99 : Math.floor(tt / CYCLE) * CYCLE + 2.2
      b.uScrollAge.value = t >= 0.03 && t <= 0.36 ? ((t - 0.03) / 0.18) * 3.6 : -99
      b.uMouth.value.set(mouth.x, mouth.y, mouth.z)
      b.uPx.value = px
    }
  })

  return (
    <>
      <points geometry={streamGeo} frustumCulled={false} renderOrder={100}>
        <shaderMaterial
          ref={stream}
          uniforms={streamU}
          vertexShader={SMOKE_VS}
          fragmentShader={SMOKE_FS}
          transparent
          depthWrite={false}
        />
      </points>
      <points geometry={breathGeo} frustumCulled={false} renderOrder={101}>
        <shaderMaterial
          ref={breath}
          uniforms={breathU}
          vertexShader={EXHALE_VS}
          fragmentShader={SMOKE_FS}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  )
}

const WORD_VS = /* glsl */ `
  uniform float uP; uniform float uT; uniform float uPx; uniform float uFade;
  uniform vec3 uMouth;
  attribute vec3 aStartJ; attribute vec3 aMidJ; attribute float aF; attribute float aR;
  varying float vA; varying float vK; varying float vSeed;
  vec3 bez(vec3 a, vec3 b, vec3 c, float t){ return mix(mix(a, b, t), mix(b, c, t), t); }
  void main(){
    float k = clamp((uP - aR * 0.45) / 0.55, 0.0, 1.0);
    float e = k * k * (3.0 - 2.0 * k);
    vec3 start = uMouth + aStartJ;
    vec3 outp = uMouth + vec3(0.0, -0.05 * ${S.toFixed(4)}, 0.40 * ${S.toFixed(4)});
    vec3 mid = mix(outp, position, 0.3 + aF * 0.25) + aMidJ;
    vec3 p = bez(start, mid, position, e);
    float turb = sin(e * 3.14159);
    p += vec3(sin(uT * 1.3 + aR * 40.0), cos(uT * 1.1 + aR * 31.0), sin(uT * 0.9 + aR * 23.0)) * ((0.07 * turb + 0.005) * ${S.toFixed(4)});
    p += vec3(sin(aR * 50.0) * 0.6, 1.4 + aR * 1.2, cos(aR * 37.0) * 0.5) * ${S.toFixed(4)} * uFade * uFade;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = smoothstep(0.0, 0.06, k) * (1.0 - uFade);
    gl_PointSize = vA > 0.0 ? uPx * mix(0.11, 0.024, e) * ${S.toFixed(4)} / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
    vK = e; vSeed = aR;
  }
`

const WORD_FS = /* glsl */ `
  varying float vA; varying float vK; varying float vSeed;
  ${NOISE}
  void main(){
    vec2 pc = gl_PointCoord - 0.5; float r = length(pc);
    if (r > 0.5) discard;
    float wisp = mix(smoothstep(0.25, 0.75, n(pc * 4.0 + vSeed * 13.0)), 1.0, vK);
    float a = smoothstep(0.5, 0.05, r) * wisp * vA * mix(0.055, 0.62, vK * vK);
    vec3 c = mix(vec3(0.6, 0.6, 0.64), vec3(0.93, 0.92, 0.9), vK);
    gl_FragColor = vec4(c, a);
  }
`

function sampleWord(family: string, maxPts: number) {
  const W = 1600
  const H = 420
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = `330px ${family}`
  g.fillText("muse-ing", W / 2, H / 2 + 10)
  const d = g.getImageData(0, 0, W, H).data
  const pts: number[] = []
  let minX = W
  let maxX = 0
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 140) {
        pts.push(x, y)
        if (x < minX) minX = x
        if (x > maxX) maxX = x
      }
    }
  }
  const rnd = mulberry32(5)
  const idx = Array.from({ length: pts.length / 2 }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0
    const tmp = idx[i]
    idx[i] = idx[j]
    idx[j] = tmp
  }
  const n = Math.min(maxPts, idx.length)
  const out = new Float32Array(n * 2)
  const cx = (minX + maxX) / 2
  const span = Math.max(1, maxX - minX)
  for (let i = 0; i < n; i++) {
    const k = idx[i]
    out[i * 2] = (pts[k * 2] - cx) / span
    out[i * 2 + 1] = -(pts[k * 2 + 1] - H / 2) / span
  }
  return out
}

function buildWordGeometry(family: string, fov: number, aspect: number) {
  const wide = sampleCamera(WORDMARK_SHOT)
  const cam = new THREE.Vector3(wide.p[0], wide.p[1], wide.p[2])
  const tgt = new THREE.Vector3(wide.l[0], wide.l[1], wide.l[2])
  const fwd = tgt.clone().sub(cam).normalize()
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize()
  const dist = cam.distanceTo(tgt)
  const D = dist - 1.6 * S
  const halfH = D * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
  const halfW = halfH * aspect
  const tall = aspect < 0.85
  const centre = cam
    .clone()
    .addScaledVector(fwd, D)
    // On portrait screens the stage slides this shot left by PROFILE_SHIFT; start right by as much so the word stays centred
    .addScaledVector(right, tall ? 2 * PROFILE_SHIFT * halfW : -0.42 * halfW)
    .addScaledVector(up, tall ? 0.62 * halfH : 0.12 * halfH)
  const width = tall ? 1.7 * halfW : 0.76 * halfW

  const uv = sampleWord(family, 9000)
  const N = uv.length / 2
  const end = new Float32Array(N * 3)
  const startJ = new Float32Array(N * 3)
  const midJ = new Float32Array(N * 3)
  const f = new Float32Array(N)
  const r = new Float32Array(N)
  const rnd = mulberry32(23)
  const e = new THREE.Vector3()
  for (let i = 0; i < N; i++) {
    e.copy(centre)
      .addScaledVector(right, uv[i * 2] * width)
      .addScaledVector(up, uv[i * 2 + 1] * width)
      .addScaledVector(fwd, (rnd() - 0.5) * 0.04 * S)
    end.set([e.x, e.y, e.z], i * 3)
    startJ.set([(rnd() - 0.5) * 0.04 * S, (rnd() - 0.5) * 0.03 * S, 0], i * 3)
    f[i] = rnd()
    midJ.set([(rnd() - 0.5) * 0.9 * S, (0.1 + rnd() * 0.7) * S, (rnd() - 0.5) * 0.7 * S], i * 3)
    r[i] = Math.min(1, Math.max(0, (uv[i * 2] + 0.5) * 0.55 + rnd() * 0.45))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(end, 3))
  g.setAttribute("aStartJ", new THREE.BufferAttribute(startJ, 3))
  g.setAttribute("aMidJ", new THREE.BufferAttribute(midJ, 3))
  g.setAttribute("aF", new THREE.BufferAttribute(f, 1))
  g.setAttribute("aR", new THREE.BufferAttribute(r, 1))
  return g
}

/** The exhale that becomes the name: every particle leaves the lips on its own clock and settles onto the wide-shot plane. */
export function Wordmark() {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const { camera, size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const fov = (camera as THREE.PerspectiveCamera).fov || 28

  useEffect(() => {
    let cancelled = false
    const family = '"Instrument Serif", Georgia, serif'
    const run = async () => {
      try {
        if (typeof FontFace !== "undefined") {
          const ff = new FontFace("Instrument Serif", "url(/fonts/InstrumentSerif-Regular.ttf)", {
            style: "normal",
            weight: "400",
          })
          const loaded = await ff.load()
          document.fonts.add(loaded)
        }
        await document.fonts.load('330px "Instrument Serif"', "muse-ing")
      } catch {
        /* fallback */
      }
      if (!cancelled) {
        setGeo((prev) => {
          prev?.dispose()
          return buildWordGeometry(family, fov, aspect)
        })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [fov, aspect])

  const uniforms = useMemo(
    () => ({
      uP: { value: 0 },
      uT: { value: 0 },
      uPx: { value: 1000 },
      uFade: { value: 0 },
      uMouth: { value: new THREE.Vector3() },
    }),
    []
  )

  useFrame((state) => {
    const u = mat.current?.uniforms
    if (!u) return
    const t = scroll.value
    u.uP.value = smooth(0.03, 0.22, t)
    u.uT.value = state.clock.elapsedTime
    u.uPx.value = pxPerUnit(state)
    u.uFade.value = smooth(0.27, 0.32, t)
    u.uMouth.value.set(mouth.x, mouth.y, mouth.z)
  })

  if (!geo) return null
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={102}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={WORD_VS}
        fragmentShader={WORD_FS}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}
