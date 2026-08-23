import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { Config, createConfigStore, installModelQuotaSettings, type ModelQuotaConfig } from './config.ts'
import { CodexQuotaAdapter } from './quota/adapters/codex.ts'
import { KimiQuotaAdapter } from './quota/adapters/kimi.ts'
import { QuotaClient } from './quota/client.ts'
import { createQuotaRoutes, installQuotaRoutes } from './quota/routes.ts'
import { QuotaService } from './quota/service.ts'

export const name = 'model-quota'
export const inject = ['webServer']
export { Config }
export type { ModelQuotaConfig }

export function apply(ctx: Context, config: ModelQuotaConfig): void {
  const configStore = createConfigStore(config)
  const client = new QuotaClient({ fetch: globalThis.fetch, maxResponseBytes: 1024 * 1024, now: () => new Date() })
  const service = new QuotaService({ client, configStore, adapters: [CodexQuotaAdapter, KimiQuotaAdapter] })
  installModelQuotaSettings(ctx, config, configStore)
  installQuotaRoutes(ctx, createQuotaRoutes({
    service,
    maxJsonResponseBytes: 256 * 1024,
    logger: { warn(message, fields) { ctx.logger('model-quota').warn(message, fields) } },
  }))
  ctx.effect(() => () => service.dispose())
}
