import { Link } from 'react-router'
import { useStats } from '@/hooks/useStats'
import { useSessions } from '@/hooks/useSessions'
import { StatTile } from '@/components/common/StatTile'
import { CostOverTimeChart } from '@/components/charts/CostOverTimeChart'
import { TokenBreakdownChart } from '@/components/charts/TokenBreakdownChart'
import { ModelSplitChart } from '@/components/charts/ModelSplitChart'
import { ProjectCostChart } from '@/components/charts/ProjectCostChart'
import { ToolUsageChart } from '@/components/charts/ToolUsageChart'
import { SessionTable } from '@/components/sessions/SessionTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost, formatTokens } from '@shared/format.ts'
import { CurrencyDollar, Coins, Lightning, ChatsCircle, FolderOpen, Broadcast } from '@phosphor-icons/react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import CountUp from '@/components/CountUp'
import { useGsapStagger } from '@/hooks/useGsapPageTransition'

export function DashboardPage() {
  const { data: stats, isLoading } = useStats({ groupBy: 'day' })
  const { data: recentSessions } = useSessions({ limit: 6 })
  const tileGridRef = useGsapStagger<HTMLDivElement>([isLoading])

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  const cacheTotal = stats.totals.cacheRead + stats.totals.input
  const cacheHitRate = cacheTotal > 0 ? (stats.totals.cacheRead / cacheTotal) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Everything Claude Code has done, tracked locally.</p>
      </div>

      <div ref={tileGridRef} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total cost" value={formatCost(stats.totals.cost)} icon={<CurrencyDollar className="size-5" />} />
        <StatTile label="Total tokens" value={formatTokens(stats.totals.input + stats.totals.output + stats.totals.cacheRead)} icon={<Coins className="size-5" />} />
        <StatTile label="API calls" value={<CountUp to={stats.totals.apiCalls} duration={1} separator="," />} icon={<Lightning className="size-5" />} />
        <StatTile
          label="Sessions"
          value={<CountUp to={stats.totals.sessions} duration={1} separator="," />}
          sub={`${stats.totals.projects} projects`}
          icon={<ChatsCircle className="size-5" />}
        />
        <StatTile label="Cache hit rate" value={`${cacheHitRate.toFixed(0)}%`} sub={`${formatTokens(stats.totals.cacheRead)} cached`} icon={<Lightning className="size-5" />} />
        <StatTile label="Live now" value={recentSessions?.sessions.filter((s) => s.liveness !== 'ended').length ?? 0} icon={<Broadcast className="size-5" />} />
        <StatTile label="Avg cost / session" value={formatCost(stats.totals.sessions > 0 ? stats.totals.cost / stats.totals.sessions : 0)} icon={<CurrencyDollar className="size-5" />} />
        <StatTile label="Projects" value={stats.totals.projects} icon={<FolderOpen className="size-5" />} />
      </div>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Token breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenBreakdownChart series={stats.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cost by project</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectCostChart byProject={stats.byProject} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tool usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ToolUsageChart byTool={stats.byTool} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">Recent sessions</h2>
          <Button variant="ghost" size="sm" render={<Link to="/sessions" />} nativeButton={false}>
            View all
          </Button>
        </div>
        <SessionTable sessions={recentSessions?.sessions ?? []} />
      </div>
    </div>
  )
}
