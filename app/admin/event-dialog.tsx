"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { useAdminData } from "./use-admin-data"
import { adminWrite, Field, FormDialog, toLocalInput } from "./admin-form"
import { FEE_STATUS_OPTIONS } from "./fee-status"

export interface EditableEvent {
  id: string
  title: string
  description?: string | null
  date: string
  ticket_price: number
  artist_id: string | null
  venue_id: string | null
  location_name: string | null
  is_listed?: number | null
  artist_fee?: number | null
  advance_paid?: number | null
  fee_status?: string | null
}

interface Pickers {
  artists: { id: string; name: string }[]
  venues: { id: string; name: string }[]
}

const blank = {
  title: "",
  description: "",
  date: "",
  ticket_price: "0",
  artist_id: "",
  venue_id: "",
  location_name: "",
  artist_fee: "",
  advance_paid: "",
  fee_status: "",
  is_listed: "1",
}
const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

/** Add or edit an event. Pass `event` to edit; `defaults` prefill a new one (for example an artist). */
export function EventDialog({
  open,
  event,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean
  event?: EditableEvent | null
  defaults?: Partial<typeof blank>
  onClose: () => void
  onSaved: () => void
}) {
  const { data: pickers } = useAdminData<Pickers>("/api/admin/pickers")
  const [f, setF] = useState(blank)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Callers pass a fresh object each render; only reset the form when its contents change.
  const defaultsKey = JSON.stringify(defaults ?? {})

  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)
    setF(
      event
        ? {
            title: event.title,
            description: event.description ?? "",
            date: toLocalInput(event.date),
            ticket_price: String(event.ticket_price ?? 0),
            artist_id: event.artist_id ?? "",
            venue_id: event.venue_id ?? "",
            location_name: event.location_name ?? "",
            artist_fee: num(event.artist_fee),
            advance_paid: num(event.advance_paid),
            fee_status: event.fee_status ?? "",
            is_listed: event.is_listed === 0 ? "0" : "1",
          }
        : { ...blank, ...(JSON.parse(defaultsKey) as Partial<typeof blank>) },
    )
  }, [open, event, defaultsKey])

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    if (confirmDelete && event) {
      await adminWrite(`/api/admin/events/${encodeURIComponent(event.id)}`, "DELETE")
    } else {
      if (!f.date) throw new Error("Pick a date and time.")
      const body = { ...f, date: new Date(f.date).toISOString() }
      if (event) await adminWrite(`/api/admin/events/${encodeURIComponent(event.id)}`, "PATCH", body)
      else await adminWrite("/api/admin/events", "POST", body)
    }
    onSaved()
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={confirmDelete ? "Delete event?" : event ? "Edit event" : "Add event"}
      description={
        confirmDelete
          ? "This removes the event, its setlist and any unpaid bookings. It can't be undone. Events with paid tickets can't be deleted."
          : "Times are in your browser's time zone. Untick “Show on website” to keep a gig off the public list."
      }
      submitLabel={confirmDelete ? "Delete for good" : event ? "Save changes" : "Add event"}
      onSubmit={save}
      extra={
        event &&
        (confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(false)} className="micro text-[#F4EFE6]/60 hover:text-white">
            Keep it
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="micro flex items-center gap-1.5 text-[#ff7a7a] hover:text-[#ff9a9a]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        ))
      }
    >
      {!confirmDelete && (
        <>
          <Field label="Title">
            <input className="admin-field" value={f.title} onChange={set("title")} placeholder="Unplugged request night" required />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Date and time">
              <input type="datetime-local" className="admin-field" value={f.date} onChange={set("date")} required />
            </Field>
            <Field label="Ticket price (₹)" hint="0 shows as Free">
              <input type="number" min="0" step="1" className="admin-field" value={f.ticket_price} onChange={set("ticket_price")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Artist">
              <select className="admin-field" value={f.artist_id} onChange={set("artist_id")}>
                <option value="">Not booked yet</option>
                {pickers?.artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Venue account">
              <select className="admin-field" value={f.venue_id} onChange={set("venue_id")}>
                <option value="">None</option>
                {pickers?.venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Location shown to the public" hint="Leave empty to use the venue's name">
            <input
              className="admin-field"
              value={f.location_name}
              onChange={set("location_name")}
              placeholder="Toit Brewhouse, Indiranagar • Bengaluru"
            />
          </Field>
          <Field label="Description">
            <textarea className="admin-field min-h-[80px] resize-y" value={f.description} onChange={set("description")} />
          </Field>
          <div className="space-y-4 border-t border-white/10 pt-4">
            <p className="micro text-[#F4EFE6]/55">Artist payment</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Fee (₹)">
                <input type="number" min="0" step="1" className="admin-field" value={f.artist_fee} onChange={set("artist_fee")} />
              </Field>
              <Field label="Advance (₹)">
                <input type="number" min="0" step="1" className="admin-field" value={f.advance_paid} onChange={set("advance_paid")} />
              </Field>
              <Field label="Status">
                <select className="admin-field" value={f.fee_status} onChange={set("fee_status")}>
                  <option value="">—</option>
                  {FEE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 border-t border-white/10 pt-4 text-[13px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#F4EFE6]"
              checked={f.is_listed === "1"}
              onChange={(e) => setF((s) => ({ ...s, is_listed: e.target.checked ? "1" : "0" }))}
            />
            <span>
              Show on website
              <span className="block text-[11px] text-[#F4EFE6]/45">Lists it on the public gig list and search.</span>
            </span>
          </label>
        </>
      )}
    </FormDialog>
  )
}
