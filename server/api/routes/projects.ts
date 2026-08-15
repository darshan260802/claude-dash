import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { ShareEnv } from '../../share/middleware.ts'

export function registerProjectRoutes(app: Hono<ShareEnv>, ctx: RouteContext): void {
  app.get('/api/projects', (c) => {
    return c.json({ projects: ctx.index.listProjects() })
  })

  app.get('/api/projects/:key', (c) => {
    const project = ctx.index.getProject(c.req.param('key'))
    if (!project) return c.json({ error: 'not_found' }, 404)
    return c.json(project)
  })
}
