// Hosts that serve the admin panel (keep in sync with ADMIN_HOSTS in proxy.ts).
const ADMIN_HOSTS = (process.env.ADMIN_HOSTS || "admin.muse-ing.in,admin.localhost")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const adminHost = [{ type: "host", value: `(${ADMIN_HOSTS.map(escape).join("|")})` }]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // On the admin host, / is the panel and /login is the admin sign-in. These live here rather than in
  // proxy.ts because a proxy rewrite behind Nginx (X-Forwarded-Proto: https) is treated as external
  // and Next tries to proxy to https://localhost:3000, which fails.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: adminHost, destination: "/admin" },
        { source: "/login", has: adminHost, destination: "/admin-login" },
      ],
    }
  },
}

export default nextConfig
