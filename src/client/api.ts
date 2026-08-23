export type QuotaErrorCode =
  | 'credential'
  | 'upstream'
  | 'timeout'
  | 'incompatible-response'

export interface QuotaWindow {
  id: string
  label: string
  remainingPercent: number | null
  resetAt: string | null
}

export interface QuotaAccount {
  id: string
  provider: string
  label: string
  shortLabel: string
  plan: string | null
  status: 'available' | 'low' | 'exhausted' | 'error'
  remainingPercent: number | null
  resetAt: string | null
  secondaryWindows: QuotaWindow[]
  errorCode: QuotaErrorCode | null
}

export interface QuotaSnapshot {
  fetchedAt: string
  accounts: QuotaAccount[]
  partial: boolean
  sourceStatus: 'ok' | 'partial' | 'unavailable'
}

export interface DiscoveredAccountPreview {
  id: string
  provider: string
  label: string
  supported: boolean
}

export interface ConnectionTestResult {
  status: 'ok' | 'partial' | 'failed' | 'not-configured'
  checkedAt: string
  discoveredAccounts: DiscoveredAccountPreview[]
  unsupportedProviders: Array<{ provider: string; count: number }>
  errorCode: 'authorization' | 'unreachable' | 'timeout' | 'incompatible-response' | null
}

export interface ModelQuotaBrowserApi {
  getSnapshot(signal?: AbortSignal): Promise<QuotaSnapshot>
  testConnection(signal?: AbortSignal): Promise<ConnectionTestResult>
}

export type BrowserApiErrorCode = 'unavailable' | 'invalid-response'

export class BrowserApiError extends Error {
  constructor(readonly code: BrowserApiErrorCode) {
    super(code)
    this.name = 'BrowserApiError'
  }
}

const quotaErrorCodes = new Set<QuotaErrorCode>([
  'credential',
  'upstream',
  'timeout',
  'incompatible-response',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullablePercent(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
}

function isQuotaWindow(value: unknown): value is QuotaWindow {
  return isRecord(value)
    && hasExactKeys(value, ['id', 'label', 'remainingPercent', 'resetAt'])
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && isNullablePercent(value.remainingPercent)
    && isNullableString(value.resetAt)
}

function isQuotaAccount(value: unknown): value is QuotaAccount {
  return isRecord(value)
    && hasExactKeys(value, [
      'id', 'provider', 'label', 'shortLabel', 'plan', 'status',
      'remainingPercent', 'resetAt', 'secondaryWindows', 'errorCode',
    ])
    && typeof value.id === 'string'
    && typeof value.provider === 'string'
    && typeof value.label === 'string'
    && typeof value.shortLabel === 'string'
    && isNullableString(value.plan)
    && (value.status === 'available' || value.status === 'low' || value.status === 'exhausted' || value.status === 'error')
    && isNullablePercent(value.remainingPercent)
    && isNullableString(value.resetAt)
    && Array.isArray(value.secondaryWindows)
    && value.secondaryWindows.every(isQuotaWindow)
    && (value.errorCode === null || (typeof value.errorCode === 'string' && quotaErrorCodes.has(value.errorCode as QuotaErrorCode)))
}

function parseQuotaSnapshot(value: unknown): QuotaSnapshot {
  if (!isRecord(value)
    || !hasExactKeys(value, ['fetchedAt', 'accounts', 'partial', 'sourceStatus'])
    || typeof value.fetchedAt !== 'string'
    || !Array.isArray(value.accounts)
    || !value.accounts.every(isQuotaAccount)
    || typeof value.partial !== 'boolean'
    || (value.sourceStatus !== 'ok' && value.sourceStatus !== 'partial' && value.sourceStatus !== 'unavailable')) {
    throw new BrowserApiError('invalid-response')
  }
  return value as unknown as QuotaSnapshot
}

function isDiscoveredAccountPreview(value: unknown): value is DiscoveredAccountPreview {
  return isRecord(value)
    && hasExactKeys(value, ['id', 'provider', 'label', 'supported'])
    && typeof value.id === 'string'
    && typeof value.provider === 'string'
    && typeof value.label === 'string'
    && typeof value.supported === 'boolean'
}

function isUnsupportedProvider(value: unknown): value is { provider: string; count: number } {
  return isRecord(value)
    && hasExactKeys(value, ['provider', 'count'])
    && typeof value.provider === 'string'
    && Number.isSafeInteger(value.count)
    && (value.count as number) >= 0
}

function parseConnectionTestResult(value: unknown): ConnectionTestResult {
  const validErrorCode = value && isRecord(value)
    && (value.errorCode === null
      || value.errorCode === 'authorization'
      || value.errorCode === 'unreachable'
      || value.errorCode === 'timeout'
      || value.errorCode === 'incompatible-response')
  if (!isRecord(value)
    || !hasExactKeys(value, ['status', 'checkedAt', 'discoveredAccounts', 'unsupportedProviders', 'errorCode'])
    || (value.status !== 'ok' && value.status !== 'partial' && value.status !== 'failed' && value.status !== 'not-configured')
    || typeof value.checkedAt !== 'string'
    || !Array.isArray(value.discoveredAccounts)
    || !value.discoveredAccounts.every(isDiscoveredAccountPreview)
    || !Array.isArray(value.unsupportedProviders)
    || !value.unsupportedProviders.every(isUnsupportedProvider)
    || !validErrorCode) {
    throw new BrowserApiError('invalid-response')
  }
  return value as unknown as ConnectionTestResult
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new BrowserApiError('unavailable')
  try {
    return await response.json()
  } catch {
    throw new BrowserApiError('invalid-response')
  }
}

export function createModelQuotaBrowserApi(fetchImpl: typeof fetch = fetch): ModelQuotaBrowserApi {
  return {
    async getSnapshot(signal?: AbortSignal) {
      const response = await fetchImpl('/api/model-quota', signal ? { method: 'GET', signal } : { method: 'GET' })
      return parseQuotaSnapshot(await readJson(response))
    },
    async testConnection(signal?: AbortSignal) {
      const response = await fetchImpl('/api/model-quota/test-connection', signal ? { method: 'POST', signal } : { method: 'POST' })
      return parseConnectionTestResult(await readJson(response))
    },
  }
}
