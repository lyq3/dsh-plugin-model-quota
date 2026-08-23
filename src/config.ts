import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { normalizeBaseUrl } from './quota/base-url.ts'

export interface ModelQuotaConfig {
  baseUrl: string
  managementKey?: string
  refreshIntervalSeconds: number
  postTurnRefreshDelaySeconds: number
  requestTimeoutSeconds: number
}

export interface NormalizedModelQuotaConfig extends Omit<ModelQuotaConfig, 'baseUrl'> {
  baseUrl: URL
}

export interface ConfigSnapshot {
  readonly generation: number
  readonly config: Readonly<NormalizedModelQuotaConfig>
}

export interface ModelQuotaConfigStore {
  getSnapshot(): ConfigSnapshot
  update(next: ModelQuotaConfig): ConfigSnapshot
  subscribe(listener: (snapshot: ConfigSnapshot) => void): () => void
}

export const defaultConfig: ModelQuotaConfig = Object.freeze({
  baseUrl: 'http://127.0.0.1:8317',
  managementKey: '',
  refreshIntervalSeconds: 60,
  postTurnRefreshDelaySeconds: 3,
  requestTimeoutSeconds: 10,
})

export const Config: Schema<ModelQuotaConfig> = Schema.object({
  baseUrl: Schema.string().default(defaultConfig.baseUrl),
  managementKey: Schema.string().role('secret'),
  refreshIntervalSeconds: Schema.number().min(30).max(900).step(1).default(defaultConfig.refreshIntervalSeconds),
  postTurnRefreshDelaySeconds: Schema.number().min(1).max(30).step(1).default(defaultConfig.postTurnRefreshDelaySeconds),
  requestTimeoutSeconds: Schema.number().min(2).max(30).step(1).default(defaultConfig.requestTimeoutSeconds),
})

function boundedInteger(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new TypeError(`${name} is outside its allowed range`)
  return value
}

export function normalizeConfig(input: ModelQuotaConfig): NormalizedModelQuotaConfig {
  return Object.freeze({
    baseUrl: normalizeBaseUrl(input.baseUrl),
    managementKey: input.managementKey ?? '',
    refreshIntervalSeconds: boundedInteger(input.refreshIntervalSeconds, 30, 900, 'refreshIntervalSeconds'),
    postTurnRefreshDelaySeconds: boundedInteger(input.postTurnRefreshDelaySeconds, 1, 30, 'postTurnRefreshDelaySeconds'),
    requestTimeoutSeconds: boundedInteger(input.requestTimeoutSeconds, 2, 30, 'requestTimeoutSeconds'),
  })
}

export function validateConfig(input: ModelQuotaConfig): void {
  normalizeConfig(input)
}

export function createConfigStore(initial: ModelQuotaConfig): ModelQuotaConfigStore {
  let snapshot: ConfigSnapshot = Object.freeze({ generation: 0, config: normalizeConfig(initial) })
  const listeners = new Set<(snapshot: ConfigSnapshot) => void>()
  return {
    getSnapshot: () => snapshot,
    update(next) {
      const config = normalizeConfig(next)
      snapshot = Object.freeze({ generation: snapshot.generation + 1, config })
      for (const listener of listeners) listener(snapshot)
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function installModelQuotaSettings(ctx: Context, entry: ModelQuotaConfig, store: ModelQuotaConfigStore): void {
  let source = () => entry
  installSettingsSection(ctx, settingsNamespace('model-quota'), Config, entry, {
    setSource(current) { source = current },
    validate: validateConfig,
    onChange() { store.update(source()) },
  })
}
