"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mic2, Sparkles, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const doLogin = async (loginEmail: string, loginPass: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not sign in.")

      if (body.role === "artist") router.push("/artist")
      else if (body.role === "admin") router.push("/admin")
      else if (body.role === "promoter") router.push("/promoter")
      else if (body.role === "venue") router.push("/venue-checkin")
      else router.push("/artist")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await doLogin(email, password)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#5a0910_0%,#1a0507_55%,#070709_100%)] px-5 py-10 text-[#F4EFE6]">
      {/* The landing's folded mark, huge and faint behind the card */}
      <p aria-hidden className="title-x pointer-events-none absolute -bottom-[4vw] left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-[42vw] leading-[0.8] opacity-[0.05]">
        M-
      </p>

      <Link
        href="/"
        className="micro absolute left-5 top-6 flex items-center gap-1.5 text-[#F4EFE6]/70 transition hover:text-white sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Muse-ing
      </Link>

      <div className="card-noir relative z-10 w-full max-w-[440px] px-6 py-9 sm:px-10 sm:py-11">
        <div className="dots"><i /></div>
        <p className="micro mt-5 flex items-center gap-2 text-[#F4EFE6]/60">
          <Mic2 className="h-3.5 w-3.5" />
          Artist &amp; partner portal
        </p>
        <h1 className="title-x mt-3 text-[34px] sm:text-[42px]">
          Artist
          <br />
          login
        </h1>
        <p className="fine mt-4 text-[13px]!">
          See where you&apos;re playing next, build your pre-gig setlist, take the room&apos;s requests live and put the lyrics on
          the big screen.
        </p>

        {/* One-click demo artist */}
        <div className="mt-7 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <div className="min-w-0">
            <p className="micro flex items-center gap-1.5 text-[#F4EFE6]">
              <Sparkles className="h-3.5 w-3.5" />
              Try the demo artist
            </p>
            <p className="mt-1 truncate text-[11px] text-[#F4EFE6]/55">Arjun Mehta · Live at Toit Indiranagar</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail("artist@museing.com")
              setPassword("artist123")
              doLogin("artist@museing.com", "artist123")
            }}
            disabled={isLoading}
            className="btn-ghost h-9! shrink-0 px-4! text-[10px]! disabled:opacity-60"
          >
            1-click login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="email" className="micro block text-[#F4EFE6]/55">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="artist@museing.com"
              className="field-noir"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="micro block text-[#F4EFE6]/55">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field-noir"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="rounded-xl border border-[#ff9a9a]/25 bg-[#ff9a9a]/10 p-2.5 text-xs text-[#ff9a9a]">{error}</p>}

          <button type="submit" className="btn-light mt-2 w-full justify-center disabled:opacity-60" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in to your dashboard"}
          </button>
        </form>

        <p className="mt-7 border-t border-white/10 pt-5 text-center text-xs text-[#F4EFE6]/55">
          New performing artist?{" "}
          <Link href="/auth/sign-up" className="text-[#F4EFE6] underline underline-offset-4 transition hover:text-white">
            Create an artist account
          </Link>
        </p>
      </div>
    </div>
  )
}
