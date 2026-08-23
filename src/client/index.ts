import { createElement, useEffect } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/lib/types/client/index'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/lib/types/client/settings-scope'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/lib/types/client/slot-contract'
import { createModelQuotaBrowserApi } from './api.ts'
import { ModelQuotaSettingsCard } from './components/ModelQuotaSettingsCard.tsx'
import { QuotaDock } from './components/QuotaDock.tsx'
import { MODEL_QUOTA_LOCALE_NAMESPACE, modelQuotaLocales } from './locales.ts'
import { createQuotaController } from './quota-controller.ts'
import { ModelQuotaSettingsController, type ModelQuotaSettings } from './settings-controller.ts'
import { injectModelQuotaStyles } from './styles.ts'

export const inject = ['locale', 'slots', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const api = createModelQuotaBrowserApi()
  const scope = ctx.settingsScope.bind<ModelQuotaSettings>({
    namespace: 'model-quota',
    decode: decodeSettings,
  })
  const timing = controllerConfig(scope.getSnapshot().value)
  const controller = createQuotaController({
    api,
    initialConfig: timing,
    document,
  })
  const describe = ctx.settingsScope.describe()
  const isManagementKeyConfigured = () => {
    const view = describe.getSnapshot().view?.namespaces.find((candidate) => candidate.ns === 'model-quota')
    return view?.secrets.some((secret: { set: boolean; path: string[] }) => secret.set && secret.path.length === 1 && secret.path[0] === 'managementKey') === true
  }
  const settings = new ModelQuotaSettingsController(scope, api, isManagementKeyConfigured)

  ctx.effect(() => ctx.locale.register(MODEL_QUOTA_LOCALE_NAMESPACE, modelQuotaLocales), 'model-quota: dictionaries')
  ctx.effect(() => injectModelQuotaStyles(), 'model-quota: styles')
  ctx.effect(() => {
    let settingsRefresh: ReturnType<typeof setTimeout> | null = null
    const unsubscribeScope = scope.subscribe(() => {
      controller.updateConfig(controllerConfig(scope.getSnapshot().value))
      if (settingsRefresh !== null) clearTimeout(settingsRefresh)
      settingsRefresh = setTimeout(() => {
        settingsRefresh = null
        void controller.refresh('settings-live')
      }, 0)
    })
    const unsubscribeDescribe = describe.subscribe(() => settings.refresh())
    return () => {
      if (settingsRefresh !== null) clearTimeout(settingsRefresh)
      unsubscribeScope()
      unsubscribeDescribe()
      settings.dispose()
      controller.dispose()
    }
  }, 'model-quota: controllers')

  ctx.effect(() => controller.startVisiblePolling(), 'model-quota: visible polling')

  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.composer.dock',
        id: 'model-quota',
        order: 100,
        locale: MODEL_QUOTA_LOCALE_NAMESPACE,
        inject: () => ({
          hooks: { quotaDock: controller },
          refresh: () => { void controller.refresh('manual') },
          setExpanded: (expanded: boolean) => controller.setExpanded(expanded),
        }),
      },
      function ModelQuotaDockEntry(props) {
        const running = (props as PropsRuntime<'conversation.composer.dock'>).session.running
        useEffect(() => {
          controller.onSessionRunningChanged(running)
        }, [running])
        return createElement(QuotaDock, props as unknown as Parameters<typeof QuotaDock>[0])
      },
    ),
  )

  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register(
      {
        name: 'settings.plugin.item',
        key: 'model-quota',
        locale: MODEL_QUOTA_LOCALE_NAMESPACE,
        inject: () => settings.inject(),
      },
      ModelQuotaSettingsCard,
    ),
  )
}

function decodeSettings(section: unknown): ModelQuotaSettings | undefined {
  if (!isRecord(section)) return undefined
  const { baseUrl, refreshIntervalSeconds, postTurnRefreshDelaySeconds, requestTimeoutSeconds } = section
  if (
    typeof baseUrl !== 'string' ||
    typeof refreshIntervalSeconds !== 'number' ||
    typeof postTurnRefreshDelaySeconds !== 'number' ||
    typeof requestTimeoutSeconds !== 'number'
  ) return undefined
  return {
    baseUrl,
    refreshIntervalSeconds,
    postTurnRefreshDelaySeconds,
    requestTimeoutSeconds,
  }
}

function controllerConfig(settings: ModelQuotaSettings | undefined) {
  return {
    refreshIntervalMs: (settings?.refreshIntervalSeconds ?? 60) * 1000,
    postTurnRefreshDelayMs: (settings?.postTurnRefreshDelaySeconds ?? 3) * 1000,
    manualRefreshDebounceMs: 800,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
