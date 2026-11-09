"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageHeader } from "./admin-table"
import { ArtistPaymentsDialog } from "./artist-payments-dialog"
import { dateTime, inr, useAdminData } from "./use-admin-data"

interface Stats {
  totals: {
    events: number
    revenue: number
    promoters: number
    venues: number
    artists: number
    pendingRefunds: number
    inquiries: number
  }
  monthly: { month: string; events: number; revenue: number; refunds: number }[]
  payments: Payments
}
interface Bucket {
  count: number
  amount: number
}
interface Payments {
  reconciles: boolean
  totals: {
    gigs: number
    played: number
    upcoming: number
    cancelled: number
    total_fees: number
    paid: Bucket
    paid_fees: number
    advances: number
    advances_open: number
    due: Bucket
    due_now: Bucket
    due_upcoming: Bucket
  }
  byArtist: {
    artist_id: string
    artist_name: string | null
    gigs: number
    paid: Bucket
    due: Bucket
    due_now: Bucket
    oldest_due: string | null
  }[]
  byVenue: { venue_id: string; venue_name: string; gigs: number; total_fees: number; paid: number; due: number }[]
  byMonth: { month: string; gigs: number; total_fees: number; paid: number; due: number }[]
}
interface Gig {
  id: string
  title: string
  date: string
  artist_name: string | null
  location_name: string | null
  venue_name: string | null
  clashes: string[]
}

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })

const CREAM = "#F4EFE6"
const RED = "#D92323"
const axis = { stroke: "rgba(244,239,230,0.45)", fontSize: 11, tickLine: false, axisLine: false }
const tooltip = {
  contentStyle: { background: "#121014", border: "1px solid rgba(244,239,230,0.15)", borderRadius: 12, color: CREAM },
  labelStyle: { color: CREAM },
  cursor: { fill: "rgba(244,239,230,0.05)" },
}

export default function AdminOverview() {
  const { data, error, loading, reload } = useAdminData<Stats>("/api/admin/stats")
  const [paying, setPaying] = useState<{ id: string; name: string } | null>(null)
  const { data: schedule } = useAdminData<Gig[]>("/api/admin/schedule")

  if (error) return <p className="text-[#ff7a7a]">Couldn&apos;t load the overview: {error}</p>
  if (loading && !data) return <p className="micro text-[#F4EFE6]/50">Loading…</p>
  if (!data) return null

  const t = data.totals
  const stats: { label: string; value: string; href: string; alert?: boolean }[] = [
    { label: "Events", value: String(t.events), href: "/admin/events" },
    { label: "Revenue", value: inr(t.revenue), href: "/admin/transactions" },
    { label: "Artists", value: String(t.artists), href: "/admin/artists" },
    { label: "Venues", value: String(t.venues), href: "/admin/venues" },
    { label: "Promoters", value: String(t.promoters), href: "/admin/promoters" },
    { label: "Pending refunds", value: String(t.pendingRefunds), href: "/admin/refunds", alert: t.pendingRefunds > 0 },
    { label: "Inquiries", value: String(t.inquiries), href: "/admin/inquiries" },
  ]
  const monthly = data.monthly.map((m) => ({ ...m, month: monthLabel(m.month) }))
  const week = Date.now() + 7 * 86400e3
  const soon = (schedule ?? []).filter((g) => new Date(g.date).getTime() < week)
  const issues = (schedule ?? []).filter((g) => g.clashes.length).length

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" subtitle="Gigs, money and requests across Muse-ing, live from the production database." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="admin-panel group block p-4 transition hover:border-[#F4EFE6]/45!">
            <p className="micro flex items-center justify-between text-[#F4EFE6]/50">
              {s.label}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </p>
            <p className={`title-x mt-3 text-[24px] ${s.alert ? "text-[#ff7a7a]!" : ""}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      <ArtistPaymentsSection p={data.payments} onOpen={setPaying} />
      <ArtistPaymentsDialog artist={paying} onClose={() => setPaying(null)} onChanged={() => void reload()} />

      <section className="admin-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="micro text-[#F4EFE6]">Next 7 days</h2>
          <div className="flex items-center gap-4">
            {issues > 0 && (
              <Link href="/admin/schedule" className="micro flex items-center gap-1.5 text-[#ff7a7a]">
                <AlertTriangle className="h-3.5 w-3.5" /> {issues} to check
              </Link>
            )}
            <Link href="/admin/schedule" className="micro text-[#F4EFE6]/55 hover:text-white">
              Full schedule
            </Link>
          </div>
        </div>
        {!schedule ? (
          <p className="micro text-[#F4EFE6]/50">Loading…</p>
        ) : !soon.length ? (
          <p className="fine text-[13px]!">No gigs in the next week.</p>
        ) : (
          <ul className="divide-y divide-white/[0.07]">
            {soon.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-[13px]">
                <span className="micro w-36 shrink-0 text-[#F4EFE6]/55">{dateTime(g.date)}</span>
                <span className="min-w-0 flex-1 font-medium">{g.title}</span>
                <span className={g.artist_name ? "text-[#F4EFE6]/75" : "text-[#ff7a7a]"}>{g.artist_name ?? "No artist"}</span>
                <span className="text-[#F4EFE6]/45">{g.location_name ?? g.venue_name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="admin-panel p-5 sm:p-6">
          <h2 className="micro text-[#F4EFE6]">Revenue</h2>
          <p className="fine mt-1">Paid tickets, dedications and tips, last six months</p>
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid vertical={false} stroke="rgba(244,239,230,0.07)" />
                <XAxis dataKey="month" {...axis} />
                <YAxis {...axis} width={56} tickFormatter={(v) => inr(Number(v))} />
                <Tooltip {...tooltip} formatter={(v) => inr(Number(v))} />
                <Bar dataKey="revenue" name="Revenue" fill={CREAM} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-panel p-5 sm:p-6">
          <h2 className="micro text-[#F4EFE6]">Events and refunds</h2>
          <p className="fine mt-1">
            <span className="text-[#F4EFE6]">━</span> events by month · <span className="text-[#ff7a7a]">━</span> refunded ₹
          </p>
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid vertical={false} stroke="rgba(244,239,230,0.07)" />
                <XAxis dataKey="month" {...axis} />
                <YAxis yAxisId="events" {...axis} allowDecimals={false} width={32} />
                <YAxis yAxisId="refunds" orientation="right" {...axis} width={56} />
                <Tooltip {...tooltip} cursor={{ stroke: "rgba(244,239,230,0.2)" }} />
                <Line yAxisId="events" type="monotone" dataKey="events" name="Events" stroke={CREAM} strokeWidth={2} dot={false} />
                <Line yAxisId="refunds" type="monotone" dataKey="refunds" name="Refunds (₹)" stroke={RED} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}

const istDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })

/** Gigs, what's been paid and what's still owed to artists, worked out from each gig's fee and status. */
function ArtistPaymentsSection({ p, onOpen }: { p: Payments; onOpen: (a: { id: string; name: string }) => void }) {
  const t = p.totals
  const owed = p.byArtist.filter((a) => a.due.count > 0)
  const months = p.byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))
  const cards = [
    { label: "Gigs", value: String(t.gigs), sub: `${t.played} played · ${t.upcoming} upcoming${t.cancelled ? ` · ${t.cancelled} cancelled` : ""}` },
    { label: "Paid to artists", value: inr(t.paid.amount), sub: `${t.paid.count} gigs paid${t.advances ? ` · ${inr(t.advances)} in advances` : ""}` },
    { label: "Due now", value: inr(t.due_now.amount), sub: `${t.due_now.count} played gigs unpaid`, alert: t.due_now.amount > 0 },
    { label: "Upcoming fees", value: inr(t.due_upcoming.amount), sub: `${t.due_upcoming.count} gigs still to play` },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="micro text-[#F4EFE6]">Artist payments</h2>
        <Link href="/admin/artists" className="micro text-[#F4EFE6]/55 hover:text-white">
          All artists
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="admin-panel p-4">
            <p className="micro text-[#F4EFE6]/50">{c.label}</p>
            <p className={`title-x mt-3 text-[22px] sm:text-[24px] ${c.alert ? "text-[#ff7a7a]!" : ""}`}>{c.value}</p>
            <p className="mt-1 text-[11.5px] text-[#F4EFE6]/50">{c.sub}</p>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-[#F4EFE6]/45">
        {t.gigs ? (
          <>
            Fees on {t.gigs} gigs {inr(t.total_fees)} = paid {inr(t.paid_fees)} + advances {inr(t.advances_open)} + due{" "}
            {inr(t.due.amount)}{" "}
            {p.reconciles ? (
              <span className="text-[#F4EFE6]/70">✓ adds up</span>
            ) : (
              <span className="text-[#ff7a7a]">✗ doesn&apos;t add up, check fees and advances</span>
            )}
          </>
        ) : (
          "Add a fee to a gig to start tracking artist payments."
        )}
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="admin-panel p-5 sm:p-6">
          <h3 className="micro text-[#F4EFE6]">Who we owe</h3>
          <p className="fine mt-1">Click an artist to change a gig to paid, advance paid, due or cancelled.</p>
          {!owed.length ? (
            <p className="fine mt-4 text-[13px]!">Everyone&apos;s paid up.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.07]">
              {owed.map((a) => (
                <li key={a.artist_id}>
                  <button
                    type="button"
                    onClick={() => onOpen({ id: a.artist_id, name: a.artist_name ?? "Artist" })}
                    className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3 text-left text-[13px] transition hover:bg-white/[0.03]"
                  >
                    <span className="min-w-0 flex-1 font-medium">{a.artist_name}</span>
                    <span className="text-[#F4EFE6]/50">
                      {a.due_now.count ? `${a.due_now.count} played since ${istDate(a.oldest_due!)}` : "Upcoming only"}
                      {a.due.count > a.due_now.count && a.due_now.count ? ` · ${a.due.count - a.due_now.count} upcoming` : ""}
                    </span>
                    <span className={`w-24 text-right font-semibold ${a.due_now.amount ? "text-[#ff7a7a]" : ""}`}>
                      {inr(a.due_now.amount || a.due.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel p-5 sm:p-6">
          <h3 className="micro text-[#F4EFE6]">By venue</h3>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="micro text-left text-[#F4EFE6]/45">
                <th className="py-2 font-normal">Venue</th>
                <th className="py-2 text-right font-normal">Gigs</th>
                <th className="py-2 text-right font-normal">Fees</th>
                <th className="py-2 text-right font-normal">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {p.byVenue.map((v) => (
                <tr key={v.venue_id}>
                  <td className="py-2.5 pr-3">{v.venue_name}</td>
                  <td className="py-2.5 text-right tabular-nums">{v.gigs}</td>
                  <td className="py-2.5 text-right tabular-nums">{inr(v.total_fees)}</td>
                  <td className={`py-2.5 text-right tabular-nums ${v.due ? "text-[#ff7a7a]" : "text-[#F4EFE6]/45"}`}>{inr(v.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {months.length > 0 && (
        <div className="admin-panel p-5 sm:p-6">
          <h3 className="micro text-[#F4EFE6]">Fees by month</h3>
          <p className="fine mt-1">
            <span className="text-[#F4EFE6]">■</span> paid · <span className="text-[#ff7a7a]">■</span> due, by the month the gig was played
          </p>
          <div className="mt-5 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid vertical={false} stroke="rgba(244,239,230,0.07)" />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={64} tickFormatter={(v) => inr(Number(v))} />
                <Tooltip {...tooltip} formatter={(v) => inr(Number(v))} />
                <Bar dataKey="paid" name="Paid" stackId="f" fill={CREAM} />
                <Bar dataKey="due" name="Due" stackId="f" fill={RED} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
