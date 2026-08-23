export type SupportedProvider = 'codex' | 'kimi'

export interface HostOnlyCredentialRef {
  provider: string
  canonicalAuthIndex: string
  label: string
  accountId?: string
}

export interface DiscoveredCredentials {
  credentials: HostOnlyCredentialRef[]
  unsupportedProviders: Array<{ provider: string; count: number }>
}

export interface ProviderRequest {
  method: 'GET' | 'POST'
  url: string
  headers: Readonly<Record<string, string>>
}

export interface QuotaWindow {
  id: string
  label: string
  remainingPercent: number | null
  resetAt: string | null
}

export interface ParsedQuota {
  plan: string | null
  remainingPercent: number | null
  resetAt: string | null
  secondaryWindows: QuotaWindow[]
}

export interface QuotaAdapter {
  readonly provider: SupportedProvider
  createRequest(credential: HostOnlyCredentialRef): ProviderRequest
  parseQuota(payload: unknown, now: Date): ParsedQuota
}

export type QuotaErrorCode =
  | 'credential'
  | 'upstream'
  | 'timeout'
  | 'incompatible-response'

export interface AccountQuotaPayload {
  credential: HostOnlyCredentialRef
  payload: unknown
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

export interface SafeLogger {
  warn(message: string, fields?: Readonly<Record<string, string | number | boolean>>): void
}
