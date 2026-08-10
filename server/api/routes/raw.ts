import type { Hono } from 'hono'
import { resolve, sep, join } from 'node:path'
import type { RouteContext } from '../context.ts'
import { readLineAt } from '../../claude/lineReader.ts'
import { toolResultsDir } from '../../claude/paths.ts'
import { parseLine } from '../../claude/parse.ts'
import { readFile } from 'node:fs/promises'

const MAX_RAW_READ_BYTES = 32 * 1024 * 1024 // guard against a malformed byteLength causing a huge read

export function registerRawRoutes(app: Hono, ctx: RouteContext): void {
  // Full untruncated content of one source line's block (thinking/text/
  // tool_result), addressed by the byte offset the index already recorded —
  // never by anything the client could use to point at an arbitrary file.
  app.get('/api/raw/block', async (c) => {
    const session = c.req.query('session')
    const byteOffset = Number(c.req.query('byteOffset'))
    const byteLength = Number(c.req.query('byteLength'))
    if (!session || !Number.isFinite(byteOffset) || !Number.isFinite(byteLength)) {
      return c.json({ error: 'bad_request' }, 400)
    }
    if (byteLength < 0 || byteLength > MAX_RAW_READ_BYTES) return c.json({ error: 'bad_request' }, 400)

    const filePath = ctx.index.getSessionFilePath(session)
    if (!filePath) return c.json({ error: 'not_found' }, 404)

    try {
      const line = await readLineAt(filePath, byteOffset, byteLength)
      const record = parseLine(line)
      if (!record) return c.json({ error: 'unreadable' }, 500)
      return c.json({ record })
    } catch {
      return c.json({ error: 'unreadable' }, 500)
    }
  })

  // `tool-results/*.txt` overflow files referenced from a tool_result's text
  // (large MCP outputs get written to disk rather than inlined). `name` is
  // validated to be a bare filename — resolved and prefix-checked against the
  // session's own tool-results directory so it can never escape it.
  app.get('/api/raw/overflow', async (c) => {
    const session = c.req.query('session')
    const name = c.req.query('name')
    if (!session || !name) return c.json({ error: 'bad_request' }, 400)

    const sessionFilePath = ctx.index.getSessionFilePath(session)
    if (!sessionFilePath) return c.json({ error: 'not_found' }, 404)

    const projectDir = sessionFilePath.slice(0, sessionFilePath.lastIndexOf(sep))
    const dir = toolResultsDir(projectDir, session)
    const requested = resolve(join(dir, name))
    const dirResolved = resolve(dir) + sep
    if (!requested.startsWith(dirResolved)) {
      return c.json({ error: 'forbidden' }, 403)
    }

    try {
      const content = await readFile(requested, 'utf8')
      return c.text(content)
    } catch {
      return c.json({ error: 'not_found' }, 404)
    }
  })

  // Binary attachment (image/PDF) embedded as base64 in a specific source
  // line — same byte-offset addressing as /api/raw/block.
  app.get('/api/raw/attachment', async (c) => {
    const session = c.req.query('session')
    const byteOffset = Number(c.req.query('byteOffset'))
    const byteLength = Number(c.req.query('byteLength'))
    if (!session || !Number.isFinite(byteOffset) || !Number.isFinite(byteLength)) {
      return c.json({ error: 'bad_request' }, 400)
    }
    if (byteLength < 0 || byteLength > MAX_RAW_READ_BYTES) return c.json({ error: 'bad_request' }, 400)

    const filePath = ctx.index.getSessionFilePath(session)
    if (!filePath) return c.json({ error: 'not_found' }, 404)

    try {
      const line = await readLineAt(filePath, byteOffset, byteLength)
      const record = parseLine(line) as {
        attachment?: { content?: { type?: string; media_type?: string; data?: string; base64?: string } }
        message?: { content?: unknown }
      } | null

      // Two distinct shapes carry binary payloads: `attachment`-type records
      // (a user-attached file/image) and inline `image` content blocks inside
      // an assistant/user message's `content` array.
      let b64: string | undefined
      let mediaType: string | undefined

      const attachmentData = record?.attachment?.content
      if (attachmentData) {
        b64 = attachmentData.data ?? attachmentData.base64
        mediaType = attachmentData.media_type ?? (attachmentData.type === 'pdf' ? 'application/pdf' : undefined)
      } else if (Array.isArray(record?.message?.content)) {
        const imageBlock = record.message.content.find(
          (b): b is { type: 'image'; source: { type: string; media_type?: string; data?: string } } =>
            !!b && typeof b === 'object' && (b as { type?: unknown }).type === 'image',
        )
        if (imageBlock?.source?.type === 'base64') {
          b64 = imageBlock.source.data
          mediaType = imageBlock.source.media_type
        }
      }

      if (!b64) return c.json({ error: 'not_found' }, 404)
      return c.body(Buffer.from(b64, 'base64'), 200, { 'Content-Type': mediaType ?? 'application/octet-stream' })
    } catch {
      return c.json({ error: 'unreadable' }, 500)
    }
  })
}
