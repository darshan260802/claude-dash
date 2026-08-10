import { useParams } from 'react-router'
import { useProject } from '@/hooks/useSessions'
import { useSessions } from '@/hooks/useSessions'
import { useStats } from '@/hooks/useStats'
import { StatTile } from '@/components/common/StatTile'
import { SessionTable } from '@/components/sessions/SessionTable'
import { ModelSplitChart } from '@/components/charts/ModelSplitChart'
import { CostOverTimeChart } from '@/components/charts/CostOverTimeChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost, formatTokens } from '@shared/format.ts'
import { CurrencyDollar, Coins, ChatsCircle, Broadcast } from '@phosphor-icons/react'
import { Skeleton } from '@/components/ui/skeleton'

export function ProjectDetailPage() {
  const { projectKey } = useParams<{ projectKey: string }>()
  const { data: project, isLoading } = useProject(projectKey)
  const { data: sessions } = useSessions({ project: projectKey })
  const { data: stats } = useStats({ project: projectKey, groupBy: 'day' })

  if (isLoading || !project) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{project.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{project.cwd}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total cost" value={formatCost(project.costUnknown ? null : project.cost)} icon={<CurrencyDollar className="size-5" />} />
        <StatTile label="Tokens" value={formatTokens(project.totals.input + project.totals.output + project.totals.cacheRead)} icon={<Coins className="size-5" />} />
        <StatTile label="Sessions" value={project.sessionCount} icon={<ChatsCircle className="size-5" />} />
        <StatTile label="Live now" value={project.liveSessionCount} icon={<Broadcast className="size-5" />} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost over time</CardTitle>
            </CardHeader>
            <CardContent>
              <CostOverTimeChart series={stats.series} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost by model</CardTitle>
            </CardHeader>
            <CardContent>
              <ModelSplitChart byModel={stats.byModel} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-semibold">Sessions</h2>
        <SessionTable sessions={sessions?.sessions ?? []} showProject={false} />
      </div>
    </div>
  )
}
