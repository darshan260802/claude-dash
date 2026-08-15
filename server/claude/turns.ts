import type { OffsetRecord } from './lineReader.ts'
import type {
  RawRecord,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  MessagePayload,
} from '@shared/records.ts'
import { isAssistantRecord, isUserRecord } from '@shared/records.ts'
import type { TurnDTO, TurnBlockDTO, Attribution } from '@shared/types.ts'
import { normalizeToolResult, parseMcpTool, truncateText } from './toolResults.ts'

/** `${message.id}:${requestId}` — the key Claude Code's own API calls share
 * across every content-block line of one assistant turn, and (rarely) across
 * a forked/resumed session's files. Some records (observed: responses routed
 * through non-Anthropic models like `deepseek-v4-pro`) carry `message.id` but
 * no top-level `requestId` at all — `message.id` alone still repeats
 * identically across that turn's content-block lines, so it's used alone as
 * the key in that case rather than falling back to no-key-at-all (which would
 * make every content-block line of the same turn a distinct "turn", wildly
 * overcounting usage for every message routed this way). */
export type TurnKey = string

export function turnKey(message: MessagePayload, requestId: string | undefined): TurnKey | null {
  if (!message.id) return null
  return requestId ? `${message.id}:${requestId}` : message.id
}

interface PendingToolResult {
  block: ToolResultBlock
  toolUseResult: unknown
  byteOffset: number
  byteLength: number
  claimed: boolean
}

const SKIPPED_TYPES = new Set([
  'ai-title',
  'agent-name',
  'last-prompt',
  'mode',
  'permission-mode',
  'file-history-snapshot',
  'file-history-delta',
  'queue-operation',
])

function extractAttribution(r: RawRecord): Attribution | undefined {
  const a: Attribution = {}
  if (typeof r.attributionMcpServer === 'string') a.mcpServer = r.attributionMcpServer
  if (typeof r.attributionMcpTool === 'string') a.mcpTool = r.attributionMcpTool
  if (typeof r.attributionSkill === 'string') a.skill = r.attributionSkill
  if (typeof r.attributionAgent === 'string') a.agent = r.attributionAgent
  if (typeof r.attributionPlugin === 'string') a.plugin = r.attributionPlugin
  return Object.keys(a).length > 0 ? a : undefined
}

function mergeAttribution(into: Attribution | undefined, from: Attribution | undefined): Attribution | undefined {
  if (!from) return into
  return { ...into, ...from }
}

function attachmentSummary(attachment: Record<string, unknown>): string {
  // Never inline base64 payloads (file/image attachments) — keep only
  // metadata; full bytes are served on demand via /api/raw/attachment.
  const { content, ...rest } = attachment
  const safe: Record<string, unknown> = { ...rest }
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    safe.content = { type: c.type, filePath: c.filePath ?? c.file, hasData: 'base64' in c || 'data' in c }
  }
  return JSON.stringify(safe)
}

function convertBlock(
  block: ContentBlock,
  session: string,
  byteOffset: number,
  byteLength: number,
  agentId: string | undefined,
): TurnBlockDTO | null {
  switch (block.type) {
    case 'thinking': {
      const t = truncateText((block as { thinking: string }).thinking ?? '')
      return {
        type: 'thinking',
        text: t.text,
        truncated: t.truncated,
        fullBytes: t.truncated ? t.fullBytes : undefined,
        ref: t.truncated ? { session, byteOffset, byteLength, agentId } : undefined,
      }
    }
    case 'text': {
      const t = truncateText((block as { text: string }).text ?? '')
      return {
        type: 'text',
        text: t.text,
        truncated: t.truncated,
        fullBytes: t.truncated ? t.fullBytes : undefined,
        ref: t.truncated ? { session, byteOffset, byteLength, agentId } : undefined,
      }
    }
    case 'image': {
      const mediaType = 'source' in block ? String((block as { source: { media_type?: string } }).source?.media_type ?? '') : ''
      return { type: 'image', ref: { session, byteOffset, byteLength, agentId }, mediaType }
    }
    case 'tool_use':
      // handled separately via convertToolUseBlock — needs session context
      return null
    case 'tool_result':
      // folded into its originating tool_use block, never rendered standalone
      return null
    default:
      return { type: 'unknown', raw: block }
  }
}

export interface GroupIntoTurnsResult {
  turns: TurnDTO[]
  /** Record types encountered that aren't in the known schema — surfaced so
   * schema drift is visible in /api/settings rather than silently dropped. */
  unknownRecordTypes: string[]
}

/** Groups a session (or sub-agent) file's parsed lines into renderable turns.
 * Two-pass: first collect every line into either an open assistant-turn group,
 * a standalone user/system/attachment/error turn, or a pending tool_result
 * (keyed by tool_use_id); second pass resolves every tool_use block against
 * its pending result (or leaves it 'pending'), and any unclaimed tool_results
 * become synthetic orphan_tool_result turns positioned by byte offset. */
interface LocatedBlock {
  block: ContentBlock
  byteOffset: number
  byteLength: number
}

export function groupIntoTurns(lines: OffsetRecord[], session: string, agentId?: string): GroupIntoTurnsResult {
  const turns: TurnDTO[] = []
  const pendingResults = new Map<string, PendingToolResult>()
  const unknownRecordTypes = new Set<string>()

  let openKey: TurnKey | null = null
  let openTurn: TurnDTO | null = null
  let openBlockAccum: LocatedBlock[] = []

  const flushOpen = () => {
    openKey = null
    openTurn = null
    openBlockAccum = []
  }

  const knownTypes = new Set(['assistant', 'user', 'system', 'attachment', ...SKIPPED_TYPES])

  for (const { record, byteOffset, byteLength } of lines) {
    if (SKIPPED_TYPES.has(record.type)) continue
    if (!knownTypes.has(record.type)) unknownRecordTypes.add(record.type)

    if (record.type === 'assistant' && isAssistantRecord(record)) {
      const message = record.message
      const key = turnKey(message, record.requestId)
      const blocks = Array.isArray(message.content) ? message.content : []

      if (key && key === openKey && openTurn) {
        for (const b of blocks) openBlockAccum.push({ block: b, byteOffset, byteLength })
        openTurn.attribution = mergeAttribution(openTurn.attribution, extractAttribution(record))
        continue
      }

      finalizeOpenAssistant(openTurn, openBlockAccum)
      flushOpen()
      const turn: TurnDTO = {
        id: key ?? record.uuid ?? `assistant:${byteOffset}`,
        kind: record.isApiErrorMessage ? 'error' : 'assistant',
        role: 'assistant',
        model: message.model,
        timestamp: record.timestamp ?? '',
        blocks: [],
        usage: message.usage,
        stopReason: message.stop_reason,
        attribution: extractAttribution(record),
        isSidechain: record.isSidechain === true,
        byteOffset,
      }
      turns.push(turn)
      openTurn = turn
      openKey = key
      openBlockAccum = blocks.map((b) => ({ block: b, byteOffset, byteLength }))
      continue
    }

    // Any user-type record ends the current assistant accumulation group.
    if (record.type === 'user' && isUserRecord(record)) {
      finalizeOpenAssistant(openTurn, openBlockAccum)
      flushOpen()

      const message = record.message
      const blocks = Array.isArray(message.content) ? message.content : []
      const toolResultBlocks = blocks.filter((b): b is ToolResultBlock => b.type === 'tool_result')
      const otherBlocks = blocks.filter((b) => b.type !== 'tool_result')

      for (const trb of toolResultBlocks) {
        pendingResults.set(trb.tool_use_id, {
          block: trb,
          toolUseResult: record.toolUseResult,
          byteOffset,
          byteLength,
          claimed: false,
        })
      }

      if (otherBlocks.length > 0 || typeof message.content === 'string') {
        const dtoBlocks: TurnBlockDTO[] = []
        if (typeof message.content === 'string') {
          const t = truncateText(message.content)
          dtoBlocks.push({ type: 'text', text: t.text, truncated: t.truncated })
        } else {
          for (const b of otherBlocks) {
            const conv = convertBlock(b, session, byteOffset, byteLength, agentId)
            if (conv) dtoBlocks.push(conv)
          }
        }
        turns.push({
          id: record.uuid ?? `user:${byteOffset}`,
          kind: record.isApiErrorMessage ? 'error' : 'user',
          role: 'user',
          timestamp: record.timestamp ?? '',
          blocks: dtoBlocks,
          isSidechain: record.isSidechain === true,
          byteOffset,
        })
      }
      continue
    }

    if (record.type === 'system') {
      turns.push({
        id: record.uuid ?? `system:${byteOffset}`,
        kind: 'system',
        timestamp: record.timestamp ?? '',
        blocks: [],
        subtype: record.subtype,
        content: record.content,
        durationMs: record.durationMs,
        isSidechain: record.isSidechain === true,
        byteOffset,
      })
      continue
    }

    if (record.type === 'attachment') {
      const attachment = (record as { attachment?: Record<string, unknown> }).attachment
      turns.push({
        id: record.uuid ?? `attachment:${byteOffset}`,
        kind: 'attachment',
        timestamp: record.timestamp ?? '',
        blocks: [],
        subtype: attachment?.type as string | undefined,
        content: attachment ? attachmentSummary(attachment) : undefined,
        isSidechain: record.isSidechain === true,
        byteOffset,
      })
      continue
    }
    // any other unknown-but-typed record is intentionally not rendered as a
    // turn — it's tracked in unknownRecordTypes for visibility instead.
  }
  finalizeOpenAssistant(openTurn, openBlockAccum)

  // Second pass: resolve tool_use blocks now that every user-turn's
  // tool_result has been indexed by tool_use_id, regardless of file order.
  for (const turn of turns) {
    if (turn.kind !== 'assistant') continue
    const rawBlocks = (turn as unknown as { __rawBlocks?: LocatedBlock[] }).__rawBlocks ?? []
    const dtoBlocks: TurnBlockDTO[] = []
    for (const { block: b, byteOffset: lbOffset, byteLength: lbLength } of rawBlocks) {
      if (b.type === 'tool_use') {
        const tu = b as ToolUseBlock
        const pending = pendingResults.get(tu.id)
        if (pending) pending.claimed = true
        const mcp = parseMcpTool(tu.name)
        dtoBlocks.push({
          type: 'tool_use',
          id: tu.id,
          name: tu.name,
          input: tu.input,
          isMcp: mcp != null,
          mcpServer: mcp?.server,
          mcpTool: mcp?.tool,
          result: normalizeToolResult(tu.name, pending?.block, pending?.toolUseResult, {
            session,
            byteOffset: pending?.byteOffset ?? turn.byteOffset,
            byteLength: pending?.byteLength ?? 0,
            agentId,
          }),
        })
        continue
      }
      const conv = convertBlock(b, session, lbOffset, lbLength, agentId)
      if (conv) dtoBlocks.push(conv)
    }
    turn.blocks = dtoBlocks
    delete (turn as unknown as { __rawBlocks?: LocatedBlock[] }).__rawBlocks
  }

  // Orphan tool_results: never claimed by any tool_use block in this file
  // (e.g. the assistant line that made the call was truncated/missing).
  for (const [toolUseId, pending] of pendingResults) {
    if (pending.claimed) continue
    const t = truncateText(
      typeof pending.block.content === 'string' ? pending.block.content : JSON.stringify(pending.block.content),
    )
    turns.push({
      id: `orphan:${toolUseId}:${pending.byteOffset}`,
      kind: 'orphan_tool_result',
      timestamp: '',
      blocks: [{ type: 'text', text: t.text, truncated: t.truncated }],
      isSidechain: false,
      byteOffset: pending.byteOffset,
    })
  }

  turns.sort((a, b) => a.byteOffset - b.byteOffset)

  return { turns, unknownRecordTypes: [...unknownRecordTypes] }
}

function finalizeOpenAssistant(turn: TurnDTO | null, accum: LocatedBlock[]): void {
  if (!turn) return
  ;(turn as unknown as { __rawBlocks: LocatedBlock[] }).__rawBlocks = accum
}
