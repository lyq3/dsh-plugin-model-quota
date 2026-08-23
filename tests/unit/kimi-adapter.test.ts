import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KimiQuotaAdapter } from '../../src/quota/adapters/kimi.ts'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as unknown

describe('KimiQuotaAdapter', () => {
  it('creates only the fixed Kimi request', () => {
    expect(KimiQuotaAdapter.createRequest({ provider: 'kimi', canonicalAuthIndex: 'fixture', label: 'account-b' })).toEqual({
      method: 'GET',
      url: 'https://api.kimi.com/coding/v1/usages',
      headers: { Authorization: 'Bearer $TOKEN$' },
    })
  })

  it('parses top-level usage and allowlisted rolling windows', () => {
    const parsed = KimiQuotaAdapter.parseQuota(fixture('kimi-usages.json'), new Date())
    expect(parsed).toEqual({
      plan: null,
      remainingPercent: 75,
      resetAt: '2030-01-01T00:00:00.000Z',
      secondaryWindows: [{ id: 'rolling', label: 'rolling', remainingPercent: 80, resetAt: '2030-01-01T01:00:00.000Z' }],
    })
    expect(JSON.stringify(parsed)).not.toMatch(/wallet|subscription|balance|parallel/)
  })

  it('parses the current string-valued Kimi response shape', () => {
    expect(KimiQuotaAdapter.parseQuota(fixture('kimi-usages-current.json'), new Date())).toEqual({
      plan: null,
      remainingPercent: 75,
      resetAt: '2030-01-01T00:00:00.000Z',
      secondaryWindows: [{ id: '5-hour', label: '5 HOUR', remainingPercent: 80, resetAt: '2030-01-01T01:00:00.000Z' }],
    })
  })

  it('distinguishes exhaustion and rejects incompatible payloads', () => {
    expect(KimiQuotaAdapter.parseQuota(fixture('kimi-usages-exhausted.json'), new Date()).remainingPercent).toBe(0)
    expect(() => KimiQuotaAdapter.parseQuota(fixture('kimi-usages-invalid.json'), new Date())).toThrow()
  })
})
