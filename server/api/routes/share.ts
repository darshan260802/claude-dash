import type { Hono } from 'hono'
import type { RouteContext } from '../context.ts'
import type { ShareController } from '../../share/controller.ts'
import type { ShareEnv } from '../../share/middleware.ts'
import { Scope, type ShareItem, type ShareItemSnapshot } from '../../share/scope.ts'
import type { ShareItemDTO, ShareStatusDTO } from '@shared/types.ts'

/** Enrich the controller's bare {kind, sessionId, agentId?} snapshots with
 * display context (title, project, liveness) by reading the index — kept
 * out of controller.ts/scope.ts so those stay free of any SessionIndex
 * dependency. An item that's vanished from the index (session deleted,
 * agent file gone) is silently dropped rather than surfaced as broken. */
function resolveShareItems(ctx: RouteContext, snapshots: ShareItemSnapshot[]): ShareItemDTO[] {
  const out: ShareItemDTO[] = []
  for (const snap of snapshots) {
    if (snap.kind === 'session') {
      const s = ctx.index.getSession(snap.sessionId)
      if (!s) continue
      out.push({ kind: 'session', sessionId: snap.sessionId, title: s.title, projectName: s.projectName, liveness: s.liveness })
    } else if (snap.agentId) {
      const a = ctx.index.getSubagent(snap.sessionId, snap.agentId)
      if (!a) continue
      out.push({
        kind: 'agent',
        sessionId: snap.sessionId,
        agentId: snap.agentId,
        title: a.agentType ?? 'Agent',
        subtitle: a.parentTitle,
        projectName: a.projectName,
        liveness: a.liveness,
      })
    }
  }
  return out
}

/** Registered separately from — and BEFORE — the rest of the share routes:
 * it must run ahead of the accessGate middleware (see the registration-order
 * comment in api/app.ts), since this is the one endpoint an anonymous
 * visitor reaches precisely because they haven't passed the gate yet. */
export function registerAccessRoute(app: Hono<ShareEnv>, share: ShareController): void {
  app.post('/api/access', async (c) => {
    let body: { code?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'invalid_body' }, 400)
    }
    const result = await share.verify(c, body.code)
    if (!result.ok) return c.json({ error: 'invalid_code', reason: result.reason }, 401)
    const secure = c.req.header('x-forwarded-proto') === 'https'
    share.setAccessCookie(c, result.token, secure)
    return c.json({ ok: true })
  })
}

export function registerShareRoutes(app: Hono<ShareEnv>, ctx: RouteContext, share: ShareController): void {
  function statusDTO(): ShareStatusDTO {
    const s = share.status()
    return { ...s, items: resolveShareItems(ctx, s.items) }
  }

  // The one thing every viewer — owner or visitor, any mode — can always
  // reach: what the frontend uses to decide which router/shell to render.
  app.get('/api/shared', (c) => {
    const s = share.status()
    return c.json({
      isOwner: c.get('shareViewer') === 'owner',
      active: s.state === 'active',
      mode: s.mode,
      items: resolveShareItems(ctx, s.items),
    })
  })

  // Everything below is owner-only + same-origin (see ownerOnly middleware,
  // mounted on /api/share/* in app.ts before this file's routes).

  app.get('/api/share', (c) => c.json(statusDTO()))

  app.post('/api/share/start', async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>)
    const mode = body.mode === 'scoped' ? 'scoped' : 'global'
    if (share.state === 'active' || share.state === 'starting') {
      return c.json(statusDTO())
    }
    share.setScope(mode === 'global' ? Scope.global() : Scope.scoped())
    // Deliberately not awaited: the first run downloads the cloudflared
    // binary, which can take well past any reasonable request timeout. The
    // Share page polls GET /api/share instead of waiting on this call.
    share.start().catch(() => {})
    return c.json({ state: 'starting' }, 202)
  })

  app.post('/api/share/scope/add', async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
    if (!sessionId) return c.json({ error: 'bad_request' }, 400)
    const item: ShareItem = { sessionId, agentId: typeof body.agentId === 'string' ? body.agentId : undefined }
    const replaceGlobal = body.replaceGlobal === true

    if (share.state === 'idle' || share.state === 'error') {
      share.setScope(Scope.scoped([item]))
      share.start().catch(() => {})
      return c.json({ state: 'starting' }, 202)
    }
    if (share.state === 'starting') {
      share.scope().add(item)
      return c.json(statusDTO())
    }
    // active
    if (share.scope().mode === 'global') {
      if (!replaceGlobal) return c.json({ error: 'global_share_active' }, 409)
      // One code per tunnel holds here too — switching modes only replaces
      // the scope object, never touches the tunnel, code, or gate.
      share.setScope(Scope.scoped([item]))
      return c.json(statusDTO())
    }
    share.scope().add(item)
    return c.json(statusDTO())
  })

  app.post('/api/share/scope/remove', async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
    if (!sessionId) return c.json({ error: 'bad_request' }, 400)
    share.scope().remove({ sessionId, agentId: typeof body.agentId === 'string' ? body.agentId : undefined })
    return c.json(statusDTO())
  })

  app.post('/api/share/stop', async (c) => {
    await share.stop()
    return c.json(statusDTO())
  })
}
