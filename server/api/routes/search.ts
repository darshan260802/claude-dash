import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { TurnKind } from '@shared/types.ts'
import type { ShareEnv } from '../../share/middleware.ts'

export function registerSearchRoutes(app: Hono<ShareEnv>, ctx: RouteContext): void {
  app.get('/api/search', (c) => {
    const q = c.req.query()
    const query = q.q ?? ''
    if (!query.trim()) return c.json({ hits: [], total: 0, tookMs: 0 })
    const result = ctx.index.search({
      q: query,
      project: q.project || undefined,
      kinds: q.kinds ? (q.kinds.split(',').filter(Boolean) as TurnKind[]) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
    return c.json(result)
  })
}
