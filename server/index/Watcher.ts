import chokidar, { type FSWatcher } from 'chokidar'
import { basename, dirname, extname } from 'node:path'
import { projectsDir } from '../claude/paths.ts'
import type { SessionIndex } from './SessionIndex.ts'
import { SWEEP_INTERVAL_MS } from '../config.ts'
import { log } from '../util/log.ts'

const DEBOUNCE_MS = 150

export interface WatcherUpdate {
  sessionId: string
  projectKey: string
  newTurns: number
  isNew: boolean
}

export interface WatcherHandle {
  close: () => Promise<void>
}

/** Watches every claude dir's `projects/**` tree for appended/new session and
 * sub-agent JSONL files, tailing only the new bytes on each change. Falls
 * back to a periodic mtime sweep in case chokidar misses events (observed on
 * some network/WSL/Docker mounts) — cheap insurance, not the primary path. */
export function startWatcher(index: SessionIndex, claudeDirs: string[], opts: { poll: boolean; onUpdate: (info: WatcherUpdate) => void }): WatcherHandle {
  const watchRoots = claudeDirs.map((d) => projectsDir(d))
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const processFile = async (filePath: string) => {
    try {
      const wasTracked = index.isTracked(filePath)
      if (wasTracked) {
        const result = await index.tailFile(filePath)
        const state = index.getFileState(filePath)
        if (result && state) {
          opts.onUpdate({ sessionId: state.sessionId, projectKey: state.projectKey, newTurns: result.newTurns, isNew: false })
        }
      } else {
        await ingestNewFile(index, filePath)
        const state = index.getFileState(filePath)
        if (state) {
          opts.onUpdate({ sessionId: state.sessionId, projectKey: state.projectKey, newTurns: 0, isNew: true })
        }
      }
    } catch (err) {
      log.warn(`watcher failed to process ${filePath}: ${String(err)}`)
    }
  }

  const handleChange = (filePath: string) => {
    if (extname(filePath) !== '.jsonl') return
    const existing = pending.get(filePath)
    if (existing) clearTimeout(existing)
    pending.set(
      filePath,
      setTimeout(() => {
        pending.delete(filePath)
        void processFile(filePath)
      }, DEBOUNCE_MS),
    )
  }

  const watcher: FSWatcher = chokidar.watch(watchRoots, {
    ignoreInitial: true,
    usePolling: opts.poll,
    depth: 3,
    awaitWriteFinish: false,
  })

  watcher.on('add', handleChange)
  watcher.on('change', handleChange)
  watcher.on('error', (err) => log.warn(`watcher error: ${String(err)}`))

  // Fallback sweep: re-tail every already-tracked file even if no chokidar
  // event fired for it. New files are still discovered primarily via 'add'.
  const sweep = setInterval(() => {
    void sweepOnce(index, opts.onUpdate)
  }, SWEEP_INTERVAL_MS)

  return {
    close: async () => {
      clearInterval(sweep)
      for (const t of pending.values()) clearTimeout(t)
      await watcher.close()
    },
  }
}

async function ingestNewFile(index: SessionIndex, filePath: string): Promise<void> {
  const dir = dirname(filePath)
  const sessionId = basename(filePath, '.jsonl')

  // Sub-agent file: <projectDir>/<sessionId>/subagents/agent-<hex>.jsonl
  if (basename(dir) === 'subagents') {
    const parentSessionId = basename(dirname(dir))
    const agentId = sessionId.replace(/^agent-/, '')
    await index.ingestSubagentFile(filePath, parentSessionId, agentId)
    return
  }

  // Regular session file: <projectsDir>/<projectKey>/<sessionId>.jsonl
  const projectKey = basename(dir)
  await index.ingestSessionFile(filePath, projectKey, sessionId)
}

async function sweepOnce(index: SessionIndex, onUpdate: (info: WatcherUpdate) => void): Promise<void> {
  for (const filePath of index.trackedFilePaths()) {
    try {
      const before = index.getFileState(filePath)
      if (!before) continue
      const result = await index.tailFile(filePath)
      if (result && result.newTurns > 0) {
        onUpdate({ sessionId: before.sessionId, projectKey: before.projectKey, newTurns: result.newTurns, isNew: false })
      }
    } catch (err) {
      log.warn(`sweep failed for ${filePath}: ${String(err)}`)
    }
  }
}
