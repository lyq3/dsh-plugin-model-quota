import type { ParsedQuota, QuotaAdapter, QuotaWindow } from '../types.ts'

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function percentUsed(limit: unknown, used: unknown): number | null {
  const total = number(limit)
  const consumed = number(used)
  if (total === null || consumed === null || total <= 0) return null
  return Math.max(0, Math.min(100, ((total - consumed) / total) * 100))
}

function percentRemaining(limit: unknown, remaining: unknown): number | null {
  const total = number(limit)
  const left = number(remaining)
  if (total === null || left === null || total <= 0) return null
  return Math.max(0, Math.min(100, (left / total) * 100))
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null
}

function parseLimit(value: unknown, index: number): QuotaWindow | null {
  const item = record(value)
  if (!item) return null
  const detail = record(item.detail)
  const window = record(item.window)
  const remainingPercent = detail
    ? percentRemaining(detail.limit, detail.remaining)
    : percentUsed(item.limit, item.used)
  if (remainingPercent === null) return null
  const legacyName = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null
  const duration = typeof window?.duration === 'number' ? window.duration : null
  const timeUnit = typeof window?.timeUnit === 'string' && window.timeUnit.trim() ? window.timeUnit.trim() : null
  const label = legacyName ?? (duration !== null && timeUnit !== null ? `${duration} ${timeUnit}` : `window-${index + 1}`)
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `kimi-${index + 1}`,
    label,
    remainingPercent,
    resetAt: timestamp(detail?.resetTime ?? item.resetTime),
  }
}

export const KimiQuotaAdapter: QuotaAdapter = {
  provider: 'kimi',
  createRequest() {
    return { method: 'GET', url: 'https://api.kimi.com/coding/v1/usages', headers: { Authorization: 'Bearer $TOKEN$' } }
  },
  parseQuota(payload): ParsedQuota {
    const root = record(payload)
    const usage = record(root?.usage)
    if (!root || !usage) throw new TypeError('incompatible Kimi quota response')
    const remainingPercent = percentUsed(usage.limit, usage.used)
    if (remainingPercent === null) throw new TypeError('incompatible Kimi quota response')
    const limits = Array.isArray(root.limits) ? root.limits : []
    return {
      plan: null,
      remainingPercent,
      resetAt: timestamp(usage.resetTime),
      secondaryWindows: limits.map(parseLimit).filter((item): item is QuotaWindow => item !== null),
    }
  },
}
