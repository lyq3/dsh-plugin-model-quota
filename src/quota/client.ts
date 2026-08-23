import type { ConfigSnapshot } from '../config.ts'
import { managementUrl } from './base-url.ts'
import type { AccountQuotaPayload, ConnectionTestResult, DiscoveredCredentials, HostOnlyCredentialRef, QuotaAdapter, QuotaErrorCode } from './types.ts'

export class QuotaClientError extends Error {
  constructor(readonly code: QuotaErrorCode, readonly httpStatus?: number) {
    super(code)
    this.name = 'QuotaClientError'
  }

  toJSON(): { code: QuotaErrorCode } {
    return { code: this.code }
  }
}

export interface QuotaClientOptions {
  fetch: typeof fetch
  maxResponseBytes: number
  now: () => Date
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function combineSignals(timeoutMs: number, caller?: AbortSignal): { signal: AbortSignal; dispose: () => void; timedOut: () => boolean } {
  const controller = new AbortController()
  let timeout = false
  const timer = setTimeout(() => { timeout = true; controller.abort() }, timeoutMs)
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  if (caller?.aborted) controller.abort()
  return {
    signal: controller.signal,
    timedOut: () => timeout,
    dispose: () => { clearTimeout(timer); caller?.removeEventListener('abort', abort) },
  }
}

async function readJson(response: Response, maxBytes: number): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new QuotaClientError('incompatible-response')
  const chunks: Uint8Array[] = []
  let total = 0
  if (response.body) {
    const reader = response.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          await reader.cancel()
          throw new QuotaClientError('incompatible-response')
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new QuotaClientError('incompatible-response')
  }
}

function normalizeProvider(value: unknown): string {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : 'unknown'
}

function credentialFrom(value: unknown): HostOnlyCredentialRef | null {
  const item = record(value)
  if (!item) return null
  const provider = normalizeProvider(item.provider ?? item.type)
  const authIndex = item.auth_index ?? item.authIndex
  if ((typeof authIndex !== 'string' && typeof authIndex !== 'number') || String(authIndex).length === 0) return null
  const rawLabel = item.email ?? item.project_id ?? item.projectId ?? item.label ?? item.name
  const label = typeof rawLabel === 'string' && rawLabel.trim()
    ? rawLabel.trim().replace(/\.json$/i, '')
    : provider
  const rawAccountId = item.account_id ?? item.accountId
  const accountId = typeof rawAccountId === 'string' && rawAccountId ? rawAccountId : undefined
  return { provider, canonicalAuthIndex: String(authIndex), label, ...(accountId ? { accountId } : {}) }
}

export class QuotaClient {
  constructor(private readonly options: QuotaClientOptions) {}

  private async request(config: ConfigSnapshot, url: URL, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    const timeout = combineSignals(config.config.requestTimeoutSeconds * 1000, signal)
    try {
      const response = await this.options.fetch(url.href, { ...init, signal: timeout.signal, redirect: 'error' })
      if (!response.ok) throw new QuotaClientError(response.status === 401 || response.status === 403 ? 'credential' : 'upstream', response.status)
      return await readJson(response, this.options.maxResponseBytes)
    } catch (error) {
      if (error instanceof QuotaClientError) throw error
      if (timeout.timedOut()) throw new QuotaClientError('timeout')
      if (signal?.aborted) throw new QuotaClientError('upstream')
      if (error instanceof Error && error.name === 'AbortError') throw new QuotaClientError('timeout')
      throw new QuotaClientError('upstream')
    } finally {
      timeout.dispose()
    }
  }

  async discoverAccounts(config: ConfigSnapshot, signal?: AbortSignal): Promise<DiscoveredCredentials> {
    const payload = await this.request(config, managementUrl(config.config.baseUrl, 'auth-files'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.config.managementKey}` },
    }, signal)
    const root = record(payload)
    const raw = Array.isArray(root?.files) ? root.files : Array.isArray(payload) ? payload : null
    if (!raw) throw new QuotaClientError('incompatible-response')
    const credentials = raw.map(credentialFrom).filter((item): item is HostOnlyCredentialRef => item !== null)
    const counts = new Map<string, number>()
    for (const item of credentials) if (item.provider !== 'codex' && item.provider !== 'kimi') counts.set(item.provider, (counts.get(item.provider) ?? 0) + 1)
    const unsupportedProviders = [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([provider, count]) => ({ provider, count }))
    return { credentials, unsupportedProviders }
  }

  async fetchAccountQuota(config: ConfigSnapshot, credential: HostOnlyCredentialRef, adapter: QuotaAdapter, signal?: AbortSignal): Promise<AccountQuotaPayload> {
    if (credential.provider !== adapter.provider) throw new QuotaClientError('incompatible-response')
    const upstream = adapter.createRequest(credential)
    const payload = await this.request(config, managementUrl(config.config.baseUrl, 'api-call'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.config.managementKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_index: credential.canonicalAuthIndex, method: upstream.method, url: upstream.url, header: upstream.headers }),
    }, signal)
    const envelope = record(payload)
    const statusCode = envelope?.status_code ?? envelope?.statusCode
    if (typeof statusCode === 'number' && (statusCode < 200 || statusCode >= 300)) {
      throw new QuotaClientError(statusCode === 401 || statusCode === 403 ? 'credential' : 'upstream', statusCode)
    }
    let body = envelope && 'body' in envelope ? envelope.body : payload
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as unknown
      } catch {
        throw new QuotaClientError('incompatible-response')
      }
    }
    return { credential, payload: body }
  }

  async testConnection(config: ConfigSnapshot, signal?: AbortSignal): Promise<ConnectionTestResult> {
    const checkedAt = this.options.now().toISOString()
    if (!config.config.managementKey) return { status: 'not-configured', checkedAt, discoveredAccounts: [], unsupportedProviders: [], errorCode: null }
    try {
      const discovered = await this.discoverAccounts(config, signal)
      return { status: 'ok', checkedAt, discoveredAccounts: [], unsupportedProviders: discovered.unsupportedProviders, errorCode: null }
    } catch (error) {
      const code = error instanceof QuotaClientError ? error.code : 'upstream'
      const errorCode = code === 'credential' ? 'authorization' : code === 'timeout' ? 'timeout' : code === 'incompatible-response' ? 'incompatible-response' : 'unreachable'
      return { status: 'failed', checkedAt, discoveredAccounts: [], unsupportedProviders: [], errorCode }
    }
  }
}
