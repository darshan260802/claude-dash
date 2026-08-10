import type { ToolUseBlockDTO } from '@shared/types.ts'

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function ToolInputPreview({ block }: { block: ToolUseBlockDTO }) {
  const input = (block.input ?? {}) as Record<string, unknown>

  switch (block.name) {
    case 'Bash':
      return <code className="block truncate rounded bg-muted/60 px-2 py-1 font-mono text-[11px]">{str(input.command) ?? ''}</code>
    case 'Read':
    case 'Write':
    case 'Edit':
      return <span className="block truncate font-mono text-[11px] text-muted-foreground">{str(input.file_path) ?? ''}</span>
    case 'WebFetch':
    case 'WebSearch':
      return <span className="block truncate text-[11px] text-muted-foreground">{str(input.url) ?? str(input.query) ?? ''}</span>
    case 'AskUserQuestion':
    case 'ExitPlanMode':
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'Agent':
    case 'Task':
      return null
    default: {
      const entries = Object.entries(input)
      if (entries.length === 0) return null
      const summary = entries
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ')
      return <span className="block truncate text-[11px] text-muted-foreground">{summary}</span>
    }
  }
}
