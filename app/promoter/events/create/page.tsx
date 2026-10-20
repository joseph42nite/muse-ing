"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function CreateEventPage() {
  const [formData, setFormData] = useState({
    eventName: "",
    description: "",
    eventDate: "",
    ticketPrice: "",
    venue: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVenues)
      .catch(() => setVenues([]))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.eventName,
          description: formData.description,
          date: formData.eventDate,
          ticket_price: parseFloat(formData.ticketPrice),
          venue_id: formData.venue || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not create event.")

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
              <select
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="bg-input border border-border text-foreground mt-1 w-full h-9 rounded-md px-3 text-sm"
              >
                <option value="">Select a venue (optional)</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
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
            <div>
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
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => router.push("/promoter/events")}>
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
