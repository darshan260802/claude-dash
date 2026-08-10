import type { Liveness } from '@shared/types.ts'
import { cn } from '@/lib/utils'

const STYLES: Record<Liveness, { label: string; dot: string; text: string }> = {
  live: { label: 'Live', dot: 'bg-[oklch(0.65_0.19_142)]', text: 'text-[oklch(0.4_0.13_142)] dark:text-[oklch(0.75_0.17_142)]' },
  recent: { label: 'Recent', dot: 'bg-chart-4', text: 'text-chart-4' },
  ended: { label: 'Ended', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
}

export function LivenessPill({ liveness, className }: { liveness: Liveness; className?: string }) {
  const s = STYLES[liveness]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', s.text, className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', s.dot, liveness === 'live' && 'animate-pulse')} />
      {s.label}
    </span>
  )
}
