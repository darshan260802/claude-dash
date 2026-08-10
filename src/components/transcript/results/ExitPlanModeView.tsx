import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ToolResultDTO } from '@shared/types.ts'
import { GenericResultView } from './GenericResultView'

export function ExitPlanModeView({ result, session }: { result: ToolResultDTO; session: string }) {
  const raw = result.raw as { plan?: string } | undefined
  if (!raw?.plan) return <GenericResultView result={result} session={session} />

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border bg-muted/20 p-3 text-xs [&_pre]:text-[11px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw.plan}</ReactMarkdown>
    </div>
  )
}
