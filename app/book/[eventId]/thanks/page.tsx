"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type State = "checking" | "paid" | "pending" | "failed"

function Status() {
  const booking = useSearchParams().get("booking")
  const [state, setState] = useState<State>("checking")

  useEffect(() => {
    if (!booking) return setState("pending")
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const res = await fetch(`/api/bookings/${booking}/status`, { cache: "no-store" })
        const { status } = await res.json()
        if (status === "paid") return setState("paid")
        if (status === "failed" || status === "cancelled") return setState("failed")
      } catch {}
      if (++tries < 6) timer = setTimeout(poll, 2500)
      else setState("pending")
    }
    poll()
    return () => clearTimeout(timer)
  }, [booking])

  const copy = {
    checking: { icon: "…", tone: "bg-white/10 text-white/70", title: "Confirming your payment", body: "Hang on a moment." },
    paid: {
      icon: "✓",
      tone: "bg-emerald-500/20 text-emerald-400",
      title: "You're all set",
      body: "Payment received. At the venue, just give the phone number you booked with. No ticket needed.",
    },
    pending: {
      icon: "•",
      tone: "bg-amber-500/20 text-amber-300",
      title: "Payment not confirmed yet",
      body: "If you've paid, this can take a minute to update. Your booking will be ready at the venue once it clears.",
    },
    failed: {
      icon: "!",
      tone: "bg-red-500/20 text-red-400",
      title: "Payment didn't go through",
      body: "No money was taken for this booking. Please use your booking link to try again.",
    },
  }[state]

  return (
    <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white">
      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${copy.tone}`}>{copy.icon}</div>
      <h1 className="text-2xl font-light mb-2">{copy.title}</h1>
      <p className="text-white/60 text-sm">{copy.body}</p>
    </div>
  )
}

export default function ThanksPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <Status />
      </Suspense>
    </div>
  )
}
