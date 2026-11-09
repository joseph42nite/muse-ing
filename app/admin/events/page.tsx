"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { AdminTable, Muted, PageHeader, type Column } from "../admin-table"
import { dateTime, inr, useAdminData } from "../use-admin-data"
import { EventDialog, type EditableEvent } from "../event-dialog"
import { FeeStatusPill } from "../fee-status"

interface EventRow extends EditableEvent {
  artist_name: string | null
  venue_name: string | null
  created_by_name: string | null
  tickets_sold: number
  ticket_revenue: number
  bookings: number
}

const columns: Column<EventRow>[] = [
  {
    header: "Event",
    cell: (e) => (
      <div>
        <p className="font-medium">{e.title}</p>
        {e.is_listed === 0 && <p className="text-[11px] text-[#F4EFE6]/45">Not on website</p>}
      </div>
    ),
  },
  { header: "When", cell: (e) => <span className="whitespace-nowrap">{dateTime(e.date)}</span> },
  { header: "Artist", cell: (e) => <Muted>{e.artist_name}</Muted> },
  { header: "Where", cell: (e) => <Muted>{e.location_name ?? e.venue_name}</Muted> },
  { header: "Price", cell: (e) => (e.ticket_price ? inr(e.ticket_price) : "Free") },
  {
    header: "Artist fee",
    cell: (e) =>
      e.artist_fee != null ? (
        <div>
          <p>{inr(e.artist_fee)}</p>
          {e.fee_status && (
            <p>
              <FeeStatusPill status={e.fee_status} />
            </p>
          )}
        </div>
      ) : (
        <Muted>{null}</Muted>
      ),
  },
  { header: "Sold", cell: (e) => e.tickets_sold, className: "text-right" },
  { header: "Revenue", cell: (e) => <span className="font-semibold">{inr(e.ticket_revenue)}</span>, className: "text-right" },
]

type Filter = "upcoming" | "past" | "all"

export default function EventsPage() {
  const { data, error, loading, reload } = useAdminData<EventRow[]>("/api/admin/events")
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<Filter>("upcoming")
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    if (!data) return null
    const now = Date.now()
    const needle = q.trim().toLowerCase()
    return data
      .filter((e) => filter === "all" || (filter === "upcoming") === new Date(e.date).getTime() >= now - 6 * 3600e3)
      .filter((e) => !needle || [e.title, e.artist_name, e.venue_name, e.location_name].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => (filter === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
  }, [data, filter, q])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Every gig on the platform. Click a row to edit it, reassign the artist or move it."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> Add event
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {(["upcoming", "past", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pill-dark micro ${filter === f ? "bg-[#F4EFE6]! text-[#14100a]!" : ""}`}
          >
            {f}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, artist or venue"
          className="admin-field w-full max-w-xs sm:ml-auto"
        />
      </div>
      <AdminTable
        title={`${filter[0].toUpperCase()}${filter.slice(1)} events`}
        description={rows ? `${rows.length} events` : undefined}
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        empty={filter === "upcoming" ? "Nothing coming up. Add an event to fill the gig list." : "No events here."}
        onRowClick={setEditing}
      />
      <EventDialog
        open={adding || !!editing}
        event={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSaved={reload}
      />
    </div>
  )
}
