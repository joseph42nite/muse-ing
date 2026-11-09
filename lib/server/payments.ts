import { all } from "./db"

/**
 * Artist gig payments, worked out live from events (never from stored rollups, which drift).
 *
 * The same rules as the Hyphening curation portal:
 *  - A gig counts once it has a fee or a payment status. Cancelled gigs are left out of the counts.
 *  - Due     = fee − advance, for gigs that aren't Paid or Cancelled (never below zero).
 *  - Paid out = the whole fee for Paid gigs, plus any advance handed over on the others.
 * On top of that, Muse splits what's due into "due now" (the gig has been played) and "upcoming".
 */

export const FEE_STATUSES = ["Pending", "Advance Paid", "Paid", "Cancelled"] as const
export type FeeStatus = (typeof FEE_STATUSES)[number]

export interface PaymentGig {
  id: string
  title: string
  date: string
  artist_id: string | null
  artist_name: string | null
  venue_id: string | null
  venue_name: string | null
  location_name: string | null
  artist_fee: number | null
  advance_paid: number | null
  fee_status: string | null
}

/** India calendar day, which is how "played" and months are judged. */
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60e3).toISOString().slice(0, 10)

export const isCancelled = (g: Pick<PaymentGig, "fee_status">) => g.fee_status === "Cancelled"
export const isPaid = (g: Pick<PaymentGig, "fee_status">) => g.fee_status === "Paid"
const money = (n: number | null | undefined) => (Number.isFinite(n as number) ? Math.max(0, Number(n)) : 0)

/** What's still owed on one gig. */
export const dueOn = (g: Pick<PaymentGig, "fee_status" | "artist_fee" | "advance_paid">) =>
  isPaid(g) || isCancelled(g) ? 0 : Math.max(0, money(g.artist_fee) - money(g.advance_paid))

/** What's been handed to the artist for one gig. */
export const paidOn = (g: Pick<PaymentGig, "fee_status" | "artist_fee" | "advance_paid">) =>
  isPaid(g) ? money(g.artist_fee) : money(g.advance_paid)

export function paymentGigs(artistId?: string): PaymentGig[] {
  return all<PaymentGig>(
    `SELECT e.id, e.title, e.date, e.artist_id, a.name AS artist_name, e.venue_id, v.name AS venue_name,
            e.location_name, e.artist_fee, e.advance_paid, e.fee_status
       FROM events e
       LEFT JOIN users a ON a.id = e.artist_id
       LEFT JOIN users v ON v.id = e.venue_id
      WHERE (e.artist_fee IS NOT NULL OR e.fee_status IS NOT NULL)
        AND (? IS NULL OR e.artist_id = ?)
      ORDER BY e.date`,
    artistId ?? null,
    artistId ?? null,
  )
}

interface Bucket {
  count: number
  amount: number
}
const bucket = (): Bucket => ({ count: 0, amount: 0 })

export interface ArtistPayments {
  artist_id: string
  artist_name: string | null
  gigs: number
  played: number
  upcoming: number
  paid: Bucket
  due: Bucket
  due_now: Bucket
  total_fees: number
  average_fee: number | null
  reliability: number | null
  oldest_due: string | null
  last_gig: string | null
  status: "All paid" | "Due" | "No gigs"
}

/** Totals plus breakdowns by artist, venue and month. `today` is an India date (YYYY-MM-DD). */
export function paymentSummary(gigs: PaymentGig[] = paymentGigs(), today = istDay(new Date().toISOString())) {
  const live = gigs.filter((g) => !isCancelled(g))
  const played = (g: PaymentGig) => istDay(g.date) <= today

  const totals = {
    gigs: live.length,
    played: live.filter(played).length,
    upcoming: live.filter((g) => !played(g)).length,
    cancelled: gigs.length - live.length,
    total_fees: 0,
    paid: bucket(), // Paid gigs; amount = everything handed over (fees + advances)
    advances: 0,
    paid_fees: 0, // fees of Paid gigs
    advances_open: 0, // advances already given on gigs that are still due (capped at the fee)
    due: bucket(), // every unpaid gig
    due_now: bucket(), // unpaid and already played
    due_upcoming: bucket(), // unpaid and still to come
  }
  for (const g of gigs) {
    const out = paidOn(g)
    totals.paid.amount += out
    if (!isPaid(g)) totals.advances += out
    if (isCancelled(g)) continue
    totals.total_fees += money(g.artist_fee)
    if (isPaid(g)) {
      totals.paid.count++
      totals.paid_fees += money(g.artist_fee)
      continue
    }
    totals.advances_open += Math.min(money(g.advance_paid), money(g.artist_fee))
    const d = dueOn(g)
    totals.due.count++
    totals.due.amount += d
    const b = played(g) ? totals.due_now : totals.due_upcoming
    b.count++
    b.amount += d
  }

  const artists = new Map<string, ArtistPayments & { paidFees: number[] }>()
  for (const g of gigs) {
    if (!g.artist_id) continue
    let a = artists.get(g.artist_id)
    if (!a) {
      a = {
        artist_id: g.artist_id,
        artist_name: g.artist_name,
        gigs: 0,
        played: 0,
        upcoming: 0,
        paid: bucket(),
        due: bucket(),
        due_now: bucket(),
        total_fees: 0,
        average_fee: null,
        reliability: null,
        oldest_due: null,
        last_gig: null,
        status: "No gigs",
        paidFees: [],
      }
      artists.set(g.artist_id, a)
    }
    a.paid.amount += paidOn(g)
    if (isCancelled(g)) continue
    a.gigs++
    a.total_fees += money(g.artist_fee)
    if (played(g)) {
      a.played++
      if (!a.last_gig || g.date > a.last_gig) a.last_gig = g.date
    } else a.upcoming++
    if (isPaid(g)) {
      a.paid.count++
      a.paidFees.push(money(g.artist_fee))
      continue
    }
    const d = dueOn(g)
    a.due.count++
    a.due.amount += d
    if (played(g)) {
      a.due_now.count++
      a.due_now.amount += d
      if (!a.oldest_due || g.date < a.oldest_due) a.oldest_due = g.date
    }
  }
  const byArtist: ArtistPayments[] = [...artists.values()].map(({ paidFees, ...a }) => ({
    ...a,
    average_fee: paidFees.length ? Math.round(paidFees.reduce((s, f) => s + f, 0) / paidFees.length) : null,
    reliability: a.gigs ? Math.round((a.paid.count / a.gigs) * 100) : null,
    status: a.gigs === 0 ? "No gigs" : a.due.count ? "Due" : "All paid",
  }))

  const venues = new Map<string, { venue_id: string; venue_name: string; gigs: number; total_fees: number; paid: number; due: number }>()
  const months = new Map<string, { month: string; gigs: number; total_fees: number; paid: number; due: number }>()
  for (const g of live) {
    const key = g.venue_id ?? `loc:${g.location_name ?? "—"}`
    const v = venues.get(key) ?? { venue_id: key, venue_name: g.venue_name ?? g.location_name ?? "No venue", gigs: 0, total_fees: 0, paid: 0, due: 0 }
    const m = istDay(g.date).slice(0, 7)
    const mo = months.get(m) ?? { month: m, gigs: 0, total_fees: 0, paid: 0, due: 0 }
    for (const r of [v, mo]) {
      r.gigs++
      r.total_fees += money(g.artist_fee)
      r.paid += paidOn(g)
      r.due += dueOn(g)
    }
    venues.set(key, v)
    months.set(m, mo)
  }

  return {
    // Every rupee of fees is either paid, advanced, or due. The overview shows this check.
    reconciles: Math.abs(totals.total_fees - (totals.paid_fees + totals.advances_open + totals.due.amount)) < 0.01,
    totals,
    byArtist: byArtist.sort((x, y) => y.due_now.amount - x.due_now.amount || y.due.amount - x.due.amount),
    byVenue: [...venues.values()].sort((x, y) => y.gigs - x.gigs),
    byMonth: [...months.values()].sort((x, y) => x.month.localeCompare(y.month)),
  }
}
