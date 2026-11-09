"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

interface EventSummary {
  id: string
  title: string
  description: string | null
  date: string
  ticket_price: number
  venue_name: string | null
}

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

const inputCls =
  "w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50 transition-colors"

export default function BookEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const searchParams = useSearchParams()
  const ref = searchParams.get("ref") ?? ""

  const [event, setEvent] = useState<EventSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [numPeople, setNumPeople] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Coupon: what was typed, and the discount the server confirmed for the current ticket count.
  const [couponInput, setCouponInput] = useState(searchParams.get("coupon") ?? "")
  const [coupon, setCoupon] = useState<{ code: string; discount_percent: number; discount_amount: number; total: number; seats_left: number } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || "Event not found.")
        setEvent(body)
      })
      .catch((e) => setLoadError(e.message))
  }, [eventId])

  const listTotal = event ? event.ticket_price * numPeople : 0
  const total = coupon ? coupon.total : listTotal

  const applyCoupon = async (code = couponInput, people = numPeople) => {
    if (!code.trim()) return
    setCheckingCoupon(true)
    setCouponError(null)
    try {
      const q = new URLSearchParams({ event_id: eventId, code: code.trim(), num_people: String(people) })
      const res = await fetch(`/api/coupons/check?${q}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "That coupon isn't valid.")
      setCoupon(body)
    } catch (err: any) {
      setCoupon(null)
      setCouponError(err.message)
    } finally {
      setCheckingCoupon(false)
    }
  }

  // The discount depends on the ticket count (a coupon covers a limited number), so re-check it.
  const changePeople = (n: number) => {
    setNumPeople(n)
    if (coupon) applyCoupon(coupon.code, n)
  }

  // A shared link with ?coupon=CODE applies it once the event has loaded.
  useEffect(() => {
    if (event && couponInput && !coupon && !couponError) applyCoupon()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, name, phone, email, num_people: numPeople, ref, coupon_code: coupon?.code ?? "" }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not start payment.")
      window.location.href = body.payment_url
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {loadError ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white">
            <h1 className="text-2xl font-light mb-2">Event unavailable</h1>
            <p className="text-white/60 text-sm">{loadError}</p>
          </div>
        ) : !event ? (
          <p className="text-center text-white/60">Loading event…</p>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-white">
            <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Book tickets</p>
            <h1 className="text-3xl font-light mb-1">{event.title}</h1>
            <p className="text-white/60 text-sm">
              {new Date(event.date).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}
              {event.venue_name ? ` · ${event.venue_name}` : ""}
            </p>
            {event.description && <p className="text-white/70 text-sm mt-4">{event.description}</p>}

            <form onSubmit={submit} className="space-y-4 mt-6">
              <div>
                <label htmlFor="name" className="block text-white/80 text-sm mb-1.5">Full name</label>
                <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="phone" className="block text-white/80 text-sm mb-1.5">Phone (used for entry)</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-white/80 text-sm mb-1.5">Email (optional)</label>
                <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1.5">Tickets</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changePeople(Math.max(1, numPeople - 1))}
                    className="h-11 w-11 rounded-lg bg-white/10 text-xl hover:bg-white/20"
                    aria-label="Fewer tickets"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-lg">{numPeople}</span>
                  <button
                    type="button"
                    onClick={() => changePeople(Math.min(20, numPeople + 1))}
                    className="h-11 w-11 rounded-lg bg-white/10 text-xl hover:bg-white/20"
                    aria-label="More tickets"
                  >
                    +
                  </button>
                  <span className="ml-auto text-white/60 text-sm">₹{event.ticket_price.toLocaleString("en-IN")} each</span>
                </div>
              </div>

              <div>
                <label htmlFor="coupon" className="block text-white/80 text-sm mb-1.5">Coupon code (optional)</label>
                <div className="flex gap-2">
                  <input
                    id="coupon"
                    className={`${inputCls} font-mono uppercase tracking-wider`}
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase().replace(/\s+/g, ""))
                      setCoupon(null)
                      setCouponError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        applyCoupon()
                      }
                    }}
                    placeholder="e.g. ARJUN10"
                  />
                  {coupon ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCoupon(null)
                        setCouponInput("")
                      }}
                      className="shrink-0 rounded-lg bg-white/10 px-4 text-sm hover:bg-white/20"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => applyCoupon()}
                      disabled={checkingCoupon || !couponInput.trim()}
                      className="shrink-0 rounded-lg bg-white/10 px-4 text-sm hover:bg-white/20 disabled:opacity-50"
                    >
                      {checkingCoupon ? "Checking…" : "Apply"}
                    </button>
                  )}
                </div>
                {couponError && <p className="mt-1.5 text-sm text-red-400">{couponError}</p>}
                {coupon && (
                  <p className="mt-1.5 text-sm text-emerald-300">
                    {coupon.code}: {coupon.discount_percent}% off · you save {rupees(coupon.discount_amount)}
                  </p>
                )}
              </div>

              {coupon && (
                <div className="flex justify-between text-sm text-white/60">
                  <span>
                    <s>{rupees(listTotal)}</s> → {rupees(total)}
                  </span>
                  <span>
                    {coupon.seats_left} discounted {coupon.seats_left === 1 ? "ticket" : "tickets"} left
                  </span>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-white text-black font-medium transition hover:bg-white/90 disabled:opacity-60"
              >
                {submitting ? "Redirecting to payment…" : total > 0 ? `Pay ${rupees(total)}` : "Confirm free booking"}
              </button>
              <p className="text-center text-xs text-white/40">Secure payment via Cashfree. Show your phone number at the venue.</p>
              <p className="text-center text-[11px] text-white/40">
                By paying you agree to the{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-white/70">Terms</Link> and{" "}
                <Link href="/refunds" target="_blank" className="underline underline-offset-2 hover:text-white/70">Refund Policy</Link>.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
