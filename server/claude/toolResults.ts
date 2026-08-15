import type { ToolResultDTO } from '@shared/types.ts'

export const INLINE_BLOCK_LIMIT = 24 * 1024 // 24KB

export interface TruncateResult {
  text: string
  truncated: boolean
  fullBytes: number
}

/** Truncate a string to INLINE_BLOCK_LIMIT bytes (UTF-8 aware, truncates on a
 * safe boundary), used for every large text/thinking/tool_result block kept
 * in the in-memory index. The full content stays recoverable via
 * /api/raw/block using the source line's byte offset. */
export function truncateText(text: string, limit = INLINE_BLOCK_LIMIT): TruncateResult {
  const fullBytes = Buffer.byteLength(text, 'utf8')
  if (fullBytes <= limit) return { text, truncated: false, fullBytes }
  // Binary-search-free approximate cut: slice by char count first (JS strings
  // are UTF-16, so this over-estimates for ASCII-heavy text, which is fine —
  // we just re-check and back off in a small loop).
  let end = Math.min(text.length, limit)
  while (end > 0 && Buffer.byteLength(text.slice(0, end), 'utf8') > limit) {
    end -= 64
  }
  return { text: text.slice(0, Math.max(0, end)), truncated: true, fullBytes }
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: unknown }).text === 'string') {
          return (c as { text: string }).text
        }
        return typeof c === 'string' ? c : JSON.stringify(c)
      })
      .join('\n')
  }
  if (content == null) return ''
  return JSON.stringify(content, null, 2)
}

export interface NormalizeContext {
  session: string
  byteOffset: number
  byteLength: number
  agentId?: string
}

/** Classify a tool by name into a display "kind" — drives which ToolResultView
 * component the frontend renders, and which icon/color server/claude data
 * associates with it. */
export function toolKind(name: string): string {
  if (name.startsWith('mcp__')) return 'mcp'
  switch (name) {
    case 'Bash':
      return 'bash'
    case 'Edit':
    case 'Write':
      return 'edit'
    case 'Read':
      return 'read'
    case 'TaskCreate':
    case 'TaskUpdate':
      return 'task'
    case 'Agent':
    case 'Task':
      return 'agent'
    case 'AskUserQuestion':
      return 'ask_user_question'
    case 'ExitPlanMode':
      return 'exit_plan_mode'
    case 'WebFetch':
    case 'WebSearch':
      return 'web'
    default:
      return 'generic'
  }
}

export function parseMcpTool(name: string): { server: string; tool: string } | null {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/.exec(name)
  if (!m) return null
  return { server: m[1], tool: m[2] }
}

/** Build the DTO shown under a tool_use block. `toolUseResult` is the raw
 * structured extra the `user`-type record carries alongside the plain
 * `tool_result` content block (shape varies wildly per tool — see
 * shared/records.ts doc comment). `resultBlock` is the matched tool_result
 * content block itself, when present (absent for tool calls still pending). */
export function normalizeToolResult(
  toolName: string,
  resultBlock: { content: string | unknown[]; is_error?: boolean } | undefined,
  toolUseResult: unknown,
  ctx: NormalizeContext,
): ToolResultDTO {
  const kind = toolKind(toolName)
  const isError = resultBlock?.is_error === true
  const tur = (toolUseResult ?? {}) as Record<string, unknown>

  const base: ToolResultDTO = {
    status: resultBlock == null ? 'pending' : isError ? 'error' : 'ok',
    kind,
    isError,
    ref: { session: ctx.session, byteOffset: ctx.byteOffset, byteLength: ctx.byteLength, agentId: ctx.agentId },
  }

  if (kind === 'bash') {
    const stdout = typeof tur.stdout === 'string' ? tur.stdout : undefined
    const stderr = typeof tur.stderr === 'string' ? tur.stderr : undefined
    const t = truncateText(stdout ?? '')
    return {
      ...base,
      stdout: t.text,
      stderr: stderr ? truncateText(stderr).text : undefined,
      interrupted: tur.interrupted === true,
      truncated: t.truncated,
      fullBytes: t.fullBytes,
    }
  }

  if (kind === 'edit') {
    return {
      ...base,
      filePath: typeof tur.filePath === 'string' ? tur.filePath : undefined,
      structuredPatch: tur.structuredPatch,
      raw: { userModified: tur.userModified === true, oldString: tur.oldString, newString: tur.newString },
    }
  }

  if (kind === 'read') {
    const content = typeof tur.content === 'string' ? tur.content : stringifyContent(resultBlock?.content)
    const t = truncateText(content)
    return {
      ...base,
      filePath: typeof tur.file === 'object' && tur.file ? (tur.file as { filePath?: string }).filePath : undefined,
      preview: t.text,
      truncated: t.truncated,
      fullBytes: t.fullBytes,
    }
  }

  // Generic / task / agent / ask_user_question / exit_plan_mode / mcp / web:
  // preview from the plain tool_result content, structured extras kept as raw.
  const contentText = resultBlock ? stringifyContent(resultBlock.content) : ''
  const t = truncateText(contentText)
  return {
    ...base,
    preview: t.text,
    truncated: t.truncated,
    fullBytes: t.fullBytes,
    raw: toolUseResult,
  }
}
