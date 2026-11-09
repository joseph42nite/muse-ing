"use client"

import { Badge } from "@/components/ui/badge"
import { AdminTable, PageHeader, type Column } from "../admin-table"
import { dateTime, useAdminData } from "../use-admin-data"

interface InquiryRow {
  id: string
  name: string
  email: string
  phone: string | null
  inquiry_type: string
  event_id: string | null
  event_title: string | null
  message: string | null
  created_at: string
}

const columns: Column<InquiryRow>[] = [
  { header: "Received", cell: (i) => <span className="text-sm text-muted-foreground">{dateTime(i.created_at)}</span> },
  {
    header: "From",
    cell: (i) => (
      <div>
        <div className="font-medium">{i.name}</div>
        <a className="text-xs text-primary underline" href={`mailto:${i.email}`}>
          {i.email}
        </a>
        {i.phone && <div className="text-xs text-muted-foreground">{i.phone}</div>}
      </div>
    ),
  },
  { header: "Type", cell: (i) => <Badge className="bg-gray-500/20 text-gray-700">{i.inquiry_type}</Badge> },
  { header: "Event", cell: (i) => i.event_title ?? i.event_id ?? "—" },
  {
    header: "Message",
    cell: (i) => <p className="max-w-md whitespace-pre-wrap text-sm">{i.message || "—"}</p>,
  },
]

export default function InquiriesPage() {
  const { data, error, loading } = useAdminData<InquiryRow[]>("/api/admin/inquiries")
  return (
    <div className="space-y-6">
      <PageHeader title="Inquiries" subtitle="Contact and booking requests sent from the public site" />
      <AdminTable
        title="All inquiries"
        description={data ? `${data.length} inquiries` : undefined}
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No inquiries yet."
      />
    </div>
  )
}
