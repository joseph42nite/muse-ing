"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Sparkles } from "lucide-react"
import { AdminTable, Muted, PageHeader, type Column } from "../admin-table"
import { dateTime, inr, useAdminData } from "../use-admin-data"
import { adminWrite, Field, FormDialog, Notice } from "../admin-form"

interface CouponRow {
  id: string
  code: string
  owner_type: "artist" | "promoter"
  owner_id: string
  owner_name: string | null
  event_id: string | null
  event_title: string | null
  event_date: string | null
  discount_percent: number
  seat_limit: number
  active: number
  seats_used: number
  seats_sold: number
  revenue: number
  discount_given: number
}
interface Person {
  id: string
  name: string
}
interface Gig {
  id: string
  title: string
  date: string
  artist_id: string | null
  location_name: string | null
}
interface Data {
  coupons: CouponRow[]
  artists: Person[]
  promoters: Person[]
  events: Gig[]
}

export default function CouponsPage() {
  const { data, error, loading, reload } = useAdminData<Data>("/api/admin/coupons")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CouponRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const toggle = async (c: CouponRow) => {
    try {
      await adminWrite(`/api/admin/coupons/${c.id}`, "PATCH", { active: !c.active })
      setNotice(`${c.code} switched ${c.active ? "off" : "on"}.`)
      reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't change the coupon.")
    }
  }

  const columns: Column<CouponRow>[] = [
    {
      header: "Code",
      cell: (c) => (
        <div>
          <p className="font-mono text-[14px] tracking-wider">{c.code}</p>
          {!c.active && <p className="text-[11px] text-[#F4EFE6]/45">Switched off</p>}
        </div>
      ),
    },
    {
      header: "For",
      cell: (c) => (
        <div>
          <p>{c.owner_name ?? "—"}</p>
          <p className="text-[11px] capitalize text-[#F4EFE6]/45">{c.owner_type}</p>
        </div>
      ),
    },
    {
      header: "Gig",
      cell: (c) =>
        c.event_title ? (
          <div>
            <p className="max-w-[220px] truncate">{c.event_title}</p>
            {c.event_date && <p className="text-[11px] text-[#F4EFE6]/45">{dateTime(c.event_date)}</p>}
          </div>
        ) : (
          <Muted>{c.owner_type === "artist" ? "Any of their gigs" : "Any gig"}</Muted>
        ),
    },
    { header: "Discount", cell: (c) => `${c.discount_percent}%`, className: "text-right" },
    {
      header: "Tickets",
      className: "text-right",
      cell: (c) => {
        const left = Math.max(0, c.seat_limit - c.seats_used)
        return (
          <div>
            <p className="tabular-nums">
              {c.seats_sold} / {c.seat_limit}
            </p>
            <p className={`text-[11px] ${left ? "text-[#F4EFE6]/45" : "text-[#ff7a7a]"}`}>{left ? `${left} left` : "Used up"}</p>
          </div>
        )
      },
    },
    {
      header: "Sales",
      className: "text-right",
      cell: (c) => (
        <div>
          <p>{inr(c.revenue)}</p>
          {c.discount_given > 0 && <p className="text-[11px] text-[#F4EFE6]/45">{inr(c.discount_given)} off</p>}
        </div>
      ),
    },
    {
      header: " ",
      className: "text-right",
      cell: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggle(c)
          }}
          className="btn-ghost btn-sm"
        >
          {c.active ? "Switch off" : "Switch on"}
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        subtitle="Discount codes for an artist or a promoter to share. Each code covers a set number of tickets; once they're sold the discount stops applying."
        actions={
          <button onClick={() => setAdding(true)} className="btn-light">
            <Plus className="h-4 w-4" /> New coupon
          </button>
        }
      />
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      <AdminTable
        title="All coupons"
        description={data ? `${data.coupons.length} codes` : undefined}
        columns={columns}
        rows={data?.coupons ?? null}
        loading={loading}
        error={error}
        empty="No coupons yet. Make one for an artist or a promoter to share."
        onRowClick={setEditing}
      />
      {data && (
        <NewCouponDialog
          open={adding}
          data={data}
          onClose={() => setAdding(false)}
          onSaved={(code) => {
            setNotice(`${code} is ready to share.`)
            reload()
          }}
        />
      )}
      <EditCouponDialog coupon={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  )
}

function NewCouponDialog({
  open,
  data,
  onClose,
  onSaved,
}: {
  open: boolean
  data: Data
  onClose: () => void
  onSaved: (code: string) => void
}) {
  const [ownerType, setOwnerType] = useState<"artist" | "promoter">("artist")
  const [ownerId, setOwnerId] = useState("")
  const [eventId, setEventId] = useState("")
  const [discount, setDiscount] = useState("10")
  const [seats, setSeats] = useState("20")
  const [code, setCode] = useState("")
  const [ideas, setIdeas] = useState<string[]>([])

  const people = ownerType === "artist" ? data.artists : data.promoters
  const owner = people.find((p) => p.id === ownerId)
  // An artist's coupon only works on their own gigs.
  const gigs = useMemo(
    () => (ownerType === "artist" && ownerId ? data.events.filter((e) => e.artist_id === ownerId) : data.events),
    [data.events, ownerType, ownerId],
  )

  useEffect(() => {
    if (!open) return
    setOwnerId("")
    setEventId("")
    setDiscount("10")
    setSeats("20")
    setCode("")
  }, [open])
  useEffect(() => setEventId(""), [ownerType, ownerId])

  // Code ideas from the owner's name, the discount and the gig.
  useEffect(() => {
    if (!owner) return setIdeas([])
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ suggest: owner.name, discount, event_id: eventId })
      const res = await fetch(`/api/admin/coupons?${q}`).catch(() => null)
      if (res?.ok) setIdeas((await res.json()).codes)
    }, 250)
    return () => clearTimeout(t)
  }, [owner, discount, eventId])

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="New coupon"
      description="The discount applies only while the coupon still has tickets left."
      submitLabel="Create coupon"
      onSubmit={async () => {
        const r = await adminWrite<{ code: string }>("/api/admin/coupons", "POST", {
          code,
          owner_type: ownerType,
          owner_id: ownerId,
          event_id: eventId,
          discount_percent: discount,
          seat_limit: seats,
        })
        onSaved(r.code)
      }}
    >
      <div className="flex gap-2">
        {(["artist", "promoter"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setOwnerType(t)
              setOwnerId("")
            }}
            className={`pill-dark micro ${ownerType === t ? "bg-[#F4EFE6]! text-[#14100a]!" : ""}`}
          >
            For {t === "artist" ? "an artist" : "a promoter"}
          </button>
        ))}
      </div>
      <Field label={ownerType === "artist" ? "Artist" : "Promoter"}>
        <select className="admin-field" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
          <option value="">Choose…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Gig"
        hint={ownerType === "artist" ? "Leave blank for any of the artist's gigs." : "Leave blank for any gig. Sales with this code count for the promoter."}
      >
        <select className="admin-field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">{ownerType === "artist" ? "Any of their gigs" : "Any gig"}</option>
          {gigs.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} · {dateTime(g.date)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Discount (%)" hint="100% gives free tickets.">
          <input className="admin-field" type="number" min={1} max={100} step="1" required value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Tickets covered" hint="After these sell, no discount.">
          <input className="admin-field" type="number" min={1} step="1" required value={seats} onChange={(e) => setSeats(e.target.value)} />
        </Field>
      </div>
      <Field label="Code" hint="3–20 letters and numbers. Pick an idea below or type your own.">
        <input
          className="admin-field font-mono uppercase tracking-wider"
          required
          maxLength={20}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="ARJUN10"
        />
      </Field>
      {ideas.length > 0 && (
        <div className="space-y-2">
          <p className="micro flex items-center gap-1.5 text-[#F4EFE6]/55">
            <Sparkles className="h-3 w-3" /> Ideas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCode(c)}
                className={`rounded-full border px-3 py-1 font-mono text-[12px] tracking-wider transition ${
                  code === c ? "border-[#F4EFE6] bg-[#F4EFE6] text-[#0b0a0e]" : "border-white/20 hover:border-[#F4EFE6]/60"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </FormDialog>
  )
}

function EditCouponDialog({ coupon, onClose, onSaved }: { coupon: CouponRow | null; onClose: () => void; onSaved: () => void }) {
  const [discount, setDiscount] = useState("")
  const [seats, setSeats] = useState("")
  useEffect(() => {
    if (!coupon) return
    setDiscount(String(coupon.discount_percent))
    setSeats(String(coupon.seat_limit))
  }, [coupon])

  const remove = async () => {
    if (!coupon || !window.confirm(`Delete ${coupon.code}?`)) return
    await adminWrite(`/api/admin/coupons/${coupon.id}`, "DELETE").catch((e) => window.alert(e.message))
    onSaved()
    onClose()
  }

  return (
    <FormDialog
      open={!!coupon}
      onClose={onClose}
      title={coupon?.code ?? "Coupon"}
      description={coupon ? `${coupon.owner_name ?? ""} · ${coupon.seats_sold} of ${coupon.seat_limit} tickets sold` : undefined}
      submitLabel="Save"
      onSubmit={async () => {
        await adminWrite(`/api/admin/coupons/${coupon!.id}`, "PATCH", { discount_percent: discount, seat_limit: seats })
        onSaved()
      }}
      extra={
        coupon && !coupon.seats_used ? (
          <button type="button" onClick={remove} className="btn-ghost btn-sm text-[#ff7a7a]">
            Delete
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Discount (%)">
          <input className="admin-field" type="number" min={1} max={100} required value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Tickets covered" hint="Raise it to add more discounted tickets.">
          <input className="admin-field" type="number" min={1} required value={seats} onChange={(e) => setSeats(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  )
}
