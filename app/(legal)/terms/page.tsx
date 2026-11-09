import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Terms & Conditions | Muse-ing",
  description: "The terms for using Muse-ing to book gigs, request songs, send dedications and tip artists.",
}

export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="lede">
        These terms govern your use of the {LEGAL.brand} website and services, operated by {LEGAL.legalName}{" "}
        (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By booking a ticket, making a payment or
        using any part of the service you agree to them.
      </p>

      <h2>1. What Muse-ing does</h2>
      <p>
        {LEGAL.brand} is a platform for live music. Audiences use it to discover gigs, buy tickets, vote on and request
        songs, send paid dedications and tip performing artists. Artists, promoters and venues use it to run events,
        manage setlists and check guests in. Events are organised and performed by independent artists, promoters and
        venues; {LEGAL.brand} provides the platform and collects payments on their behalf.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <ul>
        <li>You must be at least 18 years old, or use the service with the consent of a parent or guardian.</li>
        <li>
          Artist, promoter and venue accounts must give accurate details and keep their login credentials secure. You
          are responsible for activity on your account.
        </li>
        <li>We may suspend or close accounts that break these terms or the law.</li>
      </ul>

      <h2>3. Tickets and bookings</h2>
      <ul>
        <li>
          A booking is confirmed only once payment succeeds. Your phone number is your ticket: show it at the venue to
          be checked in.
        </li>
        <li>
          Prices are listed in Indian Rupees (₹) and include applicable taxes unless stated otherwise. The amount shown
          at checkout is the amount you pay.
        </li>
        <li>
          Entry is subject to the venue&rsquo;s own rules, including age limits, dress code and capacity. The venue
          may refuse entry for safety or conduct reasons.
        </li>
        <li>Tickets are personal and may not be resold for profit.</li>
      </ul>

      <h2>4. Song requests, dedications and tips</h2>
      <ul>
        <li>
          Song requests and votes are suggestions. The artist decides what is performed and in what order; a request or
          vote does not guarantee a song is played.
        </li>
        <li>
          A paid dedication moves your chosen song up the artist&rsquo;s queue. If the artist ends the set without
          performing it, see our <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
        </li>
        <li>
          Tips are voluntary gifts to the artist and are not payment for any specific service. Dedication messages
          must not be abusive, hateful, obscene or unlawful; artists may skip messages that are.
        </li>
      </ul>

      <h2>5. Payments</h2>
      <p>
        Payments are processed by our payment partner, Cashfree Payments, using UPI, cards, net banking or wallets.
        We do not see or store your card or bank details. {LEGAL.brand} retains a platform fee from each ticket, tip
        and dedication and passes the rest to the promoter or artist. If a payment fails but money leaves your
        account, it is normally reversed by your bank or the payment partner within 5&ndash;7 working days.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the service for anything unlawful, fraudulent or harmful;</li>
        <li>harass artists, venue staff or other guests, on the platform or at an event;</li>
        <li>interfere with the service, scrape it, or try to access accounts or data that are not yours;</li>
        <li>upload content you do not have the right to share.</li>
      </ul>

      <h2>7. Content and intellectual property</h2>
      <p>
        The {LEGAL.brand} name, logo, design and software belong to us. Song titles, lyrics and recordings belong to
        their respective rights holders and are shown for reference during performances. Artists keep the rights to
        their own profiles and content and allow us to display them on the platform.
      </p>

      <h2>8. Liability</h2>
      <p>
        We work to keep the service available and accurate but provide it &ldquo;as is&rdquo;. Artists, promoters and
        venues are responsible for their events, including their safety and the quality of performances. To the
        extent the law allows, our total liability for any claim is limited to the amount you paid us for the
        booking or payment concerned. Nothing in these terms limits rights you have under the Consumer Protection
        Act, 2019.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. The date at the bottom of this page shows when they last changed; continuing to
        use the service after a change means you accept the updated terms.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the
        courts in {LEGAL.jurisdiction}.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, or see{" "}
        <Link href="/contact">Contact Us</Link>.
      </p>
    </>
  )
}
