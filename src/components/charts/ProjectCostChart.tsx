import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { StatsByProject } from '@shared/types.ts'
import { formatCost } from '@shared/format.ts'

const chartConfig = { cost: { label: 'Cost', color: 'var(--chart-1)' } } satisfies ChartConfig

export function ProjectCostChart({ byProject }: { byProject: StatsByProject[] }) {
  const data = byProject.slice(0, 8).map((p) => ({ name: p.projectName, cost: p.cost }))

  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
  }

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(220, data.length * 34) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => formatCost(v)} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} fontSize={11} interval={0} />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent formatter={(value) => formatCost(Number(value))} />} />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ChartContainer>
  )
}
