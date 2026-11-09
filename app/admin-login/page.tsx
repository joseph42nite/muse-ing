"use client"

import type React from "react"
import { useState } from "react"
import { ShieldCheck } from "lucide-react"

// Served at /login on the admin host (see proxy.ts). Only admins get past it.
export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not sign in.")
      if (body.role !== "admin") {
        await fetch("/api/auth/logout", { method: "POST" })
        throw new Error("This login isn't an admin. Artists sign in at muse-ing.in/login.")
      }
      window.location.href = "/admin"
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#5a0910_0%,#1a0507_55%,#070709_100%)] px-5 py-10 text-[#F4EFE6]">
      <p
        aria-hidden
        className="title-x pointer-events-none absolute -bottom-[4vw] left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-[42vw] leading-[0.8] opacity-[0.05]"
      >
        M-
      </p>
      <div className="card-noir relative z-10 w-full max-w-[420px] px-6 py-9 sm:px-10 sm:py-11">
        <div className="dots">
          <i />
        </div>
        <p className="micro mt-5 flex items-center gap-2 text-[#F4EFE6]/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          Muse-ing admin
        </p>
        <h1 className="title-x mt-3 text-[34px] sm:text-[42px]">
          Control
          <br />
          room
        </h1>
        <p className="fine mt-4 text-[13px]!">Events, artist schedules, venues, payments and refunds. Admins only.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block">
            <span className="micro block text-[#F4EFE6]/55">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-noir"
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="micro block text-[#F4EFE6]/55">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-noir"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="rounded-xl border border-[#ff9a9a]/25 bg-[#ff9a9a]/10 p-2.5 text-xs text-[#ff9a9a]">{error}</p>}
          <button type="submit" className="btn-light mt-2 w-full justify-center disabled:opacity-60" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
