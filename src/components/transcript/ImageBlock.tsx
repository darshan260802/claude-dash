import type { TurnBlockDTO } from '@shared/types.ts'
import { api } from '@/lib/api'

export function ImageBlock({ block }: { block: Extract<TurnBlockDTO, { type: 'image' }> }) {
  const src = api.rawAttachmentUrl(block.ref.session, block.ref.byteOffset, block.ref.byteLength, block.ref.agentId)
  return (
    <a href={src} target="_blank" rel="noreferrer" className="inline-block">
      <img src={src} alt="" loading="lazy" className="max-h-72 max-w-full rounded-md border border-border object-contain" />
    </a>
  )
}
