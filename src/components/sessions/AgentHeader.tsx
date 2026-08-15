import { Link } from 'react-router'
import type { SubagentDetailDTO } from '@shared/types.ts'
import { formatDuration } from '@shared/format.ts'
import { CaretLeft, FolderOpen, Robot } from '@phosphor-icons/react'
import { LivenessPill } from '@/components/common/LivenessPill'
import { RelativeTime } from '@/components/common/RelativeTime'
import { SessionIdBadge } from '@/components/common/SessionIdBadge'
import { ShareButton } from '@/components/share/ShareButton'

export function AgentHeader({ detail }: { detail: SubagentDetailDTO }) {
  const durationMs = detail.endedAt && detail.startedAt ? Math.max(0, Date.parse(detail.endedAt) - Date.parse(detail.startedAt)) : 0

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex items-center justify-between gap-2">
        {/* Link only when the viewer can actually reach the parent —
         * sharing this agent alone sets parentAccessible false, and the
         * server enforces that independently; this just avoids offering a
         * link that would 403. */}
        {detail.parentAccessible ? (
          <Link to={`/sessions/${detail.sessionId}`} className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
            <CaretLeft className="size-3" />
            {detail.parentTitle}
          </Link>
        ) : (
          <span className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
            <CaretLeft className="size-3" />
            {detail.parentTitle}
          </span>
        )}
        <ShareButton sessionId={detail.sessionId} agentId={detail.agentId} />
      </div>
      <LivenessPill liveness={detail.liveness} />
      <h1 className="flex items-center gap-2 font-heading text-xl font-semibold">
        <Robot className="size-5 text-chart-5" />
        {detail.agentType ?? 'Agent'}
      </h1>
      {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
      <SessionIdBadge id={detail.agentId} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FolderOpen className="size-3.5" />
          {detail.projectName}
        </span>
        {detail.startedAt && (
          <span>
            Started <RelativeTime iso={detail.startedAt} />
          </span>
        )}
        {durationMs > 0 && <span>{formatDuration(durationMs)} elapsed</span>}
        <span>{detail.turnCount} turns</span>
      </div>
    </div>
  )
}
