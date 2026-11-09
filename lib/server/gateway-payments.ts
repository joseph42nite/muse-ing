// Tips and dedications collected through Cashfree instead of direct UPI to the artist.
//
// Flow: startGatewayPayment() makes a gateway_payments row and a Cashfree payment link. When Cashfree
// reports the link paid (webhook, or the live page asking on return), settleGatewayPayment() writes
// the artist_transactions row (status 'paid', payout_status 'owed') and, for a dedication, moves the
// song into Priority Dedications. The admin panel then pays the artist their share and marks it out.
import crypto from "node:crypto"
import { get, run, transaction } from "./db"
import { bookingStatusFor, CashfreeConfigError, createPaymentLink, fetchPaymentLink } from "./cashfree"
import { platformFeeFor, platformFeePercent, round2 } from "./settings"

export const DEDICATION_PRICE = 50
export const MIN_TIP = 10
export const MAX_TIP = 100000
const LINK_MINUTES = 60

export { platformFeeFor, platformFeePercent, round2 }

export type GatewayStatus = "created" | "paid" | "failed" | "cancelled"

export interface GatewayPayment {
  id: string
  kind: "tip" | "dedication"
  artist_id: string
  event_id: string | null
  request_id: string | null
  payer_name: string
  payer_phone: string
  amount: number
  platform_fee: number
  song_title: string | null
  note: string | null
  link_url: string | null
  status: GatewayStatus
  created_at: string
}

export interface StartInput {
  kind: "tip" | "dedication"
  artistId: string
  eventId: string
  requestId?: string | null
  payerName: string
  payerPhone: string
  amount: number
  songTitle?: string | null
  note?: string | null
  purpose: string
  origin: string
}

export type StartResult = { ok: true; id: string; payment_url: string } | { ok: false; error: string; status: number }

/**
 * Without Cashfree keys a development server hands out a local link that marks the payment paid,
 * so the whole flow can be tried. Production never does this.
 */
const devSimulation = () => process.env.NODE_ENV !== "production"

export async function startGatewayPayment(i: StartInput): Promise<StartResult> {
  // A dedication that already has an unexpired link reuses it, so a double tap can't charge twice.
  if (i.kind === "dedication" && i.requestId) {
    const open = get<{ id: string; link_url: string | null; created_at: string }>(
      `SELECT id, link_url, created_at FROM gateway_payments
        WHERE request_id = ? AND kind = 'dedication' AND status = 'created' AND payer_phone = ?
        ORDER BY created_at DESC LIMIT 1`,
      i.requestId,
      i.payerPhone,
    )
    if (open?.link_url && Date.now() - Date.parse(open.created_at) < (LINK_MINUTES - 5) * 60e3) {
      return { ok: true, id: open.id, payment_url: open.link_url }
    }
  }

  const id = `${i.kind === "tip" ? "tip" : "ded"}_${crypto.randomUUID().replace(/-/g, "")}`
  const amount = round2(i.amount)
  run(
    `INSERT INTO gateway_payments
      (id, kind, artist_id, event_id, request_id, payer_name, payer_phone, amount, platform_fee, song_title, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, i.kind, i.artistId, i.eventId, i.requestId ?? null, i.payerName, i.payerPhone, amount,
    platformFeeFor(amount), i.songTitle ?? null, i.note ?? null,
  )

  const returnUrl = `${i.origin}/live/${encodeURIComponent(i.eventId)}?payment=${id}`
  try {
    const link = await createPaymentLink({
      linkId: id,
      amountInr: amount,
      purpose: i.purpose,
      customer: { name: i.payerName, phone: i.payerPhone },
      returnUrl,
      notifyUrl: `${i.origin}/api/cashfree/webhook`,
      expiresInMinutes: LINK_MINUTES,
    })
    run("UPDATE gateway_payments SET link_url = ? WHERE id = ?", link.link_url, id)
    return { ok: true, id, payment_url: link.link_url }
  } catch (e) {
    if (e instanceof CashfreeConfigError && devSimulation()) {
      const url = `/api/payments/${id}/dev-pay` // relative: works whatever NEXT_PUBLIC_SITE_URL says
      run("UPDATE gateway_payments SET link_url = ? WHERE id = ?", url, id)
      return { ok: true, id, payment_url: url }
    }
    run("DELETE FROM gateway_payments WHERE id = ?", id) // don't leave an orphaned payment behind
    const message = e instanceof Error ? e.message : "Could not start the payment."
    return { ok: false, error: message, status: e instanceof CashfreeConfigError ? 503 : 502 }
  }
}

/**
 * Applies a Cashfree link status to a payment. Safe to call any number of times: the artist
 * transaction is written only on the first transition to paid.
 */
export function settleGatewayPayment(id: string, linkStatus: string): GatewayStatus | null {
  const p = get<GatewayPayment>("SELECT * FROM gateway_payments WHERE id = ?", id)
  if (!p) return null
  const next = bookingStatusFor(linkStatus)
  if (!next) return p.status

  return transaction(() => {
    if (next === "paid") {
      const r = run(
        "UPDATE gateway_payments SET status = 'paid', settled_at = ? WHERE id = ? AND status <> 'paid'",
        new Date().toISOString(),
        id,
      )
      if (!Number(r.changes)) return "paid"
      run(
        `INSERT INTO artist_transactions
          (id, artist_id, event_id, request_id, type, payer_name, payer_phone, amount, song_title, note,
           upi_order_id, provider, status, platform_fee, payout_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'cashfree', 'paid', ?, 'owed')`,
        crypto.randomUUID(), p.artist_id, p.event_id, p.request_id, p.kind, p.payer_name, p.payer_phone,
        p.amount, p.song_title, p.note, p.id, p.platform_fee,
      )
      if (p.kind === "dedication" && p.request_id) {
        run(
          "UPDATE song_requests SET wants_dedication = 1, dedication_payment_status = 'paid' WHERE id = ?",
          p.request_id,
        )
      }
      return "paid"
    }

    const r = run("UPDATE gateway_payments SET status = ?, settled_at = ? WHERE id = ? AND status = 'created'",
      next === "failed" ? "failed" : "cancelled", new Date().toISOString(), id)
    // An abandoned dedication goes back to unpaid so it can be paid again.
    if (Number(r.changes) && p.kind === "dedication" && p.request_id) {
      run(
        `UPDATE song_requests SET dedication_payment_status = 'none'
          WHERE id = ? AND dedication_payment_status = 'pending_gateway' AND payment_link_id = ?`,
        p.request_id,
        p.id,
      )
    }
    return get<{ status: GatewayStatus }>("SELECT status FROM gateway_payments WHERE id = ?", id)?.status ?? null
  })
}

/** Current state of a payment, asking Cashfree directly if the webhook hasn't settled it yet. */
export async function refreshGatewayPayment(id: string): Promise<GatewayPayment | null> {
  const p = get<GatewayPayment>("SELECT * FROM gateway_payments WHERE id = ?", id)
  if (!p) return null
  if (p.status === "created") {
    try {
      settleGatewayPayment(id, (await fetchPaymentLink(id)).link_status)
    } catch {
      /* keep it open; the webhook will settle it */
    }
  }
  return get<GatewayPayment>("SELECT * FROM gateway_payments WHERE id = ?", id) ?? null
}
