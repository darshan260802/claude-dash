import { useState } from 'react'
import { CaretRight, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { CopyButton } from './CopyButton'

const COLLAPSE_LINE_THRESHOLD = 12

export function JsonViewer({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  const lines = text.split('\n')
  const collapsible = lines.length > COLLAPSE_LINE_THRESHOLD
  const [expanded, setExpanded] = useState(!collapsible)

  return (
    <div className={cn('group relative rounded-md border border-border bg-muted/40', className)}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center gap-1 border-b border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? <CaretDown className="size-3" /> : <CaretRight className="size-3" />}
          {expanded ? 'Collapse' : `Show all ${lines.length} lines`}
        </button>
      )}
      <div className="relative">
        <pre className={cn('overflow-x-auto p-2 font-mono text-[11px] leading-relaxed whitespace-pre', !expanded && 'max-h-48 overflow-y-hidden')}>
          {expanded ? text : lines.slice(0, COLLAPSE_LINE_THRESHOLD).join('\n')}
        </pre>
        <CopyButton text={text} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  )
}
