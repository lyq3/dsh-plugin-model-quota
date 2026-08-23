// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  createSnapshotStore<T>(initial: T) {
    let snapshot = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => snapshot,
      subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
      set(next: T) { snapshot = next; listeners.forEach((listener) => listener()) },
    }
  },
}))
import { ModelQuotaSettingsController, type ModelQuotaSettings } from '../../src/client/settings-controller.ts'

function scopeFixture() {
  let snapshot: SettingsScopeSnapshot<ModelQuotaSettings> = {
    status: 'ready',
    value: {
      baseUrl: 'http://127.0.0.1:8317/',
      refreshIntervalSeconds: 60,
      postTurnRefreshDelaySeconds: 3,
      requestTimeoutSeconds: 10,
    },
    base: {},
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
  }
  const listeners = new Set<() => void>()
  const set = vi.fn(async (field: string, value: unknown) => {
    snapshot = { ...snapshot, value: { ...snapshot.value!, [field]: value } }
    listeners.forEach((listener) => listener())
  })
  const unset = vi.fn(async (field: string) => {
    const next = { ...snapshot.value! }
    delete (next as Record<string, unknown>)[field]
    snapshot = { ...snapshot, value: next }
    listeners.forEach((listener) => listener())
  })
  const scope: SettingsScope<ModelQuotaSettings> = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    set,
    unset,
  }
  return { scope, set, unset }
}

const api = {
  getSnapshot: vi.fn(),
  testConnection: vi.fn(async () => ({
    status: 'ok' as const,
    checkedAt: '2026-08-21T10:00:00.000Z',
    discoveredAccounts: [],
    unsupportedProviders: [],
    errorCode: null,
  })),
}

describe('ModelQuotaSettingsController', () => {
  it('writes only changed ordinary fields and preserves an untouched secret', async () => {
    const fixture = scopeFixture()
    const controller = new ModelQuotaSettingsController(fixture.scope, api, () => true)
    const face = controller.inject()
    face.edit('baseUrl', 'https://quota.example/')
    face.edit('refreshIntervalSeconds', '90')
    face.save()
    await vi.waitFor(() => expect(fixture.set).toHaveBeenCalledTimes(2))
    expect(fixture.set).toHaveBeenCalledWith('baseUrl', 'https://quota.example/')
    expect(fixture.set).toHaveBeenCalledWith('refreshIntervalSeconds', 90)
    expect(fixture.set).not.toHaveBeenCalledWith('managementKey', expect.anything())
    expect(fixture.unset).not.toHaveBeenCalledWith('managementKey')
    controller.dispose()
  })

  it('writes a new secret one-way and clears it only on explicit unset', async () => {
    const fixture = scopeFixture()
    const controller = new ModelQuotaSettingsController(fixture.scope, api, () => true)
    const face = controller.inject()
    face.edit('managementKey', 'new-secret')
    face.save()
    await vi.waitFor(() => expect(fixture.set).toHaveBeenCalledWith('managementKey', 'new-secret'))

    face.setClearManagementKey(true)
    face.save()
    await vi.waitFor(() => expect(fixture.unset).toHaveBeenCalledWith('managementKey'))
    controller.dispose()
  })

  it('does not test an unsaved draft configuration', async () => {
    const fixture = scopeFixture()
    const testConnection = vi.fn(api.testConnection)
    const controller = new ModelQuotaSettingsController(fixture.scope, { ...api, testConnection }, () => true)
    const face = controller.inject()
    face.edit('baseUrl', 'https://draft.example/')
    face.testConnection()
    await Promise.resolve()
    expect(testConnection).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('calls only the fixed browser connection-test method and publishes previews', async () => {
    const fixture = scopeFixture()
    const testConnection = vi.fn(async () => ({
      status: 'partial' as const,
      checkedAt: '2026-08-21T10:00:00.000Z',
      discoveredAccounts: [{ id: 'a', provider: 'codex', label: 'account-a', supported: true }],
      unsupportedProviders: [{ provider: 'gemini', count: 2 }],
      errorCode: null,
    }))
    const controller = new ModelQuotaSettingsController(fixture.scope, { ...api, testConnection }, () => true)
    controller.inject().testConnection()
    await vi.waitFor(() => expect(testConnection).toHaveBeenCalledTimes(1))
    expect(controller.inject().hooks.modelQuotaSettings.getSnapshot().connectionResult?.unsupportedProviders).toEqual([{ provider: 'gemini', count: 2 }])
    controller.dispose()
  })
})
