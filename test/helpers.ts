import type { OffsetRecord } from '../server/claude/lineReader.ts'
import type { RawRecord } from '../shared/records.ts'

/** Builds synthetic OffsetRecord[] fixtures for parser/dedup tests without
 * needing real (and privacy-sensitive) ~/.claude data. Byte offsets are
 * fabricated sequentially — fine for logic tests, since no test here reads
 * bytes back off disk. */
export function fakeLines(records: RawRecord[]): OffsetRecord[] {
  let offset = 0
  return records.map((record) => {
    const len = JSON.stringify(record).length + 1
    const entry: OffsetRecord = { record, byteOffset: offset, byteLength: len }
    offset += len
    return entry
  })
}

export function assistantLine(opts: {
  messageId: string
  requestId?: string
  content: unknown[]
  model?: string
  usage?: unknown
  uuid?: string
  timestamp?: string
  attribution?: Record<string, string>
}): RawRecord {
  return {
    type: 'assistant',
    uuid: opts.uuid ?? `uuid-${opts.messageId}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: opts.timestamp ?? '2026-08-10T10:00:00.000Z',
    requestId: opts.requestId,
    isSidechain: false,
    ...opts.attribution,
    message: {
      id: opts.messageId,
      role: 'assistant',
      model: opts.model ?? 'claude-sonnet-5',
      content: opts.content,
      usage: opts.usage ?? { input_tokens: 2, output_tokens: 5, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } },
      stop_reason: 'end_turn',
    },
  } as unknown as RawRecord
}

export function userTextLine(text: string, uuid = `u-${Math.random().toString(36).slice(2, 6)}`): RawRecord {
  return {
    type: 'user',
    uuid,
    timestamp: '2026-08-10T10:00:00.000Z',
    isSidechain: false,
    message: { role: 'user', content: text },
  } as unknown as RawRecord
}

export function toolResultLine(toolUseId: string, content: string, opts: { isError?: boolean; toolUseResult?: unknown; uuid?: string } = {}): RawRecord {
  return {
    type: 'user',
    uuid: opts.uuid ?? `u-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: '2026-08-10T10:00:00.000Z',
    isSidechain: false,
    toolUseResult: opts.toolUseResult,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: opts.isError }],
    },
  } as unknown as RawRecord
}
