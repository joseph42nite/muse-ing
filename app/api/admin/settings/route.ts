import { forbidden, requireRole } from "@/lib/server/auth"
import { readJson } from "@/lib/server/respond"
import { MAX_PLATFORM_FEE_PERCENT, platformFeePercent, setPlatformFeePercent } from "@/lib/server/settings"

export async function GET() {
  if (!(await requireRole("admin"))) return forbidden()
  return Response.json({ platform_fee_percent: platformFeePercent() })
}

// Changes the platform fee. Only payments started after this use the new rate.
export async function PATCH(req: Request) {
  if (!(await requireRole("admin"))) return forbidden()
  const b = await readJson(req)
  const n = Number(b.platform_fee_percent)
  if (b.platform_fee_percent === "" || b.platform_fee_percent == null || !Number.isFinite(n) || n < 0 || n > MAX_PLATFORM_FEE_PERCENT) {
    return Response.json({ error: `Enter a fee between 0 and ${MAX_PLATFORM_FEE_PERCENT}%.` }, { status: 400 })
  }
  setPlatformFeePercent(Math.round(n * 100) / 100)
  return Response.json({ platform_fee_percent: platformFeePercent() })
}
