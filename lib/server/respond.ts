import type { WriteResult } from "./admin"

/** Turns an admin write result into a JSON response: the payload on success, { error } otherwise. */
export function respond<T>(r: WriteResult<T>) {
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status })
  const { ok: _ok, ...body } = r
  return Response.json(body)
}

export const readJson = (req: Request) => req.json().catch(() => ({})) as Promise<Record<string, unknown>>
