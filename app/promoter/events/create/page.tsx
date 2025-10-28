"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

export default function CreateEventPage() {
  const [formData, setFormData] = useState({
    eventName: "",
    description: "",
    eventDate: "",
    ticketPrice: "",
    totalTickets: "",
    venue: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("User not authenticated.")
      }

      const { error: insertError } = await supabase.from("events").insert([
        {
          event_name: formData.eventName,
          description: formData.description,
          event_date: formData.eventDate,
          ticket_price: parseFloat(formData.ticketPrice),
          total_tickets: parseInt(formData.totalTickets),
          venue_id: "", // TODO: Replace with actual venue ID from a selection
          promoter_id: user.user?.id, // Assuming promoter_id is the user's ID
        },
      ])

      if (insertError) throw insertError

      router.push("/promoter/events") // Redirect to my events page
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create New Event</h1>
        <p className="text-muted-foreground mt-2">Fill in the details to create a new event</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Provide information about your event</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="eventName" className="text-foreground">
                Event Name
              </Label>
              <Input
                id="eventName"
                value={formData.eventName}
                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Enter event name"
                required
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Enter event description" rows={3}
              />
            </div>
            <div>
              <Label htmlFor="venue" className="text-foreground">
                Venue
              </Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Venue"
                required
              />
            </div>
            <div>
              <Label htmlFor="eventDate" className="text-foreground">
                Event Date & Time
              </Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ticketPrice" className="text-foreground">
                  Ticket Price
                </Label>
                <Input
                  id="ticketPrice"
                  type="number"
                  value={formData.ticketPrice}
                  onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value })}
                  className="bg-input border-border text-foreground mt-1"
                  placeholder="Price"
                  required
                />
              </div>
              <div>
                <Label htmlFor="totalTickets" className="text-foreground">
                  Total Tickets
                </Label>
                <Input
                  id="totalTickets"
                  type="number"
                  value={formData.totalTickets}
                  onChange={(e) => setFormData({ ...formData, totalTickets: e.target.value })}
                  className="bg-input border-border text-foreground mt-1"
                  placeholder="Total"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => router.push("/promoter/events")}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
