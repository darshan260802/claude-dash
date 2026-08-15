import { Link } from 'react-router'
import type { SessionDetailDTO } from '@shared/types.ts'
import { formatDuration } from '@shared/format.ts'
import { GitBranch, FolderOpen } from '@phosphor-icons/react'
import { LivenessPill } from '@/components/common/LivenessPill'
import { ModelChip } from '@/components/common/ModelChip'
import { RelativeTime } from '@/components/common/RelativeTime'
import { SessionIdBadge } from '@/components/common/SessionIdBadge'
import { Badge } from '@/components/ui/badge'
import { ShareButton } from '@/components/share/ShareButton'

export function SessionHeader({ session }: { session: SessionDetailDTO }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <LivenessPill liveness={session.liveness} />
        {session.forkOf && (
          <Badge variant="outline" className="text-[10px]">
            forked · usage attributed to parent session
          </Badge>
        )}
        <div className="ml-auto">
          <ShareButton sessionId={session.id} />
        </div>
      </div>
      <h1 className="font-heading text-xl font-semibold">{session.title}</h1>
      <SessionIdBadge id={session.id} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <Link to={`/projects/${encodeURIComponent(session.projectKey)}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
          <FolderOpen className="size-3.5" />
          {session.projectName}
        </Link>
        {session.gitBranch && (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="size-3.5" />
            {session.gitBranch}
          </span>
        )}
        <span>
          Started <RelativeTime iso={session.startedAt} />
        </span>
        <span>{formatDuration(session.durationMs)} elapsed</span>
        {session.version && <span>Claude Code v{session.version}</span>}
        <div className="flex gap-1">
          {session.models.map((m) => (
            <ModelChip key={m} model={m} className="text-[10px]" />
          ))}
        </div>
      </div>
    </div>
  )
}
