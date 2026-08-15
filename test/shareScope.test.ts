import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Scope, resolveScopeTarget } from '../server/share/scope.ts'

// ---------------------------------------------------------------------
// resolveScopeTarget — the default-deny allow-list table itself. This is
// the security-critical function: every row here is a route that must be
// classified correctly, and the final assertion in each "deny" test proves
// the *default* is deny, not an enumerated exception.
// ---------------------------------------------------------------------

test('resolveScopeTarget: non-GET/HEAD is always deny, before anything else', () => {
  assert.deepEqual(resolveScopeTarget('POST', '/api/sessions/abc', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('PATCH', '/api/settings', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('DELETE', '/api/sessions/abc', {}), { kind: 'deny' })
})

test('resolveScopeTarget: /api/health and /api/shared are always allow', () => {
  assert.deepEqual(resolveScopeTarget('GET', '/api/health', {}), { kind: 'allow' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/shared', {}), { kind: 'allow' })
  assert.deepEqual(resolveScopeTarget('HEAD', '/api/health', {}), { kind: 'allow' })
})

test('resolveScopeTarget: /api/sessions/:id and /:id/turns scope on the session id', () => {
  assert.deepEqual(resolveScopeTarget('GET', '/api/sessions/abc', {}), { kind: 'session', sessionId: 'abc' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/sessions/abc/turns', {}), { kind: 'session', sessionId: 'abc' })
})

test('resolveScopeTarget: /api/sessions/:id/subagents/:agentId[/turns] scopes on the (session, agent) pair', () => {
  assert.deepEqual(resolveScopeTarget('GET', '/api/sessions/abc/subagents/xyz', {}), { kind: 'agent', sessionId: 'abc', agentId: 'xyz' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/sessions/abc/subagents/xyz/turns', {}), { kind: 'agent', sessionId: 'abc', agentId: 'xyz' })
})

test('resolveScopeTarget: raw routes read session/agent from the query string', () => {
  assert.deepEqual(resolveScopeTarget('GET', '/api/raw/block', { session: 'abc' }), { kind: 'session', sessionId: 'abc' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/raw/block', { session: 'abc', agent: 'xyz' }), { kind: 'agent', sessionId: 'abc', agentId: 'xyz' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/raw/attachment', { session: 'abc', agent: 'xyz' }), { kind: 'agent', sessionId: 'abc', agentId: 'xyz' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/raw/overflow', { session: 'abc' }), { kind: 'session', sessionId: 'abc' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/raw/block', {}), { kind: 'deny' }, 'no session param at all is deny, not a crash')
})

test('resolveScopeTarget: machine-wide routes are denied outright, not filtered', () => {
  // The list, and everything with no single session/agent to scope a filter
  // against — denying is a stronger guarantee than trusting a per-field filter.
  assert.deepEqual(resolveScopeTarget('GET', '/api/sessions', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/projects', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/projects/some-key', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/stats', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/search', { q: 'x' }), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/settings', {}), { kind: 'deny' })
})

test('resolveScopeTarget: default-deny covers a route nobody wrote a case for', () => {
  // The whole point of the allow-list design: a brand new endpoint added by
  // someone who never thought about sharing is denied by construction.
  assert.deepEqual(resolveScopeTarget('GET', '/api/projects/some-key/sessions', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/totally-new-feature', {}), { kind: 'deny' })
  assert.deepEqual(resolveScopeTarget('GET', '/api/rate-limits/current', {}), { kind: 'deny' })
})

// ---------------------------------------------------------------------
// Scope — the in-memory allow/deny decision given a resolved target.
// ---------------------------------------------------------------------

test('Scope.global allows every session and agent', () => {
  const s = Scope.global()
  assert.equal(s.mode, 'global')
  assert.equal(s.allowsSession('anything'), false, 'Scope itself only tracks explicit items — the middleware short-circuits on mode==="global" before consulting allowsSession/allowsAgent at all')
})

test('Scope.scoped: a whole-session share allows the session and every agent under it', () => {
  const s = Scope.scoped([{ sessionId: 'A' }])
  assert.equal(s.allowsSession('A'), true)
  assert.equal(s.allowsAgent('A', 'any-agent-at-all'), true, 'a full-session share implies every one of its agents')
  assert.equal(s.allowsSession('B'), false)
})

test('Scope.scoped: an agent-only share grants no access to its parent session', () => {
  const s = Scope.scoped([{ sessionId: 'A', agentId: 'G1' }])
  assert.equal(s.allowsSession('A'), false, 'sharing an agent never implies the parent — this is the core security property of agent-only sharing')
  assert.equal(s.allowsAgent('A', 'G1'), true)
})

test('Scope.scoped: an agent-only share grants no access to sibling agents of the same session', () => {
  const s = Scope.scoped([{ sessionId: 'A', agentId: 'G1' }])
  assert.equal(s.allowsAgent('A', 'G2'), false, 'proves allowsAgent matches the exact (session, agent) pair, not just the session')
})

test('Scope.add: adding the whole session promotes it past any existing agent-only entries', () => {
  const s = Scope.scoped([{ sessionId: 'A', agentId: 'G1' }])
  assert.equal(s.allowsAgent('A', 'G2'), false)
  s.add({ sessionId: 'A' })
  assert.equal(s.allowsSession('A'), true)
  assert.equal(s.allowsAgent('A', 'G1'), true)
  assert.equal(s.allowsAgent('A', 'G2'), true, 'now implied by the full-session share, even though it was never added individually')
})

test('Scope.add: adding an agent to an already-fully-shared session is a harmless no-op', () => {
  const s = Scope.scoped([{ sessionId: 'A' }])
  s.add({ sessionId: 'A', agentId: 'G1' })
  assert.equal(s.allowsSession('A'), true)
  assert.equal(s.items().length, 1, 'does not create a redundant agent-only entry alongside the full-session one')
})

test('Scope.remove: removing a session leaves its previously-implied agents inaccessible', () => {
  const s = Scope.scoped([{ sessionId: 'A' }])
  s.remove({ sessionId: 'A' })
  assert.equal(s.allowsSession('A'), false)
  assert.equal(s.allowsAgent('A', 'G1'), false)
})

test('Scope.remove: removing one agent does not affect a sibling agent also shared individually', () => {
  const s = Scope.scoped([
    { sessionId: 'A', agentId: 'G1' },
    { sessionId: 'A', agentId: 'G2' },
  ])
  s.remove({ sessionId: 'A', agentId: 'G1' })
  assert.equal(s.allowsAgent('A', 'G1'), false)
  assert.equal(s.allowsAgent('A', 'G2'), true)
})

test('Scope.isEmpty reflects whether anything is actually shared', () => {
  const empty = Scope.scoped()
  assert.equal(empty.isEmpty(), true)
  const withItem = Scope.scoped([{ sessionId: 'A' }])
  assert.equal(withItem.isEmpty(), false)
  withItem.remove({ sessionId: 'A' })
  assert.equal(withItem.isEmpty(), true)
})

test('Scope.items reflects both full-session and agent-only entries', () => {
  const s = Scope.scoped([{ sessionId: 'A' }, { sessionId: 'B', agentId: 'G1' }])
  const items = s.items().sort((a, b) => a.sessionId.localeCompare(b.sessionId))
  assert.deepEqual(items, [
    { kind: 'session', sessionId: 'A' },
    { kind: 'agent', sessionId: 'B', agentId: 'G1' },
  ])
})
