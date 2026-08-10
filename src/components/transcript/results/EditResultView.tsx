import type { ToolResultDTO } from '@shared/types.ts'
import { DiffView } from '@/components/common/DiffView'
import { Badge } from '@/components/ui/badge'

export function EditResultView({ result }: { result: ToolResultDTO }) {
  const raw = result.raw as { userModified?: boolean } | undefined
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {result.filePath && <span className="truncate font-mono text-[11px] text-muted-foreground">{result.filePath}</span>}
        {raw?.userModified && (
          <Badge variant="outline" className="text-[10px]">
            user-modified since
          </Badge>
        )}
      </div>
      {result.structuredPatch ? (
        <DiffView patch={result.structuredPatch} />
      ) : (
        <p className="text-[11px] text-muted-foreground italic">No diff available for this edit.</p>
      )}
    </div>
  )
}
