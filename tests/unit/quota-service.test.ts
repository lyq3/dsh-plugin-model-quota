import { describe, expect, it, vi } from 'vitest'
import { createConfigStore, defaultConfig } from '../../src/config.ts'
import { CodexQuotaAdapter } from '../../src/quota/adapters/codex.ts'
import { KimiQuotaAdapter } from '../../src/quota/adapters/kimi.ts'
import { QuotaClientError } from '../../src/quota/client.ts'
import { QuotaService, createSafeAccountId } from '../../src/quota/service.ts'

const adapters = [CodexQuotaAdapter, KimiQuotaAdapter] as const
const credential = (provider: string, index: string, label: string) => ({ provider, canonicalAuthIndex: index, label })

describe('QuotaService', () => {
  it('creates stable opaque safe ids', () => {
    expect(createSafeAccountId('codex', 'fixture-a')).toMatch(/^acct_[0-9a-f]{32}$/)
    expect(createSafeAccountId('codex', 'fixture-a')).toBe(createSafeAccountId('codex', 'fixture-a'))
    expect(createSafeAccountId('codex', 'fixture-a')).not.toContain('fixture-a')
  })

  it('sorts dynamically, ignores unsupported providers as errors, and isolates account failures', async () => {
    const client = {
      discoverAccounts: vi.fn().mockResolvedValue({
        credentials: [credential('kimi', 'b', ' Account-B '), credential('codex', 'z', 'account-z'), credential('codex', 'a', 'account-a'), credential('gemini', 'g', 'account-g')],
        unsupportedProviders: [{ provider: 'gemini', count: 1 }],
      }),
      fetchAccountQuota: vi.fn().mockImplementation((_config, item) => item.canonicalAuthIndex === 'z'
        ? Promise.reject(new QuotaClientError('timeout'))
        : Promise.resolve({ credential: item, payload: item.provider === 'codex'
          ? { plan_type: 'plus', rate_limit: { primary_window: { used_percent: 70, limit_window_seconds: 3600, reset_at: 1800000000 } } }
          : { usage: { limit: 100, used: 20, resetTime: '2030-01-01T00:00:00.000Z' }, limits: [] } })),
    }
    const service = new QuotaService({ client: client as never, configStore: createConfigStore({ ...defaultConfig, managementKey: 'fixture-key' }), adapters })
    const result = await service.getSnapshot()
    expect(result.sourceStatus).toBe('partial')
    expect(result.accounts.map(({ provider, label }) => [provider, label])).toEqual([
      ['codex', 'account-a'], ['codex', 'account-z'], ['kimi', 'Account-B'],
    ])
    expect(result.accounts[1]).toMatchObject({ status: 'error', remainingPercent: null, errorCode: 'timeout' })
    expect(JSON.stringify(result)).not.toMatch(/canonicalAuthIndex|fixture-key|\"g\"/)
  })

  it('uses a 10 second generation-aware cache and merges concurrent refreshes', async () => {
    let now = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const client = {
      discoverAccounts: vi.fn().mockImplementation(async () => { await gate; return { credentials: [], unsupportedProviders: [] } }),
      fetchAccountQuota: vi.fn(),
    }
    const store = createConfigStore(defaultConfig)
    const service = new QuotaService({ client: client as never, configStore: store, adapters, now: () => new Date(now) })
    const first = service.getSnapshot()
    const concurrent = service.getSnapshot({ force: true })
    release()
    expect(await first).toBe(await concurrent)
    expect(client.discoverAccounts).toHaveBeenCalledOnce()
    await service.getSnapshot()
    expect(client.discoverAccounts).toHaveBeenCalledOnce()
    now = 10_001
    await service.getSnapshot()
    expect(client.discoverAccounts).toHaveBeenCalledTimes(2)
    store.update({ ...defaultConfig, requestTimeoutSeconds: 12 })
    await service.getSnapshot()
    expect(client.discoverAccounts).toHaveBeenCalledTimes(3)
  })

  it('keeps shared refresh alive when one caller aborts', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const client = {
      discoverAccounts: vi.fn().mockImplementation(async () => { await gate; return { credentials: [], unsupportedProviders: [] } }),
      fetchAccountQuota: vi.fn(),
    }
    const service = new QuotaService({ client: client as never, configStore: createConfigStore(defaultConfig), adapters })
    const controller = new AbortController()
    const abortedCaller = service.getSnapshot({ signal: controller.signal })
    const survivingCaller = service.getSnapshot()
    controller.abort()
    await expect(abortedCaller).rejects.toMatchObject({ name: 'AbortError' })
    release()
    await expect(survivingCaller).resolves.toMatchObject({ sourceStatus: 'ok' })
    expect(client.discoverAccounts).toHaveBeenCalledOnce()
  })

  it('aborts old generation work and never commits it to the new cache', async () => {
    let oldSignal: AbortSignal | undefined
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const client = {
      discoverAccounts: vi.fn().mockImplementation(async (_config, signal) => {
        oldSignal ??= signal
        await gate
        return { credentials: [], unsupportedProviders: [] }
      }),
      fetchAccountQuota: vi.fn(),
    }
    const store = createConfigStore(defaultConfig)
    const service = new QuotaService({ client: client as never, configStore: store, adapters })
    const old = service.getSnapshot()
    store.update({ ...defaultConfig, requestTimeoutSeconds: 12 })
    expect(oldSignal?.aborted).toBe(true)
    release()
    await old
    await service.getSnapshot()
    expect(client.discoverAccounts).toHaveBeenCalledTimes(2)
  })
})
