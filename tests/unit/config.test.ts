import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { describe, expect, it, vi } from 'vitest'
import { Config, createConfigStore, defaultConfig, installModelQuotaSettings, normalizeConfig } from '../../src/config.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected async load(): Promise<Record<string, unknown>> {
    return {}
  }

  protected async persist(): Promise<void> {}
}

describe('model quota config', () => {
  it('uses the documented defaults and secret schema role', () => {
    expect(Config()).toEqual({ ...defaultConfig, managementKey: undefined })
    expect(Config.dict?.managementKey?.meta.role).toBe('secret')
  })

  it('validates numeric ranges and normalizes the base URL', () => {
    expect(normalizeConfig(defaultConfig).baseUrl.href).toBe('http://127.0.0.1:8317/')
    expect(() => normalizeConfig({ ...defaultConfig, refreshIntervalSeconds: 29 })).toThrow()
    expect(() => normalizeConfig({ ...defaultConfig, postTurnRefreshDelaySeconds: 31 })).toThrow()
    expect(() => normalizeConfig({ ...defaultConfig, requestTimeoutSeconds: 1 })).toThrow()
  })

  it('increments generation only for valid updates and notifies subscribers', () => {
    const store = createConfigStore(defaultConfig)
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.update({ ...defaultConfig, requestTimeoutSeconds: 12 }).generation).toBe(1)
    expect(listener).toHaveBeenCalledOnce()
    expect(() => store.update({ ...defaultConfig, baseUrl: 'http://example.com' })).toThrow()
    expect(store.getSnapshot().generation).toBe(1)
  })

  it('installs the legal namespace with live validation and source hooks', async () => {
    const ctx = new Context()
    const settingsFiber = ctx.plugin(MemorySettings)
    await settingsFiber
    const store = createConfigStore(defaultConfig)
    const entry = { ...defaultConfig, managementKey: undefined }
    const pluginFiber = ctx.plugin((pluginCtx) => installModelQuotaSettings(pluginCtx, entry, store))
    await pluginFiber

    const namespace = settingsNamespace('model-quota')
    const descriptor = ctx.settings.describe({ redactSecrets: true }).find(({ ns }) => ns === namespace)
    expect(descriptor).toMatchObject({
      ns: namespace,
      applies: 'live',
      value: {
        baseUrl: defaultConfig.baseUrl,
        refreshIntervalSeconds: 60,
        postTurnRefreshDelaySeconds: 3,
        requestTimeoutSeconds: 10,
      },
      secrets: [{ path: ['managementKey'], set: false }],
    })
    expect(JSON.stringify(descriptor)).not.toContain('managementKey":"')

    await ctx.settings.mutate(namespace, [{ op: 'set', path: ['requestTimeoutSeconds'], value: 15 }], descriptor?.revision)
    await vi.waitFor(() => expect(store.getSnapshot()).toMatchObject({ generation: 2, config: { requestTimeoutSeconds: 15 } }))

    const generation = store.getSnapshot().generation
    await expect(ctx.settings.mutate(namespace, [{ op: 'set', path: ['baseUrl'], value: 'http://example.com' }])).rejects.toThrow()
    expect(store.getSnapshot().generation).toBe(generation)

    await settingsFiber.dispose()
    await vi.waitFor(() => expect(store.getSnapshot()).toMatchObject({ generation: generation + 1, config: { requestTimeoutSeconds: 10 } }))
    await pluginFiber.dispose()
  })
})
