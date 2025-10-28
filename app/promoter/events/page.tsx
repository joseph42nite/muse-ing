"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Trash2, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Mock data - replace with actual API calls
const mockEvents = [
  {
    id: "1",
    eventName: "Summer Music Festival",
    venue: "Grand Theater",
    eventDate: "2024-06-15",
    ticketPrice: 500,
    totalTickets: 2000,
    ticketsSold: 1500,
    status: "published",
  },
  {
    id: "2",
    eventName: "Tech Conference 2024",
    venue: "Convention Center",
    eventDate: "2024-07-20",
    ticketPrice: 2000,
    totalTickets: 5000,
    ticketsSold: 3200,
    status: "published",
  },
  {
    id: "3",
    eventName: "Concert Night",
    venue: "Amphitheater",
    eventDate: "2024-08-10",
    ticketPrice: 1000,
    totalTickets: 3000,
    ticketsSold: 0,
    status: "draft",
  },
]

const statusColors = {
  draft: "bg-gray-500/20 text-gray-700",
  published: "bg-green-500/20 text-green-700",
  cancelled: "bg-red-500/20 text-red-700",
  completed: "bg-blue-500/20 text-blue-700",
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any | null>(null)
  const [formData, setFormData] = useState({
    eventName: "",
    description: "",
    eventDate: "",
    ticketPrice: "",
    totalTickets: "",
    venue: "",
  })
  const supabase = createClient()

  useEffect(() => {
    const fetchEvents = async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error("Error fetching user:", userError?.message)
        return
      }

      const { data: promoterEvents, error } = await supabase
        .from("events")
        .select("*", { count: "exact" })
        .eq("created_by", user.user?.id)

      if (error) {
        console.error("Error fetching events:", error.message)
      } else {
        setEvents(promoterEvents || [])
      }
    }

    fetchEvents()
  }, [supabase])

  const handleOpenDialog = (event?: any) => {
    if (event) {
      setEditingEvent(event)
      setFormData({
        eventName: event.eventName,
        description: event.description,
        eventDate: event.eventDate,
        ticketPrice: event.ticketPrice.toString(),
        totalTickets: event.totalTickets.toString(),
        venue: event.venue,
      })
    } else {
      setEditingEvent(null)
      setFormData({
        eventName: "",
        description: "",
        eventDate: "",
        ticketPrice: "",
        totalTickets: "",
        venue: "",
      })
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    // TODO: Implement API call to save event
    console.log("Saving event:", formData)
    setShowDialog(false)
  }

  const handleDelete = async (id: string) => {
    // TODO: Implement API call to delete event
    console.log("Deleting event:", id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Events</h1>
          <p className="text-muted-foreground mt-2">Manage all events you have created</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Event
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>My Events</CardTitle>
          <CardDescription>View and manage your events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Event Name</TableHead>
                  <TableHead className="text-foreground">Venue</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                  <TableHead className="text-foreground">Price</TableHead>
                  <TableHead className="text-foreground">Tickets</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{event.eventName}</TableCell>
                    <TableCell className="text-foreground">{event.venue}</TableCell>
                    <TableCell className="text-foreground">{event.eventDate}</TableCell>
                    <TableCell className="text-foreground">₹{event.ticketPrice}</TableCell>
                    <TableCell className="text-foreground">
                      {event.ticketsSold}/{event.totalTickets}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[event.status as keyof typeof statusColors]}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(event)}
                          className="text-foreground border-border hover:bg-muted"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(event.id)}
                          className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingEvent ? "Update event information" : "Fill in the details to create a new event"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
              />
            </div>
            <div>
              <Label htmlFor="eventDate" className="text-foreground">
                Event Date
              </Label>
              <Input
                id="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
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
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
              {editingEvent ? "Update" : "Create"} Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
