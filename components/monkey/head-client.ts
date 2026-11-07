// Builds the monkey's head data (mesh ray distances and painted skin maps) across a pool of
// workers, one slice per core, so the slowest part of the landing's load runs in parallel and
// off the main thread. Started as early as possible (experience.tsx) and shared once done.
import { normalFromHeight, paintSkinRows, SEG_H, SEG_W, SKIN_H, SKIN_W, traceHead } from "./head"
import type { HeadTask } from "./head.worker"

export interface HeadData {
  /** Ray distance of each head-mesh vertex, in SphereGeometry(1, SEG_W, SEG_H) order. */
  T: Float32Array
  albedo: Uint8Array<ArrayBuffer>
  normal: Uint8Array<ArrayBuffer>
  rough: Uint8Array<ArrayBuffer>
  fur: Uint8Array<ArrayBuffer>
}

type Painted = ReturnType<typeof paintSkinRows>

let pending: Promise<HeadData> | null = null

/** Splits 0..n into k nearly equal ranges. */
const slices = (n: number, k: number) => Array.from({ length: k }, (_, i) => [Math.floor((n * i) / k), Math.floor((n * (i + 1)) / k)] as const)

function assemble(T: Float32Array, parts: Painted[]): HeadData {
  const N = SKIN_W * SKIN_H
  const height = new Float32Array(N)
  const albedo = new Uint8Array(N * 4)
  const rough = new Uint8Array(N * 4)
  const fur = new Uint8Array(N * 4)
  let at = 0
  for (const p of parts) {
    height.set(p.height, at)
    albedo.set(p.albedo, at * 4)
    rough.set(p.rough, at * 4)
    fur.set(p.fur, at * 4)
    at += p.height.length
  }
  return { T, albedo, normal: normalFromHeight(height), rough, fur }
}

async function inWorkers(): Promise<HeadData> {
  const k = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1))
  const pool = Array.from({ length: k }, () => new Worker(new URL("./head.worker.ts", import.meta.url)))
  let nextId = 0
  const run = <R>(w: Worker, job: HeadTask, transfer: Transferable[] = []) =>
    new Promise<R>((resolve, reject) => {
      const id = nextId++
      const onMsg = (e: MessageEvent) => {
        if (e.data?.id !== id) return
        w.removeEventListener("message", onMsg)
        resolve(e.data as R)
      }
      w.addEventListener("message", onMsg)
      w.addEventListener("error", reject, { once: true })
      w.postMessage({ ...job, id }, transfer)
    })
  try {
    const verts = (SEG_W + 1) * (SEG_H + 1)
    const traced = await Promise.all(slices(verts, k).map(([i0, i1], i) => run<{ T: Float32Array }>(pool[i], { kind: "trace", i0, i1 })))
    const T = new Float32Array(verts)
    traced.reduce((at, r) => (T.set(r.T, at), at + r.T.length), 0)
    const parts = await Promise.all(slices(SKIN_H, k).map(([r0, r1], i) => run<Painted>(pool[i], { kind: "paint", T, r0, r1 })))
    return assemble(T, parts)
  } finally {
    pool.forEach((w) => w.terminate())
  }
}

/** On the main thread, for browsers without module workers. */
function inline(): HeadData {
  const T = traceHead(0, (SEG_W + 1) * (SEG_H + 1))
  return assemble(T, [paintSkinRows(T, 0, SKIN_H)])
}

/** The head data, built once and shared. Safe to call early and often. */
export function loadHead(): Promise<HeadData> {
  pending ??= (typeof Worker === "undefined" ? Promise.resolve().then(inline) : inWorkers().catch(inline))
  return pending
}
