import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { StatsSeriesPoint } from '@shared/types.ts'
import { formatCost } from '@shared/format.ts'

const chartConfig = { cost: { label: 'Cost', color: 'var(--chart-1)' } } satisfies ChartConfig

export function CostOverTimeChart({ series }: { series: StatsSeriesPoint[] }) {
  const data = series.map((s) => ({ bucket: s.bucket.slice(5), cost: s.cost }))

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: -20, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickCount={4} fontSize={11} tickFormatter={(v: number) => formatCost(v)} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCost(Number(value))} />} />
        <Area dataKey="cost" type="monotone" fill="var(--color-cost)" fillOpacity={0.25} stroke="var(--color-cost)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  )
}
