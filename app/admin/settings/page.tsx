"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { PageHeader } from "../admin-table"
import { useAdminData } from "../use-admin-data"
import { adminWrite, ErrorNote, Field, Notice } from "../admin-form"

interface Settings {
  platform_fee_percent: number
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useAdminData<Settings>("/api/admin/settings")
  const [fee, setFee] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (data) setFee(String(data.platform_fee_percent))
  }, [data])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const r = await adminWrite<Settings>("/api/admin/settings", "PATCH", { platform_fee_percent: fee.trim() })
      setNotice(`Platform fee set to ${r.platform_fee_percent}%. It applies to payments from now on.`)
      reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save.")
    } finally {
      setSaving(false)
    }
  }

  const pct = Number(fee)
  const example = Number.isFinite(pct) && fee.trim() !== "" ? Math.round(500 * pct) / 100 : null

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="How Muse-ing earns from the money that passes through it." />
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {error && <p className="text-[#ff7a7a]">Couldn&apos;t load settings: {error}</p>}
      {loading && !data ? (
        <p className="micro text-[#F4EFE6]/50">Loading…</p>
      ) : (
        <form onSubmit={save} className="admin-panel max-w-lg space-y-5 p-6">
          <Field
            label="Platform fee (%)"
            hint="Taken from every ticket sale, tip and dedication paid through Cashfree. The buyer pays the listed price; the fee comes out of the promoter's or artist's share. Payments already started keep the rate they began with."
          >
            <input
              className="admin-field"
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step="0.5"
              required
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </Field>
          {example !== null && (
            <p className="text-[12px] text-[#F4EFE6]/60">
              On a ₹500 sale, Muse-ing keeps ₹{example.toLocaleString("en-IN")} and the promoter or artist gets ₹
              {(500 - example).toLocaleString("en-IN")}.
            </p>
          )}
          {saveError && <ErrorNote>{saveError}</ErrorNote>}
          <button type="submit" disabled={saving} className="btn-light btn-sm disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  )
}
