import { NextResponse } from "next/server"
import { get, run } from "@/lib/server/db"
import { getSessionUser, unauthorized } from "@/lib/server/auth"

export async function GET() {
  const user = await getSessionUser()
  return user ? NextResponse.json(user) : unauthorized()
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? user.name).trim()
  const phone = String(b.phone ?? "").trim() || null
  let code = user.promoter_code
  if (user.role === "promoter" && b.promoter_code !== undefined) {
    code = String(b.promoter_code).trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || null
    if (code && get("SELECT 1 FROM users WHERE promoter_code = ? AND id != ?", code, user.id)) {
      return NextResponse.json({ error: "That promoter code is taken." }, { status: 409 })
    }
  }
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  run("UPDATE users SET name = ?, phone = ?, promoter_code = ? WHERE id = ?", name, phone, code, user.id)
  return NextResponse.json({ ok: true })
}
