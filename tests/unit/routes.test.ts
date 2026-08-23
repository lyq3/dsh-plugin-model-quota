import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { createQuotaRoutes, installQuotaRoutes } from '../../src/quota/routes.ts'

function invoke(handler: (req: IncomingMessage, res: ServerResponse) => unknown, options: { method: string; url?: string; body?: string }) {
  const req = new EventEmitter() as IncomingMessage
  req.method = options.method
  req.url = options.url ?? '/api/model-quota'
  const headers: Record<string, string> = {}
  let body = ''
  let statusCode = 200
  const res = {
    get statusCode() { return statusCode },
    set statusCode(value: number) { statusCode = value },
    setHeader(name: string, value: string | number | readonly string[]) { headers[name.toLowerCase()] = String(value) },
    end(chunk?: string) { body += chunk ?? '' },
  } as unknown as ServerResponse
  const pending = Promise.resolve(handler(req, res)).then(() => ({ statusCode, headers, body }))
  queueMicrotask(() => {
    if (options.body) req.emit('data', Buffer.from(options.body))
    req.emit('end')
  })
  return pending
}

describe('quota routes', () => {
  const service = {
    getSnapshot: vi.fn().mockResolvedValue({ fetchedAt: '2030-01-01T00:00:00.000Z', accounts: [], partial: false, sourceStatus: 'ok' }),
    testConnection: vi.fn().mockResolvedValue({ status: 'ok', checkedAt: '2030-01-01T00:00:00.000Z', discoveredAccounts: [], unsupportedProviders: [], errorCode: null }),
  }
  const logger = { warn: vi.fn() }
  const handlers = createQuotaRoutes({ service: service as never, maxJsonResponseBytes: 4096, logger })

  it.each(['GET', 'HEAD'])('serves quota over %s with JSON no-store headers', async (method) => {
    const result = await invoke(handlers.getQuota, { method })
    expect(result.statusCode).toBe(200)
    expect(result.headers).toMatchObject({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    expect(method === 'HEAD' ? result.body : JSON.parse(result.body)).toEqual(method === 'HEAD' ? '' : expect.objectContaining({ sourceStatus: 'ok' }))
  })

  it('rejects methods, query parameters, and request bodies', async () => {
    expect((await invoke(handlers.getQuota, { method: 'POST' })).statusCode).toBe(405)
    expect((await invoke(handlers.getQuota, { method: 'GET', url: '/api/model-quota?url=https://example.com' })).statusCode).toBe(400)
    expect((await invoke(handlers.getQuota, { method: 'GET', body: '{"provider":"codex"}' })).statusCode).toBe(400)
    expect((await invoke(handlers.testConnection, { method: 'GET', url: '/api/model-quota/test-connection' })).statusCode).toBe(405)
    expect((await invoke(handlers.testConnection, { method: 'POST', url: '/api/model-quota/test-connection?authIndex=x' })).statusCode).toBe(400)
    expect((await invoke(handlers.testConnection, { method: 'POST', url: '/api/model-quota/test-connection', body: '{"managementKey":"x"}' })).statusCode).toBe(400)
  })

  it('returns a strictly redacted generic failure', async () => {
    service.getSnapshot.mockRejectedValueOnce(new Error('fixture-secret /srv/private auth_index'))
    const result = await invoke(handlers.getQuota, { method: 'GET' })
    expect(result.statusCode).toBe(503)
    expect(result.body).toBe('{"error":"unavailable"}')
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/fixture-secret|auth_index|\/srv\/private/)
  })

  it('registers exactly two Node webserver routes through effects', () => {
    const registered: Array<{ kind: string; path: string }> = []
    const disposers: unknown[] = []
    const ctx = {
      webServer: { register(route: { kind: string; path: string }) { registered.push(route); return () => undefined } },
      effect(callback: () => unknown) { disposers.push(callback()); },
    }
    installQuotaRoutes(ctx as never, handlers)
    expect(registered).toEqual([
      expect.objectContaining({ kind: 'exact', path: '/api/model-quota' }),
      expect.objectContaining({ kind: 'exact', path: '/api/model-quota/test-connection' }),
    ])
    expect(disposers).toHaveLength(2)
  })
})
