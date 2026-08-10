import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import type { StatsSeriesPoint } from '@shared/types.ts'
import { formatTokens } from '@shared/format.ts'

const chartConfig = {
  input: { label: 'Input', color: 'var(--chart-1)' },
  output: { label: 'Output', color: 'var(--chart-2)' },
  cacheRead: { label: 'Cache read', color: 'var(--chart-3)' },
  cacheWrite5m: { label: 'Cache write 5m', color: 'var(--chart-4)' },
  cacheWrite1h: { label: 'Cache write 1h', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function TokenBreakdownChart({ series }: { series: StatsSeriesPoint[] }) {
  const data = series.map((s) => ({ ...s, bucket: s.bucket.slice(5) }))

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: -20, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickCount={4} fontSize={11} tickFormatter={(v: number) => formatTokens(v)} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="input" stackId="tokens" fill="var(--color-input)" radius={0} />
        <Bar dataKey="output" stackId="tokens" fill="var(--color-output)" radius={0} />
        <Bar dataKey="cacheRead" stackId="tokens" fill="var(--color-cacheRead)" radius={0} />
        <Bar dataKey="cacheWrite5m" stackId="tokens" fill="var(--color-cacheWrite5m)" radius={0} />
        <Bar dataKey="cacheWrite1h" stackId="tokens" fill="var(--color-cacheWrite1h)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
