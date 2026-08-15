import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionIndex } from '../server/index/SessionIndex.ts'
import { PricingService } from '../server/pricing/PricingService.ts'

const FALLBACK_PATH = join(import.meta.dirname, '..', 'server', 'pricing', 'fallback.json')

async function freshIndex(): Promise<SessionIndex> {
  const pricing = new PricingService()
  await pricing.init(FALLBACK_PATH, { skipRefresh: true })
  return new SessionIndex(pricing)
}

function usageLine(input: number): unknown {
  return { input_tokens: input, output_tokens: 1, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } }
}

/** A single-image-block assistant line — convertBlock always attaches a ref
 * to an image block regardless of size, so this is a compact way to test
 * ref.agentId stamping without needing a 24KB string to trigger truncation. */
function imageLine(opts: { sessionId: string; agentId?: string; uuid: string; requestId: string }): string {
  return JSON.stringify({
    type: 'assistant',
    sessionId: opts.sessionId,
    agentId: opts.agentId,
    isSidechain: !!opts.agentId,
    uuid: opts.uuid,
    requestId: opts.requestId,
    timestamp: '2026-08-10T10:00:00.000Z',
    message: {
      id: `msg_${opts.uuid}`,
      role: 'assistant',
      model: 'claude-sonnet-5',
      content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'Zg==' } }],
      usage: usageLine(10),
    },
  })
}

test('getSubagentFilePath resolves the agent-<id>.jsonl file, distinct from the parent session file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'claude-dash-test-'))
  const sessionId = 'session-refpath'
  const agentId = 'agentA'
  const projectDir = join(dir, 'proj')
  await mkdir(join(projectDir, sessionId, 'subagents'), { recursive: true })

  const sessionPath = join(projectDir, `${sessionId}.jsonl`)
  await writeFile(sessionPath, imageLine({ sessionId, uuid: 'p1', requestId: 'req_p' }) + '\n')

  const agentPath = join(projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`)
  await writeFile(agentPath, imageLine({ sessionId, agentId, uuid: 'a1', requestId: 'req_a' }) + '\n')
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify({ agentType: 'Explore', description: 'test', toolUseId: 'toolu_x' }))

  const index = await freshIndex()
  await index.ingestSessionFile(sessionPath, 'proj', sessionId)

  assert.equal(index.getSubagentFilePath(sessionId, agentId), agentPath)
  assert.equal(index.getSessionFilePath(sessionId), sessionPath)
  assert.notEqual(index.getSubagentFilePath(sessionId, agentId), index.getSessionFilePath(sessionId))
})

test('a block ref inside an agent turn carries agentId, so /api/raw/* can address the agent file instead of the parent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'claude-dash-test-'))
  const sessionId = 'session-refstamp'
  const agentId = 'agentB'
  const projectDir = join(dir, 'proj')
  await mkdir(join(projectDir, sessionId, 'subagents'), { recursive: true })

  await writeFile(join(projectDir, `${sessionId}.jsonl`), imageLine({ sessionId, uuid: 'p1', requestId: 'req_p' }) + '\n')
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`), imageLine({ sessionId, agentId, uuid: 'a1', requestId: 'req_a' }) + '\n')
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify({ agentType: 'Explore', description: 'test', toolUseId: 'toolu_x' }))

  const index = await freshIndex()
  await index.ingestSessionFile(join(projectDir, `${sessionId}.jsonl`), 'proj', sessionId)

  const page = index.getSubagentTurns(sessionId, agentId)!
  assert.equal(page.turns.length, 1)
  const block = page.turns[0]!.blocks[0]!
  assert.equal(block.type, 'image')
  assert.equal((block as { ref: { agentId?: string } }).ref.agentId, agentId)
  assert.equal((block as { ref: { session: string } }).ref.session, sessionId, 'ref.session stays the PARENT id even for an agent turn — agentId is what disambiguates the file')
})

test('an agent whose meta.json lacks toolUseId still appears in session.subagents (not silently dropped)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'claude-dash-test-'))
  const sessionId = 'session-notooluseid'
  const agentId = 'agentC'
  const projectDir = join(dir, 'proj')
  await mkdir(join(projectDir, sessionId, 'subagents'), { recursive: true })

  await writeFile(join(projectDir, `${sessionId}.jsonl`), imageLine({ sessionId, uuid: 'p1', requestId: 'req_p' }) + '\n')
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`), imageLine({ sessionId, agentId, uuid: 'a1', requestId: 'req_a' }) + '\n')
  // Deliberately no toolUseId — buildSubagentRefMap (toolUseId-keyed) would
  // drop this entirely; buildSubagentList (agentId-keyed) must not.
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify({ agentType: 'Explore', description: 'no toolUseId here' }))

  const index = await freshIndex()
  await index.ingestSessionFile(join(projectDir, `${sessionId}.jsonl`), 'proj', sessionId)

  const session = index.getSession(sessionId)!
  assert.equal(session.subagents.length, 1)
  assert.equal(session.subagents[0]!.agentId, agentId)
  assert.equal(session.subagents[0]!.toolUseId, undefined)
})

test('a sub-agent spawned after the parent session was already ingested (the live/watcher case) still surfaces on the parent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'claude-dash-test-'))
  const sessionId = 'session-live-spawn'
  const agentId = 'agentD'
  const projectDir = join(dir, 'proj')
  const sessionPath = join(projectDir, `${sessionId}.jsonl`)
  await mkdir(projectDir, { recursive: true })
  await writeFile(sessionPath, imageLine({ sessionId, uuid: 'p1', requestId: 'req_p' }) + '\n')

  const index = await freshIndex()
  // Ingest the parent FIRST, before any subagents/ directory exists at all —
  // discoverSubagentFiles finds nothing, matching a session that hasn't
  // spawned an agent yet.
  await index.ingestSessionFile(sessionPath, 'proj', sessionId)
  assert.equal(index.getSession(sessionId)!.subagents.length, 0)

  // Now the agent spawns mid-session — the watcher's ingestNewFile path
  // calls ingestSubagentFile directly, with no second ingestSessionFile call.
  await mkdir(join(projectDir, sessionId, 'subagents'), { recursive: true })
  const agentPath = join(projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`)
  await writeFile(agentPath, imageLine({ sessionId, agentId, uuid: 'a1', requestId: 'req_a' }) + '\n')
  await writeFile(join(projectDir, sessionId, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify({ agentType: 'Explore', description: 'spawned live', toolUseId: 'toolu_live' }))

  await index.ingestSubagentFile(agentPath, sessionId, agentId)

  const session = index.getSession(sessionId)!
  assert.equal(session.subagents.length, 1, 'the parent reflects the newly-spawned agent without a second ingestSessionFile call')
  assert.equal(session.subagents[0]!.agentId, agentId)
})
