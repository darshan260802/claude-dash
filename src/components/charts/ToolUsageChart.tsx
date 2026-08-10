import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { StatsByTool } from '@shared/types.ts'

const chartConfig = {
  calls: { label: 'Calls', color: 'var(--chart-2)' },
  errors: { label: 'Errors', color: 'var(--destructive)' },
} satisfies ChartConfig

export function ToolUsageChart({ byTool }: { byTool: StatsByTool[] }) {
  const data = byTool.slice(0, 10).map((t) => ({ name: t.tool.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, ''), calls: t.calls - t.errors, errors: t.errors }))

  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No tool calls yet</div>
  }

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(220, data.length * 30) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130} fontSize={11} interval={0} />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent />} />
        <Bar dataKey="calls" stackId="t" fill="var(--color-calls)" radius={[0, 0, 0, 0]} barSize={14} />
        <Bar dataKey="errors" stackId="t" fill="var(--color-errors)" radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ChartContainer>
  )
}
