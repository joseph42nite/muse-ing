"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarPlus, Pencil, Plus } from "lucide-react"
import { AdminTable, Muted, PageHeader, type Column } from "../admin-table"
import { dateTime, inr, useAdminData } from "../use-admin-data"
import { AccountDialog, type EditableAccount } from "../account-dialog"
import { EventDialog } from "../event-dialog"
import { Notice } from "../admin-form"
import { ArtistPaymentsDialog } from "../artist-payments-dialog"

interface Bucket {
  count: number
  amount: number
}
interface Payments {
  gigs: number
  paid: Bucket
  due: Bucket
  due_now: Bucket
  average_fee: number | null
  reliability: number | null
  status: string
}

interface ArtistRow extends EditableAccount {
  category: string | null
  city: string | null
  average_fee: number | null
  payment_status: string | null
  amount_pending: number | null
  account_number: string | null
  upi_id: string | null
  bank_details: string | null
  gigs_total: number
  gigs_upcoming: number
  next_gig: string | null
  earnings: number
  payments: Payments | null
}

export default function ArtistsPage() {
  const { data, error, loading, reload } = useAdminData<ArtistRow[]>("/api/admin/artists")
  const [editing, setEditing] = useState<ArtistRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [booking, setBooking] = useState<ArtistRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [paying, setPaying] = useState<ArtistRow | null>(null)

  const columns: Column<ArtistRow>[] = [
    {
      header: "Artist",
      cell: (a) => (
        <div>
          <p className="font-medium">{a.name}</p>
          <p className="max-w-[220px] truncate text-[11px] text-[#F4EFE6]/45">
            {[a.category, a.city].filter(Boolean).join(" · ") || a.instagram_handle || a.email}
          </p>
        </div>
      ),
    },
    { header: "Phone", cell: (a) => <Muted>{a.phone}</Muted> },
    {
      header: "Fee",
      // Average of paid gigs, like Hyphening; the roster's usual fee until there are any.
      cell: (a) => {
        const fee = a.payments?.average_fee ?? a.average_fee
        return fee ? inr(fee) : <Muted>{null}</Muted>
      },
      className: "text-right",
    },
    {
      header: "Payments",
      cell: (a) => {
        const p = a.payments
        return (
          <button
            type="button"
            onClick={() => setPaying(a)}
            className="group -mx-2 rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06]"
            title="Change payment status"
          >
            {!p || !p.gigs ? (
              <span className="text-[12px] text-[#F4EFE6]/45">No paid gigs · open</span>
            ) : p.due.count ? (
              <>
                <span className="block text-[13px] text-[#ff7a7a]">{inr(p.due.amount)} due</span>
                <span className="block text-[11px] text-[#F4EFE6]/50">
                  {p.due_now.count ? `${inr(p.due_now.amount)} for ${p.due_now.count} played` : `${p.due.count} upcoming`} ·{" "}
                  {inr(p.paid.amount)} paid
                </span>
              </>
            ) : (
              <>
                <span className="block text-[13px]">All paid</span>
                <span className="block text-[11px] text-[#F4EFE6]/50">{inr(p.paid.amount)} over {p.paid.count} gigs</span>
              </>
            )}
            <span className="micro mt-0.5 block text-[#F4EFE6]/35 group-hover:text-[#F4EFE6]/70">Change status ▾</span>
          </button>
        )
      },
    },
    {
      header: "Bank",
      cell: (a) =>
        a.account_number || a.upi_id || a.bank_details ? (
          <span className="text-[12px] text-[#F4EFE6]/75">On file</span>
        ) : (
          <span className="text-[12px] text-[#ff7a7a]">Missing</span>
        ),
    },
    {
      header: "Next gig",
      cell: (a) =>
        a.next_gig ? (
          <span className="whitespace-nowrap">{dateTime(a.next_gig)}</span>
        ) : (
          <span className="text-[#F4EFE6]/40">Nothing booked</span>
        ),
    },
    { header: "Upcoming", cell: (a) => a.gigs_upcoming, className: "text-right" },
    { header: "All gigs", cell: (a) => a.gigs_total, className: "text-right" },
    { header: "Tips & dedications", cell: (a) => inr(a.earnings), className: "text-right" },
    {
      header: " ",
      className: "text-right",
      cell: (a) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/admin/schedule?artist=${encodeURIComponent(a.id)}`} className="btn-ghost btn-sm">
            Schedule
          </Link>
          <button onClick={() => setBooking(a)} className="btn-ghost btn-sm" aria-label={`Book ${a.name}`} title="Book a gig">
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(a)} className="btn-ghost btn-sm" aria-label={`Edit ${a.name}`} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Artists"
        subtitle="Who's playing next, how busy each artist is and what the room has paid them."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> Add artist
          </button>
        }
      />
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <AdminTable
        title="All artists"
        description={data ? `${data.length} artists` : undefined}
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No artists yet. Add one, or they can sign up at /auth/sign-up."
      />
      <AccountDialog
        kind="artist"
        open={adding || !!editing}
        account={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSaved={(m) => {
          setNotice(m)
          reload()
        }}
      />
      <ArtistPaymentsDialog
        artist={paying}
        onClose={() => setPaying(null)}
        onChanged={() => void reload()}
      />
      <EventDialog
        open={!!booking}
        defaults={booking ? { artist_id: booking.id } : undefined}
        onClose={() => setBooking(null)}
        onSaved={() => {
          setNotice(`Gig added for ${booking?.name}.`)
          reload()
        }}
      />
    </div>
  )
}
