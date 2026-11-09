import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin sign in · Muse-ing", robots: { index: false, follow: false } }

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
