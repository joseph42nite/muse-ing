"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, ArrowLeft, MapPin, Search, X } from "lucide-react"

export interface ExplorerEvent {
  id: string
  title: string
  description: string | null
  date: string
  event_date_only: string | null
  location_name: string | null
  location_slug: string | null
  ticket_price: number
  artist_name: string | null
  artist_avatar: string | null
}

interface SearchResponse {
  events: ExplorerEvent[]
  total: number
  page: number
  pages: number
  cities: string[]
}

const COVERS = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80",
]

const WHEN_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "all", label: "All dates" },
]

const SORT_OPTIONS = [
  { value: "soonest", label: "Soonest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "latest", label: "Latest first" },
]

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "0", label: "Free" },
  { value: "500", label: "Under ₹500" },
  { value: "1000", label: "Under ₹1,000" },
]

const PAGE_SIZE = 12

function coverFor(ev: ExplorerEvent) {
  let h = 0
  for (const ch of ev.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ev.artist_avatar || COVERS[h % COVERS.length]
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { day: "—", month: "", time: "" }
  const tz = "Asia/Kolkata"
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: tz }),
    month: d.toLocaleDateString("en-IN", { month: "short", timeZone: tz }).toUpperCase(),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }),
  }
}

const selectCls =
  "h-10 rounded-full bg-white/80 border border-[#181615]/15 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#181615] focus:outline-none focus:border-[#D92323] cursor-pointer"

export default function EventsExplorer() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const q = sp.get("q") ?? ""
  const city = sp.get("city") ?? ""
  const when = sp.get("when") ?? "upcoming"
  const sort = sp.get("sort") ?? "soonest"
  const maxPrice = sp.get("max_price") ?? ""
  const page = Math.max(parseInt(sp.get("page") ?? "1", 10) || 1, 1)

  const [searchText, setSearchText] = useState(q)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const knownCities = useRef<string[]>([])
  const gridTop = useRef<HTMLDivElement>(null)

  const setParams = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k)
        else next.set(k, v)
      }
      if (!keepPage) next.delete("page")
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [sp, router, pathname]
  )

  // Debounce the search box into the URL.
  useEffect(() => {
    if (searchText === q) return
    const t = setTimeout(() => setParams({ q: searchText.trim() || null }), 300)
    return () => clearTimeout(t)
  }, [searchText, q, setParams])

  // Keep the box in sync when the URL changes elsewhere (back button, reset).
  useEffect(() => {
    setSearchText(q)
  }, [q])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ when, sort, page: String(page), limit: String(PAGE_SIZE) })
    if (q) qs.set("q", q)
    if (city) qs.set("city", city)
    if (maxPrice) qs.set("max_price", maxPrice)

    fetch(`/api/public/events/search?${qs.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load events.")
        return (await r.json()) as SearchResponse
      })
      .then((res) => {
        if (res.cities.length) knownCities.current = res.cities
        setData(res)
        setLoading(false)
      })
      .catch((e) => {
        if (e.name === "AbortError") return
        setError(e.message || "Something went wrong.")
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [q, city, when, sort, maxPrice, page])

  const goToPage = (p: number) => {
    setParams({ page: p > 1 ? String(p) : null }, true)
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const hasFilters = Boolean(q || city || maxPrice || when !== "upcoming" || sort !== "soonest")
  const cities = data?.cities.length ? data.cities : knownCities.current

  return (
    <div className="mx-auto w-full max-w-7xl px-8 sm:px-12 md:px-16 pb-24">
      {/* Filters */}
      <div className="flex flex-col gap-5">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#181615]/45" />
          <input
            type="search"
            aria-label="Search events"
            placeholder="Search by event, artist or venue"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-12 w-full rounded-full bg-white/80 border border-[#181615]/15 pl-11 pr-4 text-sm text-[#181615] placeholder:text-[#181615]/45 focus:outline-none focus:border-[#D92323]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setParams({ city: null })}
            className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition cursor-pointer ${
              !city
                ? "bg-[#D92323] text-white"
                : "bg-white/80 text-[#181615]/75 border border-[#181615]/15 hover:bg-white"
            }`}
          >
            All cities
          </button>
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setParams({ city: c })}
              className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em] transition cursor-pointer ${
                city.toLowerCase() === c.toLowerCase()
                  ? "bg-[#D92323] text-white"
                  : "bg-white/80 text-[#181615]/75 border border-[#181615]/15 hover:bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="When" value={when} onChange={(e) => setParams({ when: e.target.value })} className={selectCls}>
            {WHEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Price" value={maxPrice} onChange={(e) => setParams({ max_price: e.target.value })} className={selectCls}>
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setParams({ sort: e.target.value })} className={selectCls}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchText("")
                router.replace(pathname, { scroll: false })
              }}
              className="h-10 inline-flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#D92323] hover:underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div ref={gridTop} className="scroll-mt-8 mt-10">
        <p aria-live="polite" className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#181615]/55">
          {loading && !data ? "Loading…" : `${data?.total ?? 0} ${data?.total === 1 ? "event" : "events"}`}
        </p>

        {error && <p className="text-sm text-[#D92323]">{error}</p>}

        {!error && data && data.events.length === 0 && !loading && (
          <div className="rounded-2xl border border-[#181615]/10 bg-white/60 px-8 py-16 text-center">
            <p className="instrument text-4xl text-[#181615]">Nothing on the bill</p>
            <p className="mt-2 text-sm text-[#181615]/65">Try another city, date or search term.</p>
          </div>
        )}

        <ul
          className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
        >
          {data?.events.map((ev) => {
            const d = formatDate(ev.date)
            return (
              <li key={ev.id}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-[#F4EFE6] shadow-[0_18px_44px_-10px_rgba(24,22,21,0.28),0_2px_8px_rgba(24,22,21,0.1)] transition-shadow duration-300 hover:shadow-[0_28px_64px_-12px_rgba(24,22,21,0.38)]">
                  <Link href={`/events/${ev.id}`} className="relative block h-52 overflow-hidden bg-[#121110]">
                    { }
                    <img
                      src={coverFor(ev)}
                      alt={ev.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute left-4 top-4 rounded-lg bg-[#F4EFE6] px-3 py-2 text-center leading-none text-[#181615]">
                      <div className="text-lg font-semibold">{d.day}</div>
                      <div className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-[#D92323]">{d.month}</div>
                    </div>
                    <span className="absolute right-4 top-4 rounded-full bg-[#181615] px-3 py-1 text-[11px] font-semibold text-white">
                      {ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"}
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    {ev.artist_name && (
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#181615]/55">
                        {ev.artist_name}
                      </p>
                    )}
                    <h2 className="mt-1 text-lg font-medium leading-snug tracking-tight text-[#181615] line-clamp-2">
                      <Link href={`/events/${ev.id}`} className="hover:text-[#D92323] transition-colors">
                        {ev.title}
                      </Link>
                    </h2>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[#5C5650]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D92323]" />
                      <span className="truncate">{ev.location_name || "Venue to be announced"}</span>
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <Link
                        href={`/events/${ev.id}`}
                        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#181615] hover:text-[#D92323] transition-colors"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/book/${ev.id}`}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#D92323] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#b81b1b]"
                      >
                        Book <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>

        {data && data.pages > 1 && (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#181615]/20 px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#181615] transition hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#181615]/65">
              Page {page} of {data.pages}
            </span>
            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => goToPage(page + 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#181615]/20 px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#181615] transition hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
