import { NextResponse } from "next/server"
import { getSessionUser, unauthorized } from "@/lib/server/auth"

export async function GET() {
  const user = await getSessionUser()
  return user ? NextResponse.json(user) : unauthorized()
}
