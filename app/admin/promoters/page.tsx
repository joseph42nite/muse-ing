"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { AdminTable, Muted, PageHeader, type Column } from "../admin-table"
import { inr, shortDate, useAdminData } from "../use-admin-data"
import { AccountDialog, type EditableAccount } from "../account-dialog"
import { Notice } from "../admin-form"

interface PromoterRow extends EditableAccount {
  promoter_code: string | null
  created_at: string
  events_created: number
  paid_bookings: number
  revenue: number
}

const columns: Column<PromoterRow>[] = [
  { header: "Name", cell: (v) => <span className="font-medium">{v.name}</span> },
  { header: "Code", cell: (v) => (v.promoter_code ? <code className="text-[12px]">{v.promoter_code}</code> : <Muted />) },
  { header: "Email", cell: (v) => v.email },
  { header: "Phone", cell: (v) => <Muted>{v.phone}</Muted> },
  { header: "Events", cell: (v) => v.events_created, className: "text-right" },
  { header: "Paid bookings", cell: (v) => v.paid_bookings, className: "text-right" },
  { header: "Revenue", cell: (v) => <span className="font-semibold">{inr(v.revenue)}</span>, className: "text-right" },
  { header: "Joined", cell: (v) => shortDate(v.created_at) },
]

export default function PromotersPage() {
  const { data, error, loading, reload } = useAdminData<PromoterRow[]>("/api/admin/promoters")
  const [editing, setEditing] = useState<PromoterRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promoters"
        subtitle="Promoter codes and the paid bookings they brought in. Click a row to edit it or reset the password."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> Add promoter
          </button>
        }
      />
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <AdminTable
        title="All promoters"
        description={data ? `${data.length} promoters` : undefined}
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No promoters yet."
        onRowClick={setEditing}
      />
      <AccountDialog
        kind="promoter"
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
