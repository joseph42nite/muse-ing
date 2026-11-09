import { NextResponse, type NextRequest } from "next/server"

// admin.muse-ing.in serves the admin panel. admin.localhost works the same way in development.
const ADMIN_HOSTS = (process.env.ADMIN_HOSTS || "admin.muse-ing.in,admin.localhost")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)
// When set (e.g. https://admin.muse-ing.in), /admin on the main site redirects there.
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN?.replace(/\/$/, "")

const hostOf = (req: NextRequest) =>
  (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim().split(":")[0].toLowerCase()

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (!ADMIN_HOSTS.includes(hostOf(req))) {
    if (ADMIN_ORIGIN && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      return NextResponse.redirect(`${ADMIN_ORIGIN}${pathname}${search}`)
    }
    return NextResponse.next()
  }

  // Admin host
  // / and /login are rewritten to /admin and /admin-login in next.config.mjs (host-matched).
  if (pathname === "/" || pathname === "/login" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/") || pathname === "/admin-login") {
    const res = NextResponse.next()
    res.headers.set("X-Robots-Tag", "noindex, nofollow")
    return res
  }
  // Public site pages don't belong on the admin host.
  // Behind Nginx the app sees http; keep the scheme the browser used.
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || req.nextUrl.protocol.replace(":", "")
  return NextResponse.redirect(`${proto}://${req.headers.get("host")}/`)
}

export const config = {
  // Skip build assets and files with an extension (icons, fonts, images).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
}
