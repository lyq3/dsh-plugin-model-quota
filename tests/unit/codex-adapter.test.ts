import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CodexQuotaAdapter } from '../../src/quota/adapters/codex.ts'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as unknown

describe('CodexQuotaAdapter', () => {
  it('creates only the fixed Codex request', () => {
    expect(CodexQuotaAdapter.createRequest({ provider: 'codex', canonicalAuthIndex: 'fixture', label: 'account-a' })).toEqual({
      method: 'GET',
      url: 'https://chatgpt.com/backend-api/wham/usage',
      headers: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal',
      },
    })
  })

  it('selects the longest window, calculates remaining, and keeps model windows secondary', () => {
    const parsed = CodexQuotaAdapter.parseQuota(fixture('codex-usage.json'), new Date('2029-01-01T00:00:00Z'))
    expect(parsed.plan).toBe('plus')
    expect(parsed.remainingPercent).toBe(15)
    expect(parsed.resetAt).toBe(new Date(1800600000 * 1000).toISOString())
    expect(parsed.secondaryWindows).toEqual([
      expect.objectContaining({ label: 'model-window', remainingPercent: 80 }),
    ])
  })

  it('hides additional rate limits without an explicit label', () => {
    const payload = {
      plan_type: 'pro',
      rate_limit: {
        primary_window: { used_percent: 10, limit_window_seconds: 604800, reset_at: 1800600000 },
      },
      additional_rate_limits: [
        { rate_limit: { primary_window: { used_percent: 25, limit_window_seconds: 18000, reset_at: 1800000000 } } },
        { label: '   ', rate_limit: { primary_window: { used_percent: 30, limit_window_seconds: 18000, reset_at: 1800000000 } } },
      ],
    }
    expect(CodexQuotaAdapter.parseQuota(payload, new Date()).secondaryWindows).toEqual([])
  })

  it('distinguishes exhaustion and rejects incompatible payloads', () => {
    expect(CodexQuotaAdapter.parseQuota(fixture('codex-usage-exhausted.json'), new Date()).remainingPercent).toBe(0)
    expect(() => CodexQuotaAdapter.parseQuota(fixture('codex-usage-invalid.json'), new Date())).toThrow()
  })
})
