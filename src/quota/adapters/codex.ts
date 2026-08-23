import type { ParsedQuota, QuotaAdapter, QuotaWindow } from '../types.ts'

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parseWindow(value: unknown, now: Date): { duration: number; remaining: number; resetAt: string | null } | null {
  const item = record(value)
  if (!item || typeof item.used_percent !== 'number' || !Number.isFinite(item.used_percent)) return null
  const remaining = Math.max(0, Math.min(100, 100 - item.used_percent))
  const duration = typeof item.limit_window_seconds === 'number' && Number.isFinite(item.limit_window_seconds) ? item.limit_window_seconds : 0
  let resetAt: string | null = null
  if (typeof item.reset_at === 'number' && Number.isFinite(item.reset_at)) resetAt = new Date(item.reset_at * 1000).toISOString()
  else if (typeof item.reset_at === 'string' && !Number.isNaN(Date.parse(item.reset_at))) resetAt = new Date(item.reset_at).toISOString()
  else if (typeof item.reset_after_seconds === 'number' && Number.isFinite(item.reset_after_seconds)) resetAt = new Date(now.getTime() + item.reset_after_seconds * 1000).toISOString()
  return { duration, remaining, resetAt }
}

function parseSecondary(value: unknown, now: Date, index: number): QuotaWindow | null {
  const item = record(value)
  if (!item) return null
  const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null
  if (label === null) return null
  const rateLimit = record(item.rate_limit)
  const parsed = parseWindow(rateLimit?.primary_window, now) ?? parseWindow(rateLimit?.secondary_window, now)
  if (!parsed) return null
  return { id: `codex-${index + 1}`, label, remainingPercent: parsed.remaining, resetAt: parsed.resetAt }
}

export const CodexQuotaAdapter: QuotaAdapter = {
  provider: 'codex',
  createRequest(credential) {
    return {
      method: 'GET',
      url: 'https://chatgpt.com/backend-api/wham/usage',
      headers: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal',
        ...(credential.accountId ? { 'Chatgpt-Account-Id': credential.accountId } : {}),
      },
    }
  },
  parseQuota(payload, now): ParsedQuota {
    const root = record(payload)
    const rateLimit = record(root?.rate_limit)
    if (!root || !rateLimit) throw new TypeError('incompatible Codex quota response')
    const candidates = [parseWindow(rateLimit.primary_window, now), parseWindow(rateLimit.secondary_window, now)].filter((item): item is NonNullable<typeof item> => item !== null)
    if (!candidates.length) throw new TypeError('incompatible Codex quota response')
    candidates.sort((left, right) => right.duration - left.duration)
    const primary = candidates[0]!
    const additional = Array.isArray(root.additional_rate_limits) ? root.additional_rate_limits : []
    return {
      plan: typeof root.plan_type === 'string' ? root.plan_type : null,
      remainingPercent: primary.remaining,
      resetAt: primary.resetAt,
      secondaryWindows: additional.map((item, index) => parseSecondary(item, now, index)).filter((item): item is QuotaWindow => item !== null),
    }
  },
}
