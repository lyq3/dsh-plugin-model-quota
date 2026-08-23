import { createHash } from 'node:crypto'
import type { ConfigSnapshot, ModelQuotaConfigStore } from '../config.ts'
import { QuotaClient, QuotaClientError } from './client.ts'
import type { ConnectionTestResult, DiscoveredAccountPreview, HostOnlyCredentialRef, QuotaAccount, QuotaAdapter, QuotaErrorCode, QuotaSnapshot } from './types.ts'

export interface GetSnapshotOptions {
  force?: boolean
  signal?: AbortSignal
}

export function createSafeAccountId(provider: string, canonicalAuthIndex: string): string {
  return `acct_${createHash('sha256').update(`dsh-model-quota:v1\0${provider}\0${canonicalAuthIndex}`).digest('hex').slice(0, 32)}`
}

function normalizedLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function shortLabel(label: string): string {
  const value = normalizedLabel(label)
  return value.length <= 24 ? value : `${value.slice(0, 21)}…`
}

function status(remaining: number | null): QuotaAccount['status'] {
  if (remaining === null) return 'error'
  if (remaining === 0) return 'exhausted'
  return remaining <= 20 ? 'low' : 'available'
}

function accountOrder(left: Pick<QuotaAccount, 'provider' | 'label' | 'id'>, right: Pick<QuotaAccount, 'provider' | 'label' | 'id'>): number {
  return left.provider.localeCompare(right.provider) || normalizedLabel(left.label).localeCompare(normalizedLabel(right.label), undefined, { sensitivity: 'base' }) || left.id.localeCompare(right.id)
}

function errorAccount(credential: HostOnlyCredentialRef, code: QuotaErrorCode): QuotaAccount {
  const label = normalizedLabel(credential.label)
  return {
    id: createSafeAccountId(credential.provider, credential.canonicalAuthIndex),
    provider: credential.provider,
    label,
    shortLabel: shortLabel(label),
    plan: null,
    status: 'error',
    remainingPercent: null,
    resetAt: null,
    secondaryWindows: [],
    errorCode: code,
  }
}

function awaitForCaller<T>(shared: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return shared
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    shared.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export class QuotaService {
  private readonly adapters: Map<string, QuotaAdapter>
  private readonly cacheTtlMs: number
  private readonly now: () => Date
  private cache: { generation: number; storedAt: number; snapshot: QuotaSnapshot } | null = null
  private inFlight: { generation: number; controller: AbortController; promise: Promise<QuotaSnapshot> } | null = null
  private readonly unsubscribe: () => void
  private disposed = false

  constructor(private readonly options: {
    client: QuotaClient
    configStore: ModelQuotaConfigStore
    adapters: readonly QuotaAdapter[]
    cacheTtlMs?: number
    now?: () => Date
  }) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.provider, adapter]))
    this.cacheTtlMs = options.cacheTtlMs ?? 10_000
    this.now = options.now ?? (() => new Date())
    this.unsubscribe = options.configStore.subscribe(() => this.invalidate())
  }

  invalidate(): void {
    this.cache = null
    this.inFlight?.controller.abort()
    this.inFlight = null
  }

  private async refresh(config: ConfigSnapshot, signal: AbortSignal): Promise<QuotaSnapshot> {
    let discovered
    try {
      discovered = await this.options.client.discoverAccounts(config, signal)
    } catch {
      return { fetchedAt: this.now().toISOString(), accounts: [], partial: false, sourceStatus: 'unavailable' }
    }
    const supported = discovered.credentials.filter((credential) => this.adapters.has(credential.provider))
    const results = await Promise.all(supported.map(async (credential): Promise<QuotaAccount> => {
      const adapter = this.adapters.get(credential.provider)!
      try {
        const result = await this.options.client.fetchAccountQuota(config, credential, adapter, signal)
        const parsed = adapter.parseQuota(result.payload, this.now())
        const label = normalizedLabel(credential.label)
        return {
          id: createSafeAccountId(credential.provider, credential.canonicalAuthIndex),
          provider: credential.provider,
          label,
          shortLabel: shortLabel(label),
          plan: parsed.plan,
          status: status(parsed.remainingPercent),
          remainingPercent: parsed.remainingPercent,
          resetAt: parsed.resetAt,
          secondaryWindows: parsed.secondaryWindows,
          errorCode: null,
        }
      } catch (error) {
        return errorAccount(credential, error instanceof QuotaClientError ? error.code : 'incompatible-response')
      }
    }))
    results.sort(accountOrder)
    const partial = results.some((account) => account.status === 'error')
    return { fetchedAt: this.now().toISOString(), accounts: results, partial, sourceStatus: partial ? 'partial' : 'ok' }
  }

  getSnapshot(options: GetSnapshotOptions = {}): Promise<QuotaSnapshot> {
    if (this.disposed) return Promise.resolve({ fetchedAt: this.now().toISOString(), accounts: [], partial: false, sourceStatus: 'unavailable' })
    const config = this.options.configStore.getSnapshot()
    const timestamp = this.now().getTime()
    if (!options.force && this.cache?.generation === config.generation && timestamp - this.cache.storedAt < this.cacheTtlMs) return Promise.resolve(this.cache.snapshot)
    if (this.inFlight?.generation === config.generation) return awaitForCaller(this.inFlight.promise, options.signal)

    const controller = new AbortController()
    const promise = this.refresh(config, controller.signal).then((snapshot) => {
      if (this.options.configStore.getSnapshot().generation === config.generation && !controller.signal.aborted) {
        this.cache = { generation: config.generation, storedAt: this.now().getTime(), snapshot }
      }
      return snapshot
    }).finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = null
    })
    this.inFlight = { generation: config.generation, controller, promise }
    return awaitForCaller(promise, options.signal)
  }

  async testConnection(signal?: AbortSignal): Promise<ConnectionTestResult> {
    const config = this.options.configStore.getSnapshot()
    const checkedAt = this.now().toISOString()
    if (!config.config.managementKey) return { status: 'not-configured', checkedAt, discoveredAccounts: [], unsupportedProviders: [], errorCode: null }
    let discovered
    try {
      discovered = await this.options.client.discoverAccounts(config, signal)
    } catch (error) {
      const code = error instanceof QuotaClientError ? error.code : 'upstream'
      return { status: 'failed', checkedAt, discoveredAccounts: [], unsupportedProviders: [], errorCode: code === 'credential' ? 'authorization' : code === 'timeout' ? 'timeout' : code === 'incompatible-response' ? 'incompatible-response' : 'unreachable' }
    }
    const previews: DiscoveredAccountPreview[] = discovered.credentials.map((credential) => ({
      id: createSafeAccountId(credential.provider, credential.canonicalAuthIndex),
      provider: credential.provider,
      label: normalizedLabel(credential.label),
      supported: this.adapters.has(credential.provider),
    })).sort(accountOrder)
    const supported = discovered.credentials.find((credential) => this.adapters.has(credential.provider))
    if (!supported) return { status: 'ok', checkedAt, discoveredAccounts: previews, unsupportedProviders: discovered.unsupportedProviders, errorCode: null }
    try {
      const adapter = this.adapters.get(supported.provider)!
      const result = await this.options.client.fetchAccountQuota(config, supported, adapter, signal)
      adapter.parseQuota(result.payload, this.now())
      return { status: 'ok', checkedAt, discoveredAccounts: previews, unsupportedProviders: discovered.unsupportedProviders, errorCode: null }
    } catch (error) {
      const code = error instanceof QuotaClientError ? error.code : 'incompatible-response'
      return { status: 'partial', checkedAt, discoveredAccounts: previews, unsupportedProviders: discovered.unsupportedProviders, errorCode: code === 'credential' ? 'authorization' : code === 'timeout' ? 'timeout' : code === 'incompatible-response' ? 'incompatible-response' : 'unreachable' }
    }
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribe()
    this.invalidate()
  }
}
