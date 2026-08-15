import type { ToolResultDTO } from '@shared/types.ts'
import { api } from '@/lib/api'

export function ReadResultView({ result, session }: { result: ToolResultDTO; session: string }) {
  const lines = (result.preview ?? '').split('\n')

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {result.filePath && <div className="truncate border-b border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">{result.filePath}</div>}
      <pre className="max-h-72 overflow-auto p-0 font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-muted/40">
            <span className="w-10 shrink-0 select-none border-r border-border px-2 text-right text-muted-foreground/60">{i + 1}</span>
            <span className="whitespace-pre px-2">{line}</span>
          </div>
        ))}
      </pre>
      {result.truncated && result.ref && (
        <a
          href={api.rawBlockUrl(session, result.ref.byteOffset, result.ref.byteLength, result.ref.agentId)}
          target="_blank"
          rel="noreferrer"
          className="block border-t border-border px-2 py-1 text-[11px] text-primary hover:underline"
        >
          Show full file ({result.fullBytes ? `${Math.round(result.fullBytes / 1024)}KB` : 'truncated'})
        </a>
      )}
    </div>
  )
}
