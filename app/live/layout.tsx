import type { Metadata } from "next"

// The audience portal. Its share image is the sitewide app/opengraph-image.jpg.
const title = "Live Music | Muse-ing"
const description =
  "You're at a Muse-ing gig. Scan your table's QR code to request songs, vote the setlist up, and send the artist a dedication, all from your seat."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Muse-ing",
    locale: "en_IN",
    url: "/live",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return children
}
