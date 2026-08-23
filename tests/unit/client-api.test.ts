import { describe, expect, it, vi } from 'vitest'
import { BrowserApiError, createModelQuotaBrowserApi } from '../../src/client/api.ts'
import { snapshot } from './client-test-helpers.ts'

const connectionResult = {
  status: 'ok',
  checkedAt: '2030-01-01T00:00:00.000Z',
  discoveredAccounts: [{ id: 'acct_0123456789abcdef0123456789abcdef', provider: 'codex', label: 'account-a', supported: true }],
  unsupportedProviders: [{ provider: 'gemini', count: 1 }],
  errorCode: null,
} as const

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

describe('model quota browser api', () => {
  it('uses only exact same-origin routes and passes AbortSignal', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(snapshot))
      .mockResolvedValueOnce(jsonResponse(connectionResult))
    const api = createModelQuotaBrowserApi(fetchImpl)
    const controller = new AbortController()

    await expect(api.getSnapshot(controller.signal)).resolves.toEqual(snapshot)
    await expect(api.testConnection(controller.signal)).resolves.toEqual(connectionResult)

    expect(fetchImpl.mock.calls).toEqual([
      ['/api/model-quota', { method: 'GET', signal: controller.signal }],
      ['/api/model-quota/test-connection', { method: 'POST', signal: controller.signal }],
    ])
    expect(fetchImpl.mock.calls.flatMap(([, init]) => Object.keys(init))).not.toContain('headers')
    expect(fetchImpl.mock.calls.flatMap(([, init]) => Object.keys(init))).not.toContain('credentials')
  })

  it('strictly rejects missing, extra, nested-invalid, and out-of-range snapshot fields', async () => {
    const invalidPayloads = [
      { ...snapshot, extra: true },
      { ...snapshot, fetchedAt: 123 },
      { ...snapshot, accounts: [{ ...snapshot.accounts[0], remainingPercent: 101 }] },
      { ...snapshot, accounts: [{ ...snapshot.accounts[0], secondaryWindows: [{ ...snapshot.accounts[0]?.secondaryWindows[0], secret: 'x' }] }] },
      { ...snapshot, accounts: [{ ...snapshot.accounts[0], errorCode: 'authorization' }] },
    ]

    for (const payload of invalidPayloads) {
      const api = createModelQuotaBrowserApi(vi.fn().mockResolvedValue(jsonResponse(payload)))
      await expect(api.getSnapshot()).rejects.toMatchObject({ code: 'invalid-response' })
    }
  })

  it('strictly validates connection result and classifies transport responses', async () => {
    const invalid = { ...connectionResult, unsupportedProviders: [{ provider: 'gemini', count: 1.5 }] }
    await expect(createModelQuotaBrowserApi(vi.fn().mockResolvedValue(jsonResponse(invalid))).testConnection())
      .rejects.toEqual(new BrowserApiError('invalid-response'))

    await expect(createModelQuotaBrowserApi(vi.fn().mockResolvedValue(new Response('down', { status: 503 }))).getSnapshot())
      .rejects.toMatchObject({ code: 'unavailable' })

    await expect(createModelQuotaBrowserApi(vi.fn().mockResolvedValue(new Response('{', { status: 200 }))).getSnapshot())
      .rejects.toMatchObject({ code: 'invalid-response' })
  })
})
