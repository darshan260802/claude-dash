import type { ToolResultDTO } from '@shared/types.ts'
import { api } from '@/lib/api'

export function GenericResultView({ result, session }: { result: ToolResultDTO; session: string }) {
  if (!result.preview || result.preview.trim().length === 0) {
    return <p className="text-[11px] text-muted-foreground italic">{result.status === 'pending' ? 'Waiting for result…' : 'No output'}</p>
  }
  return (
    <div className="rounded-md border border-border bg-muted/30">
      <pre className="max-h-72 overflow-auto p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{result.preview}</pre>
      {result.truncated && result.ref && (
        <a
          href={api.rawBlockUrl(session, result.ref.byteOffset, result.ref.byteLength, result.ref.agentId)}
          target="_blank"
          rel="noreferrer"
          className="block border-t border-border px-2 py-1 text-[11px] text-primary hover:underline"
        >
          Show full output
        </a>
      )}
    </div>
  )
}
