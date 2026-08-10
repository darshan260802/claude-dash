import type { TurnDTO } from '@shared/types.ts'
import { Terminal, Clock, Scissors, Info } from '@phosphor-icons/react'
import { formatDuration } from '@shared/format.ts'
import { RelativeTime } from '@/components/common/RelativeTime'

export function SystemTurnRow({ turn }: { turn: TurnDTO }) {
  if (turn.subtype === 'compact_boundary') {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <Scissors className="size-3" />
        <span>Context compacted</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  if (turn.subtype === 'turn_duration') {
    return (
      <div className="ml-9 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <Clock className="size-3" />
        {turn.durationMs != null ? formatDuration(turn.durationMs) : null}
        {turn.content && <span className="ml-1 truncate">turn</span>}
      </div>
    )
  }

  if (turn.subtype === 'local_command') {
    return (
      <div className="ml-9 flex items-start gap-1.5 rounded-md bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        <Terminal className="mt-0.5 size-3 shrink-0" />
        <span className="whitespace-pre-wrap">{stripTags(turn.content)}</span>
      </div>
    )
  }

  return (
    <div className="ml-9 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Info className="size-3" />
      <span className="truncate">{turn.content ?? turn.subtype ?? 'system event'}</span>
      <RelativeTime iso={turn.timestamp} className="ml-auto text-[10px]" />
    </div>
  )
}

function stripTags(content: string | undefined): string {
  if (!content) return ''
  return content.replace(/<[^>]+>/g, '').trim() || content
}
