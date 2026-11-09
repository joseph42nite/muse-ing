// Settings the admin changes from the panel, stored in app_settings.
import { get, run } from "./db"

export const DEFAULT_PLATFORM_FEE_PERCENT = 10
export const MAX_PLATFORM_FEE_PERCENT = 50

/** Our cut of every ticket, tip and dedication, in percent. Set in Admin → Settings. */
export function platformFeePercent(): number {
  const row = get<{ value: string }>("SELECT value FROM app_settings WHERE key = 'platform_fee_percent'")
  const n = Number(row?.value ?? DEFAULT_PLATFORM_FEE_PERCENT)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_PLATFORM_FEE_PERCENT) : DEFAULT_PLATFORM_FEE_PERCENT
}

export function setPlatformFeePercent(percent: number) {
  run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('platform_fee_percent', ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    String(percent),
    new Date().toISOString(),
  )
}

export const round2 = (n: number) => Math.round(n * 100) / 100
export const platformFeeFor = (amount: number, percent = platformFeePercent()) => round2((amount * percent) / 100)
