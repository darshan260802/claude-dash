import type { ToolUseBlockDTO } from '@shared/types.ts'
import { ToolHeader } from './ToolHeader'
import { ToolInputPreview } from './ToolInputPreview'
import { BashResultView } from './results/BashResultView'
import { EditResultView } from './results/EditResultView'
import { ReadResultView } from './results/ReadResultView'
import { AgentResultView } from './results/AgentResultView'
import { McpResultView } from './results/McpResultView'
import { AskUserQuestionView } from './results/AskUserQuestionView'
import { ExitPlanModeView } from './results/ExitPlanModeView'
import { TaskResultView } from './results/TaskResultView'
import { GenericResultView } from './results/GenericResultView'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function ToolCallCard({ block, session }: { block: ToolUseBlockDTO; session: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5">
      <ToolHeader block={block} />
      <ToolInputPreview block={block} />
      {block.result && (
        <ErrorBoundary fallbackLabel="Couldn't render this tool result.">
          <ResultBody block={block} session={session} />
        </ErrorBoundary>
      )}
    </div>
  )
}

function ResultBody({ block, session }: { block: ToolUseBlockDTO; session: string }) {
  const result = block.result!
  switch (result.kind) {
    case 'bash':
      return <BashResultView result={result} />
    case 'edit':
      return <EditResultView result={result} />
    case 'read':
      return <ReadResultView result={result} session={session} />
    case 'agent':
      return <AgentResultView block={block} session={session} />
    case 'mcp':
      return <McpResultView result={result} session={session} />
    case 'ask_user_question':
      return <AskUserQuestionView result={result} session={session} />
    case 'exit_plan_mode':
      return <ExitPlanModeView result={result} session={session} />
    case 'task':
      return <TaskResultView result={result} />
    default:
      return <GenericResultView result={result} session={session} />
  }
}
