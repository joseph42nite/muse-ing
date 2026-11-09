"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, LogOut, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import "@/app/admin/admin.css"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** Collapsible sidebar layout shared by the admin and promoter dashboards. */
export default function DashboardShell({
  title,
  navItems,
  children,
}: {
  title: string
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const rootHref = navItems[0]?.href

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <div className="flex h-screen" data-theme="light">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            {sidebarOpen && <h1 className="text-xl font-bold">{title}</h1>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-accent"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              // The dashboard root only matches itself, so it isn't highlighted on every sub-page
              const isActive =
                pathname === item.href || (item.href !== rootHref && pathname.startsWith(item.href + "/"))
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t">
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 hover:bg-accent">
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      <main className={cn("flex-1 overflow-auto transition-all duration-300", sidebarOpen ? "ml-64" : "ml-20")}>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
