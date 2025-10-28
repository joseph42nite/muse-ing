"use client"

import { useState, useEffect } from "react"

import { useRouter, useSearchParams } from "next/navigation"

import Link from "next/link"

import ShaderBackground from "@/components/shader-background"

import { createClient } from "@/lib/supabase/client"



export default function VenueCheckinPage() {

  const [audiencePhone, setAudiencePhone] = useState("")

  const [eventId, setEventId] = useState("")

  const [feedback, setFeedback] = useState<string | null>(null)

  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null)

  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()

  const searchParams = useSearchParams()

  const supabase = createClient()



  useEffect(() => {

    const eventIdFromUrl = searchParams.get("event_id")

    if (eventIdFromUrl) {

      setEventId(eventIdFromUrl)

    }

  }, [searchParams])



  const handleLogout = async () => {

    setIsLoading(true)

    await supabase.auth.signOut()

    router.push("/login")

    setIsLoading(false)

  }



  const handleCheckin = async (e: React.FormEvent) => {

    e.preventDefault()

    setIsLoading(true)

    setFeedback(null)

    setFeedbackType(null)



    if (!eventId) {

      setFeedback("Event ID is required.")

      setFeedbackType("error")

      setIsLoading(false)

      return

    }



    if (!audiencePhone) {

      setFeedback("Audience phone number is required.")

      setFeedbackType("error")

      setIsLoading(false)

      return

    }



    try {

      const { data: user, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {

        throw new Error("Venue security not authenticated. Please log in.")

      }



      // 1. Verify booking in audience_bookings table

      const { data: booking, error: bookingError } = await supabase

        .from("audience_bookings")

        .select("id, event_id, phone, payment_status")

        .eq("event_id", eventId)

        .eq("phone", audiencePhone)

        .eq("payment_status", "paid") // Only allow check-in for paid bookings

        .single()



      if (bookingError || !booking) {

        throw new Error("No paid booking found for this phone number and event.")

      }



      // 2. Check if already checked in for this event and phone

      const { data: existingCheckin, error: existingCheckinError } = await supabase

        .from("venue_checkins")

        .select("id")

        .eq("event_id", eventId)

        .eq("audience_phone", audiencePhone)

        .eq("checked_in", true)

        .single()



      if (existingCheckinError && existingCheckinError.code !== "PGRST116") { // PGRST116 means no rows found

        throw existingCheckinError

      }



      if (existingCheckin) {

        setFeedback("This person has already been checked in for this event.")

        setFeedbackType("error")

        setIsLoading(false)

        return

      }



      // 3. Insert into venue_checkins table

      const { error: checkinError } = await supabase.from("venue_checkins").insert({

        event_id: eventId,

        audience_phone: audiencePhone,

        checked_in: true,

        checkin_time: new Date().toISOString(),

        verified_by: user.user.id,

      })



      if (checkinError) throw checkinError



      setFeedback("Check-in successful!")

      setFeedbackType("success")

      setAudiencePhone("") // Clear phone number input after successful check-in

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

            <h1 className="text-3xl font-light text-white mb-2">Venue Check-in</h1>

            <p className="text-white/60 text-sm">Scan or enter phone number to check in attendees</p>

          </div>



          <form onSubmit={handleCheckin} className="space-y-4">

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

              <label htmlFor="audiencePhone" className="block text-white/80 text-sm font-light mb-2">Audience Phone Number</label>

              <input

                id="audiencePhone"

                type="tel"

                value={audiencePhone}

                onChange={(e) => setAudiencePhone(e.target.value)}

                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"

                placeholder="Enter phone number"

                required

              />

            </div>



            {feedback && (

              <p className={feedbackType === "error" ? "text-red-500" : "text-green-500"}>

                {feedback}

              </p>

            )}



            <button type="submit" className="w-full px-6 py-2 rounded-lg bg-white text-black font-normal text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer mt-6" disabled={isLoading}>

              {isLoading ? "Checking in..." : "Check In"}

            </button>

          </form>

        </div>

      </div>

    </ShaderBackground>

  )

}
