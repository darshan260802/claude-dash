import { Link } from 'react-router'
import type { SessionSummaryDTO } from '@shared/types.ts'
import { formatCost, formatDuration } from '@shared/format.ts'
import { Card, CardContent } from '@/components/ui/card'
import { LivenessPill } from '@/components/common/LivenessPill'
import { ModelChip } from '@/components/common/ModelChip'
import { RelativeTime } from '@/components/common/RelativeTime'

export function SessionCard({ session }: { session: SessionSummaryDTO }) {
  return (
    <Link to={`/sessions/${session.id}`}>
      <Card className="gap-0 py-0 transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <LivenessPill liveness={session.liveness} />
            <span className="text-[11px] text-muted-foreground">
              <RelativeTime iso={session.lastAppendAt} />
            </span>
          </div>
          <p className="line-clamp-2 text-sm font-medium">{session.title}</p>
          <p className="truncate text-xs text-muted-foreground">{session.projectName}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-1">
              {session.models.slice(0, 2).map((m) => (
                <ModelChip key={m} model={m} className="text-[10px]" />
              ))}
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatCost(session.costUnknown ? null : session.cost)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{session.turnCount} turns</span>
            <span>{formatDuration(session.durationMs)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
