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
