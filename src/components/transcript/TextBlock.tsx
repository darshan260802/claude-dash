import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TurnBlockDTO } from '@shared/types.ts'
import { api } from '@/lib/api'

export function TextBlock({ block, session }: { block: Extract<TurnBlockDTO, { type: 'text' }>; session: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/60 [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:text-[0.85em]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
      {block.truncated && block.ref && (
        <a href={api.rawBlockUrl(session, block.ref.byteOffset, block.ref.byteLength)} target="_blank" rel="noreferrer" className="text-xs no-underline">
          Show full message ({block.fullBytes ? `${Math.round(block.fullBytes / 1024)}KB` : 'truncated'})
        </a>
      )}
    </div>
  )
}
