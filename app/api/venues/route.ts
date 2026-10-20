import { NextResponse } from "next/server"
import { all } from "@/lib/server/db"
import { requireRole, forbidden } from "@/lib/server/auth"

export async function GET() {
  if (!(await requireRole("promoter", "admin"))) return forbidden()
  return NextResponse.json(all("SELECT id, name FROM users WHERE role = 'venue' ORDER BY name"))
}
