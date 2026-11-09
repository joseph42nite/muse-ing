import type { Metadata } from "next"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Muse-ing",
  description: "When Muse-ing refunds tickets, dedications and tips, and how long refunds take.",
}

export default function RefundsPage() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="lede">
        This policy covers payments made on {LEGAL.brand} for gig tickets, song dedications and tips to artists. We
        sell access to live events and gifts to artists; no physical goods are shipped.
      </p>

      <h2>1. Event tickets</h2>
      <ul>
        <li>
          <strong>Event cancelled by the organiser:</strong> you get a full refund of the ticket price, automatically,
          to your original payment method.
        </li>
        <li>
          <strong>Event postponed or materially changed</strong> (new date, venue or headline artist): your ticket is
          valid for the new date, or you can ask for a full refund within 7 days of the change being announced.
        </li>
        <li>
          <strong>Cancellation by you:</strong> you can cancel up to 48 hours before the event start time for a full
          refund. Within 48 hours of the start, tickets are non-refundable.
        </li>
        <li>
          Missing the event, arriving late, or being refused entry for breaking the venue&rsquo;s rules does not
          qualify for a refund.
        </li>
      </ul>

      <h2>2. Song dedications</h2>
      <ul>
        <li>
          If the artist ends the set without performing your dedicated song, you can ask for a full refund of the
          dedication within 7 days of the gig.
        </li>
        <li>Once the dedicated song has been performed, the dedication is non-refundable.</li>
      </ul>

      <h2>3. Tips</h2>
      <p>
        Tips are voluntary gifts to the artist and are non-refundable, except where you were charged more than once or
        charged an amount you did not authorise.
      </p>

      <h2>4. Failed and duplicate payments</h2>
      <p>
        If money left your account but the booking or payment shows as failed, it is normally reversed automatically by
        your bank or Cashfree within 5&ndash;7 working days. If you were charged twice for the same thing, write to us
        and we will refund the duplicate in full.
      </p>

      <h2>5. How to request a refund</h2>
      <p>
        Email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> with the phone number used for the booking, the event
        name and date, and the reason. We reply within 2 working days.
      </p>

      <h2>6. When you get your money</h2>
      <p>
        Approved refunds are issued to the original payment method within 5&ndash;7 working days of approval. Your bank
        may take a few more days to show it. Refunds are made in Indian Rupees, for the amount you paid.
      </p>

      <h2>7. Questions</h2>
      <p>
        Reach us at <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> or {LEGAL.phone}, {LEGAL.hours}.
      </p>
    </>
  )
}
