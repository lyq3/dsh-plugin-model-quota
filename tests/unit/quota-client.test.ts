import { describe, expect, it, vi } from 'vitest'
import { createConfigStore, defaultConfig } from '../../src/config.ts'
import { CodexQuotaAdapter } from '../../src/quota/adapters/codex.ts'
import { QuotaClient, QuotaClientError } from '../../src/quota/client.ts'

function response(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
}

describe('QuotaClient', () => {
  it('dynamically discovers credentials and groups unsupported providers', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response({ files: [
      { provider: 'codex', auth_index: 7, email: 'account-a' },
      { type: 'kimi', authIndex: 'fixture-b', name: 'account-b.json' },
      { provider: 'gemini', auth_index: 'fixture-c' },
      { provider: '', auth_index: 'fixture-d' },
    ] }))
    const client = new QuotaClient({ fetch, maxResponseBytes: 10_000, now: () => new Date() })
    const config = createConfigStore({ ...defaultConfig, managementKey: 'fixture-key' }).getSnapshot()
    const result = await client.discoverAccounts(config)
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8317/v0/management/auth-files', expect.objectContaining({
      method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer fixture-key' },
    }))
    expect(result.credentials).toEqual([
      { provider: 'codex', canonicalAuthIndex: '7', label: 'account-a' },
      { provider: 'kimi', canonicalAuthIndex: 'fixture-b', label: 'account-b' },
      { provider: 'gemini', canonicalAuthIndex: 'fixture-c', label: 'gemini' },
      { provider: 'unknown', canonicalAuthIndex: 'fixture-d', label: 'unknown' },
    ])
    expect(result.unsupportedProviders).toEqual([{ provider: 'gemini', count: 1 }, { provider: 'unknown', count: 1 }])
  })

  it('posts a fixed api-call envelope and enforces per-account timeout', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response({ status_code: 200, body: '{"rate_limit":{}}' }))
    const client = new QuotaClient({ fetch, maxResponseBytes: 10_000, now: () => new Date() })
    const config = createConfigStore({ ...defaultConfig, managementKey: 'fixture-key' }).getSnapshot()
    const result = await client.fetchAccountQuota(config, { provider: 'codex', canonicalAuthIndex: 'fixture-a', label: 'account-a' }, CodexQuotaAdapter)
    expect(result.payload).toEqual({ rate_limit: {} })
    const [, init] = fetch.mock.calls[0]!
    expect(fetch.mock.calls[0]![0]).toBe('http://127.0.0.1:8317/v0/management/api-call')
    expect(JSON.parse(String(init?.body))).toEqual({
      auth_index: 'fixture-a', method: 'GET', url: 'https://chatgpt.com/backend-api/wham/usage', header: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal',
      },
    })
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
  })

  it('classifies authorization, redirect, oversized, timeout, and malformed responses without raw bodies', async () => {
    const cases: Array<[typeof globalThis.fetch, string]> = [
      [vi.fn().mockResolvedValue(new Response('denied fixture-secret', { status: 401 })), 'credential'],
      [vi.fn().mockRejectedValue(new TypeError('redirect count exceeded')), 'upstream'],
      [vi.fn().mockResolvedValue(response({ value: 'x'.repeat(100) })), 'incompatible-response'],
      [vi.fn().mockRejectedValue(Object.assign(new Error('aborted fixture-secret'), { name: 'AbortError' })), 'timeout'],
      [vi.fn().mockResolvedValue(new Response('{bad json', { status: 200 })), 'incompatible-response'],
    ]
    const config = createConfigStore({ ...defaultConfig, managementKey: 'fixture-key' }).getSnapshot()
    for (const [fetch, code] of cases) {
      const client = new QuotaClient({ fetch, maxResponseBytes: 32, now: () => new Date() })
      await expect(client.discoverAccounts(config)).rejects.toMatchObject({ code })
      await client.discoverAccounts(config).catch((error: unknown) => {
        expect(error).toBeInstanceOf(QuotaClientError)
        expect(JSON.stringify(error)).not.toContain('fixture-secret')
      })
    }
  })
})
