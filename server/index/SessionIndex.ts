import { stat } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { OffsetRecord } from '../claude/lineReader.ts'
import { readLinesFrom } from '../claude/lineReader.ts'
import { groupIntoTurns } from '../claude/turns.ts'
import { extractSessionMeta, sessionLiveness, firstTimestamp, lastTimestamp } from '../claude/heuristics.ts'
import { UsageAccumulator, emptyTotals, addUsageToTotals } from '../claude/usage.ts'
import { discoverSubagentFiles, buildSubagentRefMap, buildSubagentList, type SubagentFile } from '../claude/subagents.ts'
import type { PricingService } from '../pricing/PricingService.ts'
import { buildSearchDocs, searchDocs, type SearchDoc, type SearchOptions } from './search.ts'
import { computeStats, type StatsOptions } from './aggregate.ts'
import type {
  TurnDTO,
  ProjectSummaryDTO,
  SessionSummaryDTO,
  SessionDetailDTO,
  TurnsPageDTO,
  StatsDTO,
  SearchResultDTO,
  UsageTotals,
  SubagentRefDTO,
  SubagentDetailDTO,
} from '@shared/types.ts'

interface FileState {
  path: string
  sessionId: string
  projectKey: string
  isSubagent: boolean
  agentId?: string
  offset: number
  mtimeMs: number
  rawLines: OffsetRecord[]
}

interface Attributions {
  mcpServers: Set<string>
  skills: Set<string>
  agents: Set<string>
  plugins: Set<string>
}

interface SessionNode {
  id: string
  projectKey: string
  cwd: string
  title: string
  slug?: string
  gitBranch?: string
  version?: string
  entrypoint?: string
  sessionKind?: string
  permissionModes: string[]
  filePath: string
  startedAt: string
  endedAt: string
  lastAppendAt: number
  turns: TurnDTO[]
  totals: UsageTotals
  cost: number
  costUnknown: boolean
  apiCalls: number
  countedApiCalls: number
  toolCallCount: number
  errorCount: number
  models: Set<string>
  attributions: Attributions
  subagents: SubagentRefDTO[]
  forkOf?: string
}

interface SubagentNode {
  agentId: string
  sessionId: string
  turns: TurnDTO[]
  totals: UsageTotals
  cost: number
  costUnknown: boolean
  turnCount: number
  countedApiCalls: number
  startedAt?: string
  endedAt?: string
  /** File mtime, same "is this live" signal rebuildSession uses for the
   * parent — lets an agent's own transcript be polled independently of
   * whether the parent session is still writing. */
  lastAppendAt: number
}

interface ProjectNode {
  key: string
  cwd: string
  name: string
  sessionIds: Set<string>
  sizeBytes: number
}

export class SessionIndex {
  private projects = new Map<string, ProjectNode>()
  private sessions = new Map<string, SessionNode>()
  private files = new Map<string, FileState>()
  private subagentFilesBySession = new Map<string, SubagentFile[]>()
  private subagentNodes = new Map<string, SubagentNode>() // key: `${sessionId}:${agentId}`
  private usageAcc = new UsageAccumulator()
  private unknownRecordTypes = new Set<string>()
  private searchDocsBySession = new Map<string, SearchDoc[]>()
  revision = 0
  private pricing: PricingService

  constructor(pricing: PricingService) {
    this.pricing = pricing
  }

  private touchRevision(): void {
    this.revision++
  }

  ensureProject(key: string, cwd: string): ProjectNode {
    let p = this.projects.get(key)
    if (!p) {
      p = { key, cwd, name: cwd ? basename(cwd) : key, sessionIds: new Set(), sizeBytes: 0 }
      this.projects.set(key, p)
    } else if (cwd && p.cwd !== cwd) {
      p.cwd = cwd
      p.name = basename(cwd)
    }
    return p
  }

  // ---------------------------------------------------------------------
  // Ingestion
  // ---------------------------------------------------------------------

  async ingestSessionFile(filePath: string, projectKey: string, sessionId: string): Promise<void> {
    const { lines, bytesConsumed } = await readLinesFrom(filePath, 0)
    const st = await stat(filePath)
    const state: FileState = {
      path: filePath,
      sessionId,
      projectKey,
      isSubagent: false,
      offset: bytesConsumed,
      mtimeMs: st.mtimeMs,
      rawLines: lines,
    }
    this.files.set(filePath, state)

    const subagentFiles = await discoverSubagentFiles(dirnameOfProject(filePath), sessionId)
    this.subagentFilesBySession.set(sessionId, subagentFiles)
    for (const sf of subagentFiles) {
      await this.ingestSubagentFile(sf.jsonlPath, sessionId, sf.agentId)
    }

    this.rebuildSession(state)
    this.touchRevision()
  }

  async ingestSubagentFile(filePath: string, sessionId: string, agentId: string): Promise<void> {
    const { lines, bytesConsumed } = await readLinesFrom(filePath, 0)
    const st = await stat(filePath)
    const state: FileState = {
      path: filePath,
      sessionId,
      projectKey: '', // sub-agent files don't carry project identity directly
      isSubagent: true,
      agentId,
      offset: bytesConsumed,
      mtimeMs: st.mtimeMs,
      rawLines: lines,
    }
    this.files.set(filePath, state)
    this.rebuildSubagent(state)

    // ingestSessionFile's own discoverSubagentFiles pass only runs once, at
    // initial session ingest — so a sub-agent spawned later (the live case)
    // needs its own discovery pass here, or it stays invisible in the
    // parent's `subagents` list until a full re-index. filePath here is
    // <projectDir>/<sessionId>/subagents/agent-<id>.jsonl, so three dirnames
    // up is <projectDir>.
    const projectDir = dirname(dirname(dirname(filePath)))
    const subagentFiles = await discoverSubagentFiles(projectDir, sessionId)
    this.subagentFilesBySession.set(sessionId, subagentFiles)

    const parentPath = this.sessionFilePathOf(sessionId)
    const parentState = parentPath ? this.files.get(parentPath) : undefined
    if (parentState) {
      this.rebuildSession(parentState)
      this.touchRevision()
    }
    // If the parent session file hasn't been ingested yet at all, its own
    // ingestSessionFile call will run discoverSubagentFiles itself and pick
    // up this agent then — no gap either way.
  }

  /** Called by the file watcher on `add`/`change`. Returns null if the file
   * isn't tracked (caller should do a full ingest instead), or the count of
   * newly appended turns. */
  async tailFile(filePath: string): Promise<{ newTurns: number } | null> {
    const state = this.files.get(filePath)
    if (!state) return null

    const st = await stat(filePath)
    if (st.size < state.offset) {
      // Truncated or rewritten (e.g. compaction) — release this session's
      // usage-key claims and re-index from scratch.
      this.usageAcc.releaseSession(state.sessionId)
      state.rawLines = []
      state.offset = 0
    }

    const { lines, bytesConsumed, skipped: _skipped } = await readLinesFrom(filePath, state.offset)
    if (lines.length === 0) {
      state.offset = bytesConsumed
      state.mtimeMs = st.mtimeMs
      return { newTurns: 0 }
    }

    state.rawLines.push(...lines)
    state.offset = bytesConsumed
    state.mtimeMs = st.mtimeMs

    if (state.isSubagent) {
      const before = this.subagentNodes.get(`${state.sessionId}:${state.agentId}`)?.turns.length ?? 0
      this.rebuildSubagent(state)
      // A sub-agent's usage rolls into the parent session's own turns (they
      // share nothing but the toolUseId correlation), so re-derive the
      // parent's subagent refs too.
      const parent = this.files.get(this.sessionFilePathOf(state.sessionId) ?? '')
      if (parent) this.rebuildSession(parent)
      const after = this.subagentNodes.get(`${state.sessionId}:${state.agentId}`)?.turns.length ?? 0
      this.touchRevision()
      return { newTurns: after - before }
    }

    const before = this.sessions.get(state.sessionId)?.turns.length ?? 0
    this.rebuildSession(state)
    const after = this.sessions.get(state.sessionId)?.turns.length ?? 0
    this.touchRevision()
    return { newTurns: after - before }
  }

  private sessionFilePathOf(sessionId: string): string | undefined {
    for (const [path, st] of this.files) {
      if (st.sessionId === sessionId && !st.isSubagent) return path
    }
    return undefined
  }

  isTracked(filePath: string): boolean {
    return this.files.has(filePath)
  }

  trackedFilePaths(): string[] {
    return [...this.files.keys()]
  }

  // ---------------------------------------------------------------------
  // Rebuild (re-derive turns + rollups from a file's full accumulated lines)
  // ---------------------------------------------------------------------

  private rebuildSubagent(state: FileState): void {
    const { turns, unknownRecordTypes } = groupIntoTurns(state.rawLines, state.sessionId, state.agentId)
    for (const t of unknownRecordTypes) this.unknownRecordTypes.add(t)

    const totals = emptyTotals()
    let cost = 0
    let costUnknown = false
    let countedApiCalls = 0
    const localSeen = new Set<string>()

    for (const turn of turns) {
      if (turn.kind !== 'assistant') continue
      // A key can legitimately appear as more than one Turn object within
      // this same file — groupIntoTurns starts a new Turn when a key
      // reappears after an intervening user turn (a resume/replay), which is
      // structurally correct for rendering but must still only be counted
      // once here. The global accumulator alone can't tell "same owner
      // resubmitting on a later rebuild" (fine, idempotent) apart from "same
      // owner submitting a genuine intra-file duplicate in this SAME pass"
      // (must suppress) — so that distinction is made locally, first.
      if (localSeen.has(turn.id)) {
        turn.usageCounted = false
        turn.cost = null
        continue
      }
      localSeen.add(turn.id)
      const { counted, cost: c } = this.usageAcc.add(turn.id, `${state.sessionId}:${state.agentId}`, turn.model, turn.usage, this.pricing)
      turn.usageCounted = counted
      turn.cost = c
      if (counted) {
        countedApiCalls++
        addUsageToTotals(totals, turn.usage)
        if (c == null) costUnknown = true
        else cost += c
      }
    }

    const first = firstTimestamp(state.rawLines)
    const last = lastTimestamp(state.rawLines)

    this.subagentNodes.set(`${state.sessionId}:${state.agentId}`, {
      agentId: state.agentId!,
      sessionId: state.sessionId,
      turns,
      totals,
      cost,
      costUnknown,
      turnCount: turns.length,
      countedApiCalls,
      startedAt: first,
      endedAt: last,
      lastAppendAt: state.mtimeMs,
    })
  }

  private rebuildSession(state: FileState): void {
    const { turns, unknownRecordTypes } = groupIntoTurns(state.rawLines, state.sessionId)
    for (const t of unknownRecordTypes) this.unknownRecordTypes.add(t)

    const meta = extractSessionMeta(state.rawLines, state.sessionId)
    // The file's actual last-write time is the robust "is this live" signal —
    // it reflects real disk I/O regardless of what any record's `timestamp`
    // field claims (clock skew, replayed/seeded test data, etc).
    const lastAppendAt = state.mtimeMs
    const projectKey = state.projectKey
    const cwd = meta.cwd ?? this.projects.get(projectKey)?.cwd ?? ''
    const project = this.ensureProject(projectKey, cwd)
    project.sessionIds.add(state.sessionId)

    const totals = emptyTotals()
    let cost = 0
    let costUnknown = false
    let apiCalls = 0
    let countedApiCalls = 0
    let toolCallCount = 0
    let errorCount = 0
    const models = new Set<string>()
    const attributions: Attributions = { mcpServers: new Set(), skills: new Set(), agents: new Set(), plugins: new Set() }
    const localSeen = new Set<string>()

    for (const turn of turns) {
      if (turn.kind === 'assistant' || turn.kind === 'error') {
        if (turn.kind === 'assistant') {
          apiCalls++
          if (turn.model) models.add(turn.model)
          // See the identical comment in rebuildSubagent: a key can appear as
          // more than one Turn within this same file (resume/replay after an
          // intervening user turn) and must only be counted once.
          if (localSeen.has(turn.id)) {
            turn.usageCounted = false
            turn.cost = null
          } else {
            localSeen.add(turn.id)
            const { counted, cost: c } = this.usageAcc.add(turn.id, state.sessionId, turn.model, turn.usage, this.pricing)
            turn.usageCounted = counted
            turn.cost = c
            if (counted) {
              countedApiCalls++
              addUsageToTotals(totals, turn.usage)
              if (c == null) costUnknown = true
              else cost += c
            }
          }
        } else {
          errorCount++
        }
        if (turn.attribution) {
          if (turn.attribution.mcpServer) attributions.mcpServers.add(turn.attribution.mcpServer)
          if (turn.attribution.skill) attributions.skills.add(turn.attribution.skill)
          if (turn.attribution.agent) attributions.agents.add(turn.attribution.agent)
          if (turn.attribution.plugin) attributions.plugins.add(turn.attribution.plugin)
        }
      }
      for (const block of turn.blocks) {
        if (block.type === 'tool_use') {
          toolCallCount++
          if (block.result?.isError) errorCount++
        }
      }
    }

    const subagentFiles = this.subagentFilesBySession.get(state.sessionId) ?? []
    const summaries = new Map<
      string,
      { turnCount: number; countedApiCalls: number; usage: UsageTotals; cost: number | null; startedAt?: string; endedAt?: string }
    >()
    for (const sf of subagentFiles) {
      const node = this.subagentNodes.get(`${state.sessionId}:${sf.agentId}`)
      if (node) {
        summaries.set(sf.agentId, {
          turnCount: node.turnCount,
          countedApiCalls: node.countedApiCalls,
          usage: node.totals,
          cost: node.costUnknown ? null : node.cost,
          startedAt: node.startedAt,
          endedAt: node.endedAt,
        })
      }
    }
    const subagentRefMap = buildSubagentRefMap(subagentFiles, summaries)
    for (const turn of turns) {
      if (turn.kind !== 'assistant') continue
      for (const block of turn.blocks) {
        if (block.type === 'tool_use') {
          const ref = subagentRefMap.get(block.id)
          if (ref) block.subagentRef = { agentId: ref.agentId, agentType: ref.agentType, description: ref.description, turnCount: ref.turnCount, cost: ref.cost }
        }
      }
    }

    // Roll delegated sub-agent work into this session's own totals — a user
    // thinks of "what this task cost" as including anything it spawned. Each
    // sub-agent's usage was already deduped against the SAME global
    // accumulator when it was rebuilt, so this can't double-count against
    // another session; it just decides which session's total the already-
    // counted tokens are folded into.
    for (const summary of summaries.values()) {
      totals.input += summary.usage.input
      totals.output += summary.usage.output
      totals.cacheRead += summary.usage.cacheRead
      totals.cacheWrite5m += summary.usage.cacheWrite5m
      totals.cacheWrite1h += summary.usage.cacheWrite1h
      apiCalls += summary.turnCount
      countedApiCalls += summary.countedApiCalls
      if (summary.cost == null) costUnknown = true
      else cost += summary.cost
    }

    const first = firstTimestamp(state.rawLines)
    const last = lastTimestamp(state.rawLines)

    const existing = this.sessions.get(state.sessionId)
    const node: SessionNode = {
      id: state.sessionId,
      projectKey,
      cwd,
      title: meta.title,
      slug: meta.slug,
      gitBranch: meta.gitBranch,
      version: meta.version,
      entrypoint: meta.entrypoint,
      sessionKind: meta.sessionKind,
      permissionModes: meta.permissionModes,
      filePath: state.path,
      startedAt: first ?? existing?.startedAt ?? '',
      endedAt: last ?? existing?.endedAt ?? '',
      lastAppendAt,
      turns,
      totals,
      cost,
      costUnknown,
      apiCalls,
      countedApiCalls,
      toolCallCount,
      errorCount,
      models,
      attributions,
      // Not [...subagentRefMap.values()] — that map is keyed by toolUseId and
      // silently drops any agent whose meta lacks one (see buildSubagentList's
      // doc comment). This is the DTO's full "does this agent exist" list.
      subagents: buildSubagentList(subagentFiles, summaries),
    }
    this.sessions.set(state.sessionId, node)
    this.searchDocsBySession.set(state.sessionId, buildSearchDocs(state.sessionId, projectKey, node.title, turns))
  }

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  private toProjectSummary(p: ProjectNode): ProjectSummaryDTO {
    const sessions = [...p.sessionIds].map((id) => this.sessions.get(id)).filter((s): s is SessionNode => !!s)
    const totals = emptyTotals()
    let cost = 0
    let costUnknown = false
    let apiCalls = 0
    let liveSessionCount = 0
    let firstSeen = ''
    let lastActivity = ''
    const models = new Set<string>()
    for (const s of sessions) {
      totals.input += s.totals.input
      totals.output += s.totals.output
      totals.cacheRead += s.totals.cacheRead
      totals.cacheWrite5m += s.totals.cacheWrite5m
      totals.cacheWrite1h += s.totals.cacheWrite1h
      cost += s.cost
      if (s.costUnknown) costUnknown = true
      apiCalls += s.countedApiCalls
      for (const m of s.models) models.add(m)
      if (sessionLiveness(s.lastAppendAt) !== 'ended') liveSessionCount++
      if (!firstSeen || (s.startedAt && s.startedAt < firstSeen)) firstSeen = s.startedAt || firstSeen
      if (!lastActivity || s.endedAt > lastActivity) lastActivity = s.endedAt || lastActivity
    }
    return {
      key: p.key,
      cwd: p.cwd,
      name: p.name,
      sessionCount: sessions.length,
      liveSessionCount,
      firstSeen,
      lastActivity,
      totals,
      cost,
      costUnknown,
      apiCalls,
      models: [...models],
      sizeBytes: p.sizeBytes,
    }
  }

  listProjects(): ProjectSummaryDTO[] {
    return [...this.projects.values()].map((p) => this.toProjectSummary(p)).sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1))
  }

  getProject(key: string): ProjectSummaryDTO | null {
    const p = this.projects.get(key)
    return p ? this.toProjectSummary(p) : null
  }

  private toSessionSummary(s: SessionNode): SessionSummaryDTO {
    const project = this.projects.get(s.projectKey)
    return {
      id: s.id,
      projectKey: s.projectKey,
      projectName: project?.name ?? s.projectKey,
      title: s.title,
      slug: s.slug,
      cwd: s.cwd,
      gitBranch: s.gitBranch,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      lastAppendAt: s.lastAppendAt,
      liveness: sessionLiveness(s.lastAppendAt),
      durationMs: s.endedAt && s.startedAt ? Math.max(0, Date.parse(s.endedAt) - Date.parse(s.startedAt)) : 0,
      messageCount: s.turns.length,
      turnCount: s.turns.length,
      apiCalls: s.apiCalls,
      countedApiCalls: s.countedApiCalls,
      toolCallCount: s.toolCallCount,
      errorCount: s.errorCount,
      subagentCount: s.subagents.length,
      models: [...s.models],
      sessionKind: s.sessionKind,
      entrypoint: s.entrypoint,
      version: s.version,
      totals: s.totals,
      cost: s.cost,
      costUnknown: s.costUnknown,
      forkOf: s.forkOf,
      attributions: {
        mcpServers: [...s.attributions.mcpServers],
        skills: [...s.attributions.skills],
        agents: [...s.attributions.agents],
        plugins: [...s.attributions.plugins],
      },
    }
  }

  listSessions(filter: { project?: string; live?: boolean; model?: string; from?: string; to?: string } = {}): SessionSummaryDTO[] {
    let out = [...this.sessions.values()]
    if (filter.project) out = out.filter((s) => s.projectKey === filter.project)
    if (filter.model) out = out.filter((s) => s.models.has(filter.model!))
    if (filter.from) out = out.filter((s) => !s.endedAt || s.endedAt >= filter.from!)
    if (filter.to) out = out.filter((s) => !s.startedAt || s.startedAt <= filter.to!)
    let summaries = out.map((s) => this.toSessionSummary(s))
    if (filter.live) summaries = summaries.filter((s) => s.liveness !== 'ended')
    return summaries.sort((a, b) => (a.lastAppendAt < b.lastAppendAt ? 1 : -1))
  }

  getSession(id: string): SessionDetailDTO | null {
    const s = this.sessions.get(id)
    if (!s) return null
    return { ...this.toSessionSummary(s), subagents: s.subagents, permissionModes: s.permissionModes, revision: this.revision }
  }

  getSessionTurns(
    id: string,
    opts: { cursor?: number; limit?: number; kinds?: string[]; tools?: string[]; q?: string } = {},
  ): TurnsPageDTO | null {
    const s = this.sessions.get(id)
    if (!s) return null
    return this.paginateTurns(s.turns, opts)
  }

  getSubagentTurns(sessionId: string, agentId: string, opts: { cursor?: number; limit?: number } = {}): TurnsPageDTO | null {
    const node = this.subagentNodes.get(`${sessionId}:${agentId}`)
    if (!node) return null
    return this.paginateTurns(node.turns, opts)
  }

  private paginateTurns(
    all: TurnDTO[],
    opts: { cursor?: number; limit?: number; kinds?: string[]; tools?: string[]; q?: string },
  ): TurnsPageDTO {
    let filtered = all
    if (opts.kinds && opts.kinds.length > 0) {
      const kindSet = new Set(opts.kinds)
      filtered = filtered.filter((t) => kindSet.has(t.kind))
    }
    if (opts.tools && opts.tools.length > 0) {
      const toolSet = new Set(opts.tools)
      filtered = filtered.filter((t) => t.blocks.some((b) => b.type === 'tool_use' && toolSet.has(b.name)))
    }
    if (opts.q) {
      const q = opts.q.toLowerCase()
      filtered = filtered.filter((t) => JSON.stringify(t).toLowerCase().includes(q))
    }

    const limit = opts.limit ?? 80
    const cursor = opts.cursor ?? 0
    const page = filtered.slice(cursor, cursor + limit)
    const hasMore = cursor + limit < filtered.length
    return { revision: this.revision, turns: page, nextCursor: hasMore ? cursor + limit : null, hasMore }
  }

  getStats(opts: StatsOptions): StatsDTO {
    const inputs = [...this.sessions.values()].map((s) => {
      const projectName = this.projects.get(s.projectKey)?.name ?? s.projectKey
      // Include sub-agent turns under the parent session's identity — a
      // delegated agent's model/tool usage is still this session's work, and
      // its usage keys were deduped against the same global accumulator when
      // its own file was rebuilt, so this can't double-count.
      const subagentTurns = (this.subagentFilesBySession.get(s.id) ?? []).flatMap(
        (sf) => this.subagentNodes.get(`${s.id}:${sf.agentId}`)?.turns ?? [],
      )
      return { sessionId: s.id, projectKey: s.projectKey, projectName, turns: subagentTurns.length > 0 ? [...s.turns, ...subagentTurns] : s.turns }
    })
    return computeStats(inputs, opts)
  }

  search(opts: SearchOptions): SearchResultDTO {
    const all: SearchDoc[] = []
    for (const docs of this.searchDocsBySession.values()) all.push(...docs)
    return searchDocs(all, opts)
  }

  get counts(): { projects: number; sessions: number; turns: number } {
    let turns = 0
    for (const s of this.sessions.values()) turns += s.turns.length
    return { projects: this.projects.size, sessions: this.sessions.size, turns }
  }

  get unknownTypes(): string[] {
    return [...this.unknownRecordTypes]
  }

  getFileState(filePath: string): { sessionId: string; projectKey: string; isSubagent: boolean } | undefined {
    const s = this.files.get(filePath)
    return s ? { sessionId: s.sessionId, projectKey: s.projectKey, isSubagent: s.isSubagent } : undefined
  }

  /** Resolve a raw file's absolute overflow-file directory for path-traversal-
   * safe tool-results lookups (see api/routes/raw.ts). */
  getSessionFilePath(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.filePath
  }

  /** Same as getSessionFilePath but for a sub-agent's own transcript file —
   * needed because a BlockRef inside an agent turn carries the PARENT
   * session id (groupIntoTurns is always called with the parent id) plus an
   * agentId, and /api/raw/* must read the agent's file, not the parent's, at
   * that byte offset. */
  getSubagentFilePath(sessionId: string, agentId: string): string | undefined {
    for (const [path, st] of this.files) {
      if (st.isSubagent && st.sessionId === sessionId && st.agentId === agentId) return path
    }
    return undefined
  }

  /** Standalone sub-agent detail, independent of loading the parent session —
   * backs GET /api/sessions/:id/subagents/:agentId. Reads agentType/description
   * from subagentFilesBySession (not session.subagents) so it still resolves
   * for an agent whose meta lacks a toolUseId. `parentAccessible` is always
   * true here; a scoped share (agent shared without its parent) overrides it
   * at the route layer, not here — this method has no notion of a viewer. */
  getSubagent(sessionId: string, agentId: string): SubagentDetailDTO | null {
    const node = this.subagentNodes.get(`${sessionId}:${agentId}`)
    if (!node) return null
    const file = (this.subagentFilesBySession.get(sessionId) ?? []).find((f) => f.agentId === agentId)
    const parent = this.sessions.get(sessionId)
    const project = parent ? this.projects.get(parent.projectKey) : undefined
    return {
      sessionId,
      agentId,
      agentType: file?.meta.agentType,
      description: file?.meta.description,
      turnCount: node.turnCount,
      usage: node.totals,
      cost: node.costUnknown ? null : node.cost,
      startedAt: node.startedAt,
      endedAt: node.endedAt,
      lastAppendAt: node.lastAppendAt,
      liveness: sessionLiveness(node.lastAppendAt),
      parentTitle: parent?.title ?? sessionId,
      projectName: project?.name ?? parent?.projectKey ?? '',
      projectKey: parent?.projectKey ?? '',
      parentAccessible: true,
    }
  }
}

function dirnameOfProject(sessionFilePath: string): string {
  // <projectDir>/<sessionId>.jsonl -> <projectDir>
  return dirname(sessionFilePath)
}
