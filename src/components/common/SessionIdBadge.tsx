import { CopyButton } from '@/components/common/CopyButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** The session's UUID — also its transcript filename on disk
 * (~/.claude/projects/<project>/<uuid>.jsonl). Shown small and muted by
 * design: useful for matching a dashboard row to a file, not a headline
 * detail. The copy button only appears on hover so it doesn't compete for
 * attention with the rest of the row/header. */
export function SessionIdBadge({ id, className }: { id: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn('group/id inline-flex min-w-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/70', className)}>
            <span className="truncate">{id}</span>
            <CopyButton text={id} className="size-5 shrink-0 opacity-0 group-hover/id:opacity-100" />
          </span>
        }
      />
      <TooltipContent>Copy session ID — this is the transcript filename</TooltipContent>
    </Tooltip>
  )
}
