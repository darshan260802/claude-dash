/** API DTOs shared between server and frontend. These are the *processed* shapes
 * returned over HTTP — distinct from the raw JSONL record shapes in records.ts. */

import type { ContentBlock, Usage } from './records.ts'

export interface UsageTotals {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export type Liveness = 'live' | 'recent' | 'ended'

export interface ModelPrice {
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_creation_input_token_cost?: number
  cache_creation_input_token_cost_above_1hr?: number
  cache_read_input_token_cost?: number
}

export interface ToolResultDTO {
  status: 'ok' | 'error' | 'denied' | 'pending'
  kind: string
  isError?: boolean
  preview?: string
  truncated?: boolean
  fullBytes?: number
  ref?: BlockRef
  structuredPatch?: unknown
  stdout?: string
  stderr?: string
  interrupted?: boolean
  filePath?: string
  raw?: unknown
}

export interface ToolUseBlockDTO {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
  isMcp: boolean
  mcpServer?: string
  mcpTool?: string
  result?: ToolResultDTO
  subagentRef?: { agentId: string; agentType?: string; description?: string; turnCount: number; cost: number | null }
}

export interface BlockRef {
  session: string
  byteOffset: number
  byteLength: number
  /** Present when this block belongs to a sub-agent transcript rather than
   * the main session file — `session` stays the PARENT session id either way
   * (that's what groupIntoTurns is called with for both file kinds), so this
   * is what /api/raw/* needs to pick the agent-<id>.jsonl file instead of the
   * parent's .jsonl at the same byte offset. */
  agentId?: string
}

export type TurnBlockDTO =
  | { type: 'thinking'; text: string; truncated?: boolean; fullBytes?: number; ref?: BlockRef }
  | { type: 'text'; text: string; truncated?: boolean; fullBytes?: number; ref?: BlockRef }
  | ToolUseBlockDTO
  | { type: 'image'; ref: BlockRef; mediaType: string }
  | { type: 'unknown'; raw: ContentBlock }

export interface Attribution {
  mcpServer?: string
  mcpTool?: string
  skill?: string
  agent?: string
  plugin?: string
}

export type TurnKind =
  | 'user'
  | 'assistant'
  | 'system'
  | 'attachment'
  | 'meta'
  | 'error'
  | 'orphan_tool_result'

export interface TurnDTO {
  id: string
  kind: TurnKind
  role?: 'user' | 'assistant'
  model?: string
  timestamp: string
  blocks: TurnBlockDTO[]
  usage?: Usage
  usageCounted?: boolean
  cost?: number | null
  stopReason?: string | null
  attribution?: Attribution
  isSidechain?: boolean
  subtype?: string
  durationMs?: number
  content?: string
  /** Byte offset of this turn's first source line in its session file — a
   * stable identity across tail-appends and the seek target for full-content
   * refetch via /api/raw/block. */
  byteOffset: number
}

export interface SubagentRefDTO {
  agentId: string
  agentType?: string
  description?: string
  turnCount: number
  usage: UsageTotals
  cost: number | null
  startedAt?: string
  endedAt?: string
  toolUseId?: string
}

/** Standalone view of one sub-agent, independent of loading its parent
 * session — what GET /api/sessions/:id/subagents/:agentId returns. Carries
 * just enough parent context (title, project) to orient the viewer without
 * granting access to the parent transcript itself. */
export interface SubagentDetailDTO {
  sessionId: string
  agentId: string
  agentType?: string
  description?: string
  turnCount: number
  usage: UsageTotals
  cost: number | null
  startedAt?: string
  endedAt?: string
  lastAppendAt: number
  liveness: Liveness
  parentTitle: string
  projectName: string
  projectKey: string
  /** Whether the current viewer may navigate to the parent session. True for
   * the owner and outside of scoped sharing; a scoped share of this agent
   * alone sets it false so the UI doesn't render a link the server would 403. */
  parentAccessible: boolean
}

export interface ProjectSummaryDTO {
  key: string
  cwd: string
  name: string
  sessionCount: number
  liveSessionCount: number
  firstSeen: string
  lastActivity: string
  totals: UsageTotals
  cost: number
  costUnknown: boolean
  apiCalls: number
  models: string[]
  sizeBytes: number
}

export interface SessionSummaryDTO {
  id: string
  projectKey: string
  projectName: string
  title: string
  slug?: string
  cwd: string
  gitBranch?: string
  startedAt: string
  endedAt: string
  lastAppendAt: number
  liveness: Liveness
  durationMs: number
  messageCount: number
  turnCount: number
  apiCalls: number
  countedApiCalls: number
  toolCallCount: number
  errorCount: number
  subagentCount: number
  models: string[]
  sessionKind?: string
  entrypoint?: string
  version?: string
  totals: UsageTotals
  cost: number
  costUnknown: boolean
  forkOf?: string
  attributions: { mcpServers: string[]; skills: string[]; agents: string[]; plugins: string[] }
}

export interface SessionDetailDTO extends SessionSummaryDTO {
  subagents: SubagentRefDTO[]
  permissionModes: string[]
  revision: number
}

export interface TurnsPageDTO {
  revision: number
  turns: TurnDTO[]
  nextCursor: number | null
  hasMore: boolean
}

export interface StatsSeriesPoint {
  bucket: string
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
  cost: number
  apiCalls: number
  sessions: number
}

export interface StatsByModel {
  model: string
  calls: number
  cost: number
  input: number
  output: number
  cacheRead: number
}

export interface StatsByProject {
  projectKey: string
  projectName: string
  calls: number
  cost: number
  input: number
  output: number
}

export interface StatsByTool {
  tool: string
  calls: number
  errors: number
  mcpServer?: string
}

export interface StatsDTO {
  range: { from: string; to: string }
  totals: UsageTotals & {
    cost: number
    apiCalls: number
    sessions: number
    projects: number
    unpricedCalls: number
  }
  series: StatsSeriesPoint[]
  byModel: StatsByModel[]
  byProject: StatsByProject[]
  byTool: StatsByTool[]
}

export interface SearchHitDTO {
  type: 'message'
  sessionId: string
  projectKey: string
  sessionTitle: string
  turnId: string
  turnIndex: number
  kind: TurnKind
  timestamp: string
  snippet: string
  score: number
}

export interface SearchResultDTO {
  hits: SearchHitDTO[]
  total: number
  tookMs: number
}

export interface SettingsDTO {
  claudeDirs: string[]
  detectedFrom: 'flag' | 'env' | 'default'
  pricing: {
    source: 'live' | 'cache' | 'fallback'
    fetchedAt: number | null
    modelCount: number
    unpricedModels: string[]
    error?: string
  }
  liveWindowMs: number
  recentWindowMs: number
  pollMs: number
  port: number
  version: string
  index: { projects: number; sessions: number; turns: number; indexing: boolean }
  unknownRecordTypes: string[]
}

export interface SettingsPatchDTO {
  liveWindowMs?: number
  pricingRefresh?: boolean
}

export type ShareMode = 'global' | 'scoped'

/** One shared-out item, enriched with just enough display context to render
 * a card/breadcrumb without a second round trip — used both by the owner's
 * Share page ("what am I currently sharing") and the visitor's own bootstrap
 * (GET /api/shared) and switcher. */
export interface ShareItemDTO {
  kind: 'session' | 'agent'
  sessionId: string
  agentId?: string
  title: string
  subtitle?: string
  projectName: string
  liveness: Liveness
}

export interface ShareStatusDTO {
  state: 'idle' | 'starting' | 'active' | 'error'
  url: string | null
  code: string | null
  startedAt: number | null
  error: string | null
  mode: ShareMode
  items: ShareItemDTO[]
}

/** What GET /api/shared returns — the one thing every viewer (owner or
 * visitor) can always reach, regardless of scope, since it's what the
 * frontend uses to decide which router/shell to render in the first place. */
export interface ShareContextDTO {
  isOwner: boolean
  active: boolean
  mode: ShareMode
  items: ShareItemDTO[]
}

export interface HealthDTO {
  ok: true
  version: string
  indexed: { projects: number; sessions: number; turns: number }
  indexing: boolean
}

export type ServerEvent =
  | { type: 'hello'; revision: number; liveSessions: string[] }
  | { type: 'session:update'; sessionId: string; projectKey: string; liveness: Liveness; turnCount: number; totals: UsageTotals; cost: number; newTurns: number }
  | { type: 'session:new'; sessionId: string; projectKey: string }
  | { type: 'stats:invalidate' }
  | { type: 'pricing:updated' }
  | { type: 'index:progress'; done: number; total: number }
  | { type: 'ping' }
