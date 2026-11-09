"use client"

import { Badge } from "@/components/ui/badge"
import { AdminTable, PageHeader, StatusBadge, type Column } from "../admin-table"
import { dateTime, inr, useAdminData } from "../use-admin-data"

interface TxRow {
  id: string
  kind: "ticket" | "dedication" | "tip"
  payer_name: string
  payer_phone: string | null
  payer_email: string | null
  amount: number
  status: string
  reference: string | null
  provider: string
  event_title: string | null
  num_people: number | null
  note: string | null
  created_at: string
}

const KIND_COLORS: Record<TxRow["kind"], string> = {
  ticket: "bg-blue-500/20 text-blue-700",
  dedication: "bg-pink-500/20 text-pink-700",
  tip: "bg-orange-500/20 text-orange-700",
}

const columns: Column<TxRow>[] = [
  { header: "Date", cell: (t) => <span className="text-sm text-muted-foreground">{dateTime(t.created_at)}</span> },
  { header: "Type", cell: (t) => <Badge className={KIND_COLORS[t.kind]}>{t.kind}</Badge> },
  {
    header: "Payer",
    cell: (t) => (
      <div>
        <div className="font-medium">{t.payer_name}</div>
        <div className="text-xs text-muted-foreground">{t.payer_email ?? t.payer_phone ?? ""}</div>
      </div>
    ),
  },
  {
    header: "Event",
    cell: (t) => (
      <div>
        <div>{t.event_title ?? "—"}</div>
        {t.num_people ? <div className="text-xs text-muted-foreground">{t.num_people} tickets</div> : null}
        {t.note ? <div className="text-xs text-muted-foreground">{t.note}</div> : null}
      </div>
    ),
  },
  { header: "Amount", cell: (t) => <span className="font-semibold">{inr(t.amount)}</span>, className: "text-right" },
  { header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
  {
    header: "Reference",
    cell: (t) => (
      <div className="text-xs">
        <div className="font-mono">{t.reference ?? "—"}</div>
        <div className="text-muted-foreground">{t.provider}</div>
      </div>
    ),
  },
]

export default function TransactionsPage() {
  const { data, error, loading } = useAdminData<TxRow[]>("/api/admin/transactions")
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" subtitle="Ticket bookings, song dedications and tips" />
      <AdminTable
        title="All transactions"
        description="Newest first, up to 500"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No transactions yet."
      />
    </div>
  )
}
