/** Artist payment statuses as stored (they match Hyphening) and how the admin panel names them. */
export const FEE_STATUS_OPTIONS = [
  { value: "Pending", label: "Due" },
  { value: "Advance Paid", label: "Advance paid" },
  { value: "Paid", label: "Paid" },
  { value: "Cancelled", label: "Cancelled" },
] as const

export const feeStatusLabel = (s: string | null | undefined) =>
  FEE_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? (s || "—")

/** Red for anything still owed, dim for cancelled, cream for paid. */
export const feeStatusTone = (s: string | null | undefined) =>
  s === "Paid" ? "text-[#F4EFE6]/70" : s === "Cancelled" ? "text-[#F4EFE6]/35 line-through" : "text-[#ff7a7a]"

export function FeeStatusPill({ status }: { status: string | null | undefined }) {
  return <span className={`text-[11px] ${feeStatusTone(status)}`}>{feeStatusLabel(status)}</span>
}
