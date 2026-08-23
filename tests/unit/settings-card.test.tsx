// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModelQuotaSettingsCard, type ModelQuotaSettingsState } from '../../src/client/components/ModelQuotaSettingsCard.tsx'
import { createSelectorStore, renderInDocument, translator } from './model-quota-component-test-helper.tsx'

const state: ModelQuotaSettingsState = {
  available: true,
  writable: true,
  dirty: false,
  saving: false,
  saveStatus: 'saved',
  baseUrl: { text: 'http://127.0.0.1:8317/', invalid: false },
  managementKey: { text: '', invalid: false },
  managementKeyConfigured: true,
  clearManagementKey: false,
  refreshIntervalSeconds: { text: '60', invalid: false },
  postTurnRefreshDelaySeconds: { text: '3', invalid: false },
  requestTimeoutSeconds: { text: '10', invalid: false },
  testingConnection: false,
  connectionResult: {
    status: 'partial',
    checkedAt: '2026-08-21T10:00:00.000Z',
    errorCode: null,
    discoveredAccounts: [
      { id: 'acct-a', provider: 'codex', label: 'account-a', supported: true },
      { id: 'acct-b', provider: 'kimi', label: 'account-b', supported: true },
      { id: 'acct-c', provider: 'gemini', label: 'account-c', supported: false },
    ],
    unsupportedProviders: [{ provider: 'gemini', count: 1 }, { provider: 'unknown', count: 2 }],
  },
}

function setup(next: ModelQuotaSettingsState = state, locale: 'zh' | 'en' = 'en') {
  const store = createSelectorStore(next)
  const edit = vi.fn()
  const setClearManagementKey = vi.fn()
  const save = vi.fn()
  const testConnection = vi.fn()
  renderInDocument(
    <ModelQuotaSettingsCard
      t={translator(locale)}
      useModelQuotaSettings={store.useStore}
      edit={edit}
      setClearManagementKey={setClearManagementKey}
      save={save}
      testConnection={testConnection}
      formatDateTime={(iso) => `date:${iso}`}
    />,
  )
  return { edit, setClearManagementKey, save, testConnection }
}

describe('ModelQuotaSettingsCard', () => {
  it('renders Base URL, a blank write-only key, three numeric fields and save state', () => {
    setup()
    expect((screen.getByLabelText('CLIProxyAPI Base URL') as HTMLInputElement).value).toBe('http://127.0.0.1:8317/')
    const key = screen.getByLabelText('Enter a new Management Key') as HTMLInputElement
    expect(key.type).toBe('password')
    expect(key.value).toBe('')
    expect(screen.getAllByText('Configured').length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Refresh interval') as HTMLInputElement).value).toBe('60')
    expect((screen.getByLabelText('Post-turn refresh delay') as HTMLInputElement).value).toBe('3')
    expect((screen.getByLabelText('Request timeout') as HTMLInputElement).value).toBe('10')
    expect(screen.getByText('Saved')).not.toBeNull()
  })

  it('only calls the injected face for edits, key clear, save and fixed connection test', () => {
    const dirty = { ...state, dirty: true, saveStatus: 'idle' as const }
    const faces = setup(dirty)
    fireEvent.change(screen.getByLabelText('CLIProxyAPI Base URL'), { target: { value: 'https://quota.example/' } })
    fireEvent.change(screen.getByLabelText('Enter a new Management Key'), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByLabelText('Clear saved key'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(faces.edit).toHaveBeenCalledWith('baseUrl', 'https://quota.example/')
    expect(faces.edit).toHaveBeenCalledWith('managementKey', 'new-key')
    expect(faces.setClearManagementKey).toHaveBeenCalledWith(true)
    expect(faces.save).toHaveBeenCalledTimes(1)

    const cleanFaces = setup()
    fireEvent.click(screen.getAllByRole('button', { name: 'Test connection' }).at(-1)!)
    expect(cleanFaces.testConnection).toHaveBeenCalledTimes(1)
  })

  it('shows arbitrary discovered accounts and unknown provider counts without sensitive fields', () => {
    setup()
    expect(screen.getByText('account-a')).not.toBeNull()
    expect(screen.getByText('account-b')).not.toBeNull()
    expect(screen.getByText('account-c')).not.toBeNull()
    expect(screen.getByText('Discovered but not yet supported')).not.toBeNull()
    expect(screen.getByText('unknown')).not.toBeNull()
    expect(document.body.textContent).not.toContain('auth index')
    expect(document.body.textContent).not.toContain('raw body')
  })

  it('localizes visible text and ARIA labels in Chinese', () => {
    setup(state, 'zh')
    expect(screen.getByRole('region', { name: '模型额度设置' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '测试连接' })).not.toBeNull()
    expect(screen.getByLabelText('输入新的 Management Key')).not.toBeNull()
  })

  it('disables testing while settings are dirty and blocks invalid saves', () => {
    setup({
      ...state,
      dirty: true,
      saveStatus: 'idle',
      refreshIntervalSeconds: { text: 'x', invalid: true },
    })
    expect((screen.getByRole('button', { name: 'Test connection' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
