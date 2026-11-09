"use client"

import { useCallback, useEffect, useState } from "react"

/** Fetches an admin API route; sends the browser to /login if the session isn't an admin. */
export function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login"
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
      setData(body as T)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload }
}

export const inr = (n: number | null | undefined) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"
