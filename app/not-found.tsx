import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#181615] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <span className="instrument text-7xl sm:text-8xl font-normal leading-none mb-4">
        <span className="text-[#181615]">404</span>
        <span className="text-[#D92323]">•</span>
      </span>
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#181615] mb-2">
        Page Not Found
      </h1>
      <p className="text-xs sm:text-sm text-[#181615]/70 max-w-sm mb-6 leading-relaxed">
        The setlist or page you are looking for isn&apos;t on stage right now. Return to the main stage to explore live gigs.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full bg-[#181615] text-[#F4EFE6] text-xs font-semibold uppercase tracking-wider hover:bg-[#D92323] transition-colors"
      >
        Back to Home
      </Link>
    </div>
  )
}
