import { test } from 'node:test'
import assert from 'node:assert/strict'
import { naiveDeslug, cwdToSlug, posixAdapter, win32Adapter } from '../server/claude/paths.ts'

test('naiveDeslug is a lossy last resort — documented as such, not relied on when a real cwd is available', () => {
  // "ollama-usage-monitor" naively de-slugs to "ollama/usage/monitor", which
  // is WRONG — this test pins that known limitation so nobody "fixes" the
  // naive path without also fixing the real bug (using the record's own cwd
  // field instead), see extractSessionMeta / rebuildSession.
  const slug = '-Users-darshan-Work-Projects-ollama-usage-monitor'
  const result = naiveDeslug(slug, posixAdapter)
  assert.equal(result, '/Users/darshan/Work/Projects/ollama/usage/monitor')
  assert.notEqual(result, '/Users/darshan/Work/Projects/ollama-usage-monitor', 'documents that this is lossy, not a bug to "fix" here')
})

test('naiveDeslug uses the injected adapter\'s separator, not a hardcoded "/" — exercises win32 without a real Windows machine', () => {
  const slug = 'Users-x-Work-proj'
  const result = naiveDeslug(slug, win32Adapter)
  assert.ok(result.includes('\\'), 'must use the win32 separator, not posix "/"')
  assert.ok(!result.includes('/'), 'must not leak a posix separator when given the win32 adapter')
})

test('cwdToSlug converts every path-separator-like character to a hyphen', () => {
  assert.equal(cwdToSlug('/Users/darshan/Work/Projects/claude-dash'), '-Users-darshan-Work-Projects-claude-dash')
  assert.equal(cwdToSlug('C:\\Users\\x\\proj'), 'C--Users-x-proj')
})
