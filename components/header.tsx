"use client"

import Link from "next/link"

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between p-6">
      {/* Placeholder for a potential logo or left-aligned content */}
      <div className="w-20"></div>

       {/* Navigation */}
       <nav className="flex items-center space-x-2">
        <a
          href="/login"
          className="text-white/80 hover:text-white text-base font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
        > 
         Venue
         </a>
        <a
          href="/audience-booking"
          className="text-white/80 hover:text-white text-base font-light px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
        >
         Audience
        </a>
      </nav>
      <div id="gooey-btn" className="relative flex items-center group" style={{ filter: "url(#gooey-filter)" }}>
        <Link
          href="/login"
          className="absolute right-0 px-2.5 py-2 rounded-full bg-white text-black font-normal text-xs transition-all duration-300 hover:bg-white/90 cursor-pointer h-8 flex items-center justify-center -translate-x-10 group-hover:-translate-x-19 z-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </Link>
        <Link
          href="/login"
          className="px-6 py-2 rounded-full bg-white text-black font-normal text-xs transition-all duration-300 hover:bg-white/90 cursor-pointer h-8 flex items-center z-10"
        >
          Login
        </Link>
      </div>
    </header>
  )
}
