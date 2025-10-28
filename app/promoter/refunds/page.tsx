"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-700",
  approved: "bg-blue-500/20 text-blue-700",
  rejected: "bg-red-500/20 text-red-700",
  refunded: "bg-green-500/20 text-green-700",
}

export default function PromoterRefundsPage() {
  const [refundRequests, setRefundRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchRefundRequests = async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error("Error fetching user:", userError?.message)
        setError("User not authenticated.")
        setIsLoading(false)
        return
      }

      // Fetch events created by this promoter
      const { data: promoterEvents, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .eq("promoter_id", user.user?.id)

      if (eventsError) {
        console.error("Error fetching promoter events:", eventsError.message)
        setError("Error fetching promoter events.")
        setIsLoading(false)
        return
      }

      const eventIds = promoterEvents?.map((event) => event.id) || []

      if (eventIds.length === 0) {
        setRefundRequests([])
        setIsLoading(false)
        return
      }

      // Fetch refund requests for these events
      const { data: requests, error: refundsError } = await supabase
        .from("refund_requests")
        .select("*", { count: "exact" })
        .in("event_id", eventIds)

      if (refundsError) {
        console.error("Error fetching refund requests:", refundsError.message)
        setError("Error fetching refund requests.")
      } else {
        setRefundRequests(requests || [])
      }
      setIsLoading(false)
    }

    fetchRefundRequests()
  }, [supabase])

  if (isLoading) {
    return <div className="p-8">Loading refund requests...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Refund Requests</h1>
        <p className="text-muted-foreground mt-2">View refund requests for your events</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>My Event Refund Requests</CardTitle>
          <CardDescription>Review refund requests for events you promote</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Request ID</TableHead>
                  <TableHead className="text-foreground">User Email</TableHead>
                  <TableHead className="text-foreground">Event</TableHead>
                  <TableHead className="text-foreground">Amount</TableHead>
                  <TableHead className="text-foreground">Reason</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refundRequests.map((request) => (
                  <TableRow key={request.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{request.id.substring(0, 8)}...</TableCell>
                    <TableCell className="text-foreground">{request.user_email}</TableCell>
                    <TableCell className="text-foreground">{request.event_id.substring(0, 8)}...</TableCell>
                    <TableCell className="text-foreground font-semibold">₹{request.amount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{request.reason}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {refundRequests.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground mt-4">No refund requests found for your events.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
