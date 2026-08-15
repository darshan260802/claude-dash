import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { SettingsDTO, SettingsPatchDTO } from '@shared/types.ts'
import type { ShareEnv } from '../../share/middleware.ts'

export function registerSettingsRoutes(app: Hono<ShareEnv>, ctx: RouteContext): void {
  app.get('/api/settings', (c) => {
    const counts = ctx.index.counts
    const dto: SettingsDTO = {
      claudeDirs: ctx.config.resolvedClaudeDirs,
      detectedFrom: ctx.config.detectedFrom,
      pricing: ctx.pricing.status,
      liveWindowMs: ctx.config.liveWindowMs,
      recentWindowMs: ctx.config.recentWindowMs,
      pollMs: ctx.config.pollIntervalMs,
      port: ctx.config.port,
      version: ctx.version,
      index: { ...counts, indexing: false },
      unknownRecordTypes: ctx.index.unknownTypes,
    }
    return c.json(dto)
  })

  app.patch('/api/settings', async (c) => {
    // claudeDirs is deliberately NOT patchable from the browser — it's a
    // CLI-flag-only setting, to avoid exposing an arbitrary-filesystem-read
    // surface over HTTP.
    const body = (await c.req.json().catch(() => ({}))) as SettingsPatchDTO
    if (body.pricingRefresh) {
      await ctx.pricing.refresh(true)
      ctx.hub.emit({ type: 'pricing:updated' })
    }
    return c.json({ ok: true })
  })
}
