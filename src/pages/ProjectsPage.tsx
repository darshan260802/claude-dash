import { Link } from 'react-router'
import { useProjects } from '@/hooks/useSessions'
import { Card, CardContent } from '@/components/ui/card'
import { formatCost, formatTokens } from '@shared/format.ts'
import { RelativeTime } from '@/components/common/RelativeTime'
import { ModelChip } from '@/components/common/ModelChip'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderOpen, ChatsCircle, Broadcast } from '@phosphor-icons/react'

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">Every project directory Claude Code has worked in.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!isLoading && (!projects || projects.length === 0) && (
        <EmptyState icon={FolderOpen} title="No projects indexed yet" description="Run Claude Code in a project directory and it will show up here." />
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects
            .slice()
            .sort((a, b) => b.cost - a.cost)
            .map((p) => (
              <Link key={p.key} to={`/projects/${encodeURIComponent(p.key)}`}>
                <Card className="h-full gap-0 py-0 transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-heading text-sm font-semibold">{p.name}</p>
                      {p.liveSessionCount > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-primary">
                          <Broadcast className="size-3" />
                          {p.liveSessionCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{p.cwd}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ChatsCircle className="size-3.5" />
                        {p.sessionCount} sessions
                      </span>
                      <span className="font-mono text-sm font-medium tabular-nums">{formatCost(p.costUnknown ? null : p.cost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatTokens(p.totals.input + p.totals.output + p.totals.cacheRead)} tokens</span>
                      <RelativeTime iso={p.lastActivity} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.models.slice(0, 3).map((m) => (
                        <ModelChip key={m} model={m} className="text-[10px]" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}
