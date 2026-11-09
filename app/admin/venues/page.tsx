"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { AdminTable, Muted, PageHeader, type Column } from "../admin-table"
import { shortDate, useAdminData } from "../use-admin-data"
import { AccountDialog, type EditableAccount } from "../account-dialog"
import { Notice } from "../admin-form"

interface VenueRow extends EditableAccount {
  created_at: string
  city: string | null
  poc_name: string | null
  poc_phone: string | null
  events_hosted: number
  events_upcoming: number
}

const columns: Column<VenueRow>[] = [
  {
    header: "Venue",
    cell: (v) => (
      <div>
        <p className="font-medium">{v.name}</p>
        <p className="text-[11px] text-[#F4EFE6]/45">{v.city ?? "—"}</p>
      </div>
    ),
  },
  {
    header: "Contact",
    cell: (v) =>
      v.poc_name || v.poc_phone || v.phone ? (
        <div>
          <p>{v.poc_name ?? "—"}</p>
          <p className="text-[11px] text-[#F4EFE6]/45">{v.poc_phone ?? v.phone}</p>
        </div>
      ) : (
        <Muted>{null}</Muted>
      ),
  },
  { header: "Login", cell: (v) => <span className="text-[13px]">{v.email}</span> },
  { header: "Upcoming", cell: (v) => v.events_upcoming, className: "text-right" },
  { header: "All gigs", cell: (v) => v.events_hosted, className: "text-right" },
  { header: "Added", cell: (v) => shortDate(v.created_at) },
]

export default function VenuesPage() {
  const { data, error, loading, reload } = useAdminData<VenueRow[]>("/api/admin/venues")
  const [editing, setEditing] = useState<VenueRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        subtitle="Venues sign in at muse-ing.in/login to see their gigs and each artist's playlist. Click a row to edit details or set a password."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> Add venue
          </button>
        }
      />
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <AdminTable
        title="All venues"
        description={data ? `${data.length} venues` : undefined}
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No venues yet."
        onRowClick={setEditing}
      />
      <AccountDialog
        kind="venue"
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
    </div>
  )
}
