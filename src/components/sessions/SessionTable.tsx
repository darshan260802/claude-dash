import { Link } from 'react-router'
import type { SessionSummaryDTO } from '@shared/types.ts'
import { formatCost, formatTokens } from '@shared/format.ts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LivenessPill } from '@/components/common/LivenessPill'
import { ModelChip } from '@/components/common/ModelChip'
import { TokenBar } from '@/components/common/TokenBar'
import { RelativeTime } from '@/components/common/RelativeTime'
import { SessionIdBadge } from '@/components/common/SessionIdBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { ChatsCircle, Robot, Wrench } from '@phosphor-icons/react'

export function SessionTable({ sessions, showProject = true }: { sessions: SessionSummaryDTO[]; showProject?: boolean }) {
  if (sessions.length === 0) {
    return <EmptyState icon={ChatsCircle} title="No sessions found" description="Try adjusting your filters, or start a Claude Code session." />
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Status</TableHead>
            <TableHead>Session</TableHead>
            {showProject && <TableHead>Project</TableHead>}
            <TableHead>Models</TableHead>
            <TableHead className="w-40">Tokens</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id} className="group">
              <TableCell>
                <LivenessPill liveness={s.liveness} />
              </TableCell>
              <TableCell className="max-w-[280px]">
                <Link to={`/sessions/${s.id}`} className="block truncate font-medium text-foreground hover:underline">
                  {s.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                  <SessionIdBadge id={s.id} />
                  <span className="inline-flex items-center gap-1">
                    <ChatsCircle className="size-3" />
                    {s.turnCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="size-3" />
                    {s.toolCallCount}
                  </span>
                  {s.subagentCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Robot className="size-3" />
                      {s.subagentCount}
                    </span>
                  )}
                  {s.forkOf && <span className="rounded bg-muted px-1 py-0.5">forked</span>}
                </div>
              </TableCell>
              {showProject && (
                <TableCell>
                  <Link to={`/projects/${encodeURIComponent(s.projectKey)}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    {s.projectName}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {s.models.map((m) => (
                    <ModelChip key={m} model={m} className="text-[10px]" />
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <TokenBar totals={s.totals} />
                <div className="mt-1 text-[10px] text-muted-foreground">{formatTokens(s.totals.input + s.totals.output + s.totals.cacheRead)} tok</div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{formatCost(s.costUnknown ? null : s.cost)}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                <RelativeTime iso={s.lastAppendAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
