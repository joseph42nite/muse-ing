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
    <div className="min-h-screen bg-[#07070b] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 relative z-10 shadow-2xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-white/70 hover:text-white text-sm font-light mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Events
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs mb-3">
            <Mic2 className="w-3.5 h-3.5" />
            Artist & Partner Portal
          </div>
          <h1 className="text-3xl font-light text-white mb-1.5">Artist Login</h1>
          <p className="text-white/60 text-sm">
            Sign in to view your scheduled gig location, manage your pre-gig playlist, confirm 3-song audience requests, and connect HDMI Karaoke.
          </p>
        </div>

        {/* One-Click Demo Artist Login Banner */}
        <div className="mb-6 p-3.5 rounded-xl bg-gradient-to-r from-purple-500/15 via-fuchsia-500/10 to-amber-500/15 border border-purple-400/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Try Demo Artist Account
              </p>
              <p className="text-[11px] text-white/60 mt-0.5">
                Arjun Mehta • Live at Toit Indiranagar
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("artist@museing.com")
                setPassword("artist123")
                doLogin("artist@museing.com", "artist123")
              }}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition cursor-pointer shrink-0"
            >
              1-Click Artist Login
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-white/80 text-xs font-medium mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="artist@museing.com"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 focus:outline-none focus:border-purple-400 transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-white/80 text-xs font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 focus:outline-none focus:border-purple-400 transition-colors text-sm"
              required
            />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{error}</p>}

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl bg-white text-black font-medium text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer mt-2"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in to Dashboard"}
          </button>
        </form>

        <p className="text-center text-white/60 text-xs mt-6">
          New performing artist?{" "}
          <Link href="/auth/sign-up" className="text-purple-300 hover:text-white underline underline-offset-4 transition-colors">
            Create an Artist Account
          </Link>
        </p>
      </div>
    </div>
  )
}
