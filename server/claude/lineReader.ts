import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import type { RawRecord } from '@shared/records.ts'
import { parseLine } from './parse.ts'

/** A parsed record plus the exact byte offset where its source line began in
 * the file — used both as a stable identity for a line (survives across tail
 * batches, unlike a running counter) and as a direct seek target for
 * /api/raw/block to re-fetch the full untruncated line on demand. */
export interface OffsetRecord {
  record: RawRecord
  byteOffset: number
  byteLength: number
}

export interface TailResult {
  lines: OffsetRecord[]
  /** New absolute byte offset to resume from on the next tail (excludes any
   * trailing partial line — the file may still be mid-write). */
  bytesConsumed: number
  skipped: number
  oversizedCount: number
}

/** Above this, a single line is parsed but its large content blocks are
 * truncated (by the caller) rather than held in full — real data has been
 * observed with a single line over 1MB. */
export const MAX_LINE_BYTES = 4 * 1024 * 1024

/** Read and parse every complete line appended to `file` since `startOffset`.
 * Never consumes a trailing partial line (Claude Code appends non-atomically),
 * so `bytesConsumed` may be less than the file's current size — the remainder
 * is picked up on the next call. */
export async function readLinesFrom(file: string, startOffset: number): Promise<TailResult> {
  const handle = await open(file, 'r')
  try {
    const stat = await handle.stat()
    if (stat.size <= startOffset) {
      return { lines: [], bytesConsumed: startOffset, skipped: 0, oversizedCount: 0 }
    }

    const lines: OffsetRecord[] = []
    let skipped = 0
    let oversizedCount = 0

    let buf = ''
    let cursor = startOffset // byte offset corresponding to the start of `buf`

    const stream = createReadStream(file, { start: startOffset, highWaterMark: 1 << 20, encoding: 'utf8' })

    await new Promise<void>((resolvePromise, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        let nl: number
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          const lineByteLen = Buffer.byteLength(line, 'utf8')
          const lineStart = cursor
          cursor = lineStart + lineByteLen + 1 // +1 for the newline

          if (line.trim().length === 0) continue

          if (lineByteLen > MAX_LINE_BYTES) oversizedCount++

          const parsed = parseLine(line)
          if (parsed) lines.push({ record: parsed, byteOffset: lineStart, byteLength: lineByteLen })
          else skipped++
        }
      })
      stream.on('end', () => resolvePromise())
      stream.on('error', reject)
    })

    return { lines, bytesConsumed: cursor, skipped, oversizedCount }
  } finally {
    await handle.close()
  }
}

/** Fetch the exact byte range [offset, offset+length) of one line, for the
 * /api/raw/block "show full untruncated content" escape hatch. */
export async function readLineAt(file: string, offset: number, length: number): Promise<string> {
  const handle = await open(file, 'r')
  try {
    const buf = Buffer.alloc(length)
    await handle.read(buf, 0, length, offset)
    return buf.toString('utf8')
  } finally {
    await handle.close()
  }
}
