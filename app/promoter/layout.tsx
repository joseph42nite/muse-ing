"use client"

import type React from "react"
import { LayoutDashboard, Calendar, Plus, RefreshCw, User } from "lucide-react"
import DashboardShell, { type NavItem } from "@/components/dashboard-shell"

const navItems: NavItem[] = [
  { href: "/promoter", label: "Dashboard", icon: LayoutDashboard },
  { href: "/promoter/events", label: "My Events", icon: Calendar },
  { href: "/promoter/events/create", label: "Create Event", icon: Plus },
  { href: "/promoter/refunds", label: "Refunds", icon: RefreshCw },
  { href: "/promoter/profile", label: "Profile", icon: User },
]

export default function PromoterLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Promoter" navItems={navItems}>
      {children}
    </DashboardShell>
  )
}
