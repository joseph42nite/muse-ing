"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, MapPin, Search, X } from "lucide-react"

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

/** A cream pill when on, a quiet label when off, like the tabs on the landing's booking form. */
const chip = (on: boolean) =>
  `micro h-9 shrink-0 cursor-pointer rounded-full px-4 transition ${
    on ? "bg-[#F4EFE6] text-[#0b0a0e]" : "text-[#F4EFE6]/60 hover:text-[#F4EFE6]"
  }`

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="relative flex min-w-0 flex-1 flex-col gap-1.5 border-b border-white/20 pb-2 transition focus-within:border-[#F4EFE6] sm:max-w-[220px]">
      <span className="micro text-[#F4EFE6]/45">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-[14px] text-[#F4EFE6] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#14131a] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute bottom-3 right-0 h-3.5 w-3.5 text-[#F4EFE6]/60" />
    </label>
  )
}

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
    <div className="relative z-10 px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      {/* Filters */}
      <div className="card-noir p-5 sm:p-7">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#F4EFE6]/50" />
          <input
            type="search"
            aria-label="Search events"
            placeholder="Search by event, artist or venue"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="field-noir pl-7! text-[16px]! sm:text-[18px]!"
          />
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/30 p-1 lg:max-w-[55%]">
            <button type="button" onClick={() => setParams({ city: null })} className={chip(!city)}>
              All cities
            </button>
            {cities.map((c) => (
              <button key={c} type="button" onClick={() => setParams({ city: c })} className={chip(city.toLowerCase() === c.toLowerCase())}>
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-5 sm:flex-nowrap">
            <Picker label="When" value={when} options={WHEN_OPTIONS} onChange={(v) => setParams({ when: v })} />
            <Picker label="Price" value={maxPrice} options={PRICE_OPTIONS} onChange={(v) => setParams({ max_price: v })} />
            <Picker label="Sort" value={sort} options={SORT_OPTIONS} onChange={(v) => setParams({ sort: v })} />
          </div>
        </div>
      </div>

      {/* Results */}
      <div ref={gridTop} className="mt-12 scroll-mt-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="dots"><i /></div>
            <p aria-live="polite" className="title-x mt-4 text-[30px] sm:text-[38px]">
              {loading && !data ? "Loading" : `${data?.total ?? 0} ${data?.total === 1 ? "gig" : "gigs"}`}
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchText("")
                router.replace(pathname, { scroll: false })
              }}
              className="pill-dark micro shrink-0 cursor-pointer"
            >
              Clear <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {error && <p className="fine text-[14px]!">{error}</p>}

        {!error && data && data.events.length === 0 && !loading && (
          <div className="card-noir px-8 py-16 text-center">
            <p className="title-x text-[28px] sm:text-[36px]">Nothing on the bill</p>
            <p className="fine mt-3 text-[14px]!">Try another city, date or search term.</p>
          </div>
        )}

        <ul className={`grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
          {data?.events.map((ev, i) => {
            const d = formatDate(ev.date)
            const n = (page - 1) * PAGE_SIZE + i + 1
            return (
              <li key={ev.id}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-md border border-white/10 bg-[#0b0a0e]/80 transition hover:border-white/50">
                  <Link href={`/events/${ev.id}`} className="relative block aspect-[4/3] overflow-hidden bg-[#121110]">
                    <img
                      src={coverFor(ev)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-75 grayscale-[0.6] transition duration-700 ease-out group-hover:scale-105 group-hover:opacity-90 group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a0e] via-[#0b0a0e]/20 to-transparent" />
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                      <span className="micro">
                        {d.day} {d.month}
                        {d.time && <span className="text-[#F4EFE6]/55"> · {d.time}</span>}
                      </span>
                      <span className="micro text-[#F4EFE6]/50">{String(n).padStart(2, "0")}</span>
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-3 pt-1 sm:p-4 sm:pt-1">
                    <h2 className="title-x line-clamp-2 text-[18px] leading-[1.02] group-hover:text-white sm:text-[20px]">
                      <Link href={`/events/${ev.id}`}>{ev.title}</Link>
                    </h2>
                    <p className="micro mt-2 truncate text-[#F4EFE6]/50">{ev.artist_name || "Live"}</p>

                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <span className="flex min-w-0 items-center gap-1 text-[11px] text-[#F4EFE6]/60">
                          <MapPin className="h-3 w-3 shrink-0 text-[#F4EFE6]" />
                          <span className="truncate">{ev.location_name || "Venue TBA"}</span>
                        </span>
                        <span className="micro shrink-0">{ev.ticket_price > 0 ? `₹${ev.ticket_price}` : "Free"}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Link href={`/events/${ev.id}`} className="micro flex items-center gap-1 text-[#F4EFE6]/70 transition hover:text-white">
                          Details <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        <Link
                          href={`/book/${ev.id}`}
                          className="micro inline-flex h-8 items-center gap-1.5 rounded-full bg-[#F4EFE6] px-4 text-[#0b0a0e] transition hover:bg-white"
                        >
                          Book <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
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
              className="btn-ghost h-10! cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="micro text-[#F4EFE6]/60">
              {String(page).padStart(2, "0")} / {String(data.pages).padStart(2, "0")}
            </span>
            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => goToPage(page + 1)}
              className="btn-ghost h-10! cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
