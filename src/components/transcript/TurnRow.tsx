import type { TurnDTO } from '@shared/types.ts'
import { UserTurnCard } from './UserTurnCard'
import { AssistantTurnCard } from './AssistantTurnCard'
import { SystemTurnRow } from './SystemTurnRow'
import { AttachmentRow } from './AttachmentRow'
import { ApiErrorRow } from './ApiErrorRow'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function TurnRow({ turn, session, isSubagent }: { turn: TurnDTO; session: string; isSubagent?: boolean }) {
  return (
    <ErrorBoundary fallbackLabel="Couldn't render this message.">
      <TurnRowInner turn={turn} session={session} isSubagent={isSubagent} />
    </ErrorBoundary>
  )
}

function TurnRowInner({ turn, session, isSubagent }: { turn: TurnDTO; session: string; isSubagent?: boolean }) {
  switch (turn.kind) {
    case 'user':
      return <UserTurnCard turn={turn} session={session} />
    case 'assistant':
      return <AssistantTurnCard turn={turn} session={session} isSubagent={isSubagent} />
    case 'system':
      return <SystemTurnRow turn={turn} />
    case 'attachment':
      return <AttachmentRow turn={turn} />
    case 'error':
      return <ApiErrorRow turn={turn} />
    case 'orphan_tool_result':
      return (
        <div className="ml-9 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
          Orphaned tool result (originating call not found in this transcript window)
          {turn.blocks[0]?.type === 'text' && <pre className="mt-1 whitespace-pre-wrap">{turn.blocks[0].text}</pre>}
        </div>
      )
    default:
      return null
  }
}
