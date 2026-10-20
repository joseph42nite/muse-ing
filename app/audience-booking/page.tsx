"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// Legacy entry point: forwards old ?event_id=…&promoter_id=… links to the clean booking page.
function Redirector() {
  const router = useRouter()
  const params = useSearchParams()
  const eventId = params.get("event_id")
  const ref = params.get("promoter_id")

  useEffect(() => {
    if (eventId) router.replace(`/book/${eventId}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`)
  }, [eventId, ref, router])

  return eventId ? (
    <p className="text-white/60">Taking you to booking…</p>
  ) : (
    <div className="max-w-sm text-center text-white">
      <h1 className="text-2xl font-light mb-2">Need a booking link</h1>
      <p className="text-white/60 text-sm">Ask the event promoter for the booking link to reserve your tickets.</p>
    </div>
  )
}

export default function AudienceBookingPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <Redirector />
      </Suspense>
    </div>
  )
}
