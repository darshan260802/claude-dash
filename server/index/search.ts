import type { TurnDTO, SearchHitDTO, SearchResultDTO, TurnKind } from '@shared/types.ts'

export interface SearchDoc {
  sessionId: string
  projectKey: string
  sessionTitle: string
  turnId: string
  turnIndex: number
  kind: TurnKind
  timestamp: string
  text: string
  textLower: string
}

function extractText(turn: TurnDTO): string {
  const parts: string[] = []
  if (turn.content) parts.push(turn.content)
  for (const b of turn.blocks) {
    if (b.type === 'text' || b.type === 'thinking') parts.push(b.text)
    else if (b.type === 'tool_use') {
      parts.push(b.name)
      if (typeof b.input === 'string') parts.push(b.input)
      if (b.result?.preview) parts.push(b.result.preview)
      if (b.result?.stdout) parts.push(b.result.stdout)
      if (b.result?.stderr) parts.push(b.result.stderr)
      if (b.result?.filePath) parts.push(b.result.filePath)
    }
  }
  return parts.join(' ')
}

export function buildSearchDocs(sessionId: string, projectKey: string, sessionTitle: string, turns: TurnDTO[]): SearchDoc[] {
  return turns.map((turn, turnIndex) => {
    const text = extractText(turn)
    return { sessionId, projectKey, sessionTitle, turnId: turn.id, turnIndex, kind: turn.kind, timestamp: turn.timestamp, text, textLower: text.toLowerCase() }
  })
}

function makeSnippet(text: string, matchIndex: number, query: string): string {
  const RADIUS = 60
  const start = Math.max(0, matchIndex - RADIUS)
  const end = Math.min(text.length, matchIndex + query.length + RADIUS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end).trim() + suffix
}

export interface SearchOptions {
  q: string
  project?: string
  kinds?: TurnKind[]
  limit?: number
}

/** Linear scan over a flat in-memory doc array — measured well under 5ms at
 * this scale (a few thousand turns). Swap for a proper index (e.g.
 * minisearch) only if a real corpus grows past ~100k turns. */
export function searchDocs(docs: SearchDoc[], opts: SearchOptions): SearchResultDTO {
  const start = performance.now()
  const q = opts.q.trim().toLowerCase()
  const limit = opts.limit ?? 50
  const hits: SearchHitDTO[] = []
  let total = 0

  if (q.length === 0) {
    return { hits: [], total: 0, tookMs: performance.now() - start }
  }

  for (const doc of docs) {
    if (opts.project && doc.projectKey !== opts.project) continue
    if (opts.kinds && opts.kinds.length > 0 && !opts.kinds.includes(doc.kind)) continue
    const idx = doc.textLower.indexOf(q)
    if (idx === -1) continue
    total++
    if (hits.length < limit) {
      hits.push({
        type: 'message',
        sessionId: doc.sessionId,
        projectKey: doc.projectKey,
        sessionTitle: doc.sessionTitle,
        turnId: doc.turnId,
        turnIndex: doc.turnIndex,
        kind: doc.kind,
        timestamp: doc.timestamp,
        snippet: makeSnippet(doc.text, idx, q),
        score: 1,
      })
    }
  }

  hits.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))

  return { hits, total, tookMs: performance.now() - start }
}
