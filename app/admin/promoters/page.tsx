"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Edit, Trash2, Plus } from "lucide-react"

// Mock data
const promoters = [
  {
    id: "1",
    companyName: "Live Events Co",
    contactEmail: "contact@liveevents.com",
    phone: "+91-9876543210",
    city: "Mumbai",
    status: "active",
  },
  {
    id: "2",
    companyName: "Festival Productions",
    contactEmail: "info@festival.com",
    phone: "+91-9876543211",
    city: "Delhi",
    status: "active",
  },
  {
    id: "3",
    companyName: "Concert Masters",
    contactEmail: "hello@concertmasters.com",
    phone: "+91-9876543212",
    city: "Bangalore",
    status: "inactive",
  },
]

const statusColors = {
  active: "bg-green-500/20 text-green-700",
  inactive: "bg-gray-500/20 text-gray-700",
  suspended: "bg-red-500/20 text-red-700",
}

export default function PromotersPage() {
  const [showDialog, setShowDialog] = useState(false)
  const [editingPromoter, setEditingPromoter] = useState<(typeof promoters)[0] | null>(null)
  const [formData, setFormData] = useState({
    companyName: "",
    contactEmail: "",
    phone: "",
    city: "",
    state: "",
    country: "",
  })

  const handleOpenDialog = (promoter?: (typeof promoters)[0]) => {
    if (promoter) {
      setEditingPromoter(promoter)
      setFormData({
        companyName: promoter.companyName,
        contactEmail: promoter.contactEmail,
        phone: promoter.phone,
        city: promoter.city,
        state: "",
        country: "",
      })
    } else {
      setEditingPromoter(null)
      setFormData({
        companyName: "",
        contactEmail: "",
        phone: "",
        city: "",
        state: "",
        country: "",
      })
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    // TODO: Implement API call to save promoter
    console.log("[v0] Saving promoter:", formData)
    setShowDialog(false)
  }

  const handleDelete = async (id: string) => {
    // TODO: Implement API call to delete promoter
    console.log("[v0] Deleting promoter:", id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promoters</h1>
          <p className="text-muted-foreground mt-2">Manage event promoters and their information</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Promoter
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>All Promoters</CardTitle>
          <CardDescription>View and manage all registered promoters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Company Name</TableHead>
                  <TableHead className="text-foreground">Email</TableHead>
                  <TableHead className="text-foreground">Phone</TableHead>
                  <TableHead className="text-foreground">City</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoters.map((promoter) => (
                  <TableRow key={promoter.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium">{promoter.companyName}</TableCell>
                    <TableCell className="text-foreground">{promoter.contactEmail}</TableCell>
                    <TableCell className="text-foreground">{promoter.phone}</TableCell>
                    <TableCell className="text-foreground">{promoter.city}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[promoter.status as keyof typeof statusColors]}>
                        {promoter.status.charAt(0).toUpperCase() + promoter.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(promoter)}
                          className="text-foreground border-border hover:bg-muted"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(promoter.id)}
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
            <DialogTitle className="text-foreground">
              {editingPromoter ? "Edit Promoter" : "Add New Promoter"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingPromoter ? "Update promoter information" : "Add a new event promoter to the platform"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="companyName" className="text-foreground">
                Company Name
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Enter email"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-foreground">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Enter phone number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-foreground">
                  City
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-input border-border text-foreground mt-1"
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="state" className="text-foreground">
                  State
                </Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="bg-input border-border text-foreground mt-1"
                  placeholder="State"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="country" className="text-foreground">
                Country
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Country"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
              {editingPromoter ? "Update" : "Add"} Promoter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
