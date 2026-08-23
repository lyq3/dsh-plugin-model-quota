import type { ChangeEvent } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/lib/types/client/slot-contract'

export interface SettingsFieldState {
  text: string
  invalid: boolean
}

export interface ModelQuotaSettingsState {
  available: boolean
  writable: boolean
  dirty: boolean
  saving: boolean
  saveStatus: 'idle' | 'saved' | 'failed'
  baseUrl: SettingsFieldState
  managementKey: SettingsFieldState
  managementKeyConfigured: boolean
  clearManagementKey: boolean
  refreshIntervalSeconds: SettingsFieldState
  postTurnRefreshDelaySeconds: SettingsFieldState
  requestTimeoutSeconds: SettingsFieldState
  testingConnection: boolean
  connectionResult: ConnectionTestView | null
}

export interface DiscoveredAccountView {
  id: string
  provider: string
  label: string
  supported: boolean
}

export interface ConnectionTestView {
  status: 'ok' | 'partial' | 'failed' | 'not-configured'
  checkedAt: string
  discoveredAccounts: DiscoveredAccountView[]
  unsupportedProviders: Array<{ provider: string; count: number }>
  errorCode: 'authorization' | 'unreachable' | 'timeout' | 'incompatible-response' | null
}

export interface ModelQuotaSettingsFace {
  hooks: {
    modelQuotaSettings: {
      getSnapshot(): ModelQuotaSettingsState
      subscribe(listener: () => void): () => void
    }
  }
  edit: (field: keyof EditableSettingsFields, text: string) => void
  setClearManagementKey: (clear: boolean) => void
  save: () => void
  testConnection: () => void
}

interface EditableSettingsFields {
  baseUrl: string
  managementKey: string
  refreshIntervalSeconds: string
  postTurnRefreshDelaySeconds: string
  requestTimeoutSeconds: string
}

export type ModelQuotaSettingsInjected = {
  useModelQuotaSettings: SnapshotSelectorHook<ModelQuotaSettingsState>
  edit: ModelQuotaSettingsFace['edit']
  setClearManagementKey: ModelQuotaSettingsFace['setClearManagementKey']
  save: ModelQuotaSettingsFace['save']
  testConnection: ModelQuotaSettingsFace['testConnection']
}

export type ModelQuotaSettingsCardProps = Partial<PropsRuntime<'settings.plugin.item', 'model-quota'>> &
  PropsLocale<'model-quota'> &
  InjectFace<ModelQuotaSettingsFace> & {
    formatDateTime?: (iso: string) => string
  }

function defaultFormatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function ConnectionStatus({ result, t, formatDateTime }: {
  result: ConnectionTestView
  t: ModelQuotaSettingsCardProps['t']
  formatDateTime: (iso: string) => string
}) {
  const errorKey = result.errorCode === 'incompatible-response'
    ? 'settings.connection.incompatibleResponse'
    : result.errorCode === null
      ? null
      : `settings.connection.${result.errorCode}` as const
  const statusKey = result.status === 'not-configured'
    ? 'settings.connection.notConfigured'
    : `settings.connection.${result.status}` as const
  return (
    <div className="mq-connection" role="status">
      <p>{t(errorKey ?? statusKey)}</p>
      <p className="mq-preview__meta">{t('settings.checkedAt', { time: formatDateTime(result.checkedAt) })}</p>
    </div>
  )
}

function TextField({ id, label, hint, invalidText, field, type = 'text', inputMode, disabled, ariaLabel, onChange }: {
  id: string
  label: string
  hint: string
  invalidText: string
  field: SettingsFieldState
  type?: 'text' | 'password' | 'number' | 'url'
  inputMode?: 'numeric'
  disabled: boolean
  ariaLabel?: string
  onChange: (text: string) => void
}) {
  return (
    <div className={id === 'model-quota-base-url' ? 'mq-field mq-field--wide' : 'mq-field'}>
      <label className="mq-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="mq-input"
        type={type}
        inputMode={inputMode}
        value={field.text}
        aria-label={ariaLabel}
        aria-invalid={field.invalid}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
      />
      <span className={field.invalid ? 'mq-field-error' : 'mq-hint'}>{field.invalid ? invalidText : hint}</span>
    </div>
  )
}

export function ModelQuotaSettingsCard({
  t,
  useModelQuotaSettings,
  edit,
  setClearManagementKey,
  save,
  testConnection,
  formatDateTime = defaultFormatDateTime,
}: ModelQuotaSettingsCardProps) {
  const state = useModelQuotaSettings((snapshot) => snapshot)
  if (!state.available) return null

  const disabled = !state.writable || state.saving
  const invalid = [
    state.baseUrl,
    state.managementKey,
    state.refreshIntervalSeconds,
    state.postTurnRefreshDelaySeconds,
    state.requestTimeoutSeconds,
  ].some((field) => field.invalid)
  const result = state.connectionResult
  const accounts = result?.discoveredAccounts ?? []
  const unsupported = result?.unsupportedProviders ?? []
  const saveState = state.saving
    ? t('settings.saving')
    : state.saveStatus === 'failed'
      ? t('settings.saveFailed')
      : state.dirty
        ? t('settings.unsaved')
        : state.saveStatus === 'saved'
          ? t('settings.saved')
          : ''

  return (
    <section className="mq-card" aria-label={t('settings.aria.card')}>
      <header className="mq-card__header">
        <div>
          <h3 className="mq-card__title">{t('settings.title')}</h3>
          <p className="mq-card__description">{t('settings.description')}</p>
        </div>
        <span className="mq-badge">
          {state.managementKeyConfigured ? t('settings.keyConfigured') : t('settings.keyNotConfigured')}
        </span>
      </header>

      <div className="mq-form">
        <TextField
          id="model-quota-base-url"
          label={t('settings.baseUrl')}
          hint={t('settings.baseUrlHint')}
          invalidText={t('settings.invalidNumber')}
          field={state.baseUrl}
          type="url"
          disabled={disabled}
          onChange={(text) => edit('baseUrl', text)}
        />

        <div className="mq-field mq-field--wide">
          <div className="mq-field__head">
            <label className="mq-label" htmlFor="model-quota-management-key">{t('settings.managementKey')}</label>
            <span className="mq-badge">
              {state.managementKeyConfigured ? t('settings.keyConfigured') : t('settings.keyNotConfigured')}
            </span>
          </div>
          <div className="mq-secret-row">
            <input
              id="model-quota-management-key"
              className="mq-input"
              type="password"
              autoComplete="new-password"
              value={state.managementKey.text}
              aria-label={t('settings.aria.keyInput')}
              aria-invalid={state.managementKey.invalid}
              disabled={disabled || state.clearManagementKey}
              onChange={(event) => edit('managementKey', event.currentTarget.value)}
            />
            {state.managementKeyConfigured ? (
              <label className="mq-button">
                <input
                  type="checkbox"
                  checked={state.clearManagementKey}
                  disabled={disabled}
                  onChange={(event) => setClearManagementKey(event.currentTarget.checked)}
                />{' '}
                {t('settings.clearKey')}
              </label>
            ) : null}
          </div>
          <span className="mq-hint">{t('settings.managementKeyHint')}</span>
        </div>

        <TextField
          id="model-quota-refresh-interval"
          label={t('settings.refreshInterval')}
          hint={t('settings.seconds')}
          invalidText={t('settings.invalidNumber')}
          field={state.refreshIntervalSeconds}
          type="number"
          inputMode="numeric"
          disabled={disabled}
          onChange={(text) => edit('refreshIntervalSeconds', text)}
        />
        <TextField
          id="model-quota-post-turn-delay"
          label={t('settings.postTurnDelay')}
          hint={t('settings.seconds')}
          invalidText={t('settings.invalidNumber')}
          field={state.postTurnRefreshDelaySeconds}
          type="number"
          inputMode="numeric"
          disabled={disabled}
          onChange={(text) => edit('postTurnRefreshDelaySeconds', text)}
        />
        <TextField
          id="model-quota-request-timeout"
          label={t('settings.requestTimeout')}
          hint={t('settings.seconds')}
          invalidText={t('settings.invalidNumber')}
          field={state.requestTimeoutSeconds}
          type="number"
          inputMode="numeric"
          disabled={disabled}
          onChange={(text) => edit('requestTimeoutSeconds', text)}
        />

        {result !== null ? <ConnectionStatus result={result} t={t} formatDateTime={formatDateTime} /> : null}

        {result !== null ? (
          <section className="mq-preview" aria-labelledby="model-quota-accounts-title">
            <header className="mq-preview__header">
              <h4 className="mq-section-title" id="model-quota-accounts-title">{t('settings.accountsTitle')}</h4>
              <span className="mq-preview__meta">{t('settings.accountsCount', { count: accounts.length })}</span>
            </header>
            {accounts.length === 0 ? <p className="mq-preview__meta">{t('settings.noAccounts')}</p> : (
              <ul className="mq-preview-list">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <span className="mq-preview__identity">
                      <span className="mq-preview__provider">{account.provider}</span>
                      {account.label}
                    </span>
                    <span className="mq-badge">{t(account.supported ? 'settings.supported' : 'settings.unsupported')}</span>
                  </li>
                ))}
              </ul>
            )}
            {unsupported.length > 0 ? (
              <div>
                <h4 className="mq-section-title">{t('settings.unsupportedTitle')}</h4>
                <ul className="mq-unsupported-list">
                  {unsupported.map((item) => (
                    <li key={item.provider}><span>{item.provider || t('settings.unknownProvider')}</span><span>{item.count}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mq-actions">
          <span className={`mq-save-state${state.saveStatus === 'failed' ? ' mq-save-state--failed' : ''}`} role="status">{saveState}</span>
          <button
            type="button"
            className="mq-button"
            disabled={state.testingConnection || state.saving || state.dirty}
            title={state.dirty ? t('settings.testFirstSave') : undefined}
            onClick={testConnection}
          >
            {state.testingConnection ? t('settings.testingConnection') : t('settings.testConnection')}
          </button>
          <button
            type="button"
            className="mq-button mq-button--primary"
            disabled={disabled || !state.dirty || invalid}
            onClick={save}
          >
            {state.saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </section>
  )
}
