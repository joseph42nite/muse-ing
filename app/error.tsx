"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log unexpected runtime errors for production observability
    console.error("Runtime exception caught by boundary:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#181615] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <span className="instrument text-6xl sm:text-7xl font-normal leading-none mb-3">
        <span className="text-[#181615]">m</span>
        <span className="text-[#D92323]">-</span>
      </span>
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#181615] mb-2">
        Something unexpected happened
      </h1>
      <p className="text-xs sm:text-sm text-[#181615]/70 max-w-sm mb-6 leading-relaxed">
        We hit a temporary static glitch while tuning the soundstage. Try refreshing the setlist or heading back to home.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-full bg-[#D92323] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#b81b1b] transition-colors cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-[#181615] text-[#F4EFE6] text-xs font-semibold uppercase tracking-wider hover:bg-black transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
