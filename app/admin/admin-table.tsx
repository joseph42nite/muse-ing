"use client"

import type React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface Column<T> {
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

// Cream for good and waiting states, studio red for anything that went wrong. No amber.
const STATUS_STYLES: Record<string, string> = {
  pending: "border-[#F4EFE6]/30 text-[#F4EFE6]/80",
  approved: "border-[#F4EFE6]/60 text-[#F4EFE6]",
  paid: "border-transparent bg-[#F4EFE6] text-[#14100a]",
  refunded: "border-[#F4EFE6]/20 text-[#F4EFE6]/55",
  cancelled: "border-[#F4EFE6]/15 text-[#F4EFE6]/45",
  rejected: "border-[#D92323]/50 text-[#ff7a7a]",
  failed: "border-[#D92323]/50 text-[#ff7a7a]",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "micro inline-flex h-6 items-center rounded-full border px-2.5 text-[9px]!",
        STATUS_STYLES[status] ?? "border-[#F4EFE6]/20 text-[#F4EFE6]/70",
      )}
    >
      {status}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="dots">
          <i />
        </div>
        <h1 className="title-x mt-4 text-[30px] sm:text-[38px]">{title}</h1>
        <p className="fine mt-3 max-w-xl text-[13px]!">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export const Muted = ({ children }: { children?: React.ReactNode }) =>
  children ? <>{children}</> : <span className="text-[#F4EFE6]/35">—</span>

/** Glass panel table with loading, error and empty states. */
export function AdminTable<T extends { id: string }>({
  title,
  description,
  columns,
  rows,
  loading,
  error,
  empty,
  onRowClick,
}: {
  title: string
  description?: string
  columns: Column<T>[]
  rows: T[] | null
  loading: boolean
  error: string | null
  empty: string
  onRowClick?: (row: T) => void
}) {
  let body: React.ReactNode
  if (error) body = <p className="text-sm text-[#ff7a7a]">Couldn&apos;t load: {error}</p>
  else if (loading && !rows) body = <p className="micro text-[#F4EFE6]/50">Loading…</p>
  else if (!rows?.length) body = <p className="fine text-[13px]!">{empty}</p>
  else
    body = (
      <div className="-mx-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-white/[0.07] hover:bg-white/[0.04]", onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <TableCell key={c.header} className={cn("text-[13px] text-[#F4EFE6]", c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )

  return (
    <section className="admin-panel p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="micro text-[#F4EFE6]">{title}</h2>
        {description && <p className="micro text-[#F4EFE6]/45">{description}</p>}
      </div>
      {body}
    </section>
  )
}
