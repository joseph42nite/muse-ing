"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Link2, Copy, Check, MessageCircle } from "lucide-react"
import Link from "next/link"

interface EventRow {
  id: string
  title: string
  date: string
  ticket_price: number
  total_bookings: number | null
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      window.prompt("Copy this link:", text)
    }
  }
  return { copied, copy }
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promoterCode, setPromoterCode] = useState<string | null>(null)
  const [promoterId, setPromoterId] = useState<string | null>(null)

  const [shareEvent, setShareEvent] = useState<EventRow | null>(null)
  const { copied, copy } = useCopy()

  // payment-link generator state
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", numPeople: 1 })
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<{ url: string; amount: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [evRes, meRes] = await Promise.all([fetch("/api/events"), fetch("/api/auth/me")])
    if (meRes.ok) {
      const me = await meRes.json()
      setPromoterId(me.id)
      setPromoterCode(me.promoter_code ?? null)
    }
    if (evRes.ok) setEvents(await evRes.json())
    else setError("Please sign in to see your events.")
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const ref = promoterCode || promoterId || ""
  const cleanLink = (e: EventRow) => `${origin}/book/${e.id}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`

  const openShare = (e: EventRow) => {
    setShareEvent(e)
    setGuest({ name: "", phone: "", email: "", numPeople: 1 })
    setGenerated(null)
    setGenError(null)
  }

  const generatePaymentLink = async () => {
    if (!shareEvent) return
    setGenerating(true)
    setGenError(null)
    setGenerated(null)
    try {
      const res = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: shareEvent.id,
          name: guest.name,
          phone: guest.phone,
          email: guest.email,
          num_people: guest.numPeople,
          ref,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not generate link.")
      setGenerated({ url: body.payment_url, amount: body.amount })
    } catch (e: any) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this event? Its bookings will be removed too.")) return
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" })
    if (!res.ok) setError((await res.json()).error || "Could not delete event.")
    else setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const whatsapp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Events</h1>
          <p className="text-muted-foreground mt-2">Share a booking link or generate a payment link for a guest</p>
        </div>
        <Link href="/promoter/events/create">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Create New Event
          </Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${events.length} event${events.length === 1 ? "" : "s"}`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Event</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                  <TableHead className="text-foreground">Price</TableHead>
                  <TableHead className="text-foreground">Bookings</TableHead>
                  <TableHead className="text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{event.title}</TableCell>
                    <TableCell className="text-foreground whitespace-nowrap">
                      {new Date(event.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                    <TableCell className="text-foreground">₹{Number(event.ticket_price).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-foreground">{event.total_bookings ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => openShare(event)} className="bg-primary text-primary-foreground">
                          <Link2 className="w-4 h-4 mr-1" /> Links
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(event.id)}
                          className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                          aria-label="Delete event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No events yet. Create your first event to get a shareable booking link.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!shareEvent} onOpenChange={(o) => !o && setShareEvent(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{shareEvent?.title}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Share one link with everyone, or create a ready-to-pay link for a specific guest.
            </DialogDescription>
          </DialogHeader>

          {shareEvent && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              {/* Clean booking link */}
              <section className="space-y-2">
                <Label className="text-foreground">Public booking link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={cleanLink(shareEvent)} className="bg-input border-border text-foreground" />
                  <Button variant="outline" onClick={() => copy("clean", cleanLink(shareEvent))} aria-label="Copy booking link">
                    {copied === "clean" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <a
                    href={whatsapp(`Book tickets for ${shareEvent.title}: ${cleanLink(shareEvent)}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" aria-label="Share on WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Guests pick their ticket count and pay. Bookings are credited to you.
                </p>
              </section>

              <hr className="border-border" />

              {/* Per-guest payment link */}
              <section className="space-y-3">
                <Label className="text-foreground">Payment link for a guest</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Guest name"
                    value={guest.name}
                    onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                  <Input
                    placeholder="Phone"
                    type="tel"
                    value={guest.phone}
                    onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={guest.email}
                    onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                    className="bg-input border-border text-foreground"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={guest.numPeople}
                    onChange={(e) => setGuest({ ...guest, numPeople: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: ₹{(Number(shareEvent.ticket_price) * guest.numPeople).toLocaleString("en-IN")}
                </p>
                <Button
                  onClick={generatePaymentLink}
                  disabled={generating || !guest.name || guest.phone.replace(/\D/g, "").length < 10}
                  className="bg-primary text-primary-foreground"
                >
                  {generating ? "Generating…" : "Generate payment link"}
                </Button>
                {genError && <p className="text-sm text-red-600">{genError}</p>}
                {generated && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm text-foreground">
                      Link ready · ₹{generated.amount.toLocaleString("en-IN")}
                    </p>
                    <div className="flex gap-2">
                      <Input readOnly value={generated.url} className="bg-input border-border text-foreground" />
                      <Button variant="outline" onClick={() => copy("pay", generated.url)} aria-label="Copy payment link">
                        {copied === "pay" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <a
                        href={whatsapp(`Hi ${guest.name}, pay ₹${generated.amount} to confirm your tickets for ${shareEvent.title}: ${generated.url}`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" aria-label="Send on WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
