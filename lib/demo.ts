// The seeded demo artist (see seedDemoData in lib/server/db.ts). Its one-click login is shown in
// development, or in production only when NEXT_PUBLIC_DEMO_LOGIN=true (pair with SEED_DEMO_DATA=true).
export const DEMO_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_LOGIN === "true"

export const DEMO_ARTIST = { email: "artist@museing.com", password: "artist123" }
