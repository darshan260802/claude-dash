import type { SessionDetailDTO } from '@shared/types.ts'
import { formatCost, formatTokens } from '@shared/format.ts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { RelativeTime } from '@/components/common/RelativeTime'
import { Robot, Wrench, WarningCircle } from '@phosphor-icons/react'

const USAGE_ROWS: { key: keyof SessionDetailDTO['totals']; label: string; colorClass: string }[] = [
  { key: 'input', label: 'Input', colorClass: 'bg-chart-1' },
  { key: 'output', label: 'Output', colorClass: 'bg-chart-2' },
  { key: 'cacheRead', label: 'Cache read', colorClass: 'bg-chart-3' },
  { key: 'cacheWrite5m', label: 'Cache write (5m)', colorClass: 'bg-chart-4' },
  { key: 'cacheWrite1h', label: 'Cache write (1h)', colorClass: 'bg-chart-5' },
]

export function SessionStatsRail({ session }: { session: SessionDetailDTO }) {
  const attrs = session.attributions
  const hasAttrs = attrs.mcpServers.length + attrs.skills.length + attrs.agents.length + attrs.plugins.length > 0

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground">Cost & usage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{formatCost(session.costUnknown ? null : session.cost)}</span>
            <span className="text-xs text-muted-foreground">{session.countedApiCalls} API calls</span>
          </div>
          <Separator />
          {USAGE_ROWS.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`size-1.5 rounded-full ${r.colorClass}`} />
                {r.label}
              </span>
              <span className="font-mono tabular-nums">{formatTokens(session.totals[r.key])}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground">Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wrench className="size-3.5" /> Tool calls
            </span>
            <span>{session.toolCallCount}</span>
          </div>
          {session.errorCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-destructive">
                <WarningCircle className="size-3.5" /> Errors
              </span>
              <span className="text-destructive">{session.errorCount}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last activity</span>
            <RelativeTime iso={session.lastAppendAt} />
          </div>
        </CardContent>
      </Card>

      {session.subagents.length > 0 && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Robot className="size-3.5" /> Sub-agents ({session.subagents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 px-4">
            {session.subagents.map((a) => (
              <div key={a.agentId} className="flex flex-col gap-0.5 rounded-md border border-border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.agentType ?? 'Agent'}</span>
                  <span className="font-mono text-muted-foreground">{formatCost(a.cost)}</span>
                </div>
                {a.description && <span className="truncate text-muted-foreground">{a.description}</span>}
                <span className="text-[10px] text-muted-foreground">{a.turnCount} turns</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasAttrs && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Used in this session</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 px-4">
            {attrs.mcpServers.map((s) => (
              <Badge key={`mcp-${s}`} variant="outline" className="text-[10px]">
                MCP: {s}
              </Badge>
            ))}
            {attrs.skills.map((s) => (
              <Badge key={`skill-${s}`} variant="outline" className="text-[10px]">
                skill: {s}
              </Badge>
            ))}
            {attrs.agents.map((s) => (
              <Badge key={`agent-${s}`} variant="outline" className="text-[10px]">
                agent: {s}
              </Badge>
            ))}
            {attrs.plugins.map((s) => (
              <Badge key={`plugin-${s}`} variant="outline" className="text-[10px]">
                plugin: {s}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
