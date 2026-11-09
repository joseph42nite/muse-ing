/**
 * Direct UPI payment links (no gateway), modelled on https://github.com/iamrobinsharaya/upipay.
 *
 * - `generateUPIQR` builds an NPCI `upi://pay` URI; `mode=04` asks the app to lock the amount.
 * - `buildIntentLinks` turns it into deep links for Google Pay, PhonePe, Paytm and BHIM.
 *
 * A direct UPI transfer sends no confirmation back to us, so payments made this way can't be
 * verified server-side.
 */

export interface GenerateUPIQROptions {
  /** Artist's Virtual Payment Address (e.g. "arjunmehta@ybl") */
  vpa: string
  /** Payee / Account holder name displayed in UPI apps */
  name: string
  /** Exact INR amount to lock (e.g. 50.00) */
  amount: number
  /** Unique Order / Transaction ID (`tr`) */
  orderId: string
  /** Transaction note (`tn`) */
  note?: string
  /** Merchant Category Code (`mc`), optional */
  merchantCode?: string
  /** 'fixed' sets NPCI mode=04 so the user cannot edit the amount in their UPI app */
  mode?: "fixed" | "standard"
}

export interface UPIIntentLinks {
  upiUri: string
  gpay: string
  phonepe: string
  paytm: string
  bhim: string
}

export interface UPIQRResponse {
  upiUri: string
  orderId: string
  amount: number
  vpa: string
  payeeName: string
  intentLinks: UPIIntentLinks
}

/**
 * Constructs app-specific deep links (`buildIntentLinks` from iamrobinsharaya/upipay)
 * so mobile audience members can tap Google Pay, PhonePe, Paytm, or BHIM directly.
 */
export function buildIntentLinks(upiUri: string): UPIIntentLinks {
  const queryIndex = upiUri.indexOf("?")
  const queryString = queryIndex >= 0 ? upiUri.slice(queryIndex + 1) : ""

  return {
    upiUri,
    gpay: `tez://upi/pay?${queryString}`,
    phonepe: `phonepe://pay?${queryString}`,
    paytm: `paytmmp://pay?${queryString}`,
    bhim: `bhim://pay?${queryString}`,
  }
}

/**
 * Generates an NPCI-compliant UPI URI (`upi://pay?...&mode=04`) and deep links
 * (`generateUPIQR` from iamrobinsharaya/upipay).
 */
export function generateUPIQR(options: GenerateUPIQROptions): UPIQRResponse {
  const cleanVpa = (options.vpa || "").trim()
  const cleanName = (options.name || "Live Artist").trim()
  const amountFixed = Number(options.amount || 0).toFixed(2)
  const orderId = (options.orderId || `TXN_${Date.now()}`).trim()
  const note = (options.note || "Live Gig Payment").trim()
  const modeParam = options.mode === "standard" ? "00" : "04" // mode=04 locks amount per NPCI spec

  const params = new URLSearchParams()
  params.set("pa", cleanVpa)
  params.set("pn", cleanName)
  params.set("am", amountFixed)
  params.set("cu", "INR")
  params.set("tr", orderId)
  params.set("tn", note)
  if (options.merchantCode) {
    params.set("mc", options.merchantCode)
  }
  params.set("mode", modeParam)

  const upiUri = `upi://pay?${params.toString()}`
  const intentLinks = buildIntentLinks(upiUri)

  return {
    upiUri,
    orderId,
    amount: Number(amountFixed),
    vpa: cleanVpa,
    payeeName: cleanName,
    intentLinks,
  }
}
