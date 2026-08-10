import { useState } from 'react'
import { CaretRight, CaretDown, Brain } from '@phosphor-icons/react'
import type { TurnBlockDTO } from '@shared/types.ts'

export function ThinkingBlock({ block }: { block: Extract<TurnBlockDTO, { type: 'thinking' }> }) {
  const [expanded, setExpanded] = useState(false)
  const hasText = block.text.trim().length > 0

  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
      >
        {expanded ? <CaretDown className="size-3" /> : <CaretRight className="size-3" />}
        <Brain className="size-3.5" />
        Thinking
      </button>
      {expanded && (
        <div className="border-t border-dashed border-border/70 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {hasText ? block.text : 'Thinking content was not summarized by the model for this turn.'}
        </div>
      )}
    </div>
  )
}
