"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface EventRow {
  id: string
  title: string
  date: string
}

interface Booking {
  id: string
  name: string
  phone: string
  num_people: number
  total_amount: number
  payment_status: string
  created_at: string
}

interface Checkin {
  id: string
  audience_phone: string
  checkin_time: string | null
}

type Filter = "all" | "pending" | "in"

const normalize = (p: string) => p.replace(/\D/g, "").slice(-10)

export default function VenueDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [events, setEvents] = useState<EventRow[]>([])
  const [eventId, setEventId] = useState(searchParams.get("event_id") ?? "")
  const [bookings, setBookings] = useState<Booking[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPhone, setBusyPhone] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [quickPhone, setQuickPhone] = useState("")
  const quickRef = useRef<HTMLInputElement>(null)

  const flash = useCallback((type: "ok" | "err", text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Load venue's events once.
  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/venue/events")
      if (res.status === 401 || res.status === 403) {
        router.push("/login")
        return
      }
      const rows = ((await res.json()) as EventRow[]) ?? []
      setEvents(rows)
      setEventId((cur) => {
        if (cur) return cur
        // default to the upcoming-or-latest event
        const upcoming = [...rows].reverse().find((e) => new Date(e.date).getTime() > Date.now() - 12 * 3600e3)
        return (upcoming ?? rows[0])?.id ?? ""
      })
      setLoading(false)
    })()
  }, [router])

  const loadEventData = useCallback(async () => {
    if (!eventId) return
    const res = await fetch(`/api/venue/guests?event_id=${encodeURIComponent(eventId)}`, { cache: "no-store" })
    const body = await res.json()
    if (!res.ok) return flash("err", body.error || "Could not load guests.")
    setBookings(body.bookings ?? [])
    setCheckins(body.checkins ?? [])
  }, [eventId, flash])

  // Initial load + light polling so multiple door staff stay in sync.
  useEffect(() => {
    loadEventData()
    const t = setInterval(loadEventData, 15000)
    return () => clearInterval(t)
  }, [loadEventData])

  const checkinByPhone = useMemo(() => {
    const m = new Map<string, Checkin>()
    checkins.forEach((c) => m.set(normalize(c.audience_phone), c))
    return m
  }, [checkins])

  // One row per phone number (a guest may have booked more than once).
  const guests = useMemo(() => {
    const m = new Map<string, { phone: string; name: string; people: number; amount: number }>()
    bookings.forEach((b) => {
      const key = normalize(b.phone)
      const cur = m.get(key)
      if (cur) {
        cur.people += b.num_people
        cur.amount += Number(b.total_amount)
      } else m.set(key, { phone: b.phone, name: b.name, people: b.num_people, amount: Number(b.total_amount) })
    })
    return [...m.entries()].map(([key, g]) => ({ key, ...g, checkin: checkinByPhone.get(key) ?? null }))
  }, [bookings, checkinByPhone])

  const stats = useMemo(() => {
    const total = guests.reduce((s, g) => s + g.people, 0)
    const inside = guests.filter((g) => g.checkin).reduce((s, g) => s + g.people, 0)
    return {
      bookings: guests.length,
      total,
      inside,
      remaining: total - inside,
      pct: total ? Math.round((inside / total) * 100) : 0,
    }
  }, [guests])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const qd = q.replace(/\D/g, "")
    return guests.filter((g) => {
      if (filter === "pending" && g.checkin) return false
      if (filter === "in" && !g.checkin) return false
      if (!q) return true
      return g.name.toLowerCase().includes(q) || (qd.length > 0 && g.key.includes(qd))
    })
  }, [guests, query, filter])

  const recent = useMemo(
    () =>
      guests
        .filter((g) => g.checkin?.checkin_time)
        .sort((a, b) => +new Date(b.checkin!.checkin_time!) - +new Date(a.checkin!.checkin_time!))
        .slice(0, 8),
    [guests],
  )

  const doCheckin = async (phone: string) => {
    if (!eventId) return
    const key = normalize(phone)
    const guest = guests.find((g) => g.key === key)
    if (guest?.checkin) return flash("err", `${guest.name} is already checked in.`)

    setBusyPhone(key)
    const res = await fetch("/api/venue/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, phone }),
    })
    const body = await res.json()
    setBusyPhone(null)
    if (!res.ok) return flash("err", body.error || "Check-in failed.")
    const { name, people } = body.guest
    flash("ok", `${name} checked in · ${people} ${people > 1 ? "people" : "person"}`)
    await loadEventData()
  }

  const submitQuick = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickPhone.trim()) return
    await doCheckin(quickPhone)
    setQuickPhone("")
    quickRef.current?.focus()
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const current = events.find((e) => e.id === eventId)

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mr-auto">
            <h1 className="text-lg font-medium leading-tight">Venue Dashboard</h1>
            <p className="text-xs text-white/50">
              {current
                ? new Date(current.date).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })
                : "No event selected"}
            </p>
          </div>
          {events.length > 0 && (
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="min-w-[220px] max-w-xs rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm focus:border-white/40 focus:outline-none"
              aria-label="Select event"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-neutral-900">
                  {ev.title}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={logout}
            className="rounded-full bg-white px-4 py-2 text-sm text-black transition hover:bg-white/90"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {toast && (
          <div
            role="status"
            className={`fixed right-6 top-20 z-40 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === "ok"
                ? "border-emerald-500/40 bg-emerald-950 text-emerald-200"
                : "border-red-500/40 bg-red-950 text-red-200"
            }`}
          >
            {toast.text}
          </div>
        )}

        {!loading && events.length === 0 ? (
          <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="mb-2 text-xl font-light">No events assigned yet</h2>
            <p className="text-sm text-white/60">
              Events show up here once a promoter selects your venue when creating an event.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Paid bookings" value={stats.bookings} />
              <Stat label="Total guests" value={stats.total} />
              <Stat label="Checked in" value={stats.inside} accent="text-emerald-400" sub={`${stats.pct}% of guests`} />
              <Stat label="Still expected" value={stats.remaining} accent="text-amber-300" />
            </section>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${stats.pct}%` }} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Guest list */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] lg:col-span-2">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name or phone…"
                    className="min-w-[200px] flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder-white/40 focus:border-white/40 focus:outline-none"
                  />
                  <div className="flex rounded-lg border border-white/15 p-0.5 text-sm">
                    {(
                      [
                        ["all", "All"],
                        ["pending", "Not in"],
                        ["in", "Checked in"],
                      ] as [Filter, string][]
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setFilter(k)}
                        className={`rounded-md px-3 py-1.5 transition ${
                          filter === k ? "bg-white text-black" : "text-white/70 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-neutral-900 text-xs uppercase tracking-wide text-white/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Guest</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium text-right">People</th>
                        <th className="hidden px-4 py-3 font-medium text-right md:table-cell">Paid</th>
                        <th className="px-4 py-3 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visible.map((g) => (
                        <tr key={g.key} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 font-medium">{g.name}</td>
                          <td className="px-4 py-3 text-white/70 tabular-nums">{g.phone}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{g.people}</td>
                          <td className="hidden px-4 py-3 text-right tabular-nums text-white/70 md:table-cell">
                            ₹{g.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {g.checkin ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                                ✓{" "}
                                {g.checkin.checkin_time
                                  ? new Date(g.checkin.checkin_time).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "In"}
                              </span>
                            ) : (
                              <button
                                onClick={() => doCheckin(g.phone)}
                                disabled={busyPhone === g.key}
                                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                              >
                                {busyPhone === g.key ? "…" : "Check in"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                            {loading ? "Loading…" : guests.length === 0 ? "No paid bookings yet." : "No guests match."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Side column */}
              <aside className="space-y-6">
                <form onSubmit={submitQuick} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="mb-1 text-base font-medium">Quick check-in</h2>
                  <p className="mb-4 text-xs text-white/50">Type the guest&apos;s phone number and press Enter.</p>
                  <input
                    ref={quickRef}
                    type="tel"
                    inputMode="tel"
                    autoFocus
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="Phone number"
                    className="mb-3 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-lg tabular-nums placeholder-white/30 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!quickPhone.trim() || !eventId}
                    className="w-full rounded-lg bg-white py-3 font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Check in
                  </button>
                </form>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="mb-3 text-base font-medium">Recent check-ins</h2>
                  {recent.length === 0 ? (
                    <p className="text-sm text-white/40">Nobody has checked in yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {recent.map((g) => (
                        <li key={g.key} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate">{g.name}</p>
                            <p className="text-xs text-white/40">
                              {g.people} {g.people > 1 ? "people" : "person"}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-white/50">
                            {new Date(g.checkin!.checkin_time!).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className={`mt-2 text-3xl font-light tabular-nums ${accent ?? ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  )
}
