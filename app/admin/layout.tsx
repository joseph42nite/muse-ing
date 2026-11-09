import type React from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/server/auth"
import AdminShell from "./admin-shell"

export const metadata: Metadata = { title: "Admin · Muse-ing", robots: { index: false, follow: false } }

// Sends signed-out users and non-admins to /login on first load. Layouts don't re-run on
// client navigation, so the real gate is the admin API routes, which return 403, and
// useAdminData, which redirects when they do.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin")
  if (!user) redirect("/login")
  return <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>
}
