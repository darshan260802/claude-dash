import type { TurnKind } from '@shared/types.ts'
import { ALL_TURN_KINDS } from '@/hooks/useFilterParams'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<TurnKind, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  attachment: 'Attachments',
  error: 'Errors',
  orphan_tool_result: 'Orphaned results',
  meta: 'Meta',
}

export function MessageFilterBar({ kinds, onChange }: { kinds: TurnKind[]; onChange: (kinds: TurnKind[]) => void }) {
  function toggle(kind: TurnKind) {
    if (kinds.includes(kind)) onChange(kinds.filter((k) => k !== kind))
    else onChange([...kinds, kind])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_TURN_KINDS.map((kind) => {
        const active = kinds.includes(kind)
        return (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {KIND_LABELS[kind]}
          </button>
        )
      })}
    </div>
  )
}
