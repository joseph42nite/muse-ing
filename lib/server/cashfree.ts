// Minimal Cashfree Payment Links client (no SDK).
// Docs: https://docs.cashfree.com/reference/pgcreatepaymentlink
import crypto from "node:crypto"

const API_VERSION = "2023-08-01"

export class CashfreeConfigError extends Error {}

function creds() {
  const id = process.env.CASHFREE_APP_ID
  const secret = process.env.CASHFREE_SECRET_KEY
  if (!id || !secret) {
    throw new CashfreeConfigError("Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.")
  }
  return { id, secret }
}

function baseUrl() {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg"
}

async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { id, secret } = creds()
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": id,
      "x-client-secret": secret,
    },
    body: init.json ? JSON.stringify(init.json) : undefined,
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Cashfree error (${res.status})`)
  return body
}

export interface PaymentLink {
  link_id: string
  link_url: string
  link_status: string // ACTIVE | PAID | PARTIALLY_PAID | EXPIRED | CANCELLED
}

export interface CreatePaymentLinkInput {
  linkId: string
  amountInr: number
  purpose: string
  customer: { name: string; phone: string; email?: string }
  returnUrl: string
  notifyUrl?: string
  expiresInMinutes?: number
}

export async function createPaymentLink(i: CreatePaymentLinkInput): Promise<PaymentLink> {
  const expiry = new Date(Date.now() + (i.expiresInMinutes ?? 24 * 60) * 60e3).toISOString()
  return call("/links", {
    method: "POST",
    json: {
      link_id: i.linkId,
      link_amount: Number(i.amountInr.toFixed(2)),
      link_currency: "INR",
      link_purpose: i.purpose.slice(0, 500),
      customer_details: {
        customer_name: i.customer.name,
        customer_phone: i.customer.phone,
        ...(i.customer.email ? { customer_email: i.customer.email } : {}),
      },
      link_partial_payments: false,
      link_auto_reminders: false,
      link_notify: { send_sms: false, send_email: false },
      link_expiry_time: expiry,
      link_meta: { return_url: i.returnUrl, ...(i.notifyUrl ? { notify_url: i.notifyUrl } : {}) },
    },
  })
}

export async function fetchPaymentLink(linkId: string): Promise<PaymentLink> {
  return call(`/links/${encodeURIComponent(linkId)}`)
}

/** Verifies the x-webhook-signature header: base64(HMAC-SHA256(timestamp + rawBody, secretKey)). */
export function verifyWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const { secret } = creds()
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Maps a Cashfree link status onto our booking payment_status (null = no change). */
export function bookingStatusFor(linkStatus: string): "paid" | "failed" | "cancelled" | null {
  switch (linkStatus?.toUpperCase()) {
    case "PAID":
      return "paid"
    case "EXPIRED":
      return "failed"
    case "CANCELLED":
      return "cancelled"
    default:
      return null
  }
}
