// The Hono middleware chain sharing installs in front of the whole app.
// Registration order is a correctness contract — see the comment block in
// api/app.ts where these are wired in. Summary of what each layer does:
//
//   hostAllowList  -> 403 on an unrecognized Host header (DNS-rebinding guard)
//   accessGate     -> gate page / 401 unless owner or a valid access token;
//                     stamps c.set('shareViewer', 'owner' | 'visitor')
//   ownerOnly      -> 403 anything under /api/share/* unless owner AND same-origin
//   scopeGuard     -> default-deny allow-list for a scoped visitor's /api/*

import type { Context, Next } from 'hono'
import type { ShareController } from './controller.ts'
import { resolveScopeTarget } from './scope.ts'
import { renderGatePage } from './gatePage.ts'

export type ShareViewer = 'owner' | 'visitor'
export type ShareEnv = { Variables: { shareViewer: ShareViewer } }

export function hostAllowList(share: ShareController) {
  return async (c: Context, next: Next) => {
    if (!share.isAllowedHost(c.req.header('host'))) {
      return c.text('Forbidden: claude-dash only accepts requests addressed to a known host.', 403)
    }
    return next()
  }
}

/** Gates every request behind the access code once a share is active —
 * inactive shares pass everything through untouched (isAuthorized's
 * pass-through trick, see gate.ts). Always stamps shareViewer, even when
 * inactive, so downstream code never needs a separate "is sharing even
 * running" branch — a loopback request is always the owner regardless. */
export function accessGate(share: ShareController) {
  return async (c: Context<ShareEnv>, next: Next) => {
    const owner = share.isOwnerRequest(c)
    c.set('shareViewer', owner ? 'owner' : 'visitor')

    if (owner || share.isAuthorized(c)) return next()

    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'access_required' }, 401)
    }
    return c.html(renderGatePage(), 200, { 'Cache-Control': 'no-store' })
  }
}

/** A page loaded from some other origin can still fire a same-site
 * fetch('http://127.0.0.1:<port>/api/share/start') — the loopback Host
 * check passes for that just as readily as for the real dashboard, since
 * both arrive addressed to the same host. This is the CSRF half of
 * owner-only enforcement: it requires a custom header, which only
 * same-origin JS can attach without tripping a CORS preflight this server
 * never answers, and — when the browser does send an Origin — that it's
 * itself loopback. A plain top-level navigation never reaches these routes
 * because it can't set X-Claude-Dash either. */
function isSameOriginRequest(c: Context): boolean {
  if (c.req.header('x-claude-dash') !== '1') return false
  const origin = c.req.header('origin')
  if (!origin) return true
  try {
    const host = new URL(origin).host.split(':')[0]
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

/** The Share page's own control surface — reachable only by the machine's
 * owner, never by a remote visitor who came in through the tunnel with the
 * access code. Runs even though such a visitor already passed accessGate —
 * being let in to VIEW the dashboard isn't the same as being allowed to
 * MANAGE sharing itself. */
// `_share` (unused): kept for signature symmetry with the other factories in
// this file — the check itself only needs c.get('shareViewer'), already
// stamped by accessGate.
export function ownerOnly(_share: ShareController) {
  return async (c: Context<ShareEnv>, next: Next) => {
    if (c.get('shareViewer') !== 'owner' || !isSameOriginRequest(c)) {
      return c.json({ error: 'forbidden' }, 403)
    }
    return next()
  }
}

/** Default-deny scope enforcement for every /api/* request from a
 * non-owner. By the time a request reaches here it has already passed
 * accessGate (so shareViewer is set) and, for /api/share/*, ownerOnly (so a
 * visitor never reaches this for that prefix at all — they were already
 * 403'd). See scope.ts's module doc comment for the allow-list rationale. */
export function scopeGuard(share: ShareController) {
  return async (c: Context<ShareEnv>, next: Next) => {
    if (c.get('shareViewer') === 'owner') return next()

    // A visitor never mutates anything, in either mode — this alone makes
    // PATCH /api/settings owner-only forever, without a table entry, and
    // covers every future mutating route the same way.
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return c.json({ error: 'forbidden' }, 403)
    }

    // SSE leaks every live session id on the machine in its `hello` payload,
    // and doesn't survive the Cloudflare tunnel anyway (it buffers
    // SSE-over-GET until the connection closes) — denied to every visitor,
    // both modes. The 3s polling refetchInterval is the real refresh path
    // regardless, so visitors lose nothing.
    if (c.req.path === '/api/events') {
      return c.json({ error: 'forbidden' }, 403)
    }

    const scope = share.scope()
    if (scope.mode === 'global') return next()

    const target = resolveScopeTarget(c.req.method, c.req.path, c.req.query())
    if (target.kind === 'allow') return next()
    if (target.kind === 'session' && scope.allowsSession(target.sessionId)) return next()
    if (target.kind === 'agent' && scope.allowsAgent(target.sessionId, target.agentId)) return next()
    return c.json({ error: 'out_of_scope' }, 403)
  }
}
