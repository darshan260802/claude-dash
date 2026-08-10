import { formatCost } from '@shared/format.ts'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CostBadge({ cost, unknown, className }: { cost: number | null; unknown?: boolean; className?: string }) {
  if (cost == null || unknown) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className={cn('font-mono text-muted-foreground', className)} />}>—</TooltipTrigger>
        <TooltipContent>Cost unknown — no pricing data for this model</TooltipContent>
      </Tooltip>
    )
  }
  return <span className={cn('font-mono tabular-nums', className)}>{formatCost(cost)}</span>
}
