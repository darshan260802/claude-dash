import type { ToolResultDTO } from '@shared/types.ts'
import { GenericResultView } from './GenericResultView'

interface AskUserQuestionRaw {
  questions?: { question?: string; header?: string; options?: { label?: string }[] }[]
  answers?: Record<string, string>
}

export function AskUserQuestionView({ result, session }: { result: ToolResultDTO; session: string }) {
  const raw = result.raw as AskUserQuestionRaw | undefined
  if (!raw?.questions?.length) return <GenericResultView result={result} session={session} />

  return (
    <div className="flex flex-col gap-2">
      {raw.questions.map((q, i) => {
        const answer = raw.answers?.[q.question ?? ''] ?? raw.answers?.[q.header ?? '']
        return (
          <div key={i} className="rounded-md border border-border p-2 text-xs">
            <p className="font-medium">{q.question}</p>
            {answer && (
              <p className="mt-1 flex items-center gap-1.5 text-[oklch(0.4_0.13_142)] dark:text-[oklch(0.75_0.17_142)]">
                <span className="text-muted-foreground">→</span> {answer}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
