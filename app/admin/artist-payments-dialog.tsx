"use client"

import { useEffect, useState } from "react"
import { CheckCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adminWrite, ErrorNote } from "./admin-form"
import { inr, useAdminData } from "./use-admin-data"
import { FEE_STATUS_OPTIONS } from "./fee-status"

interface Gig {
  id: string
  title: string
  date: string
  venue_name: string | null
  location_name: string | null
  artist_fee: number | null
  advance_paid: number | null
  fee_status: string | null
}
interface Bucket {
  count: number
  amount: number
}
interface Summary {
  gigs: number
  played: number
  upcoming: number
  paid: Bucket
  due: Bucket
  due_now: Bucket
  total_fees: number
  average_fee: number | null
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })
const played = (iso: string) => new Date(iso).getTime() <= Date.now()

/** Every gig of one artist with a payment status dropdown on each. */
export function ArtistPaymentsDialog({
  artist,
  onClose,
  onChanged,
}: {
  artist: { id: string; name: string } | null
  onClose: () => void
  onChanged: () => void
}) {
  const url = artist ? `/api/admin/artists/${encodeURIComponent(artist.id)}/gigs` : ""
  return (
    <Dialog open={!!artist} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
        <DialogHeader>
          <div className="dots">
            <i />
          </div>
          <DialogTitle className="title-x mt-3 text-[24px] sm:text-[28px]">{artist?.name ?? "Payments"}</DialogTitle>
          <DialogDescription className="fine text-[12.5px]!">
            Change a gig&apos;s status and it saves straight away. Due is the fee minus any advance.
          </DialogDescription>
        </DialogHeader>
        {artist && <Body key={url} url={url} artistId={artist.id} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ url, artistId, onChanged }: { url: string; artistId: string; onChanged: () => void }) {
  const { data, error, reload } = useAdminData<{ gigs: Gig[]; summary: Summary | null }>(url)
  const [busy, setBusy] = useState<string | null>(null)
  const [fail, setFail] = useState<string | null>(null)
  const [advance, setAdvance] = useState<Record<string, string>>({})
  useEffect(() => {
    if (data) setAdvance(Object.fromEntries(data.gigs.map((g) => [g.id, g.advance_paid ? String(g.advance_paid) : ""])))
  }, [data])

  const save = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
    setFail(null)
    try {
      await adminWrite(`/api/admin/events/${encodeURIComponent(id)}`, "PATCH", body)
      await reload()
      onChanged()
    } catch (e) {
      setFail(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const settle = async () => {
    setBusy("all")
    setFail(null)
    try {
      await adminWrite(`/api/admin/artists/${encodeURIComponent(artistId)}/settle`, "POST")
      await reload()
      onChanged()
    } catch (e) {
      setFail(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <p className="micro text-[#F4EFE6]/50">Loading…</p>
  const s = data.summary
  const gigs = [...data.gigs].reverse() // newest first

  return (
    <div className="mt-2 space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { k: "Gigs", v: String(s?.gigs ?? 0), sub: `${s?.played ?? 0} played · ${s?.upcoming ?? 0} to come` },
          { k: "Paid", v: inr(s?.paid.amount), sub: `${s?.paid.count ?? 0} gigs` },
          { k: "Due now", v: inr(s?.due_now.amount), sub: `${s?.due_now.count ?? 0} played, unpaid`, alert: (s?.due_now.amount ?? 0) > 0 },
          { k: "Total due", v: inr(s?.due.amount), sub: `${s?.due.count ?? 0} gigs incl. upcoming` },
        ].map((t) => (
          <div key={t.k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="micro text-[#F4EFE6]/50">{t.k}</p>
            <p className={`title-x mt-1.5 text-[18px] ${t.alert ? "text-[#ff7a7a]!" : ""}`}>{t.v}</p>
            <p className="mt-0.5 text-[11px] text-[#F4EFE6]/45">{t.sub}</p>
          </div>
        ))}
      </div>

      {(s?.due_now.count ?? 0) > 0 && (
        <button type="button" onClick={settle} disabled={!!busy} className="btn-light btn-sm disabled:opacity-60">
          <CheckCheck className="h-3.5 w-3.5" />
          {busy === "all" ? "Saving…" : `Mark ${s?.due_now.count} played gig${s?.due_now.count === 1 ? "" : "s"} paid`}
        </button>
      )}
      {fail && <ErrorNote>{fail}</ErrorNote>}

      {!gigs.length ? (
        <p className="fine text-[13px]!">No gigs with a fee yet. Add the fee on the event to track it here.</p>
      ) : (
        <ul className="divide-y divide-white/[0.07] rounded-2xl border border-white/10">
          {gigs.map((g) => {
            const due = g.fee_status === "Paid" || g.fee_status === "Cancelled" ? 0 : Math.max(0, (g.artist_fee ?? 0) - (g.advance_paid ?? 0))
            return (
              <li key={g.id} className={`grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] ${busy === g.id ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">
                    {day(g.date)}
                    {!played(g.date) && <span className="micro ml-2 text-[#F4EFE6]/45">Upcoming</span>}
                  </p>
                  <p className="truncate text-[12px] text-[#F4EFE6]/55">{g.venue_name ?? g.location_name ?? g.title}</p>
                  <p className="mt-1 text-[12px] text-[#F4EFE6]/70">
                    Fee {inr(g.artist_fee)}
                    {due > 0 && <span className="text-[#ff7a7a]"> · {inr(due)} due</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {g.fee_status === "Advance Paid" && (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Advance paid"
                      placeholder="Advance ₹"
                      className="admin-field w-28! py-1.5! text-[13px]"
                      value={advance[g.id] ?? ""}
                      onChange={(e) => setAdvance((a) => ({ ...a, [g.id]: e.target.value }))}
                      onBlur={() => {
                        const v = advance[g.id] ?? ""
                        if (v !== (g.advance_paid ? String(g.advance_paid) : "")) void save(g.id, { advance_paid: v })
                      }}
                    />
                  )}
                  <select
                    aria-label={`Payment status for ${day(g.date)}`}
                    className="admin-field w-40! py-1.5! text-[13px]"
                    value={g.fee_status ?? "Pending"}
                    disabled={!!busy}
                    onChange={(e) => void save(g.id, { fee_status: e.target.value })}
                  >
                    {FEE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
