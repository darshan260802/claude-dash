import type { OffsetRecord } from './lineReader.ts'
import type { Liveness } from '@shared/types.ts'
import { LIVE_WINDOW_MS, RECENT_WINDOW_MS } from '../config.ts'

/** No explicit "session is active" flag exists anywhere in Claude Code's JSONL
 * format — this is an inferred heuristic based on how recently the file was
 * last appended to, and is labeled as such in the UI. */
/** First/last record `timestamp` in file order — NOT every record type
 * carries one (e.g. `mode`/`permission-mode`/`file-history-*` often don't),
 * so this scans rather than trusting index 0 / length-1 directly. */
export function firstTimestamp(lines: OffsetRecord[]): string | undefined {
  return lines.find((l) => typeof l.record.timestamp === 'string')?.record.timestamp
}

export function lastTimestamp(lines: OffsetRecord[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (typeof lines[i].record.timestamp === 'string') return lines[i].record.timestamp
  }
  return undefined
}

export function sessionLiveness(lastAppendAt: number, now = Date.now()): Liveness {
  const age = now - lastAppendAt
  if (age < LIVE_WINDOW_MS) return 'live'
  if (age < RECENT_WINDOW_MS) return 'recent'
  return 'ended'
}

export interface SessionMeta {
  title: string
  cwd?: string
  gitBranch?: string
  slug?: string
  sessionKind?: string
  version?: string
  entrypoint?: string
  permissionModes: string[]
}

/** Derive session-level metadata by scanning every raw line once. Title
 * preference: the LAST `ai-title` record's `aiTitle` (Claude Code writes it
 * repeatedly as the conversation evolves — take the most recent), then
 * `agent-name`, then `slug` prettified, then the first real user message text,
 * then the session UUID as a last resort. */
export function extractSessionMeta(lines: OffsetRecord[], sessionIdFallback: string): SessionMeta {
  let aiTitle: string | undefined
  let agentName: string | undefined
  let slug: string | undefined
  let cwd: string | undefined
  let gitBranch: string | undefined
  let sessionKind: string | undefined
  let version: string | undefined
  let entrypoint: string | undefined
  let firstUserText: string | undefined
  const permissionModes = new Set<string>()

  for (const { record } of lines) {
    if (record.type === 'ai-title' && typeof (record as { aiTitle?: unknown }).aiTitle === 'string') {
      aiTitle = (record as { aiTitle: string }).aiTitle
    }
    if (record.type === 'agent-name' && typeof (record as { agentName?: unknown }).agentName === 'string') {
      agentName = (record as { agentName: string }).agentName
    }
    if (!slug && typeof record.slug === 'string') slug = record.slug
    if (!cwd && typeof record.cwd === 'string') cwd = record.cwd
    if (!gitBranch && typeof record.gitBranch === 'string') gitBranch = record.gitBranch
    if (!sessionKind && typeof record.sessionKind === 'string') sessionKind = record.sessionKind
    if (!version && typeof record.version === 'string') version = record.version
    if (!entrypoint && typeof record.entrypoint === 'string') entrypoint = record.entrypoint
    if (typeof record.permissionMode === 'string') permissionModes.add(record.permissionMode)

    if (!firstUserText && record.type === 'user') {
      const message = (record as { message?: { content?: unknown; role?: string } }).message
      if (message?.role === 'user') {
        const candidate =
          typeof message.content === 'string'
            ? message.content.trim()
            : Array.isArray(message.content)
              ? message.content.find(
                  (b): b is { type: 'text'; text: string } =>
                    !!b && typeof b === 'object' && (b as { type?: unknown }).type === 'text',
                )?.text?.trim()
              : undefined
        // Skip harness-injected wrapper text (e.g. <local-command-caveat>,
        // <system-reminder>) — not what a user typed, useless as a title.
        if (candidate && !/^</.test(candidate)) firstUserText = candidate
      }
    }
  }

  const title =
    aiTitle ??
    agentName ??
    (slug ? slug.replace(/-/g, ' ') : undefined) ??
    (firstUserText ? firstUserText.slice(0, 80) : undefined) ??
    sessionIdFallback

  return { title, cwd, gitBranch, slug, sessionKind, version, entrypoint, permissionModes: [...permissionModes] }
}
