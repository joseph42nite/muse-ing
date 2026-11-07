// Sculpts and paints one slice of the monkey's head off the main thread (see head-client.ts).
import { paintSkinRows, traceHead } from "./head"

export type HeadTask = { kind: "trace"; i0: number; i1: number } | { kind: "paint"; T: Float32Array; r0: number; r1: number }
type HeadJob = HeadTask & { id: number }

const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<HeadJob>) => {
  const job = e.data
  if (job.kind === "trace") {
    const T = traceHead(job.i0, job.i1)
    ctx.postMessage({ id: job.id, T }, [T.buffer])
  } else {
    const out = paintSkinRows(job.T, job.r0, job.r1)
    ctx.postMessage({ id: job.id, ...out }, [out.height.buffer, out.albedo.buffer, out.rough.buffer, out.fur.buffer])
  }
}
