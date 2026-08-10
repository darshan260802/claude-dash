/**
 * Raw JSONL record shapes written by Claude Code into ~/.claude/projects/**\/*.jsonl.
 * This format is undocumented and drifts across versions — every type here is
 * intentionally loose (open index signatures, optional fields) and every consumer
 * must be tolerant of unknown values rather than throwing.
 */

export interface CacheCreation {
  ephemeral_5m_input_tokens?: number
  ephemeral_1h_input_tokens?: number
}

export interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: CacheCreation
  service_tier?: string
  inference_geo?: string
  server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number }
  iterations?: unknown[]
  speed?: string
  [k: string]: unknown
}

export type ToolCaller = { type: 'direct' | string } | undefined

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature?: string
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
  caller?: ToolCaller
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | unknown[]
  is_error?: boolean
}

export interface ImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string } | { type: 'url'; url: string }
}

export type ContentBlock =
  | ThinkingBlock
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock
  | { type: string; [k: string]: unknown }

export interface MessagePayload {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  model?: string
  id?: string
  type?: string
  usage?: Usage
  stop_reason?: string | null
  stop_details?: unknown
  [k: string]: unknown
}

/** Fields common to nearly every record type. */
interface RecordBase {
  type: string
  sessionId?: string
  session_id?: string
  timestamp?: string
  uuid?: string
  parentUuid?: string | null
  logicalParentUuid?: string | null
  isSidechain?: boolean
  isMeta?: boolean
  isApiErrorMessage?: boolean
  isVisibleInTranscriptOnly?: boolean
  isCompactSummary?: boolean
  compactMetadata?: unknown
  userType?: string
  entrypoint?: string
  cwd?: string
  version?: string
  gitBranch?: string
  slug?: string
  sessionKind?: string
  effort?: string
  permissionMode?: string
  requestId?: string
  promptId?: string
  agentId?: string
  toolDenialKind?: string
  interruptedMessageId?: string
  sourceToolUseID?: string
  sourceToolAssistantUUID?: string
  promptSource?: string
  origin?: string
  error?: unknown
  userFeedback?: unknown
  [k: string]: unknown
}

export interface AssistantRecord extends RecordBase {
  type: 'assistant'
  message: MessagePayload
}

export interface UserRecord extends RecordBase {
  type: 'user'
  message: MessagePayload
  toolUseResult?: unknown
}

export interface SystemRecord extends RecordBase {
  type: 'system'
  subtype?: 'turn_duration' | 'informational' | 'away_summary' | 'local_command' | 'compact_boundary' | string
  content?: string
  level?: string
  durationMs?: number
  messageCount?: number
}

export interface AttachmentRecord extends RecordBase {
  type: 'attachment'
  attachment: { type: string; [k: string]: unknown }
}

export interface AiTitleRecord extends RecordBase {
  type: 'ai-title'
  aiTitle: string
}

export interface AgentNameRecord extends RecordBase {
  type: 'agent-name'
  agentName: string
}

export interface LastPromptRecord extends RecordBase {
  type: 'last-prompt'
  lastPrompt: string
  leafUuid?: string
}

export interface ModeRecord extends RecordBase {
  type: 'mode'
  mode: string
}

export interface PermissionModeRecord extends RecordBase {
  type: 'permission-mode'
  permissionMode: string
}

export interface FileHistorySnapshotRecord extends RecordBase {
  type: 'file-history-snapshot'
  messageId: string
  snapshot: unknown
  isSnapshotUpdate?: boolean
}

export interface FileHistoryDeltaRecord extends RecordBase {
  type: 'file-history-delta'
  messageId: string
  snapshotMessageId?: string
  trackingPath?: string
  backup?: unknown
}

export interface QueueOperationRecord extends RecordBase {
  type: 'queue-operation'
  operation: string
  content?: string
}

/** Discriminated union of every record type observed. Unknown `type` values fall
 * through to `RecordBase` shape via the catch-all — parsers must handle that case. */
export type RawRecord =
  | AssistantRecord
  | UserRecord
  | SystemRecord
  | AttachmentRecord
  | AiTitleRecord
  | AgentNameRecord
  | LastPromptRecord
  | ModeRecord
  | PermissionModeRecord
  | FileHistorySnapshotRecord
  | FileHistoryDeltaRecord
  | QueueOperationRecord

/** A record whose `type` didn't match any known variant above (schema drift —
 * Claude Code's JSONL format is undocumented and versioned). `record.type` is
 * still readable (every variant has it); other fields need a manual cast. */
export type UnknownRecord = RecordBase

export function isAssistantRecord(r: RawRecord): r is AssistantRecord {
  return r.type === 'assistant' && !!(r as AssistantRecord).message
}

export function isUserRecord(r: RawRecord): r is UserRecord {
  return r.type === 'user' && !!(r as UserRecord).message
}

export function sessionIdOf(r: RawRecord): string | undefined {
  return r.sessionId ?? r.session_id
}

/** Sub-agent `<sessionId>/subagents/<agent>.meta.json` sidecar shape. */
export interface SubagentMeta {
  agentType?: string
  description?: string
  toolUseId?: string
  spawnDepth?: number
  agentName?: string
  [k: string]: unknown
}
