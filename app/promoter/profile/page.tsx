"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function PromoterProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    promoter_code: "",
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: authUser, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser.user) {
        setError("User not authenticated.")
        setIsLoading(false)
        router.push("/login")
        return
      }
      setUser(authUser.user)

      const { data: userDetails, error: fetchError } = await supabase
        .from("users")
        .select("name, email, phone, promoter_code")
        .eq("id", authUser.user.id)
        .single()

      if (fetchError) {
        setError("Error fetching profile data.")
        console.error(fetchError)
      } else if (userDetails) {
        setFormData({
          name: userDetails.name,
          email: userDetails.email,
          phone: userDetails.phone || "",
          promoter_code: userDetails.promoter_code || "",
        })
      }
      setIsLoading(false)
    }

    fetchUserProfile()
  }, [supabase, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    if (!user) {
      setError("User not authenticated.")
      setIsSaving(false)
      return
    }

    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: formData.name,
          phone: formData.phone,
          promoter_code: formData.promoter_code,
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      alert("Profile updated successfully!")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8">Loading profile...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your promoter profile information</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name, email, and contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-foreground">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                className="bg-input border-border text-foreground mt-1"
                readOnly
                disabled
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-foreground">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Your phone number"
              />
            </div>
            <div>
              <Label htmlFor="promoter_code" className="text-foreground">
                Promoter Code
              </Label>
              <Input
                id="promoter_code"
                type="text"
                value={formData.promoter_code}
                onChange={(e) => setFormData({ ...formData, promoter_code: e.target.value })}
                className="bg-input border-border text-foreground mt-1"
                placeholder="Your unique promoter code"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 justify-end">
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
