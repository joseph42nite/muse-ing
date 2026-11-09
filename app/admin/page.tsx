"use client"

import Link from "next/link"
import { AlertTriangle, ArrowUpRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageHeader } from "./admin-table"
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
  const { data, error, loading } = useAdminData<Stats>("/api/admin/stats")
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
