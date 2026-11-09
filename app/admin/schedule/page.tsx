"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Plus } from "lucide-react"
import { PageHeader } from "../admin-table"
import { inr, useAdminData } from "../use-admin-data"
import { EventDialog, type EditableEvent } from "../event-dialog"
import { feeStatusLabel } from "../fee-status"
import { cn } from "@/lib/utils"

interface ScheduleRow extends EditableEvent {
  artist_name: string | null
  venue_name: string | null
  tickets_sold: number
  day: string
  clashes: string[]
}
interface Pickers {
  artists: { id: string; name: string }[]
}

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  })
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
const todayIST = () => new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 10)

function Schedule() {
  const router = useRouter()
  const params = useSearchParams()
  const artist = params.get("artist") ?? ""
  const url = `/api/admin/schedule${artist ? `?artist=${encodeURIComponent(artist)}` : ""}`
  const { data, error, loading, reload } = useAdminData<ScheduleRow[]>(url)
  const { data: pickers } = useAdminData<Pickers>("/api/admin/pickers")
  const [editing, setEditing] = useState<ScheduleRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const days = useMemo(() => {
    const m = new Map<string, ScheduleRow[]>()
    for (const r of data ?? []) if (!onlyIssues || r.clashes.length) m.set(r.day, [...(m.get(r.day) ?? []), r])
    return [...m.entries()]
  }, [data, onlyIssues])
  const issues = data?.filter((r) => r.clashes.length).length ?? 0
  const today = todayIST()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle="Every upcoming gig by day, in India time. Double bookings and gigs without an artist are flagged in red."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> Add event
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={artist}
          onChange={(e) => router.replace(e.target.value ? `/admin/schedule?artist=${encodeURIComponent(e.target.value)}` : "/admin/schedule")}
          className="admin-field max-w-xs"
          aria-label="Filter by artist"
        >
          <option value="">All artists</option>
          {pickers?.artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyIssues((v) => !v)}
          className={cn("pill-dark micro", onlyIssues && "border-[#D92323]! bg-[#D92323]/20!")}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {issues} to check
        </button>
      </div>

      {error && <p className="text-sm text-[#ff7a7a]">Couldn&apos;t load: {error}</p>}
      {loading && !data && <p className="micro text-[#F4EFE6]/50">Loading…</p>}
      {data && !days.length && (
        <section className="admin-panel p-6">
          <p className="fine text-[13px]!">{onlyIssues ? "Nothing to check. Every gig has an artist and no one is double-booked." : "No upcoming gigs."}</p>
        </section>
      )}

      <div className="space-y-8">
        {days.map(([day, rows]) => (
          <section key={day}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="micro text-[#F4EFE6]">{dayLabel(day)}</h2>
              {day === today && <span className="micro rounded-full bg-[#D92323] px-2 py-0.5 text-[9px]! text-white">Tonight</span>}
              <span className="micro text-[#F4EFE6]/40">
                {rows.length} gig{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setEditing(r)}
                  className={cn(
                    "admin-panel block p-5 text-left transition hover:border-[#F4EFE6]/50!",
                    r.clashes.length && "border-[#D92323]/60!",
                    r.fee_status === "Cancelled" && "opacity-50",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="title-x text-[20px]">{time(r.date)}</span>
                    <span className="micro text-[#F4EFE6]/50">{r.ticket_price ? inr(r.ticket_price) : "Free"}</span>
                  </div>
                  <p className="mt-3 text-[14px] font-medium leading-snug">{r.title}</p>
                  <p className={cn("mt-1 text-[12.5px]", r.artist_name ? "text-[#F4EFE6]/80" : "text-[#ff7a7a]")}>
                    {r.artist_name ?? "No artist booked"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#F4EFE6]/50">{r.location_name ?? r.venue_name ?? "No location"}</p>
                  <p className="micro mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[#F4EFE6]/45">
                    <span>{r.tickets_sold} tickets sold</span>
                    {r.artist_fee != null && (
                      <span className={r.fee_status === "Paid" || !r.fee_status ? undefined : "text-[#ff7a7a]"}>
                        Fee {inr(r.artist_fee)}
                        {r.fee_status ? ` · ${feeStatusLabel(r.fee_status)}` : ""}
                      </span>
                    )}
                    {r.is_listed === 0 && <span>Not on website</span>}
                  </p>
                  {r.clashes
                    .filter((c) => c !== "No artist booked")
                    .map((c) => (
                      <p key={c} className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#ff7a7a]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {c}
                      </p>
                    ))}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <EventDialog
        open={adding || !!editing}
        event={editing}
        defaults={artist ? { artist_id: artist } : undefined}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSaved={reload}
      />
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="micro text-[#F4EFE6]/50">Loading…</p>}>
      <Schedule />
    </Suspense>
  )
}
