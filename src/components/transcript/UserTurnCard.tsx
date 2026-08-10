import type { TurnDTO } from '@shared/types.ts'
import { User } from '@phosphor-icons/react'
import { RelativeTime } from '@/components/common/RelativeTime'
import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'

export function UserTurnCard({ turn, session }: { turn: TurnDTO; session: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <User className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <RelativeTime iso={turn.timestamp} className="text-[11px] text-muted-foreground" />
        <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2.5">
          {turn.blocks.map((block, i) => {
            if (block.type === 'text') return <TextBlock key={i} block={block} session={session} />
            if (block.type === 'image') return <ImageBlock key={i} block={block} />
            return null
          })}
        </div>
      </div>
    </div>
  )
}
