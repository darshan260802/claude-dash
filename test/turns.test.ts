import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupIntoTurns } from '../server/claude/turns.ts'
import { fakeLines, assistantLine, userTextLine, toolResultLine } from './helpers.ts'

test('multi-block lines sharing message.id+requestId merge into one turn', () => {
  const lines = fakeLines([
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'thinking', thinking: 'let me think' }] }),
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'text', text: 'here is the answer' }] }),
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } }] }),
  ])

  const { turns } = groupIntoTurns(lines, 'session-1')
  const assistantTurns = turns.filter((t) => t.kind === 'assistant')

  assert.equal(assistantTurns.length, 1, 'three same-key lines must collapse into exactly one turn')
  assert.equal(assistantTurns[0].blocks.length, 3)
  assert.deepEqual(
    assistantTurns[0].blocks.map((b) => b.type),
    ['thinking', 'text', 'tool_use'],
  )
})

test('message.id alone (no requestId) still merges multi-block lines — the deepseek-routed case', () => {
  const lines = fakeLines([
    assistantLine({ messageId: 'msg_ds_1', content: [{ type: 'thinking', thinking: 'planning' }], model: 'deepseek-v4-pro' }),
    assistantLine({ messageId: 'msg_ds_1', content: [{ type: 'tool_use', id: 'toolu_ds_1', name: 'EnterPlanMode', input: {} }], model: 'deepseek-v4-pro' }),
  ])

  const { turns } = groupIntoTurns(lines, 'session-1')
  const assistantTurns = turns.filter((t) => t.kind === 'assistant')

  assert.equal(assistantTurns.length, 1, 'records with message.id but no requestId must still dedupe on message.id alone')
  assert.equal(assistantTurns[0].id, 'msg_ds_1')
  assert.equal(assistantTurns[0].blocks.length, 2)
})

test('a resumed/replayed key (same key reappearing after an intervening user turn) becomes two Turn objects', () => {
  const lines = fakeLines([
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'text', text: 'first pass' }] }),
    userTextLine('please continue'),
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'text', text: 'replayed pass' }] }),
  ])

  const { turns } = groupIntoTurns(lines, 'session-1')
  const assistantTurns = turns.filter((t) => t.kind === 'assistant')

  // Structurally two turns (this is correct for rendering — a resume/replay
  // is a real second occurrence in the file); the global usage dedup that
  // prevents double-counting lives in SessionIndex, not here.
  assert.equal(assistantTurns.length, 2)
  assert.equal(assistantTurns[0].id, assistantTurns[1].id)
})

test('tool_use resolves against its matching tool_result, out of a following user line', () => {
  const lines = fakeLines([
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'echo hi' } }] }),
    toolResultLine('toolu_1', 'hi', { toolUseResult: { stdout: 'hi', stderr: '', interrupted: false } }),
  ])

  const { turns } = groupIntoTurns(lines, 'session-1')
  const assistantTurn = turns.find((t) => t.kind === 'assistant')!
  const toolBlock = assistantTurn.blocks[0]

  assert.equal(toolBlock.type, 'tool_use')
  if (toolBlock.type !== 'tool_use') throw new Error('unreachable')
  assert.equal(toolBlock.result?.status, 'ok')
  assert.equal(toolBlock.result?.kind, 'bash')
  assert.equal(toolBlock.result?.stdout, 'hi')
})

test('an unmatched tool_use is left pending, not crashed on', () => {
  const lines = fakeLines([assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'tool_use', id: 'toolu_orphan', name: 'Read', input: { file_path: '/x' } }] })])
  const { turns } = groupIntoTurns(lines, 'session-1')
  const toolBlock = turns.find((t) => t.kind === 'assistant')!.blocks[0]
  assert.equal(toolBlock.type, 'tool_use')
  if (toolBlock.type !== 'tool_use') throw new Error('unreachable')
  assert.equal(toolBlock.result?.status, 'pending')
})

test('an unmatched tool_result (no tool_use in this file) becomes a synthetic orphan turn', () => {
  const lines = fakeLines([toolResultLine('toolu_missing', 'some result text')])
  const { turns } = groupIntoTurns(lines, 'session-1')
  assert.equal(turns.length, 1)
  assert.equal(turns[0].kind, 'orphan_tool_result')
})

test('an unknown record type is tracked, not silently ignored or crashed on', () => {
  const lines = fakeLines([{ type: 'some-future-record-type', sessionId: 's', timestamp: '2026-08-10T10:00:00.000Z' } as never])
  const { turns, unknownRecordTypes } = groupIntoTurns(lines, 'session-1')
  assert.equal(turns.length, 0)
  assert.deepEqual(unknownRecordTypes, ['some-future-record-type'])
})

// ---------------------------------------------------------------------
// agentId stamping on BlockRef — groupIntoTurns' optional third argument.
// Every ref-carrying block type must pick it up, since /api/raw/* uses
// ref.agentId (not ref.session, which stays the PARENT id either way) to
// decide whether to read the agent's own file or the parent's.
// ---------------------------------------------------------------------

const AGENT_ID = 'agent-xyz'

test('an image block ref carries agentId when groupIntoTurns is called for a sub-agent file', () => {
  const lines = fakeLines([assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'Zg==' } }] })])
  const { turns } = groupIntoTurns(lines, 'parent-session', AGENT_ID)
  const block = turns.find((t) => t.kind === 'assistant')!.blocks[0]!
  assert.equal(block.type, 'image')
  if (block.type !== 'image') throw new Error('unreachable')
  assert.equal(block.ref.agentId, AGENT_ID)
  assert.equal(block.ref.session, 'parent-session', 'ref.session stays the PARENT id — agentId is what disambiguates the file')
})

test('a truncated text block ref carries agentId', () => {
  const longText = 'x'.repeat(30_000) // over INLINE_BLOCK_LIMIT (24KB), so it truncates and gets a ref
  const lines = fakeLines([assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'text', text: longText }] })])
  const { turns } = groupIntoTurns(lines, 'parent-session', AGENT_ID)
  const block = turns.find((t) => t.kind === 'assistant')!.blocks[0]!
  assert.equal(block.type, 'text')
  if (block.type !== 'text') throw new Error('unreachable')
  assert.equal(block.truncated, true)
  assert.equal(block.ref?.agentId, AGENT_ID)
})

test('a truncated thinking block ref carries agentId', () => {
  const longThinking = 'y'.repeat(30_000)
  const lines = fakeLines([assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'thinking', thinking: longThinking }] })])
  const { turns } = groupIntoTurns(lines, 'parent-session', AGENT_ID)
  const block = turns.find((t) => t.kind === 'assistant')!.blocks[0]!
  assert.equal(block.type, 'thinking')
  if (block.type !== 'thinking') throw new Error('unreachable')
  assert.equal(block.truncated, true)
  assert.equal(block.ref?.agentId, AGENT_ID)
})

test('a tool_use result ref carries agentId', () => {
  const lines = fakeLines([
    assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'echo hi' } }] }),
    toolResultLine('toolu_1', 'hi', { toolUseResult: { stdout: 'hi', stderr: '', interrupted: false } }),
  ])
  const { turns } = groupIntoTurns(lines, 'parent-session', AGENT_ID)
  const toolBlock = turns.find((t) => t.kind === 'assistant')!.blocks[0]!
  assert.equal(toolBlock.type, 'tool_use')
  if (toolBlock.type !== 'tool_use') throw new Error('unreachable')
  assert.equal(toolBlock.result?.ref?.agentId, AGENT_ID)
})

test('omitting agentId (the main-session call site) leaves refs without one', () => {
  const lines = fakeLines([assistantLine({ messageId: 'msg_1', requestId: 'req_1', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'Zg==' } }] })])
  const { turns } = groupIntoTurns(lines, 'session-1')
  const block = turns.find((t) => t.kind === 'assistant')!.blocks[0]!
  assert.equal(block.type, 'image')
  if (block.type !== 'image') throw new Error('unreachable')
  assert.equal(block.ref.agentId, undefined)
})
