import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { createSession, hashPassword } from "@/lib/server/auth"

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? "").trim()
  const email = String(b.email ?? "").trim().toLowerCase()
  const phone = String(b.phone ?? "").trim() || null
  const password = String(b.password ?? "")
  const role =
    b.role === "artist"
      ? "artist"
      : b.role === "venue"
        ? "venue"
        : "promoter"
  const instagramRaw = String(b.instagram_handle ?? "").trim()
  const instagramHandle =
    instagramRaw && !instagramRaw.startsWith("@") && !instagramRaw.startsWith("http")
      ? `@${instagramRaw}`
      : instagramRaw || null
  const avatarUrl = String(b.avatar_url ?? "").trim() || null

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "A name and valid email are required." }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
  }
  if (get("SELECT 1 FROM users WHERE email = ?", email)) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
  }

  let promoterCode: string | null = null
  if (role === "promoter") {
    const wanted = String(b.promoter_code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    promoterCode = wanted || name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900)
    if (get("SELECT 1 FROM users WHERE promoter_code = ?", promoterCode)) {
      return NextResponse.json({ error: "That promoter code is taken. Try another." }, { status: 409 })
    }
  }

  const id = crypto.randomUUID()
  run(
    `INSERT INTO users (id, name, email, phone, role, promoter_code, instagram_handle, avatar_url, password_hash)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id,
    name,
    email,
    phone,
    role,
    promoterCode,
    instagramHandle,
    avatarUrl,
    hashPassword(password)
  )
  await createSession(id)
  return NextResponse.json({ role })
}
