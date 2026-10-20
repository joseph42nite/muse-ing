"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, XCircle, CreditCard } from "lucide-react"

// Mock data - replace with actual API calls
const refundRequests = [
  {
    id: "1",
    userName: "John Doe",
    event: "Summer Music Festival",
    amount: 2500,
    status: "pending",
    reason: "Event cancelled",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    userName: "Jane Smith",
    event: "Tech Conference 2024",
    amount: 5000,
    status: "approved",
    reason: "Personal reasons",
    createdAt: "2024-01-14",
  },
  {
    id: "3",
    userName: "Mike Johnson",
    event: "Concert Night",
    amount: 1500,
    status: "rejected",
    reason: "Duplicate booking",
    createdAt: "2024-01-13",
  },
  {
    id: "4",
    userName: "Sarah Williams",
    event: "Art Exhibition",
    amount: 3000,
    status: "refunded",
    reason: "Event postponed",
    createdAt: "2024-01-12",
  },
]

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-700",
  approved: "bg-blue-500/20 text-blue-700",
  rejected: "bg-red-500/20 text-red-700",
  refunded: "bg-green-500/20 text-green-700",
}

export default function RefundsPage() {
  const [selectedRefund, setSelectedRefund] = useState<(typeof refundRequests)[0] | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [action, setAction] = useState<"approve" | "reject" | "refund" | null>(null)

  const handleAction = (refund: (typeof refundRequests)[0], actionType: "approve" | "reject" | "refund") => {
    setSelectedRefund(refund)
    setAction(actionType)
    setShowDialog(true)
  }

  const confirmAction = async () => {
    if (!selectedRefund || !action) return

    // TODO: Implement API calls for:
    // - Approve refund
    // - Reject refund
    // - Trigger Cashfree refund
    // - Trigger n8n workflow

    console.log(`[v0] ${action} refund:`, selectedRefund.id)
    setShowDialog(false)
    setSelectedRefund(null)
    setAction(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Refund Requests</h1>
        <p className="text-muted-foreground mt-2">Manage and process refund requests from users</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Pending Refunds</CardTitle>
          <CardDescription>Review and process refund requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">User Name</TableHead>
                  <TableHead className="text-foreground">Event</TableHead>
                  <TableHead className="text-foreground">Amount</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Reason</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                  <TableHead className="text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refundRequests.map((refund) => (
                  <TableRow key={refund.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{refund.userName}</TableCell>
                    <TableCell className="text-foreground">{refund.event}</TableCell>
                    <TableCell className="text-foreground font-semibold">₹{refund.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[refund.status as keyof typeof statusColors]}>
                        {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{refund.reason}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{refund.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {refund.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                              onClick={() => handleAction(refund, "approve")}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                              onClick={() => handleAction(refund, "reject")}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {refund.status === "approved" && (
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => handleAction(refund, "refund")}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Refund in Cashfree
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {action === "approve" && "Approve Refund Request?"}
              {action === "reject" && "Reject Refund Request?"}
              {action === "refund" && "Process Refund in Cashfree?"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {action === "approve" && "This will approve the refund request and prepare it for processing."}
              {action === "reject" && "This will reject the refund request. The user will be notified."}
              {action === "refund" && "This will trigger a refund in Cashfree and notify the user."}
            </DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-semibold text-foreground">{selectedRefund.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-foreground">₹{selectedRefund.amount.toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Event</p>
                  <p className="font-semibold text-foreground">{selectedRefund.event}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              className={action === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}
              onClick={confirmAction}
            >
              {action === "approve" && "Approve"}
              {action === "reject" && "Reject"}
              {action === "refund" && "Process Refund"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
