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
import { registerAccessRoute, registerShareRoutes } from './routes/share.ts'
import type { ShareController } from '../share/controller.ts'
import { hostAllowList, accessGate, ownerOnly, scopeGuard, type ShareEnv } from '../share/middleware.ts'

const PING_INTERVAL_MS = 20_000

export interface AppOptions {
  webDir: string
  ctx: RouteContext
  getHealth: () => HealthDTO
  share: ShareController
}

export function createApp({ webDir, ctx, getHealth, share }: AppOptions): Hono<ShareEnv> {
  const app = new Hono<ShareEnv>()

  // Sharing's middleware chain. Registration order here is a correctness
  // contract — Hono composes matching layers in the order they were
  // registered, so each of these depends on everything above it having run
  // first. See server/share/middleware.ts's module doc comment for what
  // each layer does.
  app.use('*', hostAllowList(share)) // 403 first — DNS-rebinding guard
  registerAccessRoute(app, share) // reachable pre-auth, post-host-check
  app.use('*', accessGate(share)) // gate page / 401; sets c.set('shareViewer', …)
  app.use('/api/share/*', ownerOnly(share)) // loopback Host + X-Claude-Dash
  app.use('/api/*', scopeGuard(share)) // default-deny allow-list for a scoped visitor
  registerShareRoutes(app, ctx, share) // GET /api/shared + the rest of /api/share/*

  app.get('/api/health', (c) => {
    const health = getHealth()
    // A scoped or unauthenticated-but-inactive-share request has no owner
    // context — redact the machine-wide index counts rather than leak how
    // much is on this box. Nothing in src/ currently reads this endpoint, so
    // this costs the owner nothing.
    if (c.get('shareViewer') !== 'owner') {
      return c.json({ ...health, indexed: { projects: 0, sessions: 0, turns: 0 } })
    }
    return c.json(health)
  })

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
