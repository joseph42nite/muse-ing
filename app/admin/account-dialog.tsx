"use client"

import { useEffect, useState } from "react"
import { adminWrite, Field, FormDialog } from "./admin-form"

export type AccountKind = "artist" | "venue" | "promoter"
export interface EditableAccount {
  id: string
  name: string
  email: string
  phone: string | null
  bio?: string | null
  instagram_handle?: string | null
  [field: string]: unknown
}

const ROUTE: Record<AccountKind, string> = { artist: "artists", venue: "venues", promoter: "promoters" }

interface Extra {
  key: string
  label: string
  type?: "text" | "number" | "url" | "textarea"
  placeholder?: string
  wide?: boolean
}
/** Extra fields per kind, grouped into titled sections. Keys match PROFILE_FIELDS on the server. */
const SECTIONS: Record<AccountKind, { title: string; fields: Extra[] }[]> = {
  artist: [
    {
      title: "Profile",
      fields: [
        { key: "instagram_handle", label: "Instagram", placeholder: "@handle" },
        { key: "city", label: "City" },
        { key: "category", label: "Category", placeholder: "Bollywood Singer, Kannada Singer", wide: true },
        { key: "instruments", label: "Instruments", wide: true },
        { key: "bio", label: "Bio", type: "textarea", wide: true },
      ],
    },
    {
      title: "Roster",
      fields: [
        { key: "average_fee", label: "Average fee (₹)", type: "number" },
        { key: "rating", label: "Rating (1–10)", type: "number" },
        { key: "reliability_score", label: "Reliability score", type: "number" },
        { key: "total_performances", label: "Total performances", type: "number" },
        { key: "perf_with_m", label: "Gigs with Muse-ing", type: "number" },
        { key: "last_perf_date", label: "Last performance" },
        { key: "payment_status", label: "Payment status" },
        { key: "amount_paid", label: "Amount paid (₹)", type: "number" },
        { key: "amount_pending", label: "Amount pending (₹)", type: "number" },
        { key: "notes", label: "Notes", type: "textarea", wide: true },
      ],
    },
    {
      title: "Bank details",
      fields: [
        { key: "payee_name", label: "Account holder" },
        { key: "bank_name", label: "Bank" },
        { key: "account_number", label: "Account number" },
        { key: "ifsc_code", label: "IFSC" },
        { key: "upi_id", label: "UPI ID", wide: true },
        { key: "bank_details", label: "Bank details as shared", type: "textarea", wide: true },
      ],
    },
  ],
  venue: [
    {
      title: "Venue",
      fields: [
        { key: "city", label: "City" },
        { key: "map_link", label: "Map link", type: "url" },
        { key: "address", label: "Address", type: "textarea", wide: true },
        { key: "poc_name", label: "Contact person" },
        { key: "poc_phone", label: "Contact phone" },
        { key: "social_links", label: "Social links", wide: true },
      ],
    },
  ],
  promoter: [],
}

const extraKeys = (kind: AccountKind) => SECTIONS[kind].flatMap((s) => s.fields.map((f) => f.key))
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))

/** Create or edit an artist, venue or promoter login. */
export function AccountDialog({
  kind,
  open,
  account,
  onClose,
  onSaved,
}: {
  kind: AccountKind
  open: boolean
  account?: EditableAccount | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [f, setF] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!open) return
    const base: Record<string, string> = {
      name: str(account?.name),
      email: str(account?.email),
      phone: str(account?.phone),
      password: "",
    }
    for (const k of extraKeys(kind)) base[k] = str(account?.[k])
    setF(base)
  }, [open, account, kind])
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    const body: Record<string, string> = { name: f.name, email: f.email, phone: f.phone }
    for (const k of extraKeys(kind)) body[k] = f[k] ?? ""
    if (f.password) body.password = f.password
    if (account) {
      await adminWrite(`/api/admin/accounts/${encodeURIComponent(account.id)}`, "PATCH", body)
      onSaved(f.password ? `Saved. ${f.name} has been signed out and must use the new password.` : "Saved.")
    } else {
      const r = await adminWrite<{ promoter_code: string | null }>(`/api/admin/${ROUTE[kind]}`, "POST", body)
      onSaved(`${f.name} can now sign in with ${f.email}.` + (r.promoter_code ? ` Promoter code: ${r.promoter_code}.` : ""))
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`${account ? "Edit" : "Add"} ${kind}`}
      description={
        account ? "Leave the password empty to keep it." : `Creates a ${kind} login. Share the email and password with them yourself.`
      }
      submitLabel={account ? "Save changes" : `Add ${kind}`}
      onSubmit={save}
    >
      <Field label={kind === "venue" ? "Venue name" : "Name"}>
        <input className="admin-field" value={f.name ?? ""} onChange={set("name")} required />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email (login)">
          <input type="email" className="admin-field" value={f.email ?? ""} onChange={set("email")} required />
        </Field>
        <Field label="Phone">
          <input type="tel" className="admin-field" value={f.phone ?? ""} onChange={set("phone")} />
        </Field>
      </div>
      {SECTIONS[kind].map((section) => (
        <div key={section.title} className="space-y-4 border-t border-white/10 pt-4">
          <p className="micro text-[#F4EFE6]/55">{section.title}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {section.fields.map((x) => (
              <div key={x.key} className={x.wide ? "sm:col-span-2" : undefined}>
                <Field label={x.label}>
                  {x.type === "textarea" ? (
                    <textarea
                      className="admin-field min-h-[70px] resize-y"
                      value={f[x.key] ?? ""}
                      onChange={set(x.key)}
                      placeholder={x.placeholder}
                    />
                  ) : (
                    <input
                      type={x.type ?? "text"}
                      step={x.type === "number" ? "any" : undefined}
                      className="admin-field"
                      value={f[x.key] ?? ""}
                      onChange={set(x.key)}
                      placeholder={x.placeholder}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Field label={account ? "New password" : "Password"} hint="At least 8 characters">
        <input
          type="password"
          className="admin-field"
          value={f.password ?? ""}
          onChange={set("password")}
          autoComplete="new-password"
          minLength={8}
          required={!account}
        />
      </Field>
    </FormDialog>
  )
}
