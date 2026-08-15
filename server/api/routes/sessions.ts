import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { TurnKind } from '@shared/types.ts'
import type { ShareEnv } from '../../share/middleware.ts'

function splitParam(v: string | undefined): string[] | undefined {
  if (!v) return undefined
  return v.split(',').filter(Boolean)
}

export function registerSessionRoutes(app: Hono<ShareEnv>, ctx: RouteContext): void {
  app.get('/api/sessions', (c) => {
    const q = c.req.query()
    const sessions = ctx.index.listSessions({
      project: q.project || undefined,
      live: q.live === 'true',
      model: q.model || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
    })
    const limit = q.limit ? Number(q.limit) : 50
    const cursor = q.cursor ? Number(q.cursor) : 0
    const page = sessions.slice(cursor, cursor + limit)
    return c.json({ sessions: page, nextCursor: cursor + limit < sessions.length ? cursor + limit : null, total: sessions.length })
  })

  app.get('/api/sessions/:id', (c) => {
    const session = ctx.index.getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    return c.json(session)
  })

  app.get('/api/sessions/:id/turns', (c) => {
    const q = c.req.query()
    const page = ctx.index.getSessionTurns(c.req.param('id'), {
      cursor: q.cursor ? Number(q.cursor) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      kinds: splitParam(q.kinds) as TurnKind[] | undefined,
      tools: splitParam(q.tools),
      q: q.q || undefined,
    })
    if (!page) return c.json({ error: 'not_found' }, 404)
    return c.json(page)
  })

  app.get('/api/sessions/:id/subagents/:agentId', (c) => {
    const detail = ctx.index.getSubagent(c.req.param('id'), c.req.param('agentId'))
    if (!detail) return c.json({ error: 'not_found' }, 404)
    return c.json(detail)
  })

  app.get('/api/sessions/:id/subagents/:agentId/turns', (c) => {
    const q = c.req.query()
    const page = ctx.index.getSubagentTurns(c.req.param('id'), c.req.param('agentId'), {
      cursor: q.cursor ? Number(q.cursor) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
    if (!page) return c.json({ error: 'not_found' }, 404)
    return c.json(page)
  })
}
