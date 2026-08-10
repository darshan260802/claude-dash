import type { ToolUseBlockDTO } from '@shared/types.ts'
import { metaForTool } from '@/lib/toolMeta'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, CircleNotch, ProhibitInset } from '@phosphor-icons/react'

const STATUS_ICON = {
  ok: CheckCircle,
  error: XCircle,
  pending: CircleNotch,
  denied: ProhibitInset,
} as const

// Tailwind's scanner needs complete literal class strings — `text-${token}`
// interpolation would never be picked up by the JIT compiler, so every token
// toolMeta.ts can produce is mapped to its full class name here.
const COLOR_CLASS: Record<string, string> = {
  'chart-1': 'text-chart-1',
  'chart-2': 'text-chart-2',
  'chart-3': 'text-chart-3',
  'chart-4': 'text-chart-4',
  'chart-5': 'text-chart-5',
  'muted-foreground': 'text-muted-foreground',
}

export function ToolHeader({ block }: { block: ToolUseBlockDTO }) {
  const meta = metaForTool(block.name)
  const status = block.result?.status ?? 'pending'
  const StatusIcon = STATUS_ICON[status]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <meta.icon className={`size-4 shrink-0 ${COLOR_CLASS[meta.colorToken] ?? 'text-muted-foreground'}`} />
      <span className="text-xs font-medium">{block.isMcp ? block.mcpTool : meta.label}</span>
      {block.isMcp && (
        <Badge variant="outline" className="text-[10px]">
          MCP: {block.mcpServer}
        </Badge>
      )}
      <StatusIcon
        className={`size-3.5 shrink-0 ${status === 'error' ? 'text-destructive' : status === 'pending' ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'}`}
      />
    </div>
  )
}
