import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelQuotaBrowserApi } from './api.ts'
import type {
  ConnectionTestView,
  ModelQuotaSettingsFace,
  ModelQuotaSettingsState,
  SettingsFieldState,
} from './components/ModelQuotaSettingsCard.tsx'

export interface ModelQuotaSettings {
  baseUrl: string
  refreshIntervalSeconds: number
  postTurnRefreshDelaySeconds: number
  requestTimeoutSeconds: number
}

type EditableField = 'baseUrl' | 'managementKey' | 'refreshIntervalSeconds' | 'postTurnRefreshDelaySeconds' | 'requestTimeoutSeconds'

const numericLimits = {
  refreshIntervalSeconds: [30, 900],
  postTurnRefreshDelaySeconds: [1, 30],
  requestTimeoutSeconds: [2, 30],
} as const

export class ModelQuotaSettingsController {
  private readonly store: SnapshotStore<ModelQuotaSettingsState>
  private readonly drafts = new Map<EditableField, string>()
  private clearManagementKey = false
  private saving = false
  private saveStatus: ModelQuotaSettingsState['saveStatus'] = 'idle'
  private testingConnection = false
  private connectionResult: ConnectionTestView | null = null
  private readonly unsubscribe: () => void

  constructor(
    private readonly scope: SettingsScope<ModelQuotaSettings>,
    private readonly api: ModelQuotaBrowserApi,
    private readonly managementKeyConfigured: () => boolean,
  ) {
    this.store = createSnapshotStore(this.project())
    this.unsubscribe = scope.subscribe(() => this.publish())
  }

  inject(): ModelQuotaSettingsFace {
    return {
      hooks: { modelQuotaSettings: this.store },
      edit: (field, text) => {
        this.drafts.set(field, text)
        if (field === 'managementKey' && text !== '') this.clearManagementKey = false
        this.saveStatus = 'idle'
        this.publish()
      },
      setClearManagementKey: (clear) => {
        this.clearManagementKey = clear
        if (clear) this.drafts.delete('managementKey')
        this.saveStatus = 'idle'
        this.publish()
      },
      save: () => { void this.save() },
      testConnection: () => { void this.testConnection() },
    }
  }

  refresh(): void {
    this.publish()
  }

  dispose(): void {
    this.unsubscribe()
  }

  private async save(): Promise<void> {
    const state = this.project()
    if (!state.writable || !state.dirty || this.invalid()) return
    this.saving = true
    this.saveStatus = 'idle'
    this.publish()
    try {
      for (const field of ['baseUrl', 'refreshIntervalSeconds', 'postTurnRefreshDelaySeconds', 'requestTimeoutSeconds'] as const) {
        const draft = this.drafts.get(field)
        if (draft === undefined) continue
        if (draft.trim() === '') await this.scope.unset(field)
        else await this.scope.set(field, field === 'baseUrl' ? draft.trim() : Number(draft))
      }
      const key = this.drafts.get('managementKey')
      if (key !== undefined && key !== '') await this.scope.set('managementKey', key)
      else if (this.clearManagementKey) await this.scope.unset('managementKey')
      this.drafts.clear()
      this.clearManagementKey = false
      this.saveStatus = 'saved'
    } catch {
      this.saveStatus = 'failed'
    } finally {
      this.saving = false
      this.publish()
    }
  }

  private async testConnection(): Promise<void> {
    if (this.testingConnection || this.project().dirty) return
    this.testingConnection = true
    this.publish()
    try {
      this.connectionResult = await this.api.testConnection()
    } catch {
      this.connectionResult = {
        status: 'failed',
        checkedAt: new Date().toISOString(),
        discoveredAccounts: [],
        unsupportedProviders: [],
        errorCode: 'unreachable',
      }
    } finally {
      this.testingConnection = false
      this.publish()
    }
  }

  private field(name: EditableField, stored: unknown): SettingsFieldState {
    const text = this.drafts.get(name) ?? (typeof stored === 'string' || typeof stored === 'number' ? String(stored) : '')
    return { text, invalid: this.fieldInvalid(name, text) }
  }

  private fieldInvalid(name: EditableField, text: string): boolean {
    if (name === 'baseUrl' || name === 'managementKey' || text.trim() === '') return false
    const value = Number(text)
    const limits = numericLimits[name]
    return !Number.isInteger(value) || value < limits[0] || value > limits[1]
  }

  private invalid(): boolean {
    return ([...this.drafts] as Array<[EditableField, string]>).some(([field, text]) => this.fieldInvalid(field, text))
  }

  private project(): ModelQuotaSettingsState {
    const snapshot = this.scope.getSnapshot()
    const value = snapshot.value
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: this.drafts.size > 0 || this.clearManagementKey,
      saving: this.saving,
      saveStatus: this.saveStatus,
      baseUrl: this.field('baseUrl', value?.baseUrl),
      managementKey: this.field('managementKey', ''),
      managementKeyConfigured: this.managementKeyConfigured(),
      clearManagementKey: this.clearManagementKey,
      refreshIntervalSeconds: this.field('refreshIntervalSeconds', value?.refreshIntervalSeconds),
      postTurnRefreshDelaySeconds: this.field('postTurnRefreshDelaySeconds', value?.postTurnRefreshDelaySeconds),
      requestTimeoutSeconds: this.field('requestTimeoutSeconds', value?.requestTimeoutSeconds),
      testingConnection: this.testingConnection,
      connectionResult: this.connectionResult,
    }
  }

  private publish(): void {
    this.store.set(this.project())
  }
}
