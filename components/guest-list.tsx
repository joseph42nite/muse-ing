"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Phone, Search } from "lucide-react"

export interface Guest {
  id: string
  name: string
  phone: string
  num_people: number
  total_amount: number
  coupon_code: string | null
  payment_status: string
  paid: boolean
  paid_at_door: boolean
  arrived: boolean
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`

/**
 * The door list for one gig: who booked, their phone, and two switches for the night —
 * Arrived, and Paid (for bookings that weren't paid online). Shared by the venue portal and
 * the admin panel; both talk to /api/venue/guests.
 */
export function GuestList({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState<Guest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/venue/guests?event_id=${encodeURIComponent(eventId)}`, { cache: "no-store" }).catch(() => null)
    if (!res?.ok) return setError("Couldn't load the guest list.")
    setError(null)
    setGuests((await res.json()).guests)
  }, [eventId])

  // Refresh now and then, so several people at the door see each other's ticks.
  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  const set = async (g: Guest, change: { arrived?: boolean; paid?: boolean }) => {
    setBusy(g.id)
    setGuests((list) => list?.map((x) => (x.id === g.id ? { ...x, ...change, paid_at_door: change.paid ?? x.paid_at_door } : x)) ?? null)
    const res = await fetch("/api/venue/guests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: g.id, ...change }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (res?.ok && body?.guest) setGuests((list) => list?.map((x) => (x.id === g.id ? body.guest : x)) ?? null)
    else {
      setError(body?.error ?? "Couldn't save that. Try again.")
      load()
    }
    setBusy(null)
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/\D/g, "")
    return (guests ?? []).filter(
      (g) => !needle || g.name.toLowerCase().includes(needle) || (digits.length >= 3 && g.phone.replace(/\D/g, "").includes(digits)),
    )
  }, [guests, q])

  if (!guests) return <p className="fine">{error ?? "Loading guests…"}</p>

  const tickets = guests.reduce((s, g) => s + g.num_people, 0)
  const arrived = guests.filter((g) => g.arrived).reduce((s, g) => s + g.num_people, 0)
  const unpaid = guests.filter((g) => !g.paid).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Bookings", value: `${guests.length} · ${tickets} ppl` },
          { label: "Arrived", value: `${arrived} / ${tickets}` },
          { label: "Not paid", value: String(unpaid), alert: unpaid > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="micro text-[#F4EFE6]/50">{s.label}</p>
            <p className={`mt-1 text-[15px] tabular-nums ${s.alert ? "text-[#ff7a7a]" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {guests.length > 0 && (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#F4EFE6]/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone"
            className="w-full rounded-full border border-white/15 bg-white/[0.04] py-2.5 pl-9 pr-4 text-[13px] text-[#F4EFE6] placeholder:text-[#F4EFE6]/35 focus:border-[#F4EFE6]/60 focus:outline-none"
          />
        </label>
      )}

      {error && <p className="text-[12px] text-[#ff9a9a]">{error}</p>}

      {guests.length === 0 ? (
        <p className="fine">No bookings yet.</p>
      ) : shown.length === 0 ? (
        <p className="fine">Nobody matches “{q}”.</p>
      ) : (
        <ul className="divide-y divide-white/[0.07]">
          {shown.map((g) => (
            <li key={g.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${g.arrived ? "opacity-70" : ""}`}>
              <div className="min-w-[11rem] flex-1">
                <p className="text-[14px] font-medium leading-snug">
                  {g.name} <span className="text-[#F4EFE6]/50">× {g.num_people}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#F4EFE6]/55">
                  <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1 hover:text-[#F4EFE6]">
                    <Phone className="h-3 w-3" />
                    {g.phone}
                  </a>
                  <span>{g.total_amount > 0 ? inr(g.total_amount) : "Free"}</span>
                  {g.coupon_code && <span className="rounded-full border border-white/15 px-1.5 text-[10px] tracking-wider">{g.coupon_code}</span>}
                  <span className={g.paid ? "" : "text-[#ff7a7a]"}>
                    {!g.paid ? "Not paid" : g.paid_at_door ? "Paid at door" : g.total_amount > 0 ? "Paid online" : "Free with coupon"}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Toggle
                  on={g.paid}
                  label="Paid"
                  // An online payment can't be undone from the door.
                  disabled={busy === g.id || (g.paid && !g.paid_at_door)}
                  title={g.paid && !g.paid_at_door ? "Already paid online (or free)" : g.paid ? "Undo paid at door" : "Mark paid at the door"}
                  onClick={() => set(g, { paid: !g.paid })}
                />
                <Toggle
                  on={g.arrived}
                  label="Arrived"
                  disabled={busy === g.id}
                  title={g.arrived ? "Undo arrived" : "Mark arrived"}
                  onClick={() => set(g, { arrived: !g.arrived })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toggle({ on, label, disabled, title, onClick }: { on: boolean; label: string; disabled?: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on}
      className={`micro inline-flex h-8 items-center gap-1 rounded-full border px-3 transition disabled:cursor-default ${
        on
          ? "border-[#F4EFE6] bg-[#F4EFE6] text-[#0b0a0e]"
          : "border-white/20 text-[#F4EFE6]/75 hover:border-[#F4EFE6]/60 disabled:opacity-50"
      }`}
    >
      {on && <Check className="h-3 w-3" />}
      {label}
    </button>
  )
}
