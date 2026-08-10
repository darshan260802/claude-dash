import type { TurnDTO } from '@shared/types.ts'
import { WarningCircle } from '@phosphor-icons/react'

export function ApiErrorRow({ turn }: { turn: TurnDTO }) {
  const text = turn.blocks.find((b) => b.type === 'text')
  return (
    <div className="ml-9 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
      <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
      <span className="whitespace-pre-wrap">{text && text.type === 'text' ? text.text : 'API error'}</span>
    </div>
  )
}
