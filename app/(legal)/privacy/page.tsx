import type { Metadata } from "next"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Privacy Policy — Muse-ing",
  description: "What personal data Muse-ing collects, why, who it is shared with and how to reach us about it.",
}

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="lede">
        This policy explains what personal data {LEGAL.legalName} collects through {LEGAL.brand}, how we use it and
        the choices you have. It is written to meet the Digital Personal Data Protection Act, 2023 and the
        Information Technology Act, 2000 and its rules.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Audiences:</strong> your name, phone number and (optionally) email when you book a ticket or pay for
          a tip or dedication; song requests, votes and dedication messages you send during a gig.
        </li>
        <li>
          <strong>Artists, promoters and venues:</strong> name, email, phone, social handles, profile details and the
          bank or UPI details needed to pay you.
        </li>
        <li>
          <strong>Payments:</strong> the amount, status and reference of each transaction. Card, UPI PIN and bank
          login details are entered on Cashfree&rsquo;s secure pages and never reach us.
        </li>
        <li>
          <strong>Technical data:</strong> basic logs (IP address, browser, pages requested) and cookies needed to
          keep you signed in.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>to confirm bookings and check you in at the venue;</li>
        <li>to process payments, refunds and payouts to artists and promoters;</li>
        <li>to show your requests and dedications to the artist during the gig;</li>
        <li>to send you messages about your booking, such as confirmations or event changes;</li>
        <li>to prevent fraud, keep the service secure and meet legal and tax obligations.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2>3. Who we share it with</h2>
      <ul>
        <li>
          <strong>The event&rsquo;s promoter and venue</strong>, who see the guest list (name and phone) for check-in.
        </li>
        <li>
          <strong>The artist</strong>, who sees your name, requests and dedication messages during their set.
        </li>
        <li>
          <strong>Cashfree Payments</strong>, our payment partner, to process your payment.
        </li>
        <li>
          <strong>Service providers</strong> that host the site or help us run it, under confidentiality obligations.
        </li>
        <li>
          <strong>Authorities</strong>, when required by law or to protect safety and prevent fraud.
        </li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        We use only essential cookies, to keep you signed in and remember basic preferences. We do not use advertising
        or tracking cookies.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep booking and payment records for as long as tax and accounting law requires (generally up to 8 years).
        Other data is kept while your account is active or as long as needed for the purpose it was collected, then
        deleted or anonymised.
      </p>

      <h2>6. Security</h2>
      <p>
        Data is sent over encrypted connections (HTTPS), passwords are stored hashed, and access to personal data is
        limited to people who need it. No system is perfectly secure, but we will notify you and the authorities as
        the law requires if a breach affects your data.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You can ask to see the personal data we hold about you, correct it, or have it erased (subject to records we
        must keep by law), and you can withdraw consent at any time. Email us at{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> and we will respond within 30 days.
      </p>

      <h2>8. Children</h2>
      <p>
        {LEGAL.brand} is not intended for children under 18 without a parent&rsquo;s or guardian&rsquo;s consent, and
        we do not knowingly collect their data otherwise.
      </p>

      <h2>9. Grievance Officer</h2>
      <p>
        For any concern about your data, contact our Grievance Officer at{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> or {LEGAL.phone}, {LEGAL.address}. We acknowledge
        complaints within 48 hours and resolve them within 30 days.
      </p>

      <h2>10. Changes</h2>
      <p>We may update this policy; the date at the bottom of the page shows when it last changed.</p>
    </>
  )
}
