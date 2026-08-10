import type { RawRecord } from '@shared/records.ts'

/** Parse one JSONL line into a RawRecord. Never throws — malformed lines
 * (partial writes, corruption) return null so callers can count them as
 * `skipped` instead of crashing the indexer. */
export function parseLine(line: string): RawRecord | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj: unknown = JSON.parse(trimmed)
    if (obj !== null && typeof obj === 'object' && typeof (obj as { type?: unknown }).type === 'string') {
      return obj as RawRecord
    }
    return null
  } catch {
    return null
  }
}
