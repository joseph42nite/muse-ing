"use client"

import Link from "next/link"
import { Mic2, QrCode, Sparkles } from "lucide-react"

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-4 bg-black/35 backdrop-blur-xl border-b border-white/10">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-amber-400 flex items-center justify-center text-black font-bold text-sm">
          M
        </div>
        <span className="text-white font-medium tracking-tight text-lg">
          Muse<span className="italic font-light text-purple-300">-ing</span>
        </span>
      </Link>

      <nav className="hidden md:flex items-center space-x-2">
        <Link
          href="/#events-by-location"
          className="text-white/80 hover:text-white text-sm font-light px-3.5 py-2 rounded-full hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5"
        >
          <QrCode className="w-3.5 h-3.5 text-purple-300" />
          Live Events & Locations
        </Link>
        <Link
          href="/live?location=toit-indiranagar"
          className="text-white/80 hover:text-white text-sm font-light px-3.5 py-2 rounded-full hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Audience QR View
        </Link>
        <Link
          href="/artist"
          className="text-white/80 hover:text-white text-sm font-light px-3.5 py-2 rounded-full hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5"
        >
          <Mic2 className="w-3.5 h-3.5 text-emerald-300" />
          Artist Dashboard
        </Link>
      </nav>

      <div className="flex items-center gap-2.5">
        <Link
          href="/login"
          className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-normal text-xs transition-all duration-200 hover:bg-white/20 flex items-center gap-1.5"
        >
          <Mic2 className="w-3.5 h-3.5 text-purple-300" />
          Artist Login
        </Link>
      </div>
    </header>
  )
}
