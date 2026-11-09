"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, CreditCard } from "lucide-react"
import { AdminTable, PageHeader, StatusBadge, type Column } from "../admin-table"
import { inr, shortDate, useAdminData } from "../use-admin-data"

interface RefundRow {
  id: string
  booking_id: string
  user_email: string
  reason: string | null
  status: "pending" | "approved" | "rejected" | "refunded"
  admin_notes: string | null
  created_at: string
  booker_name: string
  booker_phone: string
  amount: number
  payment_status: string
  payment_link_id: string | null
  event_title: string | null
}

type Action = "approve" | "reject" | "refund"

const COPY: Record<Action, { title: string; body: string; button: string }> = {
  approve: {
    title: "Approve refund request?",
    body: "The request moves to approved. Issue the refund in Cashfree, then mark it refunded here.",
    button: "Approve",
  },
  reject: { title: "Reject refund request?", body: "The request is closed as rejected.", button: "Reject" },
  refund: {
    title: "Mark as refunded?",
    body: "Do this once the money has gone back in Cashfree. The booking is marked refunded too.",
    button: "Mark refunded",
  },
}

export default function RefundsPage() {
  const { data, error, loading, reload } = useAdminData<RefundRow[]>("/api/admin/refunds")
  const [selected, setSelected] = useState<RefundRow | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const open = (row: RefundRow, a: Action) => {
    setSelected(row)
    setAction(a)
    setNotes(row.admin_notes ?? "")
    setActionError(null)
  }
  const close = () => {
    setSelected(null)
    setAction(null)
  }

  const confirm = async () => {
    if (!selected || !action) return
    setSaving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/refunds/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      })
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login"
        return
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      close()
      await reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<RefundRow>[] = [
    {
      header: "Requested by",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.booker_name}</div>
          <div className="text-xs text-muted-foreground">{r.user_email}</div>
        </div>
      ),
    },
    { header: "Event", cell: (r) => r.event_title ?? "—" },
    { header: "Amount", cell: (r) => <span className="font-semibold">{inr(r.amount)}</span> },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: "Reason",
      cell: (r) => (
        <div className="max-w-xs text-sm">
          <div className="text-muted-foreground">{r.reason || "—"}</div>
          {r.admin_notes && <div className="text-xs mt-1">Note: {r.admin_notes}</div>}
        </div>
      ),
    },
    { header: "Date", cell: (r) => <span className="text-sm text-muted-foreground">{shortDate(r.created_at)}</span> },
    {
      header: "Actions",
      className: "text-right",
      cell: (r) => (
        <div className="flex gap-2 justify-end">
          {r.status === "pending" && (
            <button className="btn-ghost btn-sm" onClick={() => open(r, "approve")}>
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
          )}
          {(r.status === "pending" || r.status === "approved") && (
            <button className="btn-ghost btn-sm border-[#D92323]/50! text-[#ff7a7a]!" onClick={() => open(r, "reject")}>
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          )}
          {r.status === "approved" && (
            <button className="btn-light btn-sm" onClick={() => open(r, "refund")}>
              <CreditCard className="h-3.5 w-3.5" />
              Mark refunded
            </button>
          )}
        </div>
      ),
    },
  ]

  const copy = action ? COPY[action] : null

  return (
    <div className="space-y-6">
      <PageHeader title="Refund requests" subtitle="Review and process refund requests from ticket buyers" />
      <AdminTable
        title="All refund requests"
        description="Pending first"
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        empty="No refund requests."
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && close()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="title-x text-[24px]">{copy?.title}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{copy?.body}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Booked by</p>
                  <p className="font-semibold text-foreground">{selected.booker_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-foreground">{inr(selected.amount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Event</p>
                  <p className="font-semibold text-foreground">{selected.event_title ?? "—"}</p>
                </div>
                {selected.payment_link_id && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Cashfree link</p>
                    <p className="font-mono text-sm text-foreground">{selected.payment_link_id}</p>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="admin-notes" className="text-foreground">
                  Admin notes
                </Label>
                <Textarea
                  id="admin-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-input border-border text-foreground mt-1"
                  rows={3}
                  placeholder="Optional"
                />
              </div>
              {actionError && <p className="text-sm text-[#ff7a7a]">{actionError}</p>}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost btn-sm" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button
              className={`${action === "reject" ? "btn-red" : "btn-light"} btn-sm disabled:opacity-60`}
              onClick={confirm}
              disabled={saving}
            >
              {saving ? "Saving…" : copy?.button}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
