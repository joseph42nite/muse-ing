"use client"

import * as THREE from "three"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { ember, MONKEY_SCALE, mouth, mulberry32, scroll, smooth } from "./store"

const S = MONKEY_SCALE


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
