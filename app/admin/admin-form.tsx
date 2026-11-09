"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Sends a JSON write to an admin route. Signed-out sessions go to /login. */
export async function adminWrite<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login"
    throw new Error("Signed out.")
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className ?? "block"}>
      <span className="micro block text-[#F4EFE6]/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#F4EFE6]/40">{hint}</span>}
    </label>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-[#D92323]/30 bg-[#D92323]/10 p-2.5 text-xs text-[#ff9a9a]">{children}</p>
}

/** A dialog holding a form: title in the landing type, a submit button and inline errors. */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
  extra,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  submitLabel: string
  onSubmit: () => Promise<void>
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <div className="dots">
            <i />
          </div>
          <DialogTitle className="title-x mt-3 text-[24px] sm:text-[28px]">{title}</DialogTitle>
          {description && <DialogDescription className="fine text-[12.5px]!">{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-5">
          {children}
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>{extra}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-light btn-sm disabled:opacity-60">
                {saving ? "Saving…" : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** `<input type="datetime-local">` value for an ISO timestamp, in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Notice({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#F4EFE6]/15 bg-[#F4EFE6]/[0.06] px-4 py-3 text-[13px] text-[#F4EFE6]">
      <span>{children}</span>
      <button onClick={onDismiss} className="micro shrink-0 text-[#F4EFE6]/55 hover:text-white">
        Dismiss
      </button>
    </div>
  )
}
