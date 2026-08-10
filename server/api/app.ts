import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { streamSSE } from 'hono/streaming'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { HealthDTO, ServerEvent } from '@shared/types.ts'
import type { RouteContext } from './context.ts'
import { registerProjectRoutes } from './routes/projects.ts'
import { registerSessionRoutes } from './routes/sessions.ts'
import { registerStatsRoutes } from './routes/stats.ts'
import { registerSearchRoutes } from './routes/search.ts'
import { registerSettingsRoutes } from './routes/settings.ts'
import { registerRawRoutes } from './routes/raw.ts'

const PING_INTERVAL_MS = 20_000

export interface AppOptions {
  webDir: string
  ctx: RouteContext
  getHealth: () => HealthDTO
}

export function createApp({ webDir, ctx, getHealth }: AppOptions): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => c.json(getHealth()))

  registerProjectRoutes(app, ctx)
  registerSessionRoutes(app, ctx)
  registerStatsRoutes(app, ctx)
  registerSearchRoutes(app, ctx)
  registerSettingsRoutes(app, ctx)
  registerRawRoutes(app, ctx)

  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      let closed = false
      stream.onAbort(() => {
        closed = true
      })

      const unsubscribe = ctx.hub.subscribe((event: ServerEvent) => {
        if (closed) return
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
      })

      const liveSessions = ctx.index.listSessions({ live: true }).map((s) => s.id)
      await stream.writeSSE({ event: 'hello', data: JSON.stringify({ type: 'hello', revision: ctx.index.revision, liveSessions }) })

      try {
        while (!closed && !stream.closed) {
          await stream.sleep(PING_INTERVAL_MS)
          if (closed || stream.closed) break
          await stream.writeSSE({ event: 'ping', data: '{}' })
        }
      } finally {
        unsubscribe()
      }
    })
  })

  // Static SPA — only mounted when a built dist-web/ exists (absent in dev,
  // where Vite serves the frontend on its own port and proxies /api/* here).
  if (existsSync(join(webDir, 'index.html'))) {
    app.use('/*', serveStatic({ root: webDir }))
    app.get('*', serveStatic({ path: join(webDir, 'index.html') }))
  }

  return app
}
