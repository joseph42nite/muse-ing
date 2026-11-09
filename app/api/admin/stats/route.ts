import { dashboardStats } from "@/lib/server/admin"
import { forbidden, requireRole } from "@/lib/server/auth"

export async function GET() {
  if (!(await requireRole("admin"))) return forbidden()
  return Response.json(dashboardStats())
}
