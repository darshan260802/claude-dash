import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { SubagentMeta } from '@shared/records.ts'
import type { SubagentRefDTO } from '@shared/types.ts'
import { subagentsDir } from './paths.ts'

export interface SubagentFile {
  agentId: string
  jsonlPath: string
  meta: SubagentMeta
}

/** Scan `<projectDir>/<sessionId>/subagents/*.meta.json` for one session.
 * Missing directory is the common case (most sessions spawn no sub-agents) —
 * returns an empty array rather than throwing. */
export async function discoverSubagentFiles(projectDir: string, sessionId: string): Promise<SubagentFile[]> {
  const dir = subagentsDir(projectDir, sessionId)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const metaFiles = entries.filter((f) => f.endsWith('.meta.json'))
  const results: SubagentFile[] = []
  for (const metaFile of metaFiles) {
    const agentId = basename(metaFile, '.meta.json').replace(/^agent-/, '')
    const jsonlPath = join(dir, `agent-${agentId}.jsonl`)
    try {
      const metaRaw = await readFile(join(dir, metaFile), 'utf8')
      const meta = JSON.parse(metaRaw) as SubagentMeta
      await stat(jsonlPath) // ensure the transcript actually exists
      results.push({ agentId, jsonlPath, meta })
    } catch {
      // a meta file with no matching transcript, or invalid JSON — skip it
      // rather than failing the whole session's index.
    }
  }
  return results
}

type SubagentSummary = { turnCount: number; usage: SubagentRefDTO['usage']; cost: number | null; startedAt?: string; endedAt?: string }

/** Build the full list of a session's sub-agents for `SessionDetailDTO.subagents`
 * — every discovered agent file, regardless of whether its meta carries a
 * `toolUseId`. Deliberately distinct from buildSubagentRefMap below: that one
 * is keyed by toolUseId and drops any file missing one, which is correct for
 * attaching a ref onto a specific tool_use block but wrong for "does this
 * agent show up anywhere at all" — an agent whose meta write raced the parent
 * turn's flush (or just predates toolUseId being recorded) would otherwise
 * silently vanish from the UI. */
export function buildSubagentList(files: SubagentFile[], summaries: Map<string, SubagentSummary>): SubagentRefDTO[] {
  return files.map((f) => {
    const summary = summaries.get(f.agentId)
    return {
      agentId: f.agentId,
      agentType: f.meta.agentType,
      description: f.meta.description,
      turnCount: summary?.turnCount ?? 0,
      usage: summary?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
      cost: summary?.cost ?? null,
      startedAt: summary?.startedAt,
      endedAt: summary?.endedAt,
      toolUseId: f.meta.toolUseId,
    }
  })
}

/** Build a lookup from the parent session's `Agent`/`Task` tool_use.id to the
 * sub-agent's summary — used both to attach `subagentRef` on the tool_use
 * block and to serve `GET /sessions/:id/subagents/:agentId/turns`. */
export function buildSubagentRefMap(
  files: SubagentFile[],
  summaries: Map<string, { turnCount: number; usage: SubagentRefDTO['usage']; cost: number | null; startedAt?: string; endedAt?: string }>,
): Map<string, SubagentRefDTO> {
  const byToolUseId = new Map<string, SubagentRefDTO>()
  for (const f of files) {
    const toolUseId = f.meta.toolUseId
    if (!toolUseId) continue
    const summary = summaries.get(f.agentId)
    byToolUseId.set(toolUseId, {
      agentId: f.agentId,
      agentType: f.meta.agentType,
      description: f.meta.description,
      turnCount: summary?.turnCount ?? 0,
      usage: summary?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
      cost: summary?.cost ?? null,
      startedAt: summary?.startedAt,
      endedAt: summary?.endedAt,
      toolUseId,
    })
  }
  return byToolUseId
}
