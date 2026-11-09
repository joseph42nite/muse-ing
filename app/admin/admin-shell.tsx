"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Mic2,
  Building2,
  Users,
  CreditCard,
  RefreshCw,
  Inbox,
  Settings,
  TicketPercent,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import "./admin-noir.css"

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/admin/events", label: "Events", icon: Ticket },
  { href: "/admin/artists", label: "Artists", icon: Mic2 },
  { href: "/admin/venues", label: "Venues", icon: Building2 },
  { href: "/admin/promoters", label: "Promoters", icon: Users },
  { href: "/admin/transactions", label: "Transactions", icon: CreditCard },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/refunds", label: "Refunds", icon: RefreshCw },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export default function AdminShell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "micro flex items-center gap-3 rounded-full px-4 py-3 text-[10px]! transition",
              active ? "bg-[#F4EFE6] text-[#14100a]" : "text-[#F4EFE6]/65 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-xs text-[#F4EFE6]">{user.name}</p>
      <p className="truncate text-[11px] text-[#F4EFE6]/45">{user.email}</p>
      <button onClick={logout} className="micro mt-3 flex items-center gap-2 text-[#F4EFE6]/60 transition hover:text-white">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  )

  const brand = (
    <Link href="/admin" className="block">
      <span className="title-x block text-[26px]">M-</span>
      <span className="micro mt-1 block text-[#F4EFE6]/50">Muse-ing admin</span>
    </Link>
  )

  return (
    <div className="admin-noir">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between gap-8 glass-bar p-6 lg:flex">
        <div className="space-y-8">
          {brand}
          {links}
        </div>
        {footer}
      </aside>

      {/* Phone / tablet header */}
      <header className="sticky top-0 z-30 flex items-center justify-between glass-bar px-5 py-4 sm:px-8 lg:hidden">
        {brand}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFE6] text-[#14100a]"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[73px] z-20 flex flex-col justify-between gap-6 overflow-y-auto glass-thick rounded-none px-5 py-6 sm:px-8 lg:hidden">
          {links}
          {footer}
        </div>
      )}

      <main className="min-w-0 px-5 py-8 sm:px-8 lg:ml-60 lg:px-10 lg:py-10">{children}</main>
    </div>
  )
}
