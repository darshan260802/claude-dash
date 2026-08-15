// Defines what an active share exposes: the whole dashboard ("global"), or
// an explicit set of sessions/agents ("scoped"). Read by the scopeGuard
// middleware in middleware.ts to decide whether a given request may
// proceed. Deliberately framework-free (no Hono Context) — resolveScopeTarget
// in particular is a pure function precisely so the routing table can be
// unit-tested without spinning up an HTTP server.

export type ShareMode = 'global' | 'scoped'

export interface ShareItem {
  sessionId: string
  agentId?: string
}

export interface ShareItemSnapshot extends ShareItem {
  kind: 'session' | 'agent'
}

/** Tracks which sessions/agents a scoped share exposes. A session shared
 * whole (fullSessions) also exposes every one of its agents; an agent
 * shared alone (agentOnly) exposes nothing about its parent or siblings —
 * sharing an agent never implies access to the session it came from, by
 * design (see allowsAgent). */
export class Scope {
  mode: ShareMode = 'scoped'
  private fullSessions = new Set<string>()
  private agentOnly = new Map<string, Set<string>>() // sessionId -> agentIds

  static global(): Scope {
    const s = new Scope()
    s.mode = 'global'
    return s
  }

  static scoped(items: ShareItem[] = []): Scope {
    const s = new Scope()
    s.mode = 'scoped'
    for (const item of items) s.add(item)
    return s
  }

  /** Adding a whole session promotes it out of agentOnly if some of its
   * agents were already shared individually — sharing the parent is a
   * strict widening, so the narrower entries have nothing left to add. */
  add(item: ShareItem): void {
    if (item.agentId) {
      if (this.fullSessions.has(item.sessionId)) return // already implied
      const set = this.agentOnly.get(item.sessionId) ?? new Set<string>()
      set.add(item.agentId)
      this.agentOnly.set(item.sessionId, set)
    } else {
      this.fullSessions.add(item.sessionId)
      this.agentOnly.delete(item.sessionId)
    }
  }

  remove(item: ShareItem): void {
    if (item.agentId) {
      this.agentOnly.get(item.sessionId)?.delete(item.agentId)
    } else {
      this.fullSessions.delete(item.sessionId)
    }
  }

  isEmpty(): boolean {
    if (this.fullSessions.size > 0) return false
    for (const set of this.agentOnly.values()) if (set.size > 0) return false
    return true
  }

  allowsSession(sessionId: string): boolean {
    return this.fullSessions.has(sessionId)
  }

  allowsAgent(sessionId: string, agentId: string): boolean {
    return this.fullSessions.has(sessionId) || (this.agentOnly.get(sessionId)?.has(agentId) ?? false)
  }

  items(): ShareItemSnapshot[] {
    const out: ShareItemSnapshot[] = []
    for (const sessionId of this.fullSessions) out.push({ kind: 'session', sessionId })
    for (const [sessionId, agents] of this.agentOnly) {
      for (const agentId of agents) out.push({ kind: 'agent', sessionId, agentId })
    }
    return out
  }
}

// ---------------------------------------------------------------------
// Route allow-list — the choke point every /api/* request passes through
// once a share is active and scoped. Default-deny: any path with no
// matching entry here is refused to a scoped visitor, so a future route
// added by someone who never heard of sharing is safe by construction —
// the opposite of cursor-dash's deny-list, chosen deliberately because
// "denied by default" is a much easier invariant to keep correct over time
// than "the filter covers every field that might leak."
// ---------------------------------------------------------------------

export type ScopeTarget =
  | { kind: 'allow' } // fine regardless of scope contents (health, /api/shared)
  | { kind: 'deny' } // no single session/agent to scope against — denied outright
  | { kind: 'session'; sessionId: string }
  | { kind: 'agent'; sessionId: string; agentId: string }

/** `path` is the raw request pathname. Ids are read by splitting it rather
 * than via Hono's `c.req.param()` — this runs as `/api/*` middleware,
 * before Hono has matched a specific route, so params aren't populated yet. */
export function resolveScopeTarget(method: string, path: string, query: Record<string, string>): ScopeTarget {
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'deny' }

  const parts = path.split('/').filter(Boolean) // ["api", "sessions", ":id", ...]
  if (parts[0] !== 'api') return { kind: 'deny' }

  if (parts[1] === 'health') return { kind: 'allow' }
  if (parts[1] === 'shared' && parts.length === 2) return { kind: 'allow' }

  if (parts[1] === 'sessions' && parts.length >= 3) {
    const sessionId = parts[2]!
    // /api/sessions/:id/subagents/:agentId[/turns]
    if (parts[3] === 'subagents' && parts[4]) {
      return { kind: 'agent', sessionId, agentId: parts[4] }
    }
    // /api/sessions/:id and /api/sessions/:id/turns both scope on the id
    // alone — there's nothing under this session a whole-session share
    // shouldn't expose.
    return { kind: 'session', sessionId }
  }

  if (parts[1] === 'raw' && (parts[2] === 'block' || parts[2] === 'attachment' || parts[2] === 'overflow')) {
    const sessionId = query.session
    if (!sessionId) return { kind: 'deny' }
    const agentId = query.agent
    return agentId ? { kind: 'agent', sessionId, agentId } : { kind: 'session', sessionId }
  }

  // /api/sessions (the list), /api/projects*, /api/stats, /api/search,
  // /api/settings — every one of these exposes machine-wide data with no
  // single session/agent to scope a filter against, so they're denied
  // outright rather than filtered (a correct filter and a denied route are
  // equally safe today; only one of them stays safe when someone adds a
  // field to the DTO later without thinking about sharing).
  return { kind: 'deny' }
}
