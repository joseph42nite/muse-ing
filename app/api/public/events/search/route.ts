import { NextResponse } from "next/server"
import { all, get } from "@/lib/server/db"

const PAGE_SIZE_MAX = 48

const SORTS: Record<string, string> = {
  soonest: "e.date ASC",
  latest: "e.date DESC",
  price_asc: "e.ticket_price ASC, e.date ASC",
  price_desc: "e.ticket_price DESC, e.date ASC",
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function dateRange(when: string): { from?: string; to?: string } {
  const today = new Date()
  const start = isoDay(today)
  const plus = (days: number) => isoDay(new Date(today.getTime() + days * 86400e3))
  switch (when) {
    case "today":
      return { from: start, to: start }
    case "week":
      return { from: start, to: plus(7) }
    case "weekend": {
      const dow = today.getUTCDay() // 0 Sun .. 6 Sat
      const toSat = (6 - dow + 7) % 7
      const sat = dow === 0 ? -1 : toSat
      return { from: plus(Math.max(sat, 0)), to: plus(Math.max(sat, 0) + 1) }
    }
    case "all":
      return {}
    default:
      return { from: start } // upcoming
  }
}

// Paginated, filterable public event listing for the /events explorer.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams

  const q = sp.get("q")?.trim().toLowerCase() ?? ""
  const city = sp.get("city")?.trim().toLowerCase() ?? ""
  const when = sp.get("when")?.trim() ?? "upcoming"
  const maxPriceRaw = sp.get("max_price")
  const maxPrice = maxPriceRaw !== null && maxPriceRaw !== "" ? Number(maxPriceRaw) : null
  const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.soonest
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "12", 10) || 12, 1), PAGE_SIZE_MAX)
  const page = Math.max(parseInt(sp.get("page") ?? "1", 10) || 1, 1)

  const where: string[] = []
  const params: any[] = []

  if (q) {
    where.push(
      "(LOWER(e.title) LIKE ? OR LOWER(COALESCE(e.location_name,'')) LIKE ? OR LOWER(COALESCE(u.name,'')) LIKE ?)"
    )
    const like = `%${q}%`
    params.push(like, like, like)
  }
  if (city) {
    // location_name is stored as "Venue • City"
    where.push("LOWER(COALESCE(e.location_name,'')) LIKE ?")
    params.push(`%• ${city}`)
  }
  const { from, to } = dateRange(when)
  if (from) {
    where.push("e.event_date_only >= ?")
    params.push(from)
  }
  if (to) {
    where.push("e.event_date_only <= ?")
    params.push(to)
  }
  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    where.push("e.ticket_price <= ?")
    params.push(maxPrice)
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  const from_ = "FROM events e LEFT JOIN users u ON u.id = e.artist_id"

  const total = get<{ n: number }>(`SELECT COUNT(*) AS n ${from_} ${whereSql}`, ...params)?.n ?? 0
  const events = all(
    `SELECT e.id, e.title, e.description, e.date, e.event_date_only, e.location_name, e.location_slug,
            e.ticket_price, e.artist_id, u.name AS artist_name, u.avatar_url AS artist_avatar
       ${from_} ${whereSql}
      ORDER BY ${sort}
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit
  )

  // City facets, independent of the active city filter so the chips stay stable.
  const cities = all<{ location_name: string }>(
    "SELECT DISTINCT location_name FROM events WHERE location_name LIKE '%•%'"
  )
    .map((r) => r.location_name.split("•")[1]?.trim())
    .filter((c): c is string => Boolean(c))
  const uniqueCities = Array.from(new Set(cities)).sort()

  return NextResponse.json({
    events,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    limit,
    cities: uniqueCities,
  })
}
