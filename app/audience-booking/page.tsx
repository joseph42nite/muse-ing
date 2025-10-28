"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import ShaderBackground from "@/components/shader-background"
import { createClient } from "@/lib/supabase/client"

export default function AudienceBookingPage() {
  const [eventId, setEventId] = useState("")
  const [promoterId, setPromoterId] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [numPeople, setNumPeople] = useState<number>(1)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [eventTicketPrice, setEventTicketPrice] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const eventIdFromUrl = searchParams.get("event_id")
    if (eventIdFromUrl) {
      setEventId(eventIdFromUrl)
    }
    const promoterIdFromUrl = searchParams.get("promoter_id")
    if (promoterIdFromUrl) {
      setPromoterId(promoterIdFromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (eventId) {
        const { data, error } = await supabase
          .from("events")
          .select("ticket_price")
          .eq("id", eventId)
          .single()

        if (error) {
          console.error("Error fetching event details:", error.message)
          setFeedback("Error fetching event details.")
          setFeedbackType("error")
        } else if (data) {
          setEventTicketPrice(data.ticket_price)
        }
      }
    }
    fetchEventDetails()
  }, [eventId, supabase])

  const handleLogout = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    router.push("/login")
    setIsLoading(false)
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setFeedback(null)
    setFeedbackType(null)

    if (!eventId || !promoterId || !name || !phone || numPeople <= 0) {
      setFeedback("Please fill in all required fields.")
      setFeedbackType("error")
      setIsLoading(false)
      return
    }

    if (eventTicketPrice === null) {
      setFeedback("Could not determine event ticket price. Please try again.")
      setFeedbackType("error")
      setIsLoading(false)
      return
    }

    const totalAmount = numPeople * eventTicketPrice

    try {
      const { error: insertError } = await supabase.from("audience_bookings").insert({
        event_id: eventId,
        promoter_id: promoterId,
        name,
        phone,
        email,
        num_people: numPeople,
        total_amount: totalAmount,
        payment_status: "pending", // Default to pending, actual payment handled elsewhere
      })

      if (insertError) throw insertError

      setFeedback("Booking successful! Payment is pending.")
      setFeedbackType("success")
      // Clear form fields
      setName("")
      setPhone("")
      setEmail("")
      setNumPeople(1)
    } catch (err: any) {
      setFeedback(err.message)
      setFeedbackType("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ShaderBackground>
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full bg-white text-black font-normal text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer"
          disabled={isLoading}
        >
          Logout
        </button>
      </div>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/50 p-8 rounded-lg shadow-lg relative z-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-light text-white mb-2">Audience Booking</h1>
            <p className="text-white/60 text-sm">Book your tickets for the event</p>
          </div>

          <form onSubmit={handleBooking} className="space-y-4">
            <div>
              <label htmlFor="eventId" className="block text-white/80 text-sm font-light mb-2">Event ID</label>
              <input
                id="eventId"
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                placeholder="Enter Event ID (e.g., from URL)"
                required
                disabled={!!searchParams.get("event_id")}
              />
            </div>
            <div>
              <label htmlFor="promoterId" className="block text-white/80 text-sm font-light mb-2">Promoter ID</label>
              <input
                id="promoterId"
                type="text"
                value={promoterId}
                onChange={(e) => setPromoterId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                placeholder="Enter Promoter ID (e.g., from URL)"
                required
                disabled={!!searchParams.get("promoter_id")}
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-white/80 text-sm font-light mb-2">Your Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-white/80 text-sm font-light mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                placeholder="Enter your phone number"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-white/80 text-sm font-light mb-2">Email (Optional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label htmlFor="numPeople" className="block text-white/80 text-sm font-light mb-2">Number of People</label>
              <input
                id="numPeople"
                type="number"
                value={numPeople}
                onChange={(e) => setNumPeople(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
                min="1"
                required
              />
            </div>

            {eventTicketPrice !== null && numPeople > 0 && (
              <p className="text-white/80 text-sm mt-2">Total Amount: ₹{(numPeople * eventTicketPrice).toLocaleString()}</p>
            )}

            {feedback && (
              <p className={feedbackType === "error" ? "text-red-500" : "text-green-500"}>
                {feedback}
              </p>
            )}

            <button type="submit" className="w-full px-6 py-2 rounded-lg bg-white text-black font-normal text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer mt-6" disabled={isLoading}>
              {isLoading ? "Booking..." : "Book Tickets"}
            </button>
          </form>
        </div>
      </div>
    </ShaderBackground>
  )
}
