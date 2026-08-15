import { useState } from 'react'
import { Link } from 'react-router'
import { CaretRight, CaretDown, Robot, ArrowSquareOut } from '@phosphor-icons/react'
import type { ToolUseBlockDTO } from '@shared/types.ts'
import { formatCost } from '@shared/format.ts'
import { SubagentThread } from '../SubagentThread'

export function AgentResultView({ block, session }: { block: ToolUseBlockDTO; session: string }) {
  const [expanded, setExpanded] = useState(false)
  const ref = block.subagentRef

  if (!ref) {
    return <p className="text-[11px] text-muted-foreground italic">{block.result?.status === 'pending' ? 'Agent running…' : 'No sub-agent transcript found.'}</p>
  }

  return (
    <div className="rounded-md border border-border">
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex w-full items-center gap-2 p-2 text-left hover:bg-muted/40">
        {expanded ? <CaretDown className="size-3.5 shrink-0 text-muted-foreground" /> : <CaretRight className="size-3.5 shrink-0 text-muted-foreground" />}
        <Robot className="size-4 shrink-0 text-chart-5" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium">{ref.agentType ?? 'Agent'}</span>
          {ref.description && <span className="truncate text-[11px] text-muted-foreground">{ref.description}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span>{ref.turnCount} turns</span>
          <span className="font-mono">{formatCost(ref.cost)}</span>
        </div>
      </button>
      {expanded && (
        <>
          <SubagentThread sessionId={session} agentId={ref.agentId} />
          <Link
            to={`/sessions/${session}/agents/${ref.agentId}`}
            className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11px] text-primary hover:underline"
          >
            <ArrowSquareOut className="size-3" />
            Open full transcript
          </Link>
        </>
      )}
    </div>
  )
}
