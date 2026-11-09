import type { Metadata } from "next"

export const metadata: Metadata = { title: "Venue | Muse-ing", robots: { index: false } }

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  return children
}
