import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { ShareEnv } from '../../share/middleware.ts'

const VALID_GROUP_BY = new Set(['day', 'hour', 'model', 'project', 'tool'])

export function registerStatsRoutes(app: Hono<ShareEnv>, ctx: RouteContext): void {
  app.get('/api/stats', (c) => {
    const q = c.req.query()
    const groupBy = VALID_GROUP_BY.has(q.groupBy) ? (q.groupBy as 'day' | 'hour' | 'model' | 'project' | 'tool') : 'day'
    const stats = ctx.index.getStats({ from: q.from || undefined, to: q.to || undefined, project: q.project || undefined, groupBy })
    return c.json(stats)
  })
}
