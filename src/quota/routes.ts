import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { QuotaService } from './service.ts'
import type { SafeLogger } from './types.ts'

export type QuotaRouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

export interface QuotaRouteHandlers {
  getQuota: QuotaRouteHandler
  testConnection: QuotaRouteHandler
}

function headers(res: ServerResponse): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

function send(res: ServerResponse, statusCode: number, value: unknown, head: boolean, limit: number): void {
  let body: string
  try {
    body = JSON.stringify(value)
  } catch {
    statusCode = 503
    body = '{"error":"unavailable"}'
  }
  if (Buffer.byteLength(body) > limit) {
    statusCode = 503
    body = '{"error":"unavailable"}'
  }
  res.statusCode = statusCode
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(head ? undefined : body)
}

async function requireEmptyBody(req: IncomingMessage, maxBytes = 1024): Promise<boolean> {
  return await new Promise((resolve) => {
    let bytes = 0
    let nonEmpty = false
    const done = () => resolve(!nonEmpty)
    req.on('data', (chunk: Buffer | string) => {
      bytes += Buffer.byteLength(chunk)
      if (bytes > 0) nonEmpty = true
      if (bytes > maxBytes) req.destroy()
    })
    req.once('end', done)
    req.once('aborted', () => resolve(false))
    req.once('error', () => resolve(false))
  })
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function trustedBrowserRequest(req: IncomingMessage): boolean {
  const authority = req.headers.host
  if (authority === undefined) return false
  let host: URL
  try {
    host = new URL(`http://${authority}`)
  } catch {
    return false
  }
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      if (new URL(origin).host !== host.host) return false
    } catch {
      return false
    }
  }
  if (isLoopbackHostname(host.hostname)) return true
  return fetchSite === 'same-origin'
}

function hasQuery(req: IncomingMessage): boolean {
  try {
    return new URL(req.url ?? '/', 'http://localhost').search.length > 0
  } catch {
    return true
  }
}

export function createQuotaRoutes(options: { service: QuotaService; maxJsonResponseBytes: number; logger: SafeLogger }): QuotaRouteHandlers {
  return {
    async getQuota(req, res) {
      headers(res)
      const method = req.method ?? ''
      if (!trustedBrowserRequest(req)) {
        send(res, 403, { error: 'forbidden' }, method === 'HEAD', options.maxJsonResponseBytes)
        return
      }
      if (method !== 'GET' && method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD')
        send(res, 405, { error: 'method-not-allowed' }, false, options.maxJsonResponseBytes)
        return
      }
      if (hasQuery(req) || !await requireEmptyBody(req)) {
        send(res, 400, { error: 'invalid-request' }, method === 'HEAD', options.maxJsonResponseBytes)
        return
      }
      try {
        send(res, 200, await options.service.getSnapshot(), method === 'HEAD', options.maxJsonResponseBytes)
      } catch {
        options.logger.warn('model quota request failed', { category: 'unavailable' })
        send(res, 503, { error: 'unavailable' }, method === 'HEAD', options.maxJsonResponseBytes)
      }
    },
    async testConnection(req, res) {
      headers(res)
      if (!trustedBrowserRequest(req)) {
        send(res, 403, { error: 'forbidden' }, false, options.maxJsonResponseBytes)
        return
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        send(res, 405, { error: 'method-not-allowed' }, false, options.maxJsonResponseBytes)
        return
      }
      if (hasQuery(req) || !await requireEmptyBody(req)) {
        send(res, 400, { error: 'invalid-request' }, false, options.maxJsonResponseBytes)
        return
      }
      try {
        send(res, 200, await options.service.testConnection(), false, options.maxJsonResponseBytes)
      } catch {
        options.logger.warn('model quota connection test failed', { category: 'unavailable' })
        send(res, 503, { error: 'unavailable' }, false, options.maxJsonResponseBytes)
      }
    },
  }
}

export function installQuotaRoutes(ctx: Context, handlers: QuotaRouteHandlers): void {
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/model-quota', handler: handlers.getQuota }))
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/model-quota/test-connection', handler: handlers.testConnection }))
}
