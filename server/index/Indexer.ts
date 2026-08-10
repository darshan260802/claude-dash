import { readdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { projectsDir, isDirectory } from '../claude/paths.ts'
import { SessionIndex } from './SessionIndex.ts'
import { log } from '../util/log.ts'

interface DiscoveredSessionFile {
  filePath: string
  projectKey: string
  sessionId: string
  mtimeMs: number
}

async function discoverSessionFiles(claudeDirs: string[]): Promise<DiscoveredSessionFile[]> {
  const found: DiscoveredSessionFile[] = []

  for (const claudeDir of claudeDirs) {
    const pDir = projectsDir(claudeDir)
    let projectEntries: string[]
    try {
      projectEntries = await readdir(pDir)
    } catch {
      continue
    }

    for (const projectKey of projectEntries) {
      const projectPath = join(pDir, projectKey)
      if (!isDirectory(projectPath)) continue

      let files: string[]
      try {
        files = await readdir(projectPath)
      } catch {
        continue
      }

      for (const f of files) {
        if (extname(f) !== '.jsonl') continue
        const filePath = join(projectPath, f)
        try {
          const st = await stat(filePath)
          if (!st.isFile()) continue
          found.push({ filePath, projectKey, sessionId: basename(f, '.jsonl'), mtimeMs: st.mtimeMs })
        } catch {
          // file disappeared between readdir and stat — skip
        }
      }
    }
  }

  // Deterministic fork attribution: process oldest-mtime-first so a resumed/
  // forked session's shared usage keys are always claimed by the same file
  // across restarts.
  found.sort((a, b) => a.mtimeMs - b.mtimeMs)
  return found
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once —
 * a full corpus scan doing 4 unbounded-concurrent readers on a dozen+ files
 * is fine, but an unbounded Promise.all over hundreds of files (larger
 * long-lived installs) would spike memory reading many multi-MB files at
 * once. */
async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

export async function buildIndex(index: SessionIndex, claudeDirs: string[]): Promise<void> {
  const start = performance.now()
  const files = await discoverSessionFiles(claudeDirs)

  let done = 0
  await mapWithConcurrency(files, 4, async (f) => {
    try {
      await index.ingestSessionFile(f.filePath, f.projectKey, f.sessionId)
    } catch (err) {
      log.warn(`failed to index ${f.filePath}: ${String(err)}`)
    }
    done++
  })

  const ms = Math.round(performance.now() - start)
  const counts = index.counts
  log.info(`indexed ${counts.projects} projects, ${counts.sessions} sessions, ${counts.turns} turns in ${ms}ms`)
  if (files.length !== done) log.warn(`${files.length - done} session files failed to index`)
}
