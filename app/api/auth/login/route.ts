import { NextResponse } from "next/server"
import { get } from "@/lib/server/db"
import { createSession, verifyPassword } from "@/lib/server/auth"

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}))
  const email = String(b.email ?? "").trim().toLowerCase()
  const password = String(b.password ?? "")
  const user = get<{ id: string; role: string; password_hash: string }>(
    "SELECT id, role, password_hash FROM users WHERE email = ?",
    email,
  )
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
  }
  await createSession(user.id)
  return NextResponse.json({ role: user.role })
}
