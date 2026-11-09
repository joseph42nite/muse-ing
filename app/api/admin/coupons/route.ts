import { forbidden, requireRole } from "@/lib/server/auth"
import { createCoupon, listCoupons, suggestCodes } from "@/lib/server/coupons"
import { all } from "@/lib/server/db"
import { readJson, respond } from "@/lib/server/respond"

// GET: every coupon with seats used and sales, plus the artists, promoters and gigs to pick from.
// GET ?suggest=<owner name>&discount=<n>&event_id=<id>: code ideas.
export async function GET(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  const q = new URL(req.url).searchParams
  if (q.has("suggest")) {
    const ev = all<{ title: string; location_name: string | null }>("SELECT title, location_name FROM events WHERE id = ?", q.get("event_id") ?? "")[0]
    return Response.json({ codes: suggestCodes(q.get("suggest") ?? "", Number(q.get("discount")), ev ? [ev.location_name ?? "", ev.title] : []) })
  }
  return Response.json({
    coupons: listCoupons(),
    artists: all("SELECT id, name FROM users WHERE role = 'artist' ORDER BY name"),
    promoters: all("SELECT id, name FROM users WHERE role = 'promoter' ORDER BY name"),
    events: all(
      `SELECT id, title, date, artist_id, location_name FROM events
        WHERE ticket_price > 0 AND date >= ? AND COALESCE(fee_status, '') <> 'Cancelled' ORDER BY date`,
      new Date(Date.now() - 12 * 3600e3).toISOString(),
    ),
  })
}

export async function POST(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  return respond(createCoupon(await readJson(req)))
}
