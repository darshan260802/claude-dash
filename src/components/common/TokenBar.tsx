import type { UsageTotals } from '@shared/types.ts'
import { formatTokens } from '@shared/format.ts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const SEGMENTS: { key: keyof UsageTotals; label: string; color: string }[] = [
  { key: 'input', label: 'Input', color: 'bg-chart-1' },
  { key: 'output', label: 'Output', color: 'bg-chart-2' },
  { key: 'cacheRead', label: 'Cache read', color: 'bg-chart-3' },
  { key: 'cacheWrite5m', label: 'Cache write (5m)', color: 'bg-chart-4' },
  { key: 'cacheWrite1h', label: 'Cache write (1h)', color: 'bg-chart-5' },
]

export function TokenBar({ totals, className }: { totals: UsageTotals; className?: string }) {
  const total = SEGMENTS.reduce((sum, s) => sum + totals[s.key], 0)
  if (total === 0) return <div className={className}>—</div>

  return (
    <div className={className}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {SEGMENTS.map((s) => {
          const value = totals[s.key]
          if (value === 0) return null
          const pct = (value / total) * 100
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger render={<div className={s.color} style={{ width: `${pct}%` }} />} />
              <TooltipContent>
                {s.label}: {formatTokens(value)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
