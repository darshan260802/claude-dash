import { cn } from '@/lib/utils'
import { useSessions } from '@/hooks/useSessions'
import ShinyText from '@/components/ShinyText'

export function LiveIndicator({ variant = 'full', className }: { variant?: 'full' | 'dot'; className?: string }) {
  const { data } = useSessions({ live: true })
  const count = data?.sessions.length ?? 0

  if (count === 0) return variant === 'full' ? null : null

  const dot = (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[oklch(0.65_0.19_142)] opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-[oklch(0.65_0.19_142)]" />
    </span>
  )

  if (variant === 'dot') {
    return <span className={cn('ml-auto', className)}>{dot}</span>
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium', className)}>
      {dot}
      <ShinyText
        text={`${count} live session${count === 1 ? '' : 's'}`}
        speed={2.5}
        color="oklch(0.4911 0.0904 37.5793)"
        shineColor="oklch(0.65 0.19 142)"
        className="text-xs font-medium"
      />
    </div>
  )
}
