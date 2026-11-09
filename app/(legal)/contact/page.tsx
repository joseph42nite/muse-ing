import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Contact Us — Muse-ing",
  description: "How to reach Muse-ing about bookings, payments, refunds or hosting a gig.",
}

export default function ContactPage() {
  const rows: [string, React.ReactNode][] = [
    ["Business name", LEGAL.legalName],
    ["Registered address", LEGAL.address],
    ["Email", <a key="e" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>],
    ["Phone", <a key="p" href={`tel:${LEGAL.phone.replace(/[^\d+]/g, "")}`}>{LEGAL.phone}</a>],
    ["Support hours", LEGAL.hours],
  ]
  return (
    <>
      <h1>Contact Us</h1>
      <p className="lede">
        Questions about a booking, a payment, a refund or hosting a gig? Get in touch and we&rsquo;ll reply within 2
        working days.
      </p>

      <dl className="mt-10 divide-y divide-white/10 border-y border-white/10">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
            <dt className="micro pt-1 text-[#F4EFE6]/50">{k}</dt>
            <dd className="text-[0.95rem] text-[#F4EFE6]">{v}</dd>
          </div>
        ))}
      </dl>

      <h2>For a refund</h2>
      <p>
        Include the phone number used for the booking, the event name and date. See the{" "}
        <Link href="/refunds">Refund &amp; Cancellation Policy</Link> for what qualifies.
      </p>

      <h2>Grievances</h2>
      <p>
        Complaints, including about your personal data, go to our Grievance Officer at the email above. We acknowledge
        them within 48 hours and resolve them within 30 days.
      </p>
    </>
  )
}
