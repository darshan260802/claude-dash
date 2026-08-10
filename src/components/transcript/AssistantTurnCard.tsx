import type { TurnDTO } from '@shared/types.ts'
import { TextBlock } from './TextBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'
import { ImageBlock } from './ImageBlock'
import { ModelChip } from '@/components/common/ModelChip'
import { CostBadge } from '@/components/common/CostBadge'
import { RelativeTime } from '@/components/common/RelativeTime'
import { Sparkle } from '@phosphor-icons/react'
import { JsonViewer } from '@/components/common/JsonViewer'

export function AssistantTurnCard({ turn, session, isSubagent }: { turn: TurnDTO; session: string; isSubagent?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkle className="size-3.5" weight="fill" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {isSubagent && <span className="rounded bg-muted px-1 py-0.5">sub-agent</span>}
          {turn.model && <ModelChip model={turn.model} className="text-[10px]" />}
          <RelativeTime iso={turn.timestamp} />
          {turn.usageCounted && turn.cost != null && <CostBadge cost={turn.cost} className="text-[10px]" />}
          {!turn.usageCounted && (
            <span className="italic" title="This turn's usage was already counted elsewhere (a resumed/forked session)">
              usage counted elsewhere
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {turn.blocks.map((block, i) => {
            switch (block.type) {
              case 'text':
                return <TextBlock key={i} block={block} session={session} />
              case 'thinking':
                return <ThinkingBlock key={i} block={block} />
              case 'tool_use':
                return <ToolCallCard key={i} block={block} session={session} />
              case 'image':
                return <ImageBlock key={i} block={block} />
              default:
                return <JsonViewer key={i} value={block.raw} className="text-[11px]" />
            }
          })}
        </div>
      </div>
    </div>
  )
}
