"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eye } from "lucide-react"

// Mock data
const transactions = [
  {
    id: "1",
    razorpayId: "pay_1234567890",
    userName: "John Doe",
    event: "Summer Music Festival",
    amount: 2500,
    currency: "INR",
    status: "captured",
    paymentMethod: "card",
    createdAt: "2024-01-15 10:30",
  },
  {
    id: "2",
    razorpayId: "pay_0987654321",
    userName: "Jane Smith",
    event: "Tech Conference 2024",
    amount: 5000,
    currency: "INR",
    status: "captured",
    paymentMethod: "upi",
    createdAt: "2024-01-14 14:20",
  },
  {
    id: "3",
    razorpayId: "pay_1111111111",
    userName: "Mike Johnson",
    event: "Concert Night",
    amount: 1500,
    currency: "INR",
    status: "refunded",
    paymentMethod: "card",
    createdAt: "2024-01-13 09:15",
  },
  {
    id: "4",
    razorpayId: "pay_2222222222",
    userName: "Sarah Williams",
    event: "Art Exhibition",
    amount: 3000,
    currency: "INR",
    status: "captured",
    paymentMethod: "netbanking",
    createdAt: "2024-01-12 16:45",
  },
  {
    id: "5",
    razorpayId: "pay_3333333333",
    userName: "Alex Brown",
    event: "Summer Music Festival",
    amount: 2500,
    currency: "INR",
    status: "failed",
    paymentMethod: "card",
    createdAt: "2024-01-11 11:00",
  },
]

const statusColors = {
  created: "bg-gray-500/20 text-gray-700",
  authorized: "bg-blue-500/20 text-blue-700",
  captured: "bg-green-500/20 text-green-700",
  failed: "bg-red-500/20 text-red-700",
  refunded: "bg-yellow-500/20 text-yellow-700",
}

const paymentMethodColors = {
  card: "bg-purple-500/20 text-purple-700",
  upi: "bg-orange-500/20 text-orange-700",
  netbanking: "bg-cyan-500/20 text-cyan-700",
  wallet: "bg-pink-500/20 text-pink-700",
}

export default function TransactionsPage() {
  const [selectedTransaction, setSelectedTransaction] = useState<(typeof transactions)[0] | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const handleViewDetails = (transaction: (typeof transactions)[0]) => {
    setSelectedTransaction(transaction)
    setShowDialog(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground mt-2">View all Razorpay transactions and payment details</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Complete transaction history from Razorpay</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Razorpay ID</TableHead>
                  <TableHead className="text-foreground">User</TableHead>
                  <TableHead className="text-foreground">Event</TableHead>
                  <TableHead className="text-foreground">Amount</TableHead>
                  <TableHead className="text-foreground">Payment Method</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Date</TableHead>
                  <TableHead className="text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-mono text-sm">{transaction.razorpayId}</TableCell>
                    <TableCell className="text-foreground">{transaction.userName}</TableCell>
                    <TableCell className="text-foreground">{transaction.event}</TableCell>
                    <TableCell className="text-foreground font-semibold">
                      ₹{transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={paymentMethodColors[transaction.paymentMethod as keyof typeof paymentMethodColors]}
                      >
                        {transaction.paymentMethod.charAt(0).toUpperCase() + transaction.paymentMethod.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[transaction.status as keyof typeof statusColors]}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transaction.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(transaction)}
                        className="text-foreground border-border hover:bg-muted"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Transaction Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Complete information about this transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Razorpay ID</p>
                  <p className="font-mono text-sm text-foreground break-all">{selectedTransaction.razorpayId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedTransaction.status as keyof typeof statusColors]}>
                    {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-semibold text-foreground">{selectedTransaction.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Event</p>
                  <p className="font-semibold text-foreground">{selectedTransaction.event}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold text-foreground">₹{selectedTransaction.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <Badge
                    className={
                      paymentMethodColors[selectedTransaction.paymentMethod as keyof typeof paymentMethodColors]
                    }
                  >
                    {selectedTransaction.paymentMethod.charAt(0).toUpperCase() +
                      selectedTransaction.paymentMethod.slice(1)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-semibold text-foreground">{selectedTransaction.createdAt}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">View in Razorpay</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
