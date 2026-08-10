import { useMemo } from 'react'
import { Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { StatsByModel } from '@shared/types.ts'
import { modelShortName } from '@/components/common/ModelChip'
import { formatCost } from '@shared/format.ts'

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function ModelSplitChart({ byModel }: { byModel: StatsByModel[] }) {
  const { data, config, total } = useMemo(() => {
    const top = byModel.slice(0, 5)
    const rest = byModel.slice(5)
    const restCost = rest.reduce((s, m) => s + m.cost, 0)
    const rows = restCost > 0 ? [...top, { model: 'other', calls: rest.reduce((s, m) => s + m.calls, 0), cost: restCost, input: 0, output: 0, cacheRead: 0 }] : top

    const cfg: ChartConfig = { cost: { label: 'Cost' } }
    const rowsWithFill = rows.map((m, i) => {
      const key = m.model.replace(/[^a-zA-Z0-9]/g, '_')
      cfg[key] = { label: modelShortName(m.model), color: PALETTE[i % PALETTE.length] }
      return { key, label: modelShortName(m.model), cost: m.cost, fill: PALETTE[i % PALETTE.length] }
    })
    return { data: rowsWithFill, config: cfg, total: rows.reduce((s, m) => s + m.cost, 0) }
  }, [byModel])

  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No priced usage yet</div>
  }

  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => formatCost(Number(value))} />} />
        <Pie data={data} dataKey="cost" nameKey="key" innerRadius={55} strokeWidth={4}>
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-semibold">
            {formatCost(total)}
          </text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
            total cost
          </text>
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
